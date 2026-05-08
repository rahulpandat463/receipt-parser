import { useState, useEffect } from "react";
import { Receipt, ParsedReceipt } from "./types";
import { parseReceipt, saveReceipt, listReceipts } from "./api";
import UploadZone from "./components/UploadZone";
import ReceiptEditor from "./components/ReceiptEditor";
import ReceiptList from "./components/ReceiptList";

type View = "upload" | "edit" | "list";

export default function App() {
  const [view, setView] = useState<View>("upload");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [imagePath, setImagePath] = useState<string>("");
  const [parseError, setParseError] = useState<string | undefined>();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  async function loadReceipts() {
    setLoadingList(true);
    try {
      const list = await listReceipts();
      setReceipts(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (view === "list") loadReceipts();
  }, [view]);

  async function handleFile(file: File) {
    setParsing(true);
    setParseError(undefined);
    try {
      const result = await parseReceipt(file);
      setParsed(result.parsed);
      setImagePath(result.imagePath);
      setParseError(result.parseError);
      setView("edit");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave(data: ParsedReceipt) {
    if (!imagePath) return;
    setSaving(true);
    try {
      const saved = await saveReceipt({
        ...data,
        rawImagePath: imagePath,
        imagePath,
      });
      setReceipts((prev) => [saved, ...prev]);
      setParsed(null);
      setImagePath("");
      setParseError(undefined);
      setView("list");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function handleUpdate(updated: Receipt) {
    setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleDelete(id: number) {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--rule)",
        background: "white",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "0.85rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.2rem" }}>🧾</span>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Receipt Parser
            </h1>
          </div>
          <nav style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className={view === "upload" || view === "edit" ? "btn-primary" : "btn-ghost"}
              onClick={() => { setParsed(null); setView("upload"); }}
              style={{ fontSize: "0.82rem", padding: "0.35rem 0.85rem" }}
            >
              + New
            </button>
            <button
              className={view === "list" ? "btn-primary" : "btn-ghost"}
              onClick={() => setView("list")}
              style={{ fontSize: "0.82rem", padding: "0.35rem 0.85rem" }}
            >
              Receipts {receipts.length > 0 && `(${receipts.length})`}
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, maxWidth: 680, width: "100%", margin: "0 auto", padding: "2rem 1.5rem" }}>

        {view === "upload" && (
          <div className="fade-in">
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.3rem" }}>Upload a receipt</h2>
              <p style={{ color: "var(--ink-faint)", fontSize: "0.88rem" }}>
                Drop a photo and we'll extract the details automatically.
              </p>
            </div>
            <UploadZone onFile={handleFile} loading={parsing} />
          </div>
        )}

        {view === "edit" && parsed && (
          <div className="fade-in">
            <div style={{ marginBottom: "1.5rem" }}>
              <button
                onClick={() => { setParsed(null); setView("upload"); }}
                style={{ background: "none", border: "none", color: "var(--ink-faint)", cursor: "pointer", fontSize: "0.85rem", padding: 0, marginBottom: "0.75rem" }}
              >
                ← Back
              </button>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.3rem" }}>Review & correct</h2>
              <p style={{ color: "var(--ink-faint)", fontSize: "0.88rem" }}>
                Check that everything looks right before saving.
              </p>
            </div>
            <ReceiptEditor
              initial={parsed}
              imagePath={imagePath}
              parseError={parseError}
              onSave={handleSave}
              saving={saving}
            />
          </div>
        )}

        {view === "list" && (
          <div className="fade-in">
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.3rem" }}>Saved receipts</h2>
              <p style={{ color: "var(--ink-faint)", fontSize: "0.88rem" }}>
                {receipts.length} receipt{receipts.length !== 1 ? "s" : ""} saved.
              </p>
            </div>
            {loadingList ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                <div className="spinner" />
              </div>
            ) : (
              <ReceiptList receipts={receipts} onUpdate={handleUpdate} onDelete={handleDelete} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
