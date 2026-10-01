import mongoose from "mongoose";

let memoryServer = null;

/**
 * Connects to MongoDB.
 * - If MONGO_URI is set, uses it (Atlas or local MongoDB).
 * - Otherwise starts a throwaway in-memory MongoDB (data is lost when the server stops).
 */
export async function connectDB() {
  let uri = process.env.MONGO_URI?.trim();

  if (!uri) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MONGO_URI is required in production");
    }
    console.log("ℹ️  MONGO_URI not set — starting an in-memory MongoDB (first run downloads ~100MB)…");
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri("vstore");
  }

  mongoose.set("strictQuery", true);
  const conn = await mongoose.connect(uri);
  console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}${memoryServer ? " (in-memory)" : ""}`);
  return conn;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
