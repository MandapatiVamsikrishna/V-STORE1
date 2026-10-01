import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Promo from "../models/Promo.js";

// Starting discount codes — edit or delete them in Admin → Discounts
const DEFAULT_PROMOS = [
  { code: "WELCOME10", description: "10% off for new customers", type: "percent", value: 10 },
  { code: "SAVE15", description: "15% off orders of £60 or more", type: "percent", value: 15, minSubtotal: 60 },
  { code: "SAVE5", description: "£5 off any order", type: "flat", value: 5 },
  { code: "FREESHIP", description: "Free delivery", type: "freeship", value: 0 }
];

export async function seedPromos() {
  if (await Promo.estimatedDocumentCount()) return 0;
  await Promo.insertMany(DEFAULT_PROMOS);
  return DEFAULT_PROMOS.length;
}

const catalogPath = resolve(import.meta.dirname, "..", "data", "products.json");

export function loadCatalog() {
  return JSON.parse(readFileSync(catalogPath, "utf8"));
}

export async function seedProducts({ reset = false } = {}) {
  if (reset) await Product.deleteMany({});
  const catalog = loadCatalog();
  const ops = catalog.map((p) => ({
    updateOne: {
      filter: { sku: p.sku },
      update: { $setOnInsert: { ...p, countInStock: 100, numReviews: 0 } },
      upsert: true
    }
  }));
  const res = await Product.bulkWrite(ops);
  return res.upsertedCount;
}

export async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@vstore.local").toLowerCase();
  if (await User.exists({ email })) return false;
  await User.create({
    name: process.env.ADMIN_NAME || "Store Admin",
    email,
    password: process.env.ADMIN_PASSWORD || "Admin@12345",
    role: "admin"
  });
  return true;
}

export async function seedIfEmpty() {
  if ((await Product.estimatedDocumentCount()) === 0) {
    const n = await seedProducts();
    console.log(`🌱 Seeded ${n} products from server/data/products.json`);
  }
  const promoCount = await seedPromos();
  if (promoCount) console.log(`🏷️  Created ${promoCount} starting discount codes (edit them in Admin → Discounts)`);
  if (await seedAdmin()) {
    console.log(`👤 Admin created: ${process.env.ADMIN_EMAIL || "admin@vstore.local"} / ${process.env.ADMIN_PASSWORD ? "(from .env)" : "Admin@12345"}`);
  }
}
