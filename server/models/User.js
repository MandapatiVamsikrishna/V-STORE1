import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const addressSchema = new mongoose.Schema(
  { line1: String, city: String, state: String, postcode: String, country: String },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    phone: { type: String, trim: true, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    address: { type: addressSchema, default: () => ({}) },
    wishlist: [{ type: String }] // product SKUs
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.toSafeJSON = function () {
  const { _id, name, email, phone, role, address, wishlist, createdAt } = this;
  return { id: _id, name, email, phone, role, address, wishlist, createdAt };
};

export default mongoose.model("User", userSchema);
