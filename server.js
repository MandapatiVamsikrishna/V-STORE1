// server.js — minimal backend for V-STORE / FreshMart
// Run: npm init -y && npm i express cors morgan dotenv
// Then: node server.js

import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.resolve();
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname); // serve your HTML/CSS/JS from project root
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

// Ensure data dir/files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]", "utf8");

// Demo product catalog (replace with DB later)
const PRODUCTS = [
  {
    id: "apple-royal-gala-1kg",
    name: "Royal Gala Apples (1kg)",
    price: 2.49,
    img: "/images/apple.jpg",
    category: "fruits",
    rating: 4.6,
    stock: 120
  },
  {
    id: "organic-milk-2l",
    name: "Organic Whole Milk (2L)",
    price: 1.99,
    img: "/images/milk.jpg",
    category: "dairy",
    rating: 4.8,
    stock: 64
  },
  {
    id: "brown-bread",
    name: "Wholegrain Brown Bread",
    price: 1.29,
    img: "/images/bread.jpg",
    category: "bakery",
    rating: 4.4,
    stock: 80
  }
];

// Valid promos mirrored from your front-end
const PROMOS = {
  WELCOME10: { code: "WELCOME10", type: "percent", value: 10 },
  FREESHIP:  { code: "FREESHIP",  type: "freeship", value: 0 },
  SAVE5:     { code: "SAVE5",     type: "flat", value: 5.0 },
  SAVE15:    { code: "SAVE15",    type: "percent", value: 15, minSubtotal: 60 }
};

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ---------- Static hosting ----------
// Serves index.html, category pages, checkout.html, thank-you.html, style.css, script.js, images, etc.
app.use(express.static(STATIC_DIR, { extensions: ["html"] }));

// ---------- Utility ----------
const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const FREE_SHIP_THRESHOLD = 49;

function computeTotals(items = [], promo) {
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  let discount = 0;

  if (promo?.type === "percent") {
    if (!promo.minSubtotal || subtotal >= promo.minSubtotal) {
      discount = +(subtotal * (promo.value / 100)).toFixed(2);
    }
  } else if (promo?.type === "flat") {
    discount = Math.min(subtotal, promo.value || 0);
  }

  let shipping = 0;
  if (items.length) shipping = (subtotal - discount) >= FREE_SHIP_THRESHOLD ? 0 : 4.99;
  if (promo?.type === "freeship" && items.length) shipping = 0;

  const total = Math.max(0, subtotal - discount + shipping);
  return { subtotal, discount, shipping, total };
}

// ---------- APIs ----------

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "vstore-backend", time: new Date().toISOString() }));

// Products (simple; add query params later for search/filter/sort)
app.get("/api/products", (req, res) => {
  const q = (req.query.q || "").toString().toLowerCase();
  const filtered = q
    ? PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    : PRODUCTS;
  res.json({ items: filtered });
});

// Single product
app.get("/api/products/:id", (req, res) => {
  const p = PRODUCTS.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(p);
});

// Validate promo (server-side mirror of front-end normalizePromo)
app.post("/api/promo/validate", (req, res) => {
  const raw = (req.body?.code || "").trim().toUpperCase();
  const promo = PROMOS[raw];
  if (!promo) return res.status(400).json({ valid: false, error: "Invalid code" });
  res.json({ valid: true, promo });
});

// Price quote (compute totals server-side to prevent tampering)
app.post("/api/quote", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const promoCode = (req.body?.promo || "").trim().toUpperCase();
  const promo = PROMOS[promoCode] || null;

  // Trust price coming from server catalog if ids match; fall back to given price if unknown
  const normalized = items.map(it => {
    const serverItem = PRODUCTS.find(p => p.id === it.id);
    const price = serverItem ? serverItem.price : Number(it.price) || 0;
    const name = serverItem ? serverItem.name : (it.name || "Item");
    const img = serverItem ? serverItem.img : (it.img || null);
    const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
    return { id: it.id, name, price, qty, img };
    });
  const totals = computeTotals(normalized, promo);
  res.json({ items: normalized, promo, totals, currency: "GBP", formatted: {
    subtotal: GBP.format(totals.subtotal),
    discount: GBP.format(totals.discount),
    shipping: totals.shipping === 0 ? "Free" : GBP.format(totals.shipping),
    total: GBP.format(totals.total)
  }});
});

// Create order (persists to ./data/orders.json)
app.post("/api/orders", (req, res) => {
  const { items = [], customer = {}, payment = {}, promoCode = null } = req.body || {};
  const promo = promoCode ? PROMOS[(promoCode || "").toUpperCase()] : null;

  // Basic validation
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }
  if (!customer?.name || !customer?.address) {
    return res.status(400).json({ error: "Missing customer name or address" });
  }

  // Rebuild items using server catalog price whenever possible
  const normalized = items.map(it => {
    const ref = PRODUCTS.find(p => p.id === it.id);
    return {
      id: it.id,
      name: ref ? ref.name : it.name || "Item",
      price: ref ? ref.price : Number(it.price) || 0,
      qty: Math.max(1, Math.min(99, Number(it.qty) || 1)),
      img: ref ? ref.img : it.img || null
    };
  });

  const totals = computeTotals(normalized, promo);
  const order = {
    id: "ORD-" + Date.now(),
    createdAt: new Date().toISOString(),
    items: normalized,
    totals,
    customer: {
      name: customer.name,
      address: customer.address,
      email: customer.email || "",
      phone: customer.phone || "",
      city: customer.city || "",
      state: customer.state || "",
      zip: customer.zip || "",
      country: customer.country || ""
    },
    payment: payment || { method: "unknown" },
    promo: promo || null,
    currency: "GBP"
  };

  // Persist
  try {
    const prev = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
    prev.push(order);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(prev, null, 2));
  } catch (e) {
    console.error("Failed to save order:", e);
    return res.status(500).json({ error: "Failed to save order" });
  }

  res.status(201).json({
    ok: true,
    orderId: order.id,
    totals: order.totals,
    formatted: {
      subtotal: GBP.format(order.totals.subtotal),
      discount: GBP.format(order.totals.discount),
      shipping: order.totals.shipping === 0 ? "Free" : GBP.format(order.totals.shipping),
      total: GBP.format(order.totals.total)
    }
  });
});

// List orders (dev only)
app.get("/api/orders", (_req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
    res.json({ count: data.length, orders: data });
  } catch {
    res.json({ count: 0, orders: [] });
  }
});

// Catch-all to let the SPA-ish site handle routes (optional)
// If you have separate HTML files per route, you can remove this.
app.get("*", (req, res, next) => {
  const candidate = path.join(STATIC_DIR, req.path);
  if (fs.existsSync(candidate)) return res.sendFile(candidate);
  const indexPath = path.join(STATIC_DIR, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  next();
});

app.listen(PORT, () => {
  console.log(`✓ V-STORE backend running on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${STATIC_DIR}`);
});
