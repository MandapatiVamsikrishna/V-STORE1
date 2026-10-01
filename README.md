# V-STORE

A full-stack online grocery and electronics store.

- **Storefront:** a multi-page HTML/CSS/JavaScript site, served by Vite.
- **API:** a REST API built with Node.js, Express 5 and MongoDB.

Shoppers can browse, search, check out, track orders and leave reviews. Admins can manage products, orders, customers and messages.

---

## Quick start (Windows + VS Code)

**You need:**
- **Node.js 20.11 or newer** (LTS). Check with `node -v`.
- **Git** and **VS Code**.

```powershell
git clone https://github.com/MandapatiVamsikrishna/V-STORE1.git
cd V-STORE1
code .
```

In the VS Code terminal (**Ctrl + `**):

```powershell
npm install
copy .env.example .env
npm run dev
```

Open **http://localhost:5173**. The terminal shows two coloured streams: `[api]` is the backend on port 5000 and `[web]` is the website on port 5173.

**Demo admin login:** `admin@vstore.local` / `Admin@12345` (then click **Admin** in the top bar).

### Which database?

**Full step-by-step guide: [DATABASE.md](DATABASE.md).** It covers creating a free permanent database, admin access, and four ways to look at your data.


With `MONGO_URI` left empty in `.env`, the API starts a temporary in-memory MongoDB. The first run downloads it (about 100 MB, once), and data resets whenever you stop the server. That is ideal for trying the app.

For data that persists, set `MONGO_URI` in `.env` to either:
- a MongoDB Atlas connection string: `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/vstore`
- a local MongoDB: `mongodb://127.0.0.1:27017/vstore`

On first start the API imports all 145 products and creates the admin account. After changing the catalogue file, run `npm run seed` (add missing products) or `npm run seed:reset` (re-import all). With a real database, run `npm run seed:reset` once to pick up the sale prices.

> ⚠️ **Never commit `.env`.** It is listed in `.gitignore`. The old repo had a real Atlas password committed, so that password must be changed in Atlas → Database Access.

### Handy VS Code features

- **Ctrl + Shift + B** runs the default build task, which starts `npm run dev`.
- **Run and Debug → "Debug API server"** lets you set breakpoints in any `server/` file.
- Open **`api.http`** with the REST Client extension to call the API from the editor.

---

## Design

Every page shares one shell and one stylesheet, `client/vstore.css`.

- **Colours:** leaf green `#1E7A46` for actions and the department bar, a light sage `#F4F6F3` background, and white cards. Citrus `#FFC83D` is used only for the cart count and promo codes. There is a full dark mode, and the choice is remembered.
- **Type:** Figtree for everything. Prices use aligned numerals.
- **Header on every page:** a delivery strip, then the logo, a store-wide search and account/cart icons, then the department bar. Icon labels hide on phones.
- **Components:** product cards, buttons, forms, tables, status pills and dialogs all use the same tokens. To change the brand colour, edit `--leaf` at the top of `vstore.css`.
- **Pages:**
  - `index.html` (home) and `categories.html` (all departments) are built from the real catalogue.
  - `search.html?q=` searches every product.
- **Responsive:** tested at 375 px with no sideways scrolling. Filters fold away on phones.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (auto-restarts on change) plus website with hot reload |
| `npm run server` / `npm run client` | Run just one of them |
| `npm run build` | Build the website into `dist/` |
| `npm start` | Production mode: API also serves `dist/` on http://localhost:5000 |
| `npm run seed` / `seed:reset` | Import the product catalogue into a real database |
| `npm run cloudshell` | Google Cloud Shell: pull the latest code from GitHub, install, build, and start on port 8080 |
| `npm run test:api` | 51-check end-to-end API test (start the server first) |

---

## Features

### Shoppers

- **Browsing:** 15 departments, with search, filters (category, price, rating) and sorting.
- **Product pages:** open from any card (`product.html?id=…`), with stock level, related items and reviews. You can post, update or delete your own review.
- **Cart:** quantity controls, and promo codes `WELCOME10`, `SAVE5`, `SAVE15` (orders of £60+) and `FREESHIP`. Delivery is free over £49.
- **Checkout:**
  - Payment by card (Luhn check, only the brand and last 4 digits are stored), UPI, PayPal or cash on delivery. All payments are simulated.
  - You're asked to sign in first, and your cart is kept while you do.
  - Your saved address is filled in for you.
- **Account:** register, sign in (with "remember me"), edit profile and address, change password.
- **Orders:** real order history with search, date and status filters, CSV export, and cancelling while an order is still "Processing" (stock is returned).
- **Wishlist:** saved with ♡ on any card. It works signed out and syncs to your account when you sign in.
- **Contact form:** messages go to the admin inbox.
- **Other:** dark mode, a delivery-country price display and a mobile layout.

- **Search:** the header search box shows instant suggestions (with photos and prices) as you type, and full results can be sorted by match, price, rating or name.
- **Mini cart:** adding an item opens a slide-out cart with quantity controls and a "£X to free delivery" progress bar.
- **Deals:** products with a "was" price show a −% badge and were/now prices. `deals.html` lists every offer.
- **Recently viewed:** shown on the home page and product pages.
- **Delivery slots:** checkout has Cart → Delivery & payment → Confirmation steps and a 5-day slot picker. The chosen slot is saved with the order.
- **Order tracking:** each order opens a details panel with a Placed → Shipped → Delivered timeline, the slot, address, payment and totals, plus a print option.

### Selling in 13 countries

Pick a country with **Deliver to** at the top of any page. Everything switches to that country's rules:
- **Currency:** GBP, EUR, USD, CAD, AUD, INR, SEK or PLN.
- **Tax:** UK, EU, Australia and India show tax-inclusive prices. The US and Canada add estimated sales tax at checkout.
- **Delivery:** each country has its own fee, free-delivery threshold and delivery time. The UK gets 2-hour slots; everywhere else shows an estimated arrival date.
- **What ships where:** fresh food (fruit, vegetables, dairy, eggs, meat, seafood and bakery) is UK-only. Tech, home and pantry items ship everywhere.
- **Payment:** card and PayPal everywhere; UPI in India; cash on delivery in the UK and India.
- **Address format:** postcode, ZIP, PIN, Eircode and so on, each validated in its own format.

All of these rules live in **`client/public/markets.json`**. The browser and the server read the same file, so the price a shopper sees is the price they're charged. The server enforces every rule: it re-prices orders and refuses fresh food outside the UK, wrong postcode formats, or payment methods that aren't allowed. To add a country or change a rate, edit that one file. Exchange rates are fixed demo rates, not live ones.

### Admins (`admin.html`)

- **Overview:** revenue, orders, orders waiting to ship, customers, new messages, recent orders and low-stock alerts.
- **Products:** search, add, edit, hide or delete products, and edit stock inline. Set a "Was price" on a product to put it on sale. Products at 0 stock show "Out of stock" in the shop.
- **Discounts:** create, edit, pause or delete promo codes (% off, amount off or free delivery), with an optional minimum spend, usage limit and expiry date. The store's code hints update automatically.
- **Orders:** filter by status and move orders through Processing → Shipped → Delivered, or Cancel (which restocks).
- **Messages and Customers:** mark messages read or resolved, and promote customers to admin.

### How pages connect

- **Every page:** the same header (search, Wishlist, Orders, Account, Cart), a department bar with Deals, and a footer with links to every section.
- **Products:** every product name and photo is a real link to its page, so it works with the keyboard and with "open in new tab".
- **Department pages:** end with links to related departments and Deals.
- **Product pages:** link back to their department ("More from Bakery →").
- **Help pages** (shipping, contact, terms, privacy, cookies): share a side menu.
- **Thank-you page:** leads to order tracking or back to the shop.
- **Admin:** has a way back to the store.

### Security

- Passwords are hashed with bcrypt.
- Sign-in uses JWT, and admin routes are protected.
- **Prices are always recalculated on the server**, so a tampered cart can't change what is charged.
- Stock is reserved atomically, so an item can't be oversold.
- Login and registration are rate-limited, and security headers come from Helmet.
- All input is validated, and API errors come back as clear messages.

### Works without the backend (GitHub Pages)

If the API isn't reachable, the site falls back to a local demo mode. Browsing, cart, wishlist, product pages and checkout still work in the browser, and sign-in explains that the server is needed.

`.github/workflows/pages.yml` publishes the site on every push to `main`. To turn it on, go to repo **Settings → Pages → Source: GitHub Actions**.

---

## Project structure

```
client/                 website (Vite root)
  *.html                one file per page
  vstore.css            the whole design system (one stylesheet for every page)
  public/               copied as-is: plain scripts, products.json, favicon
    api.js              shared API client, sign-in state, wishlist, nav links
    script.js           cart, filters, checkout, orders, chat (original code, wired to the API)
    *-page.js           product, wishlist, account, admin, contact, search pages
server/
  server.js app.js      entry point + Express app
  config/               env loading, MongoDB connection (in-memory fallback)
  models/               User, Product, Order, Message
  controllers/ routes/  REST endpoints
  middleware/           auth, validation, errors
  utils/pricing.js      promo and shipping rules (server = source of truth)
  data/products.json    catalogue (153 products extracted from the HTML pages)
  scripts/              seeding + smoke test
```

## API reference (base `/api`)

| Method & path | Access | Purpose |
|---|---|---|
| `POST /auth/register` · `POST /auth/login` | public | Create account / sign in → `{ user, token }` |
| `GET /auth/check-email?email=` | public | Is the email taken? |
| `GET, PUT /auth/me` · `PUT /auth/password` | user | Profile / change password |
| `GET, PUT /auth/wishlist` | user | Saved SKUs |
| `GET /products` | public | `?q, department, category, minPrice, maxPrice, minRating, sort, page, limit` |
| `GET /products/departments` · `GET /products/:skuOrId` | public | Departments / product + related |
| `POST, PUT, DELETE /products/:id` | admin | Manage catalogue |
| `POST, DELETE /products/:id/reviews[/:reviewId]` | user | Reviews |
| `POST /orders/quote` | public | Price a cart with server prices |
| `POST /orders` · `GET /orders/mine` · `GET /orders/:id` · `PUT /orders/:id/cancel` | user | Orders |
| `GET /orders` · `PUT /orders/:id/status` | admin | All orders / change status |
| `POST /contact` · `GET, PUT /contact[/:id]` | public · admin | Contact messages |
| `GET /admin/stats` · `GET /admin/users` · `PUT /admin/users/:id/role` | admin | Dashboard |

Send the token as `Authorization: Bearer <token>`.

---

## What changed from the original repo

**Backend:**
- It couldn't start: `server.js` and `utils/apiFeatures.js` were missing, and imports used hard-coded `C:\Users\…` paths or the wrong files. It was rewritten and tested.
- Added order status, stock control, server-side pricing, contact messages, wishlist, the admin API and seeding.

**Bugs fixed in the storefront:**
- **Duplicate orders:** `checkout.html` loaded `script.js` twice, so every order was submitted twice.
- **Wishlist heart couldn't be clicked:** the ♡ button sat underneath the product image on every card.
- **Prices shown 20% too high:** the country price converter added UK VAT on top of prices that already include it, so cart and order totals were 20% too high.
- **Broken links:** 404 links (`bakery`, `pantry`, `dairy`, `login.html`…) and broken stylesheet URLs (`https//…`).
- **Missing scripts:** references to non-existent scripts such as `pricing.js`, `cart.js`, `dept-*.js`, and `server.js` loaded in the browser.
- **Consistency:** file names with spaces or typos were renamed (`sea food.html` → `seafood.html`, `order history.html` → `orders.html` …), and branding is now "V-STORE" everywhere.

**New pages:**
- Product detail, wishlist, account and admin dashboard.
- Terms, privacy, shipping and cookies.
- A working contact form (replacing the placeholder).

**Removed:** the unused stub `product.html`, `Product.js`, `payment.html` and the React/Prisma template leftovers.
