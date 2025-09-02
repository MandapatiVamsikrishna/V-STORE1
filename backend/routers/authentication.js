import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email & password required" });

  let conn;
  try {
    conn = await pool.getConnection();
    const hash = await bcrypt.hash(password, 10);
    await conn.query(
      "INSERT INTO users(email, password_hash, name) VALUES (?, ?, ?)",
      [email, hash, name || null]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    const dup = e?.code === "ER_DUP_ENTRY";
    res.status(dup ? 409 : 500).json({ error: dup ? "Email already used" : "Registration failed" });
  } finally {
    if (conn) conn.release();
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ uid: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, name: user.name || "" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
