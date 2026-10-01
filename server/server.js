import "./config/env.js";
import { createApp } from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { seedIfEmpty } from "./scripts/seedData.js";

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  await connectDB();
  await seedIfEmpty();
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`🚀 API ready on http://localhost:${PORT}/api  (health: /api/health)`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("❌ Failed to start server:", err.message);
  process.exit(1);
});
