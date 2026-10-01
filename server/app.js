import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import apiRoutes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({
    origin: (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((s) => s.trim()),
    credentials: true
  }));
  app.use(express.json({ limit: "1mb" }));
  if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.use("/api", apiRoutes);
  app.use("/api", notFound);

  // In production, serve the built storefront (npm run build → /dist)
  const dist = resolve(import.meta.dirname, "..", "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist, { extensions: ["html"] }));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
