// npm run seed          → adds any missing products + admin
// npm run seed:reset    → wipes products and re-imports the catalog
import "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";
import { seedProducts, seedAdmin, seedPromos } from "./seedData.js";

const reset = process.argv.includes("--reset");
if (!process.env.MONGO_URI) {
  console.log("MONGO_URI is empty — the in-memory DB is seeded automatically when the server starts. Nothing to do.");
  process.exit(0);
}
await connectDB();
const n = await seedProducts({ reset });
console.log(`${reset ? "Reset + imported" : "Imported"} ${n} products`);
if (await seedAdmin()) console.log("Admin user created");
const np = await seedPromos(); if (np) console.log(`Created ${np} starting discount codes`);
await disconnectDB();
