import Promo from "../models/Promo.js";
import { httpError } from "../utils/httpError.js";

const FIELDS = ["code", "description", "type", "value", "minSubtotal", "active", "showOnSite", "expiresAt", "maxUses"];
const pick = (body) => {
  const out = {};
  for (const k of FIELDS) if (k in body) out[k] = body[k];
  if ("expiresAt" in out && !out.expiresAt) out.expiresAt = null;
  if ("code" in out) out.code = String(out.code).trim().toUpperCase();
  return out;
};

// ---- Public ----
export async function checkPromo(req, res) {
  const promo = await Promo.findOne({ code: String(req.params.code || "").trim().toUpperCase() });
  if (!promo) throw httpError(404, "That promo code isn't valid");
  const problem = promo.problem();
  if (problem) throw httpError(400, problem);
  res.json(promo.toPublic());
}

export async function publicPromos(_req, res) {
  const now = new Date();
  const list = await Promo.find({ active: true, showOnSite: true }).sort({ createdAt: 1 });
  res.json(list.filter((p) => (!p.expiresAt || p.expiresAt > now) && (!p.maxUses || p.uses < p.maxUses)).map((p) => p.toPublic()));
}

// ---- Admin ----
export async function listPromos(_req, res) {
  res.json(await Promo.find().sort({ createdAt: -1 }));
}
export async function createPromo(req, res) {
  res.status(201).json(await Promo.create(pick(req.body)));
}
export async function updatePromo(req, res) {
  const promo = await Promo.findById(req.params.id);
  if (!promo) throw httpError(404, "Promo code not found");
  Object.assign(promo, pick(req.body));
  await promo.save();
  res.json(promo);
}
export async function deletePromo(req, res) {
  const promo = await Promo.findById(req.params.id);
  if (!promo) throw httpError(404, "Promo code not found");
  await promo.deleteOne();
  res.json({ message: "Promo code deleted" });
}
