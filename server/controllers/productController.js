import mongoose from "mongoose";
import Product from "../models/Product.js";
import { buildProductQuery } from "../utils/apiFeatures.js";
import { httpError } from "../utils/httpError.js";

const PUBLIC_FIELDS = "-reviews -__v";
const EDITABLE = ["sku", "name", "brand", "department", "category", "page", "description", "image",
  "price", "compareAtPrice", "priceLabel", "countInStock", "isActive"];

// Accept either a Mongo _id or a SKU (the data-id used in the HTML cards)
async function findByIdOrSku(idOrSku) {
  const q = mongoose.isValidObjectId(idOrSku) ? { $or: [{ _id: idOrSku }, { sku: idOrSku }] } : { sku: idOrSku };
  const product = await Product.findOne(q);
  if (!product) throw httpError(404, "Product not found");
  return product;
}

export async function listProducts(req, res) {
  const isAdmin = req.user?.role === "admin" && req.query.all === "true";
  const { filter, sort, limit, page, skip } = buildProductQuery(req.query, { includeInactive: isAdmin });
  const [products, total] = await Promise.all([
    Product.find(filter).select(PUBLIC_FIELDS).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter)
  ]);
  res.json({ total, page, pages: Math.ceil(total / limit) || 1, count: products.length, products });
}

export async function listDepartments(_req, res) {
  const rows = await Product.find({ isActive: true }).select("department page image").sort({ department: 1, name: 1 }).lean();
  const map = new Map();
  for (const p of rows) {
    const d = map.get(p.department) || { department: p.department, count: 0, page: p.page, image: p.image };
    d.count++;
    map.set(p.department, d);
  }
  res.json([...map.values()]);
}

export async function getProduct(req, res) {
  const product = await findByIdOrSku(req.params.id);
  const related = await Product.find({ department: product.department, _id: { $ne: product._id }, isActive: true })
    .select(PUBLIC_FIELDS).limit(4);
  res.json({ product, related });
}

const clean = (k, v) => (k === "compareAtPrice" && (v === "" || v === null || Number(v) <= 0) ? null : v);

export async function createProduct(req, res) {
  const data = Object.fromEntries(EDITABLE.filter((k) => k in req.body).map((k) => [k, clean(k, req.body[k])]));
  const product = await Product.create(data);
  res.status(201).json(product);
}

export async function updateProduct(req, res) {
  const product = await findByIdOrSku(req.params.id);
  for (const k of EDITABLE) if (k in req.body) product[k] = clean(k, req.body[k]);
  await product.save();
  res.json(product);
}

export async function deleteProduct(req, res) {
  const product = await findByIdOrSku(req.params.id);
  await product.deleteOne();
  res.json({ message: "Product deleted" });
}

export async function addReview(req, res) {
  const product = await findByIdOrSku(req.params.id);
  const existing = product.reviews.find((r) => r.user.equals(req.user._id));
  if (existing) {
    existing.rating = Number(req.body.rating);
    existing.comment = req.body.comment || "";
  } else {
    product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(req.body.rating), comment: req.body.comment || "" });
  }
  product.recalcRating();
  await product.save();
  res.status(existing ? 200 : 201).json({ message: existing ? "Review updated" : "Review added", rating: product.rating, numReviews: product.numReviews, reviews: product.reviews });
}

export async function deleteReview(req, res) {
  const product = await findByIdOrSku(req.params.id);
  const review = product.reviews.id(req.params.reviewId);
  if (!review) throw httpError(404, "Review not found");
  if (!review.user.equals(req.user._id) && req.user.role !== "admin") throw httpError(403, "Not your review");
  review.deleteOne();
  product.recalcRating();
  await product.save();
  res.json({ message: "Review removed" });
}
