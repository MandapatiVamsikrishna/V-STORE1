import express from "express";
import { body } from "express-validator";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview
} from "V-STORE1/controllers/productController.js";
import { protect, admin } from "C:\Users\vtu16\OneDrive\Documents\GitHub\V-STORE1\V-STORE1\routers\authRoutes.js";

const router = express.Router();

router.route("/")
  .get(getProducts)
  .post(
    protect,
    admin,
    [
      body("name").notEmpty(),
      body("price").isFloat({ min: 0 }),
      body("countInStock").isInt({ min: 0 })
    ],
    createProduct
  );

router.route("/:id")
  .get(getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

router.post("/:id/reviews", protect, body("rating").isFloat({ min: 0, max: 5 }), createProductReview);

export default router;
