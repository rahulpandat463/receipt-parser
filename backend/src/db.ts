import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";

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

const DB_PATH = path.join(__dirname, "../../receipts.db");

let db: Database | null = null;

function saveDb(database: Database) {
  const data = database.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export async function getDb(): Promise<Database> {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant TEXT NOT NULL,
      date TEXT NOT NULL,
      line_items TEXT NOT NULL,
      subtotal REAL,
      tax REAL,
      tip REAL,
      total REAL NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'medium',
      raw_image_path TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  saveDb(db);
  return db;
}

export function queryOne(database: Database, sql: string, params: (string | number | null)[] = []): Record<string, unknown> | null {
  const results = database.exec(sql, params);
  if (!results.length || !results[0].values.length) return null;
  const { columns, values } = results[0];
  return Object.fromEntries(columns.map((col, i) => [col, values[0][i]]));
}

export function queryAll(database: Database, sql: string, params: (string | number | null)[] = []): Record<string, unknown>[] {
  const results = database.exec(sql, params);
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

export function run(database: Database, sql: string, params: (string | number | null)[] = []): void {
  database.run(sql, params);
  saveDb(database);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function rowToReceipt(row: Record<string, unknown>): Receipt {
  return {
    id: Number(row.id),
    merchant: (row.merchant as string) ?? "",
    date: (row.date as string) ?? "",
    lineItems: JSON.parse((row.line_items as string) || "[]") as LineItem[],
    subtotal: toNum(row.subtotal),
    tax: toNum(row.tax),
    tip: toNum(row.tip),
    total: toNum(row.total) ?? 0,
    confidence: (row.confidence as Receipt["confidence"]) ?? "medium",
    rawImagePath: (row.raw_image_path as string) ?? "",
    notes: (row.notes as string) || null,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
  };
}