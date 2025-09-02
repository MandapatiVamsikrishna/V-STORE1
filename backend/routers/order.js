import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = Router();

function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  try {
    if (!token) throw new Error();
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

router.post("/", auth, async (req, res) => {
  const { items } = req.body || []; // [{product_id, quantity, price_each}]
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "No items" });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const total = items.reduce((s, it) => s + Number(it.price_each) * Number(it.quantity), 0);
    const r = await conn.query(
      "INSERT INTO orders(user_id, total, status) VALUES (?, ?, 'pending')",
      [req.user.uid, total]
    );
    const orderId = r.insertId;

    const values = items.map(it => [orderId, it.product_id, it.quantity, it.price_each]);
    await conn.batch(
      "INSERT INTO order_items(order_id, product_id, quantity, price_each) VALUES (?, ?, ?, ?)",
      values
    );

    await conn.commit();
    res.status(201).json({ order_id: orderId, total });
  } catch (e) {
    if (conn) await conn.rollback();
    console.error(e);
    res.status(500).json({ error: "Order failed" });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
