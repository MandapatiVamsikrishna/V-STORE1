// src/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import productRoutes from './routes/products.js';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true })); 
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

// Test route
app.use('/api/products', productRoutes);
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Connect DB and start server
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(process.env.PORT || 4000, () => {
      console.log(`✅ API running at http://localhost:${process.env.PORT || 4000}`);
    });
  })
  .catch((err) => console.error('❌ MongoDB Error:', err));
