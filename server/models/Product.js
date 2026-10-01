import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: String,
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 1000 }
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true }, // matches data-id in the HTML cards
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true, default: "" },
    department: { type: String, trim: true, index: true }, // Fruits, Bakery, Electronics…
    category: { type: String, trim: true, index: true },   // finer grain: citrus, bread…
    page: { type: String, default: "" },                   // which HTML page lists it
    description: { type: String, trim: true, default: "" },
    image: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0, default: null },   // "was" price — shown as a sale when higher than price
    priceLabel: { type: String, default: "" },             // e.g. "£2.99 / lb"
    countInStock: { type: Number, required: true, min: 0, default: 100 },
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    reviews: [reviewSchema],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// A "was" price only makes sense when it's higher than the current price
productSchema.pre("save", function (next) {
  if (this.compareAtPrice != null && !(this.compareAtPrice > this.price)) this.compareAtPrice = null;
  next();
});

productSchema.index({ name: "text", description: "text", category: "text", department: "text" });

productSchema.methods.recalcRating = function () {
  this.numReviews = this.reviews.length;
  if (this.numReviews) {
    this.rating = +(this.reviews.reduce((a, r) => a + r.rating, 0) / this.numReviews).toFixed(1);
  }
};

export default mongoose.model("Product", productSchema);
