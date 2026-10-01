// End-to-end API check. Start the server first (npm run server), then: npm run test:api
const BASE = process.env.API_URL || "http://localhost:5000/api";
let pass = 0, fail = 0;
const call = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const check = (label, cond, extra = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✔" : "✘"} ${label}${!cond && extra ? " → " + JSON.stringify(extra).slice(0, 300) : ""}`);
};

const email = `test${Date.now()}@example.com`;
let r = await call("GET", "/health"); check("health", r.data.ok);
r = await call("GET", "/products?limit=5"); check("list products", r.data.total > 100 && r.data.products.length === 5, r.data);
r = await call("GET", "/products?department=Fruits&sort=price-asc"); check("filter + sort", r.data.products.every((p, i, a) => p.department === "Fruits" && (!i || a[i - 1].price <= p.price)), r.data);
r = await call("GET", "/products?q=apple"); check("search", r.data.total >= 1, r.data);
r = await call("GET", "/products/departments"); check("departments", r.data.length >= 10, r.data);
r = await call("GET", "/products/p-apple"); check("product by SKU", r.data.product?.name === "Red Apples", r.data);

r = await call("POST", "/auth/register", { name: "Test User", email, password: "short" }); check("register rejects weak password", r.status === 400, r.data);
r = await call("POST", "/auth/register", { name: "Test User", email, password: "Password123!", phone: "+44 7700 900123" }); check("register", r.status === 201 && r.data.token, r.data);
const token = r.data.token;
r = await call("GET", `/auth/check-email?email=${email}`); check("check-email taken", r.data.taken === true);
r = await call("POST", "/auth/login", { email, password: "wrong-pass" }); check("login rejects bad password", r.status === 401);
r = await call("POST", "/auth/login", { email, password: "Password123!" }); check("login", !!r.data.token);
r = await call("GET", "/auth/me", null, token); check("me", r.data.user?.email === email, r.data);
r = await call("PUT", "/auth/me", { name: "Tess User", address: { line1: "1 Test Road", city: "London" } }, token); check("update profile", r.data.user?.name === "Tess User", r.data);
r = await call("PUT", "/auth/wishlist", { wishlist: ["p-apple", "p-banana"] }, token); check("wishlist", r.data.wishlist?.length === 2, r.data);

const stockBefore = (await call("GET", "/products/p-apple")).data.product.countInStock;
const items = [{ id: "p-apple", qty: 3, price: 0.01 }, { id: "p-banana", qty: 2 }];
r = await call("POST", "/orders/quote", { items, promoCode: "WELCOME10" }); check("quote uses DB prices (ignores client price)", r.data.items?.[0]?.price === 2.99 && r.data.discount > 0, r.data);
r = await call("POST", "/orders", { items, shippingAddress: { name: "Test User", line1: "1 Test Road", city: "London", postcode: "E1 1AA", country: "UK" }, payment: { method: "card", brand: "Visa", last4: "4242" }, promoCode: "SAVE5" }, token);
check("create order", r.status === 201 && r.data.orderNumber && r.data.isPaid, r.data);
const orderId = r.data._id;
r = await call("GET", "/products/p-apple"); check("stock decremented", r.data.product.countInStock === stockBefore - 3, r.data.product);
r = await call("GET", "/orders/mine", null, token); check("my orders", r.data.length === 1, r.data);
r = await call("POST", "/products/p-apple/reviews", { rating: 4, comment: "Crisp!" }, token); check("add review", r.status === 201, r.data);
r = await call("GET", "/orders", null, token); check("non-admin blocked from all orders", r.status === 403);

r = await call("POST", "/auth/login", { email: "admin@vstore.local", password: "Admin@12345" }); const adminToken = r.data.token;
check("admin login", r.data.user?.role === "admin", r.data);
r = await call("GET", "/admin/stats", null, adminToken); check("admin stats", r.data.orders >= 1, r.data);
r = await call("PUT", `/orders/${orderId}/status`, { status: "Shipped" }, adminToken); check("admin ships order", r.data.status === "Shipped", r.data);
r = await call("PUT", `/orders/${orderId}/cancel`, null, token); check("can't cancel shipped order", r.status === 400);
r = await call("POST", "/products", { sku: "test-sku", name: "Test Product", price: 9.99, department: "Test", countInStock: 5 }, adminToken); check("admin create product", r.status === 201, r.data);
r = await call("PUT", "/products/test-sku", { price: 7.5 }, adminToken); check("admin update product", r.data.price === 7.5, r.data);
r = await call("DELETE", "/products/test-sku", null, adminToken); check("admin delete product", r.status === 200, r.data);
r = await call("POST", "/contact", { name: "Test", email, message: "Hello there, testing the form." }); check("contact form", r.status === 201, r.data);
r = await call("GET", "/contact", null, adminToken); check("admin reads messages", r.data.length >= 1, r.data);

// ---- Country rules ----
r = await call("GET", "/markets"); check("markets list (13)", Object.keys(r.data.markets || {}).length === 13, r.data);
r = await call("POST", "/orders/quote", { items: [{ id: "el-wireless-buds", qty: 1 }], market: "US" });
check("US quote: USD + sales tax on top", r.data.currency === "USD" && r.data.tax > 0 && r.data.total > r.data.subtotal, r.data);
r = await call("POST", "/orders/quote", { items: [{ id: "el-wireless-buds", qty: 1 }], market: "DE" });
check("DE quote: EUR, tax included", r.data.currency === "EUR" && r.data.tax === 0 && r.data.taxIncluded > 0, r.data);
r = await call("POST", "/orders/quote", { items: [{ id: "p-banana", qty: 1 }], market: "US" });
check("quote flags fresh food as unavailable in US", (r.data.unavailable || []).includes("p-banana"), r.data);
const intl = { name: "Test User", line1: "1 Test Road", city: "Somewhere" };
r = await call("POST", "/orders", { items: [{ id: "p-banana", qty: 1 }], market: "US", shippingAddress: { ...intl, postcode: "10001" }, payment: { method: "card", last4: "4242" } }, token);
check("US order with fresh food is refused", r.status === 400 && /UK only/.test(r.data.message), r.data);
r = await call("POST", "/orders", { items: [{ id: "el-wireless-buds", qty: 1 }], market: "US", shippingAddress: { ...intl, postcode: "SW1A 1AA" }, payment: { method: "card", last4: "4242" } }, token);
check("US order with a UK postcode is refused", r.status === 400 && /ZIP/.test(r.data.message), r.data);
r = await call("POST", "/orders", { items: [{ id: "el-wireless-buds", qty: 1 }], market: "US", shippingAddress: { ...intl, postcode: "10001" }, payment: { method: "upi", handle: "a@upi" } }, token);
check("UPI refused outside India", r.status === 400 && /UPI/.test(r.data.message), r.data);
r = await call("POST", "/orders", { items: [{ id: "el-wireless-buds", qty: 1 }], market: "US", shippingAddress: { ...intl, postcode: "10001" }, payment: { method: "card", last4: "4242" } }, token);
check("US order stored in USD with tax + estimate, no slot", r.status === 201 && r.data.currency === "USD" && r.data.tax > 0 && r.data.deliveryEstimate && !r.data.deliverySlot && r.data.totalGBP > 0, r.data);
r = await call("POST", "/orders", { items: [{ id: "el-wireless-buds", qty: 1 }], market: "IN", shippingAddress: { ...intl, postcode: "110001" }, payment: { method: "upi", handle: "test@okicici" } }, token);
check("India order with UPI in INR", r.status === 201 && r.data.currency === "INR", r.data);

// ---- Discount codes (Admin → Discounts) ----
r = await call("GET", "/promos/public"); check("public codes include WELCOME10", (r.data || []).some((p) => p.code === "WELCOME10"), r.data);
r = await call("POST", "/promos", { code: "ONCE20", type: "percent", value: 20, maxUses: 1 }, token); check("customer can't create codes", r.status === 403);
r = await call("POST", "/promos", { code: "once20", type: "percent", value: 20, maxUses: 1, description: "Test" }, adminToken);
check("admin creates code (stored upper-case)", r.status === 201 && r.data.code === "ONCE20", r.data); const promoId = r.data._id;
r = await call("POST", "/promos", { code: "BAD", type: "percent", value: 95 }, adminToken); check("percent over 90 refused", r.status === 400, r.data);
r = await call("GET", "/promos/check/once20"); check("code check works", r.data.type === "percent" && r.data.value === 20, r.data);
const once = { items: [{ id: "el-wireless-buds", qty: 1 }], market: "GB", promoCode: "ONCE20", shippingAddress: { name: "Test User", line1: "1 Test Road", city: "London", postcode: "E1 1AA" }, payment: { method: "card", last4: "4242" } };
r = await call("POST", "/orders", once, token); check("order with ONCE20 gets 20% off", r.status === 201 && r.data.promoCode === "ONCE20" && r.data.discount > 0, r.data);
r = await call("POST", "/orders", once, token); check("second use refused (limit 1)", r.status === 400 && /fully used/.test(r.data.message), r.data);
r = await call("PUT", `/promos/${promoId}`, { maxUses: 0, active: false }, adminToken); check("admin pauses code", r.data.active === false, r.data);
r = await call("GET", "/promos/check/ONCE20"); check("paused code refused", r.status === 400 && /isn't active/.test(r.data.message), r.data);
r = await call("PUT", `/promos/${promoId}`, { active: true, expiresAt: "2020-01-01T00:00:00Z" }, adminToken);
r = await call("GET", "/promos/check/ONCE20"); check("expired code refused", r.status === 400 && /expired/.test(r.data.message), r.data);
r = await call("POST", "/promos", { code: "BIGSPEND", type: "flat", value: 10, minSubtotal: 500 }, adminToken);
r = await call("POST", "/orders", { ...once, promoCode: "BIGSPEND" }, token); check("minimum spend enforced", r.status === 400 && /minimum spend/.test(r.data.message), r.data);
r = await call("DELETE", `/promos/${promoId}`, null, adminToken); check("admin deletes code", r.status === 200, r.data);
r = await call("GET", "/promos/check/ONCE20"); check("deleted code is invalid", r.status === 404, r.data);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
