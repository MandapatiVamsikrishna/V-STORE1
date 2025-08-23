import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },  // URL-friendly name
  description: String,
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'GBP' },
  images: [String],
  category: String,
  brand: String,
  stock: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// for search
ProductSchema.index({ title: 'text', description: 'text', category: 'text' });

export default mongoose.model('Product', ProductSchema);
