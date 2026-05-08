import { useState } from "react";
import { LineItem, ParsedReceipt } from "../types";

interface Props {
  initial: ParsedReceipt;
  imagePath: string;
  parseError?: string;
  onSave: (data: ParsedReceipt) => Promise<void>;
  saving: boolean;
}

function fmt(n: number | null): string {
  if (n === null) return "";
  return n.toFixed(2);
}

function parseAmt(s: string): number | null {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
  highlight?: boolean;
}

function Field({ label, value, onChange, type = "text", placeholder, mono, highlight }: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          background: highlight ? "rgba(200,75,47,0.05)" : "white",
          borderColor: highlight ? "var(--accent)" : undefined,
        }}
      />
    </div>
  );
}

export default function ReceiptEditor({ initial, imagePath, parseError, onSave, saving }: Props) {
  const [merchant, setMerchant] = useState(initial.merchant);
  const [date, setDate] = useState(initial.date);
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initial.lineItems.length > 0 ? initial.lineItems : [{ name: "", amount: 0 }]
  );
  const [subtotal, setSubtotal] = useState(fmt(initial.subtotal));
  const [tax, setTax] = useState(fmt(initial.tax));
  const [tip, setTip] = useState(fmt(initial.tip));
  const [total, setTotal] = useState(initial.total === 0 ? "" : fmt(initial.total));

  // Track which fields were auto-filled vs blank (to highlight uncertain ones)
  const confidence = initial.confidence;
  const lowConf = confidence === "low";
  const medConf = confidence === "medium";

  const computedTotal = lineItems.reduce((s, i) => s + (i.amount || 0), 0)
    + (parseAmt(tax) ?? 0)
    + (parseAmt(tip) ?? 0);

  const totalMismatch =
    parseAmt(total) !== null &&
    Math.abs(computedTotal - (parseAmt(total) ?? 0)) > 0.02 &&
    lineItems.length > 0;

  function updateItem(idx: number, field: keyof LineItem, val: string) {
    setLineItems((items) =>
      items.map((item, i) =>
        i === idx ? { ...item, [field]: field === "amount" ? (parseFloat(val) || 0) : val } : item
      )
    );
  }

  function addItem() {
    setLineItems((items) => [...items, { name: "", amount: 0 }]);
  }

  function removeItem(idx: number) {
    setLineItems((items) => items.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    await onSave({
      merchant,
      date,
      lineItems: lineItems.filter((i) => i.name.trim() !== ""),
      subtotal: parseAmt(subtotal),
      tax: parseAmt(tax),
      tip: parseAmt(tip),
      total: (parseAmt(total) && parseAmt(total) !== 0) ? parseAmt(total)! : computedTotal,
      confidence,
      notes: initial.notes,
    });
  }

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Parse warnings */}
      {parseError && (
        <div style={{
          background: "var(--danger-light)",
          border: "1px solid rgba(200,75,47,0.3)",
          borderRadius: "6px",
          padding: "0.75rem 1rem",
          fontSize: "0.85rem",
          color: "var(--accent)",
        }}>
          <strong>⚠ Auto-extraction failed</strong> — fields have been left blank for you to fill in manually.
        </div>
      )}

      {!parseError && (lowConf || medConf) && initial.notes && (
        <div style={{
          background: lowConf ? "var(--danger-light)" : "var(--warn-light)",
          border: `1px solid ${lowConf ? "rgba(200,75,47,0.3)" : "rgba(184,124,26,0.3)"}`,
          borderRadius: "6px",
          padding: "0.75rem 1rem",
          fontSize: "0.85rem",
          color: lowConf ? "var(--accent)" : "var(--warn)",
          display: "flex",
          gap: "0.5rem",
          alignItems: "flex-start",
        }}>
          <span>{lowConf ? "⚠" : "ℹ"}</span>
          <div>
            <strong>{lowConf ? "Low confidence" : "Some fields uncertain"}</strong>
            <br />{initial.notes}
          </div>
        </div>
      )}

      {/* Receipt image thumbnail */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <img
          src={`/uploads/${imagePath}`}
          alt="Receipt"
          style={{
            width: "90px",
            height: "120px",
            objectFit: "cover",
            borderRadius: "4px",
            border: "1px solid var(--rule)",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className={`tag tag-${confidence}`}>
              {confidence === "high" ? "✓" : confidence === "medium" ? "~" : "!"} {confidence} confidence
            </span>
          </div>
          <Field
            label="Merchant"
            value={merchant}
            onChange={setMerchant}
            placeholder="Store name"
            highlight={lowConf && merchant === ""}
          />
          <Field
            label="Date"
            value={date}
            onChange={setDate}
            type="date"
            highlight={lowConf && date === ""}
          />
        </div>
      </div>

      <div className="divider" />

      {/* Line items */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <label style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
            Line Items
          </label>
          <button className="btn-ghost" onClick={addItem} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}>
            + Add item
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {lineItems.map((item, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 100px 28px", gap: "0.4rem", alignItems: "center" }}>
              <input
                value={item.name}
                onChange={(e) => updateItem(idx, "name", e.target.value)}
                placeholder={`Item ${idx + 1}`}
                style={{ background: (lowConf && item.name === "") ? "rgba(200,75,47,0.04)" : "white" }}
              />
              <input
                value={item.amount === 0 && item.name === "" ? "" : item.amount.toFixed(2)}
                onChange={(e) => updateItem(idx, "amount", e.target.value)}
                placeholder="0.00"
                style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}
              />
              <button
                onClick={() => removeItem(idx)}
                style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: "1rem", padding: "0", lineHeight: 1, cursor: "pointer" }}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="divider" />

      {/* Subtotals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
        <Field label="Subtotal" value={subtotal} onChange={setSubtotal} mono placeholder="0.00" />
        <Field label="Tax" value={tax} onChange={setTax} mono placeholder="0.00" />
        <Field label="Tip" value={tip} onChange={setTip} mono placeholder="0.00" />
      </div>

      {/* Total */}
      <div style={{
        background: totalMismatch ? "var(--danger-light)" : "var(--paper-warm)",
        borderRadius: "6px",
        padding: "0.75rem 1rem",
        border: `1px solid ${totalMismatch ? "rgba(200,75,47,0.4)" : "var(--rule)"}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div style={{ flex: 1 }}>
            <Field
              label="Total (from receipt — ₹)"
              value={total}
              onChange={setTotal}
              mono
              placeholder="0.00"
              highlight={totalMismatch}
            />
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "0.7rem", color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Computed</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>₹{computedTotal.toFixed(2)}</div>
          </div>
        </div>
        {totalMismatch && (
          <p style={{ fontSize: "0.78rem", color: "var(--accent)", marginTop: "0.4rem" }}>
            ⚠ Total doesn't match sum of items + tax + tip (₹{computedTotal.toFixed(2)}). Please review.
          </p>
        )}
      </div>

      <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: "0.65rem 1.5rem", fontSize: "0.95rem" }}>
        {saving ? "Saving…" : "Save Receipt"}
      </button>
    </div>
  );
}