// server.js — Express + MariaDB + Winston/Morgan (CommonJS)

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const winston = require("winston");

// === LOCAL MODULES (CommonJS) ===
// Make sure your db.js and routes/* also export via module.exports
const { ping } = require("./db.js");
const products = require("./routes/products.js");
const auth = require("./routes/auth.js");
const orders = require("./routes/orders.js");

dotenv.config();

// ---------- Logger (Winston) ----------
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// Log to console in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

const app = express();

// ---------- CORS ----------
function parseCorsOrigins(value) {
  if (!value || value === "*") return true; // allow all
  return value.split(",").map((s) => s.trim());
}
app.use(
  cors({
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: false,
  })
);

// ---------- Body parsing ----------
app.use(express.json());

// ---------- HTTP access log (Morgan -> Winston) ----------
const morganStream = {
  write: (message) => logger.info(message.trim()),
};
app.use(morgan("tiny", { stream: morganStream }));

// ---------- Request audit log (compact) ----------
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("req", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ms: duration,
      // Only log body for non-GET and small payloads
      body:
        req.method !== "GET" && req.headers["content-length"] < 2048
          ? req.body
          : undefined,
      query: Object.keys(req.query).length ? req.query : undefined,
      params: Object.keys(req.params).length ? req.params : undefined,
    });
  });
  next();
});

// ---------- Routes ----------
app.get("/api/health", async (_req, res) => {
  try {
    const ok = await ping();
    res.json({ db: ok });
  } catch (e) {
    logger.error("health failed", { err: e.message });
    res.status(500).json({ db: false });
  }
});

app.use("/api/products", products);
app.use("/api/auth", auth);
app.use("/api/orders", orders);

// ---------- 404 (must be after routes) ----------
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// ---------- Central error handler (last) ----------
app.use((err, _req, res, _next) => {
  logger.error("unhandled", { err: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal Server Error" });
});

// ---------- Start ----------
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  logger.info(`API running on http://localhost:${port}`);
});
