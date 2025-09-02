import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { ping } from "./db.js";
import products from "./routes/products.js";
import auth from "./routes/auth.js";
import orders from "./routes/orders.js";

dotenv.config();
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", async (_req, res) => res.json({ db: await ping() }));
app.use("/api/products", products);
app.use("/api/auth", auth);
app.use("/api/orders", orders);

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
