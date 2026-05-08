export interface LineItem {
  name: string;
  amount: number;
}

export interface Receipt {
  id: number;
  merchant: string;
  date: string;
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number;
  confidence: "high" | "medium" | "low";
  rawImagePath: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedReceipt {
  merchant: string;
  date: string;
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number;
  confidence: "high" | "medium" | "low";
  notes: string | null;
}
