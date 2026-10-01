import { Router } from "express";
import { body } from "express-validator";
import rateLimit from "express-rate-limit";
import { protect, admin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as auth from "../controllers/authController.js";
import * as products from "../controllers/productController.js";
import * as orders from "../controllers/orderController.js";
import * as contact from "../controllers/contactController.js";
import * as adminCtl from "../controllers/adminController.js";
import * as promos from "../controllers/promoController.js";
import { MARKETS, PERISHABLE } from "../utils/pricing.js";

const router = Router();

// Sign-in / sign-up are rate limited to slow down password guessing
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many attempts — try again in a few minutes" } });

router.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
router.get("/markets", (_req, res) => res.json({ markets: MARKETS, perishableDepartments: [...PERISHABLE] }));

/* ---------- Auth & account ---------- */
router.post("/auth/register", authLimiter,
  body("name").trim().isLength({ min: 2 }).withMessage("Enter your full name"),
  body("email").trim().isEmail().withMessage("Enter a valid email address").normalizeEmail({ gmail_remove_dots: false }),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("phone").optional({ values: "falsy" }).matches(/^\+?[0-9\s\-()]{7,}$/).withMessage("Enter a valid phone number"),
  validate, auth.register);
router.post("/auth/login", authLimiter,
  body("email").trim().isEmail().withMessage("Enter a valid email address"),
  body("password").notEmpty().withMessage("Enter your password"),
  validate, auth.login);
router.get("/auth/check-email", auth.checkEmail);
router.get("/auth/me", protect, auth.me);
router.put("/auth/me", protect,
  body("name").optional().trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  validate, auth.updateMe);
router.put("/auth/password", protect,
  body("currentPassword").notEmpty().withMessage("Enter your current password"),
  body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
  validate, auth.changePassword);
router.get("/auth/wishlist", protect, auth.getWishlist);
router.put("/auth/wishlist", protect, auth.setWishlist);

/* ---------- Products ---------- */
// optional auth so admins can pass ?all=true to include hidden products
const optionalAuth = async (req, res, next) => (req.headers.authorization || req.headers["x-auth-token"] ? protect(req, res, next) : next());
router.get("/products", optionalAuth, products.listProducts);
router.get("/products/departments", products.listDepartments);
router.get("/products/:id", products.getProduct);
const productRules = [
  body("sku").optional().trim().notEmpty().withMessage("SKU can't be empty"),
  body("name").optional().trim().notEmpty().withMessage("Name can't be empty"),
  body("price").optional().isFloat({ min: 0 }).withMessage("Price must be 0 or more"),
  body("compareAtPrice").optional({ values: "null" }).custom((v) => v === "" || Number(v) >= 0).withMessage("Was price must be 0 or more"),
  body("countInStock").optional().isInt({ min: 0 }).withMessage("Stock must be a whole number, 0 or more")
];
router.post("/products", protect, admin,
  body("sku").trim().notEmpty().withMessage("SKU is required"),
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("price").isFloat({ min: 0 }).withMessage("Price must be 0 or more"),
  ...productRules, validate, products.createProduct);
router.put("/products/:id", protect, admin, ...productRules, validate, products.updateProduct);
router.delete("/products/:id", protect, admin, products.deleteProduct);
router.post("/products/:id/reviews", protect,
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Choose a rating from 1 to 5"),
  body("comment").optional().isLength({ max: 1000 }).withMessage("Keep reviews under 1000 characters"),
  validate, products.addReview);
router.delete("/products/:id/reviews/:reviewId", protect, products.deleteReview);

/* ---------- Orders ---------- */
router.post("/orders/quote", orders.quote);
router.post("/orders", protect,
  body("shippingAddress.name").trim().isLength({ min: 2 }).withMessage("Enter the recipient's full name"),
  body("shippingAddress.line1").trim().isLength({ min: 5 }).withMessage("Enter a valid address"),
  validate, orders.createOrder);
router.get("/orders/mine", protect, orders.myOrders);
router.get("/orders", protect, admin, orders.allOrders);
router.get("/orders/:id", protect, orders.getOrder);
router.put("/orders/:id/cancel", protect, orders.cancelOrder);
router.put("/orders/:id/status", protect, admin, orders.updateStatus);

/* ---------- Contact ---------- */
router.post("/contact", rateLimit({ windowMs: 60 * 60 * 1000, limit: 20 }),
  body("name").trim().isLength({ min: 2 }).withMessage("Enter your name"),
  body("email").trim().isEmail().withMessage("Enter a valid email address"),
  body("message").trim().isLength({ min: 10 }).withMessage("Message should be at least 10 characters"),
  validate, contact.createMessage);
router.get("/contact", protect, admin, contact.listMessages);
router.put("/contact/:id", protect, admin, contact.updateMessage);

/* ---------- Discount codes ---------- */
router.get("/promos/public", promos.publicPromos);
router.get("/promos/check/:code", promos.checkPromo);
const promoRules = [
  body("code").optional().trim().matches(/^[A-Za-z0-9_-]{3,20}$/).withMessage("Codes use 3–20 letters, numbers, - or _"),
  body("type").optional().isIn(["percent", "flat", "freeship"]).withMessage("Choose % off, amount off or free delivery"),
  body("value").optional().isFloat({ min: 0 }).withMessage("Value must be 0 or more"),
  body("minSubtotal").optional().isFloat({ min: 0 }).withMessage("Minimum spend must be 0 or more"),
  body("maxUses").optional().isInt({ min: 0 }).withMessage("Usage limit must be a whole number (0 = unlimited)")
];
router.get("/promos", protect, admin, promos.listPromos);
router.post("/promos", protect, admin, body("code").notEmpty().withMessage("Enter a code"), body("type").notEmpty().withMessage("Choose a discount type"), ...promoRules, validate, promos.createPromo);
router.put("/promos/:id", protect, admin, ...promoRules, validate, promos.updatePromo);
router.delete("/promos/:id", protect, admin, promos.deletePromo);

/* ---------- Admin ---------- */
router.get("/admin/stats", protect, admin, adminCtl.stats);
router.get("/admin/users", protect, admin, adminCtl.listUsers);
router.put("/admin/users/:id/role", protect, admin, adminCtl.setUserRole);

export default router;
