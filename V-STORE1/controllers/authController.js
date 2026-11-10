import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import User from "C:\Users\vtu16\OneDrive\Documents\GitHub\V-STORE1\authentication.js";

const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

export const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: "Email already registered" });

  const user = await User.create({ name, email, password });
  const token = genToken(user._id);
  res.status(201).json({ user: { id: user._id, name, email, role: user.role }, token });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const token = genToken(user._id);
  res.json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    token
  });
};

export const getProfile = async (req, res) => {
  res.json(req.user);
};
