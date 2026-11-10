import express from "express";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  payOrder,
  markDelivered,
  getAllOrders
} from "C:\Users\vtu16\OneDrive\Documents\GitHub\V-STORE1\V-STORE1\controllers\orderController.js";
import { protect, admin } from "C:\Users\vtu16\OneDrive\Documents\GitHub\V-STORE1\V-STORE1\routers\authRoutes.js";

const router = express.Router();

router.route("/")
  .post(protect, createOrder)
  .get(protect, admin, getAllOrders);

router.get("/mine", protect, getMyOrders);

router.route("/:id")
  .get(protect, getOrderById);

router.put("/:id/pay", protect, payOrder);
router.put("/:id/deliver", protect, admin, markDelivered);

export default router;
