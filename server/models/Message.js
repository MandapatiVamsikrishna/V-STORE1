import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, trim: true, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: { type: String, enum: ["new", "read", "resolved"], default: "new" }
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
