import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || "");

const LineItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
});

const ParsedReceiptSchema = z.object({
  merchant: z.string(),
  date: z.string(),
  lineItems: z.array(LineItemSchema),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  tip: z.number().nullable(),
  total: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().nullable(),
});

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;

const PROMPT = `You are a receipt parser. Extract structured data from this receipt image.

Return ONLY a valid JSON object with this exact shape:
{
  "merchant": "Store name",
  "date": "YYYY-MM-DD or empty string if unclear",
  "lineItems": [
    { "name": "Item name", "amount": 9.99 }
  ],
  "subtotal": 12.50,
  "tax": 1.50,
  "tip": null,
  "total": 14.00,
  "confidence": "high",
  "notes": null
}

Rules:
- lineItems: only individual purchased items. Do NOT include subtotal, tax, tip, or total as line items.
- amounts: always positive numbers (discounts can be negative).
- date: ISO format YYYY-MM-DD. Use empty string if unreadable.
- confidence: "high" = clear image, "medium" = some fields uncertain, "low" = blurry or data missing.
- notes: briefly explain issues if confidence < high, else null.
- Use null for unknown numbers, empty string for unknown strings.
- Return ONLY the JSON. No markdown, no explanation, no backticks.`;

export async function parseReceiptImage(imagePath: string): Promise<ParsedReceipt> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent([
    PROMPT,
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]);

  const text = result.response.text();
  const cleaned = text.replace(/```json|```/gi, "").trim();

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned non-JSON response. Raw output: ${text.slice(0, 200)}`);
  }

  const parsed = ParsedReceiptSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`LLM response failed schema validation: ${parsed.error.message}`);
  }

  return parsed.data;
}