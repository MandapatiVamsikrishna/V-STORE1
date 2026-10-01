import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { httpError } from "../utils/httpError.js";

const readToken = (req) => {
  // X-Auth-Token first: some hosting proxies (e.g. Cloud Shell Web Preview) take over the Authorization header
  if (req.headers["x-auth-token"]) return String(req.headers["x-auth-token"]);
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
};

export const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

export async function protect(req, _res, next) {
  const token = readToken(req);
  if (!token) throw httpError(401, "Please sign in to continue");
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, "Your session has expired — please sign in again");
  }
  req.user = await User.findById(decoded.id);
  if (!req.user) throw httpError(401, "Account not found");
  next();
}

export function admin(req, _res, next) {
  if (req.user?.role !== "admin") throw httpError(403, "Admin access only");
  next();
}
