import { useRef, useState, DragEvent, ChangeEvent } from "react";

interface Props {
  onFile: (file: File) => void;
  loading: boolean;
}

export default function UploadZone({ onFile, loading }: Props) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handle(file: File) {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Please upload a JPG or PNG file.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onFile(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handle(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--rule)"}`,
          borderRadius: "8px",
          padding: "2.5rem 1.5rem",
          textAlign: "center",
          cursor: loading ? "default" : "pointer",
          background: dragging ? "rgba(200,75,47,0.04)" : "white",
          transition: "all 0.15s",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {preview ? (
          <div style={{ position: "relative" }}>
            <img
              src={preview}
              alt="Receipt preview"
              style={{
                maxHeight: "260px",
                maxWidth: "100%",
                borderRadius: "4px",
                objectFit: "contain",
                opacity: loading ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            />
            {loading && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: "0.75rem",
              }}>
                <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                <span style={{ fontSize: "0.85rem", color: "var(--ink-light)", fontFamily: "var(--font-mono)" }}>
                  Parsing receipt…
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>🧾</div>
            <div>
              <p style={{ fontWeight: 600, color: "var(--ink)" }}>Drop a receipt photo here</p>
              <p style={{ fontSize: "0.85rem", color: "var(--ink-faint)", marginTop: "0.25rem" }}>
                or click to browse — JPG or PNG
              </p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={onChange}
          style={{ display: "none" }}
        />
      </div>

      {preview && !loading && (
        <button
          className="btn-ghost"
          onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}
          style={{ alignSelf: "center", fontSize: "0.8rem" }}
        >
          ↩ Upload a different image
        </button>
      )}
    </div>
  );
}
