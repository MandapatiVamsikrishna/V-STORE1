import Product from '../models/Product.js';

// List products
export async function list(req, res) {
  const { search = '', category, sort = '-createdAt', page = 1, limit = 20 } = req.query;
  const q = { isActive: true };
  if (category) q.category = category;
  if (search) q.$text = { $search: search };

  const data = await Product.find(q)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Product.countDocuments(q);
  res.json({ data, total });
}

// Get single product by slug
export async function getOne(req, res) {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true });
  if (!product) return res.status(404).json({ message: 'Not found' });
  res.json(product);
}
