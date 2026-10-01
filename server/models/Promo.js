import mongoose from "mongoose";

// Discount codes managed from the admin Discounts tab
const promoSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: [/^[A-Z0-9_-]{3,20}$/, "Codes use 3–20 letters, numbers, - or _"] },
    description: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["percent", "flat", "freeship"], required: true },
    value: { type: Number, min: 0, default: 0 },          // percent (1–90) or a UK amount in GBP for "flat"
    minSubtotal: { type: Number, min: 0, default: 0 },    // minimum spend in GBP (converted per country like prices)
    active: { type: Boolean, default: true },
    showOnSite: { type: Boolean, default: true },         // listed in the store's code hints
    expiresAt: { type: Date, default: null },
    maxUses: { type: Number, min: 0, default: 0 },        // 0 = unlimited
    uses: { type: Number, min: 0, default: 0 }
  },
  { timestamps: true }
);

promoSchema.pre("validate", function (next) {
  if (this.type === "percent" && !(this.value >= 1 && this.value <= 90)) this.invalidate("value", "Percent discounts must be between 1 and 90");
  if (this.type === "flat" && !(this.value > 0)) this.invalidate("value", "Enter the amount to take off");
  if (this.type === "freeship") this.value = 0;
  next();
});

/** Why a code can't be used right now (or null if it can) */
promoSchema.methods.problem = function () {
  if (!this.active) return "That promo code isn't active right now";
  if (this.expiresAt && this.expiresAt < new Date()) return "That promo code has expired";
  if (this.maxUses && this.uses >= this.maxUses) return "That promo code has been fully used";
  return null;
};

promoSchema.methods.toPublic = function () {
  const { code, description, type, value, minSubtotal, expiresAt } = this;
  return { code, description, type, value, minSubtotal, expiresAt };
};

export default mongoose.model("Promo", promoSchema);
