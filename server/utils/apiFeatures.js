const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds a Mongo filter + sort + pagination from query params:
 *  ?q=apple&department=Fruits&category=citrus&minPrice=1&maxPrice=10&minRating=4
 *  &sort=price-asc|price-desc|name-asc|name-desc|rating-desc|newest&page=1&limit=24
 */
export function buildProductQuery(query, { includeInactive = false } = {}) {
  const filter = includeInactive ? {} : { isActive: true };

  if (query.q) {
    const rx = new RegExp(escapeRegex(String(query.q).trim()), "i");
    filter.$or = [{ name: rx }, { description: rx }, { category: rx }, { department: rx }, { sku: rx }];
  }
  for (const key of ["department", "category", "page"]) {
    if (query[key]) {
      const values = String(query[key]).split(",").map((v) => new RegExp(`^${escapeRegex(v.trim())}$`, "i"));
      filter[key] = { $in: values };
    }
  }
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }
  if (query.minRating) filter.rating = { $gte: Number(query.minRating) };
  if (query.inStock === "true") filter.countInStock = { $gt: 0 };
  if (query.onSale === "true") filter.compareAtPrice = { $gt: 0 }; // only ever set when higher than price (see Product model)

  const sorts = {
    "price-asc": { price: 1 }, "price-desc": { price: -1 },
    "name-asc": { name: 1 }, "name-desc": { name: -1 },
    "rating-desc": { rating: -1 }, newest: { createdAt: -1 }
  };
  const sort = sorts[query.sort] || { department: 1, name: 1 };

  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 24));
  const page = Math.max(1, parseInt(query.page, 10) || 1);

  return { filter, sort, limit, page, skip: (page - 1) * limit };
}
