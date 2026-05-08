import { ParsedReceipt, Receipt } from "./types";

const BASE = "/api/receipts";

export async function parseReceipt(
  file: File
): Promise<{ imagePath: string; parsed: ParsedReceipt; parseError?: string }> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${BASE}/parse`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok && res.status !== 422) {
    throw new Error(data.error ?? "Upload failed.");
  }
  // 422 means parse failed but we still get a blank template + imagePath
  return {
    imagePath: data.imagePath,
    parsed: data.parsed,
    parseError: data.error,
  };
}

export async function saveReceipt(
  payload: Omit<Receipt, "id" | "createdAt" | "updatedAt"> & { imagePath: string }
): Promise<Receipt> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
  return res.json();
}

export async function updateReceipt(
  id: number,
  payload: Partial<Receipt>
): Promise<Receipt> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Update failed.");
  return res.json();
}

export async function listReceipts(): Promise<Receipt[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error("Failed to load receipts.");
  return res.json();
}

export async function deleteReceipt(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed.");
}
