
import { rowToReceipt } from "../db";

describe("rowToReceipt", () => {
  const baseRow = {
    id: "1",
    merchant: "Sharma General Store",
    date: "2026-05-08",
    line_items: JSON.stringify([{ name: "Namkeen", amount: 20 }]),
    subtotal: "20",
    tax: "2",
    tip: null,
    total: "22",
    confidence: "high",
    raw_image_path: "abc123.jpg",
    notes: null,
    created_at: "2026-05-08T10:00:00",
    updated_at: "2026-05-08T10:00:00",
  };

  it("coerces string numerics to numbers", () => {
    const receipt = rowToReceipt(baseRow);
    expect(typeof receipt.total).toBe("number");
    expect(receipt.total).toBe(22);
    expect(receipt.subtotal).toBe(20);
    expect(receipt.tax).toBe(2);
  });

  it("handles null numeric fields correctly", () => {
    const receipt = rowToReceipt({ ...baseRow, tip: null, subtotal: null });
    expect(receipt.tip).toBeNull();
    expect(receipt.subtotal).toBeNull();
  });

  it("parses line_items JSON string into array", () => {
    const receipt = rowToReceipt(baseRow);
    expect(Array.isArray(receipt.lineItems)).toBe(true);
    expect(receipt.lineItems[0].name).toBe("Namkeen");
    expect(receipt.lineItems[0].amount).toBe(20);
  });

  it("handles empty line_items gracefully", () => {
    const receipt = rowToReceipt({ ...baseRow, line_items: "[]" });
    expect(receipt.lineItems).toEqual([]);
  });

  it("maps snake_case DB columns to camelCase", () => {
    const receipt = rowToReceipt(baseRow);
    expect(receipt.rawImagePath).toBe("abc123.jpg");
    expect(receipt.createdAt).toBe("2026-05-08T10:00:00");
  });

  it("returns correct confidence level", () => {
    expect(rowToReceipt({ ...baseRow, confidence: "high" }).confidence).toBe("high");
    expect(rowToReceipt({ ...baseRow, confidence: "medium" }).confidence).toBe("medium");
    expect(rowToReceipt({ ...baseRow, confidence: "low" }).confidence).toBe("low");
  });
});

// ─── LLM response parsing (inline, no real API call) ─────────────────────────

// We extract just the parsing + validation logic so we can unit test it
// without calling the actual Anthropic API.

import { z } from "zod";

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

function parseLLMResponse(raw: string) {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  const parsed = JSON.parse(cleaned); // throws if not JSON
  return ParsedReceiptSchema.parse(parsed); // throws if schema invalid
}

describe("parseLLMResponse", () => {
  const validResponse = {
    merchant: "Sharma General Store",
    date: "2026-05-08",
    lineItems: [{ name: "Namkeen", amount: 20.0 }],
    subtotal: 20.0,
    tax: 2.0,
    tip: null,
    total: 22.0,
    confidence: "high" as const,
    notes: null,
  };

  it("parses a well-formed LLM response", () => {
    const result = parseLLMResponse(JSON.stringify(validResponse));
    expect(result.merchant).toBe("Sharma General Store");
    expect(result.total).toBe(22.0);
    expect(result.lineItems).toHaveLength(1);
  });

  it("strips markdown code fences the LLM sometimes adds", () => {
    const fenced = "```json\n" + JSON.stringify(validResponse) + "\n```";
    const result = parseLLMResponse(fenced);
    expect(result.merchant).toBe("Sharma General Store");
  });

  it("throws on non-JSON response", () => {
    expect(() => parseLLMResponse("Sorry, I cannot read this image.")).toThrow();
  });

  it("throws when required fields are missing", () => {
    const { total, ...withoutTotal } = validResponse;
    void total;
    expect(() => parseLLMResponse(JSON.stringify(withoutTotal))).toThrow();
  });

  it("throws when confidence is not a valid enum value", () => {
    const bad = { ...validResponse, confidence: "very_high" };
    expect(() => parseLLMResponse(JSON.stringify(bad))).toThrow();
  });

  it("allows null for optional numeric fields", () => {
    const withNulls = { ...validResponse, subtotal: null, tax: null, tip: null };
    const result = parseLLMResponse(JSON.stringify(withNulls));
    expect(result.subtotal).toBeNull();
    expect(result.tax).toBeNull();
  });

  it("allows empty lineItems array", () => {
    const withEmpty = { ...validResponse, lineItems: [] };
    const result = parseLLMResponse(JSON.stringify(withEmpty));
    expect(result.lineItems).toEqual([]);
  });

  it("allows negative amounts for discounts", () => {
    const withDiscount = {
      ...validResponse,
      lineItems: [
        { name: "Namkeen", amount: 20.0 },
        { name: "Loyalty Discount", amount: -5.0 },
      ],
    };
    const result = parseLLMResponse(JSON.stringify(withDiscount));
    expect(result.lineItems[1].amount).toBe(-5.0);
  });
});