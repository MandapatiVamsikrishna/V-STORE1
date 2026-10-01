import User from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";

const authResponse = (user) => ({ user: user.toSafeJSON(), token: signToken(user._id) });

export async function register(req, res) {
  const { name, email, password, phone } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) {
    throw httpError(409, "This email is already registered", [{ field: "email", message: "Email already registered" }]);
  }
  const user = await User.create({ name, email, password, phone: phone || "" });
  res.status(201).json(authResponse(user));
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() }).select("+password");
  if (!user || !(await user.matchPassword(password))) throw httpError(401, "Incorrect email or password");
  res.json(authResponse(user));
}

export async function checkEmail(req, res) {
  const email = String(req.query.email || "").toLowerCase().trim();
  res.json({ taken: email ? Boolean(await User.exists({ email })) : false });
}

export async function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}

export async function updateMe(req, res) {
  const { name, phone, address } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  if (address !== undefined) req.user.address = { ...req.user.address?.toObject?.(), ...address };
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.matchPassword(currentPassword))) throw httpError(400, "Current password is incorrect");
  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated" });
}

export async function getWishlist(req, res) {
  res.json({ wishlist: req.user.wishlist });
}

export async function setWishlist(req, res) {
  const skus = Array.isArray(req.body.wishlist) ? req.body.wishlist : [];
  req.user.wishlist = [...new Set(skus.map(String))].slice(0, 500);
  await req.user.save();
  res.json({ wishlist: req.user.wishlist });
}
