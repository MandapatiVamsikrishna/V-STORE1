import { pool } from "./db.js";

const demo = [
  ["Organic Apples 1kg", "Crisp and fresh.", 2.99, "https://picsum.photos/seed/apple/600/400", "fruits", 120],
  ["Whole Milk 1L", "Creamy dairy milk.", 1.25, "https://picsum.photos/seed/milk/600/400", "dairy", 200],
  ["Brown Bread", "Soft wholegrain loaf.", 1.60, "https://picsum.photos/seed/bread/600/400", "bakery", 80],
  ["Free-range Eggs (12)", "Large grade A eggs.", 3.15, "https://picsum.photos/seed/eggs/600/400", "eggs", 60],
  ["Basmat i Rice 5kg", "Premium long-grain.", 9.99, "https://picsum.photos/seed/rice/600/400", "pantry", 40]
];

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();
    const values = demo.map(d => ({
      title: d[0], description: d[1], price: d[2], image_url: d[3], category: d[4], stock: d[5]
    }));
    for (const v of values) {
      await conn.query(
        "INSERT INTO products(title, description, price, image_url, category, stock) VALUES (?, ?, ?, ?, ?, ?)",
        [v.title, v.description, v.price, v.image_url, v.category, v.stock]
      );
    }
    console.log("Seed done.");
  } catch (e) {
    console.error(e);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
}
run();
