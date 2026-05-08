import { useState } from "react";
import { Receipt, ParsedReceipt } from "../types";
import { updateReceipt, deleteReceipt } from "../api";
import ReceiptEditor from "./ReceiptEditor";

interface Props {
  receipts: Receipt[];
  onUpdate: (r: Receipt) => void;
  onDelete: (id: number) => void;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n as string) : n;
  if (isNaN(num)) return "—";
  return `₹${num.toFixed(2)}`;
}

export default function ReceiptList({ receipts, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleUpdate(id: number, data: ParsedReceipt) {
    setSaving(true);
    try {
      const updated = await updateReceipt(id, data);
      onUpdate(updated);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this receipt?")) return;
    await deleteReceipt(id);
    onDelete(id);
    setExpanded(null);
  }

  if (receipts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "var(--ink-faint)", fontSize: "0.9rem" }}>
        No saved receipts yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {receipts.map((r) => (
        <div key={r.id} style={{
          border: "1px solid var(--rule)",
          borderRadius: "6px",
          background: "white",
          overflow: "hidden",
        }}>
          {/* Summary row */}
          <div
            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 1rem",
              cursor: "pointer",
              userSelect: "none",
              gap: "0.75rem",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.merchant || "—"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>
                {r.date || "No date"} · {r.lineItems.length} item{r.lineItems.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>{fmt(r.total)}</div>
              <span className={`tag tag-${r.confidence}`} style={{ fontSize: "0.7rem" }}>
                {r.confidence}
              </span>
            </div>
            <div style={{ color: "var(--ink-faint)", fontSize: "0.8rem", flexShrink: 0 }}>
              {expanded === r.id ? "▲" : "▼"}
            </div>
          </div>

          {/* Expanded detail */}
          {expanded === r.id && (
            <div className="fade-in" style={{ borderTop: "1px solid var(--rule)", padding: "1rem" }}>
              {editing === r.id ? (
                <>
                  <ReceiptEditor
                    initial={{
                      merchant: r.merchant,
                      date: r.date,
                      lineItems: r.lineItems,
                      subtotal: r.subtotal,
                      tax: r.tax,
                      tip: r.tip,
                      total: r.total,
                      confidence: r.confidence,
                      notes: r.notes,
                    }}
                    imagePath={r.rawImagePath}
                    onSave={(data) => handleUpdate(r.id, data)}
                    saving={saving}
                  />
                  <button className="btn-ghost" onClick={() => setEditing(null)} style={{ marginTop: "0.75rem" }}>
                    Cancel
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Image + details side by side */}
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <img
                      src={`/uploads/${r.rawImagePath}`}
                      alt="Receipt"
                      style={{ width: 70, height: 90, objectFit: "cover", borderRadius: 4, border: "1px solid var(--rule)", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, fontSize: "0.85rem" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                          {r.lineItems.map((item, i) => (
                            <tr key={i}>
                              <td style={{ padding: "0.15rem 0", color: "var(--ink-light)" }}>{item.name}</td>
                              <td style={{ padding: "0.15rem 0", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                                {fmt(item.amount)}
                              </td>
                            </tr>
                          ))}
                          {r.tax !== null && (
                            <tr>
                              <td style={{ padding: "0.15rem 0", color: "var(--ink-faint)" }}>Tax</td>
                              <td style={{ padding: "0.15rem 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--ink-faint)" }}>{fmt(r.tax)}</td>
                            </tr>
                          )}
                          {r.tip !== null && (
                            <tr>
                              <td style={{ padding: "0.15rem 0", color: "var(--ink-faint)" }}>Tip</td>
                              <td style={{ padding: "0.15rem 0", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--ink-faint)" }}>{fmt(r.tip)}</td>
                            </tr>
                          )}
                          <tr style={{ borderTop: "1px solid var(--rule)" }}>
                            <td style={{ padding: "0.3rem 0 0", fontWeight: 600 }}>Total</td>
                            <td style={{ padding: "0.3rem 0 0", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{fmt(r.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {r.notes && (
                    <div style={{ fontSize: "0.78rem", color: "var(--ink-faint)", fontStyle: "italic" }}>
                      Note: {r.notes}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn-ghost" onClick={() => setEditing(r.id)} style={{ fontSize: "0.8rem" }}>
                      ✎ Edit
                    </button>
                    <button className="btn-danger" onClick={() => handleDelete(r.id)} style={{ fontSize: "0.8rem" }}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}