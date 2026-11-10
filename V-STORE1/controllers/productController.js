import Product from "C:\Users\vtu16\OneDrive\Documents\GitHub\V-STORE1\V-STORE1\models\product.js";
import APIFeatures from "../utils/apiFeatures.js";
import { validationResult } from "express-validator";

export const getProducts = async (req, res) => {
  const features = new APIFeatures(Product.find(), req.query)
    .search()
    .filter()
    .sort()
    .paginate();
  const products = await features.query;
  const total = await Product.countDocuments();
  res.json({ total, count: products.length, products });
};

export const getProductById = async (req, res) => {
  const prod = await Product.findById(req.params.id);
  if (!prod) return res.status(404).json({ message: "Product not found" });
  res.json(prod);
};

export const createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const product = await Product.create({ ...req.body, user: req.user._id });
  res.status(201).json(product);
};

export const updateProduct = async (req, res) => {
  const prod = await Product.findById(req.params.id);
  if (!prod) return res.status(404).json({ message: "Product not found" });
  Object.assign(prod, req.body);
  await prod.save();
  res.json(prod);
};

export const deleteProduct = async (req, res) => {
  const prod = await Product.findById(req.params.id);
  if (!prod) return res.status(404).json({ message: "Product not found" });
  await prod.deleteOne();
  res.json({ message: "Product removed" });
};

export const createProductReview = async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const already = product.reviews.find((r) => r.user.toString() === req.user._id.toString());
  if (already) return res.status(400).json({ message: "Product already reviewed" });

  product.reviews.push({
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment
  });
  product.numReviews = product.reviews.length;
  product.rating =
    product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length;

  await product.save();
  res.status(201).json({ message: "Review added" });
};
