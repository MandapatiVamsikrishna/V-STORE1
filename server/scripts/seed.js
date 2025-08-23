import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../src/models/Product.js';

await mongoose.connect(process.env.MONGODB_URI);

await Product.deleteMany({});

await Product.insertMany([
  {
    title: "Wireless Headphones",
    slug: "wireless-headphones",
    description: "Noise-cancelling Bluetooth headphones.",
    price: 59.99,
    currency: "GBP",
    images: ["/img/headphones.jpg"],
    category: "electronics",
    stock: 20
  },
  {
    title: "Running Shoes",
    slug: "running-shoes",
    description: "Lightweight running shoes for daily training.",
    price: 79.99,
    currency: "GBP",
    images: ["/img/shoes.jpg"],
    category: "sports",
    stock: 15
  }
]);

console.log("✅ Products seeded");
process.exit(0);
