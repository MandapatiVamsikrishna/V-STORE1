import mongoose from "mongoose";

export const ORDER_STATUSES = ["Processing", "Shipped", "Delivered", "Cancelled"];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    sku: String,
    name: String,
    image: String,
    price: Number, // unit price in the order currency at time of purchase (from DB, never trusted from client)
    qty: { type: Number, min: 1 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    shippingAddress: {
      name: String, email: String, phone: String,
      line1: String, city: String, state: String, postcode: String, country: String
    },
    payment: {
      method: { type: String, enum: ["card", "upi", "paypal", "cod"], default: "card" },
      brand: String,   // Visa / Mastercard…
      last4: String,   // never store the full card number
      handle: String,  // UPI id
      transactionId: String
    },
    market: { type: String, default: "GB" },          // delivery country code (see markets.json)
    currency: { type: String, default: "GBP" },       // all money fields below are in this currency
    deliverySlot: { type: String, maxlength: 80 },
    deliveryEstimate: String,   // e.g. "Thu 2 Oct, 10:00–12:00"
    promoCode: String,
    subtotal: Number,
    discount: Number,
    shipping: Number,
    tax: { type: Number, default: 0 },          // added at checkout (US/CA)
    taxIncluded: { type: Number, default: 0 },  // already inside prices (UK/EU/AU/IN)
    totalGBP: Number,                           // approximate GBP value, for store reporting
    total: Number,
    status: { type: String, enum: ORDER_STATUSES, default: "Processing" },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date
  },
  { timestamps: true }
);

orderSchema.pre("validate", function (next) {
  if (!this.orderNumber) {
    const d = new Date();
    const ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
    this.orderNumber = `ORD-${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
  next();
});

export default mongoose.model("Order", orderSchema);
