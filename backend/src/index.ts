import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import receiptRoutes from "./routes";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

app.use("/api/receipts", receiptRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🧾 Receipt parser backend running on http://localhost:${PORT}`);
});
