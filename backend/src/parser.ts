import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import fs from "fs";
import path from "path";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

const SYSTEM_PROMPT = `You are a receipt parser. Extract structured data from receipt images.

Return ONLY a valid JSON object with this exact shape:
{
  "merchant": "Store name",
  "date": "YYYY-MM-DD or empty string if unclear",
  "lineItems": [
    { "name": "Item name", "amount": 9.99 }
  ],
  "subtotal": 12.50 or null,
  "tax": 1.50 or null,
  "tip": null or a number,
  "total": 14.00,
  "confidence": "high" | "medium" | "low",
  "notes": null or a string explaining issues
}

Rules:
- lineItems: include only individual purchased items/services. Do NOT include subtotal, tax, tip, or total as line items — those belong in their dedicated fields.
- amounts: always positive numbers (discounts can be negative).
- date: ISO format YYYY-MM-DD. Use empty string "" if unreadable.
- confidence:
    "high" = clear image, all fields readable
    "medium" = some fields uncertain or partially legible
    "low" = blurry, faded, or significant data missing
- notes: if confidence < high, briefly explain what's unclear or missing. null otherwise.
- If a field genuinely cannot be determined, use null (numbers) or "" (strings).
- Never guess amounts; prefer null over wrong numbers.
- Return ONLY the JSON. No markdown, no explanation, no backticks.`;

export async function parseReceiptImage(
  imagePath: string
): Promise<ParsedReceipt> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === ".png" ? "image/png" : "image/jpeg";

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: "text",
            text: "Parse this receipt and return the JSON.",
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Strip any accidental markdown fences
  const cleaned = text.replace(/```json|```/gi, "").trim();

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `LLM returned non-JSON response. Raw output: ${text.slice(0, 200)}`
    );
  }

  const result = ParsedReceiptSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `LLM response failed schema validation: ${result.error.message}`
    );
  }

  return result.data;
}
