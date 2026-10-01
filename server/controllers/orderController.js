import mongoose from "mongoose";
import Order, { ORDER_STATUSES } from "../models/Order.js";
import Product from "../models/Product.js";
import Promo from "../models/Promo.js";
import { computeTotals, getMarket, unitPrice, canShip, validPostcode } from "../utils/pricing.js";

// Look up a promo code in the database and check it can be used
async function loadPromo(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return null;
  const promo = await Promo.findOne({ code: c });
  if (!promo) throw httpError(400, "That promo code isn't valid");
  const problem = promo.problem();
  if (problem) throw httpError(400, problem);
  return promo;
}
import { httpError } from "../utils/httpError.js";

// Resolve cart lines against the DB (prices come from the DB, not the browser)
async function resolveItems(lines) {
  if (!Array.isArray(lines) || !lines.length) throw httpError(400, "Your cart is empty");
  const merged = new Map();
  for (const l of lines) {
    const key = String(l.id || l.sku || l.product || "");
    const qty = Math.max(1, Math.min(99, parseInt(l.qty, 10) || 1));
    if (key) merged.set(key, (merged.get(key) || 0) + qty);
  }
  const keys = [...merged.keys()];
  const ids = keys.filter((k) => mongoose.isValidObjectId(k));
  const products = await Product.find({ $or: [{ sku: { $in: keys } }, { _id: { $in: ids } }], isActive: true });
  const byKey = new Map();
  products.forEach((p) => { byKey.set(p.sku, p); byKey.set(String(p._id), p); });

  const missing = keys.filter((k) => !byKey.has(k));
  if (missing.length) throw httpError(400, `Some items are no longer available: ${missing.join(", ")}`);

  return keys.map((k) => {
    const p = byKey.get(k);
    const qty = merged.get(k);
    if (p.countInStock < qty) throw httpError(400, `Only ${p.countInStock} left of ${p.name}`);
    return { product: p._id, sku: p.sku, name: p.name, image: p.image, price: p.price, department: p.department, qty };
  });
}

function marketFrom(req) {
  const m = getMarket(req.body.market || "GB");
  if (!m) throw httpError(400, "We don't deliver to that country yet");
  return m;
}

// Items that can't be sent to this country (fresh food is UK-only)
function blocked(items, m) {
  const bad = items.filter((it) => !canShip(it.department, m));
  if (bad.length) {
    throw httpError(400, `${bad.map((b) => b.name).join(", ")} can't be delivered to ${m.name}: fresh food ships within the UK only. Remove ${bad.length > 1 ? "them" : "it"} to continue.`,
      bad.map((b) => ({ field: "items", sku: b.sku, message: "Not available in this country" })));
  }
}

const localLines = (items, m) => items.map(({ department, ...it }) => ({ ...it, price: unitPrice(it.price, m) }));

export async function quote(req, res) {
  const m = marketFrom(req);
  const items = await resolveItems(req.body.items);
  const promo = await loadPromo(req.body.promoCode);
  const unavailable = items.filter((it) => !canShip(it.department, m)).map((it) => it.sku);
  res.json({ market: m.code, items: localLines(items, m), unavailable, deliveryEstimate: m.delivery, ...computeTotals(items, promo, m) });
}

export async function createOrder(req, res) {
  const { items: lines, shippingAddress = {}, payment = {}, promoCode } = req.body;
  const m = marketFrom(req);
  const items = await resolveItems(lines);
  blocked(items, m);
  if (!validPostcode(shippingAddress.postcode, m)) {
    throw httpError(400, `Enter a valid ${m.postcode.label} for ${m.name} (for example ${m.postcode.example})`, [{ field: "postcode", message: `Invalid ${m.postcode.label}` }]);
  }
  const requested = ["card", "upi", "paypal", "cod"].includes(payment.method) ? payment.method : "card";
  if (!m.payments.includes(requested)) {
    throw httpError(400, `${{ card: "Card", upi: "UPI", paypal: "PayPal", cod: "Cash on delivery" }[requested]} isn't available in ${m.name}`);
  }
  const promo = await loadPromo(promoCode);
  const totals = computeTotals(items, promo, m);
  if (totals.promoMinSpend) throw httpError(400, `${promo.code} needs a minimum spend of ${totals.promoMinSpend.toFixed(2)} ${m.currency}`);
  // Count the use (respecting the usage limit) before saving the order
  if (totals.promoCode) {
    const ok = await Promo.updateOne({ _id: promo._id, $or: [{ maxUses: 0 }, { uses: { $lt: promo.maxUses } }] }, { $inc: { uses: 1 } });
    if (!ok.modifiedCount) throw httpError(400, "That promo code has been fully used");
  }

  // Reserve stock atomically; roll back if any line fails
  const reserved = [];
  for (const it of items) {
    const ok = await Product.updateOne({ _id: it.product, countInStock: { $gte: it.qty } }, { $inc: { countInStock: -it.qty } });
    if (!ok.modifiedCount) {
      await Promise.all(reserved.map((r) => Product.updateOne({ _id: r.product }, { $inc: { countInStock: r.qty } })));
      throw httpError(409, `${it.name} just sold out — please update your cart`);
    }
    reserved.push(it);
  }

  const method = requested;
  const order = await Order.create({
    user: req.user._id,
    market: m.code,
    currency: m.currency,
    items: localLines(items, m),
    shippingAddress: { email: req.user.email, ...shippingAddress, country: m.name },
    payment: {
      method,
      brand: payment.brand,
      last4: String(payment.last4 || "").replace(/\D/g, "").slice(-4) || undefined,
      handle: payment.handle,
      // Mock gateway: card/UPI/PayPal are "paid" immediately; COD is paid on delivery
      transactionId: method === "cod" ? undefined : `MOCK-${Date.now().toString(36).toUpperCase()}`
    },
    deliverySlot: m.slots ? String(req.body.deliverySlot || "").trim().slice(0, 80) || undefined : undefined,
    deliveryEstimate: m.slots ? undefined : m.delivery,
    promoCode: totals.promoCode,
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: totals.shipping,
    tax: totals.tax,
    taxIncluded: totals.taxIncluded,
    total: totals.total,
    totalGBP: Math.round((totals.total / m.fx) * 100) / 100,
    isPaid: method !== "cod",
    paidAt: method !== "cod" ? new Date() : undefined
  });

  // Save the address for next time if the user has none
  if (!req.user.address?.line1 && shippingAddress.line1) {
    req.user.address = { line1: shippingAddress.line1, city: shippingAddress.city, state: shippingAddress.state, postcode: shippingAddress.postcode, country: m.code };
    await req.user.save();
  }

  res.status(201).json(order);
}

export async function myOrders(req, res) {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
}

async function loadOrderFor(req) {
  const q = mongoose.isValidObjectId(req.params.id) ? { _id: req.params.id } : { orderNumber: req.params.id };
  const order = await Order.findOne(q).populate("user", "name email");
  if (!order) throw httpError(404, "Order not found");
  if (req.user.role !== "admin" && !order.user._id.equals(req.user._id)) throw httpError(404, "Order not found");
  return order;
}

export async function getOrder(req, res) {
  res.json(await loadOrderFor(req));
}

export async function cancelOrder(req, res) {
  const order = await loadOrderFor(req);
  if (order.status !== "Processing") throw httpError(400, `Orders that are ${order.status.toLowerCase()} can't be cancelled`);
  order.status = "Cancelled";
  order.cancelledAt = new Date();
  await order.save();
  await Promise.all(order.items.map((it) => Product.updateOne({ _id: it.product }, { $inc: { countInStock: it.qty } })));
  res.json(order);
}

// ---- Admin ----
export async function allOrders(req, res) {
  const filter = {};
  if (req.query.status && ORDER_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const orders = await Order.find(filter).populate("user", "name email").sort({ createdAt: -1 }).limit(500);
  res.json(orders);
}

export async function updateStatus(req, res) {
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) throw httpError(400, `Status must be one of: ${ORDER_STATUSES.join(", ")}`);
  const order = await loadOrderFor(req);
  if (order.status === "Cancelled") throw httpError(400, "Cancelled orders can't be changed");
  if (status === "Cancelled") {
    await Promise.all(order.items.map((it) => Product.updateOne({ _id: it.product }, { $inc: { countInStock: it.qty } })));
    order.cancelledAt = new Date();
  }
  if (status === "Shipped" && !order.shippedAt) order.shippedAt = new Date();
  if (status === "Delivered") {
    if (!order.shippedAt) order.shippedAt = new Date();
    order.deliveredAt = new Date();
    if (!order.isPaid) { order.isPaid = true; order.paidAt = new Date(); } // cash on delivery collected
  }
  order.status = status;
  await order.save();
  res.json(order);
}
