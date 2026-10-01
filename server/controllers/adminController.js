import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

export async function stats(_req, res) {
  const [allOrders, users, products, lowStock, newMessages, recent] = await Promise.all([
    Order.find().select("status total totalGBP").lean(),
    User.countDocuments(),
    Product.countDocuments(),
    Product.find({ countInStock: { $lte: 10 } }).select("sku name countInStock").sort({ countInStock: 1 }).limit(10),
    Message.countDocuments({ status: "new" }),
    Order.find().populate("user", "name email").sort({ createdAt: -1 }).limit(5)
  ]);
  const live = allOrders.filter((o) => o.status !== "Cancelled");
  const byStatus = {};
  allOrders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
  res.json({
    revenue: Math.round(live.reduce((s, o) => s + (o.totalGBP ?? o.total ?? 0), 0) * 100) / 100, // in GBP
    orders: allOrders.length,
    byStatus,
    users, products, lowStock, newMessages, recent
  });
}

export async function listUsers(_req, res) {
  res.json(await User.find().sort({ createdAt: -1 }).limit(500));
}

export async function setUserRole(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user._id.equals(req.user._id)) return res.status(400).json({ message: "You can't change your own role" });
  user.role = req.body.role === "admin" ? "admin" : "user";
  await user.save();
  res.json(user.toSafeJSON());
}
