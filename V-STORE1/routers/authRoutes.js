import express from "express";
import { body } from "express-validator";
import { register, login, getProfile } from "../controllers/authController.js";
import { protect } from "V-STORE1/middleware/authMiddleWare.js";

const router = express.Router();

router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Min 6 chars")
  ],
  register
);

router.post("/login", login);
router.get("/me", protect, getProfile);

export default router;
