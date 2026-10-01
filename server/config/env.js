import dotenv from "dotenv";
import { resolve } from "node:path";
import crypto from "node:crypto";

// .env lives in the project root (next to package.json)
dotenv.config({ path: resolve(import.meta.dirname, "..", "..", ".env"), quiet: true });

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET is required in production");
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("⚠️  JWT_SECRET not set — using a temporary one (sessions reset on restart). Create a .env file.");
}
