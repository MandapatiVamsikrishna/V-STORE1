// db.js — MariaDB pool (CommonJS)
const mariadb = require("mariadb");
require("dotenv").config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "vstore_user",
  password: process.env.DB_PASS || "supersecret",
  database: process.env.DB_NAME || "vstore",
  connectionLimit: 5,
});

async function ping() {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT 1 AS ok");
    return rows[0]?.ok === 1;
  } finally {
    if (conn) conn.release();
  }
}

module.exports = { pool, ping };
