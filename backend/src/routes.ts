import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parseReceiptImage } from "./parser";
import { getDb, queryOne, queryAll, run, rowToReceipt } from "./db";

const router = Router();

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG and PNG files are supported."));
  },
});

// POST /api/receipts/parse
router.post("/parse", upload.single("image"), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No image file provided." }); return; }
  try {
    const parsed = await parseReceiptImage(req.file.path);
    res.json({ imagePath: req.file.filename, parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Parse failed.";
    res.status(422).json({
      error: "Could not extract structured data from this image.",
      detail: message,
      imagePath: req.file.filename,
      parsed: {
        merchant: "", date: "", lineItems: [], subtotal: null, tax: null,
        tip: null, total: 0, confidence: "low",
        notes: "Automatic extraction failed. Please fill in the fields manually.",
      },
    });
  }
});

// POST /api/receipts
router.post("/", async (req: Request, res: Response) => {
  const { imagePath, merchant, date, lineItems, subtotal, tax, tip, total, confidence, notes } = req.body;
  if (!imagePath || !merchant || total === undefined) {
    res.status(400).json({ error: "imagePath, merchant, and total are required." });
    return;
  }
  const db = await getDb();
  run(db,
    `INSERT INTO receipts (merchant, date, line_items, subtotal, tax, tip, total, confidence, raw_image_path, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [merchant, date ?? "", JSON.stringify(lineItems ?? []), subtotal ?? null,
     tax ?? null, tip ?? null, total, confidence ?? "medium", imagePath, notes ?? null]
  );
  const row = queryOne(db, "SELECT * FROM receipts WHERE id = (SELECT MAX(id) FROM receipts)");
  res.status(201).json(rowToReceipt(row!));
});

// PUT /api/receipts/:id
router.put("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { merchant, date, lineItems, subtotal, tax, tip, total, confidence, notes } = req.body;
  const db = await getDb();
  const existing = queryOne(db, "SELECT id FROM receipts WHERE id = ?", [Number(id)]);
  if (!existing) { res.status(404).json({ error: "Receipt not found." }); return; }
  run(db,
    `UPDATE receipts SET merchant=?, date=?, line_items=?, subtotal=?, tax=?, tip=?, total=?,
     confidence=?, notes=?, updated_at=datetime('now') WHERE id=?`,
    [merchant, date, JSON.stringify(lineItems ?? []), subtotal ?? null, tax ?? null,
     tip ?? null, total, confidence ?? "medium", notes ?? null, Number(id)]
  );
  const row = queryOne(db, "SELECT * FROM receipts WHERE id = ?", [Number(id)]);
  res.json(rowToReceipt(row!));
});

// GET /api/receipts
router.get("/", async (_req: Request, res: Response) => {
  const db = await getDb();
  const rows = queryAll(db, "SELECT * FROM receipts ORDER BY created_at DESC");
  res.json(rows.map(rowToReceipt));
});

// GET /api/receipts/:id
router.get("/:id", async (req: Request, res: Response) => {
  const db = await getDb();
  const row = queryOne(db, "SELECT * FROM receipts WHERE id = ?", [Number(req.params.id)]);
  if (!row) { res.status(404).json({ error: "Receipt not found." }); return; }
  res.json(rowToReceipt(row));
});

// DELETE /api/receipts/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const db = await getDb();
  const existing = queryOne(db, "SELECT id FROM receipts WHERE id = ?", [Number(req.params.id)]);
  if (!existing) { res.status(404).json({ error: "Receipt not found." }); return; }
  run(db, "DELETE FROM receipts WHERE id = ?", [Number(req.params.id)]);
  res.json({ success: true });
});

export default router;
