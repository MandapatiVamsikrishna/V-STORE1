# V-STORE database guide

V-STORE stores everything in **MongoDB**: products, customers, orders, discount codes and contact messages.

With `MONGO_URI` empty in `.env`, the server uses a **temporary database that is wiped every time it stops**. That's fine for testing; for a real shop, use a permanent database. MongoDB Atlas has a free tier that is plenty for this project.

---

## 1. Create a free MongoDB Atlas database (about 10 minutes)

1. **Sign up.** Go to https://www.mongodb.com/cloud/atlas/register. Signing in with Google is fine.
2. **Create the cluster.**
   - Choose **Create**, then **M0 (Free)**.
   - Pick a provider and the region closest to you (for London, for example *AWS eu-west-2* or *Google europe-west2*).
   - Name it `vstore`, then click **Create Deployment**.
3. **Create a database user.** Atlas offers to do this straight away, or go to **Security → Database Access → Add New Database User**.
   - Username: `vstore-app`
   - Password: click **Autogenerate Secure Password** and **copy it somewhere safe**.
   - Role: **Read and write to any database**.
   - If you still have the old user whose password was in the original repo's `.env`, **delete that user**.
4. **Allow connections.** Go to **Security → Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`). Cloud Shell's IP address changes every session, so a fixed IP won't work. The strong password is what protects the database.
5. **Copy the connection string.**
   - Go to **Database → Connect → Drivers** and copy the string. It looks like this:
     ```
     mongodb+srv://vstore-app:<db_password>@vstore.abcde.mongodb.net/?retryWrites=true&w=majority&appName=vstore
     ```
   - Replace `<db_password>` with your password, and add the database name `vstore` just before the `?`:
     ```
     mongodb+srv://vstore-app:YOUR-PASSWORD@vstore.abcde.mongodb.net/vstore?retryWrites=true&w=majority&appName=vstore
     ```
   - If your password contains `@ : / ? # %`, either generate one without them, or replace each one (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`, `#` → `%23`, `%` → `%25`).

## 2. Connect V-STORE to it

In Cloud Shell, or in the project folder on your PC:

```bash
cd ~/V-STORE1
nano .env
```

Set these lines, then save with **Ctrl+O**, **Enter** and **Ctrl+X**:

```
MONGO_URI=mongodb+srv://vstore-app:YOUR-PASSWORD@vstore.abcde.mongodb.net/vstore?retryWrites=true&w=majority&appName=vstore
ADMIN_NAME=Your Name
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-password-only-you-know
```

> **Set your admin email and password before the first start.** The admin account is created only once, when the database is empty.

Start the store:

```bash
pkill -f "^node server/server.js"; npm run build && PORT=8080 npm start
```

The first start against the new database prints:

```
✅ MongoDB connected: ac-xxxx.vstore.abcde.mongodb.net/vstore
🌱 Seeded 145 products from server/data/products.json
🏷️  Created 4 starting discount codes (edit them in Admin → Discounts)
👤 Admin created: you@example.com / (from .env)
```

From now on, everything is saved permanently: products you add, orders, customers and codes.

**`.env` is never uploaded to GitHub** (it's in `.gitignore`). If you work in both Cloud Shell and on your PC, put the same `MONGO_URI` in both `.env` files, and they'll share one database.

---

## 3. Your admin access

Sign in with your `ADMIN_EMAIL`. A shield icon labelled **Admin** appears in the header. Each tab does the following:

| Tab | What you can do |
|---|---|
| **Overview** | Revenue (in GBP), number of orders, orders waiting to ship, customers, products, new messages, low-stock alerts |
| **Products** | **Add** a product, **edit** any field, **delete**, hide it from the shop (Visible: No), change **stock** inline, and set a **Was price** to put it on sale with a −% badge |
| **Discounts** | **Create, edit, pause, activate or delete** promo codes: % off, amount off or free delivery, with optional **minimum spend**, **usage limit** and **expiry date**, and the number of times each code has been used |
| **Orders** | See every order (in its own currency) and move it Processing → Shipped → Delivered, or Cancel it (stock is returned) |
| **Messages** | Read contact-form messages and mark them read or resolved |
| **Customers** | See all accounts and make someone an **admin** (or remove admin) |

Change your own password any time from **Account** (person icon).

**If an admin already exists** (for example `admin@vstore.local`, from before you set your own), you have two options:
- sign in as that admin and make your own account admin under **Customers**, or
- sign in and change its password on the **Account** page.

---

## 4. Looking at the database directly

Day to day, use the **Admin** pages. They check everything (prices, codes, stock), while the tools below edit the raw data with no checks. These tools are useful for looking, exporting and fixing.

### a) Atlas website (easiest)
Go to **Database → Browse Collections → vstore**. You can open any collection, filter it (for example `{ "department": "Fruits" }`), and edit or delete documents.

### b) MongoDB Compass (Windows app)
Download it from https://www.mongodb.com/try/download/compass, click **New connection**, paste your connection string and **Connect**. You can browse, filter and **export** a collection to JSON or CSV with **Collection → Export Data**.

### c) VS Code
Install the **MongoDB for VS Code** extension (the project suggests it). Click the leaf icon in the sidebar, **Add Connection**, and paste the connection string.

### d) Terminal (Cloud Shell)
```bash
npx -y mongosh "mongodb+srv://vstore-app:YOUR-PASSWORD@vstore.abcde.mongodb.net/vstore"
```
Then try:
```js
db.products.countDocuments()
db.orders.find().sort({ createdAt: -1 }).limit(5)
db.promos.find({}, { code: 1, type: 1, value: 1, uses: 1, active: 1 })
db.users.find({}, { name: 1, email: 1, role: 1 })
```
Type `exit` to leave.

---

## 5. What's in the database

| Collection | One document per | Key fields |
|---|---|---|
| `products` | product | `sku` (matches the website), `name`, `department`, `price` (GBP incl. UK VAT), `compareAtPrice` (was-price, for sales), `countInStock`, `isActive`, `reviews` |
| `users` | account | `name`, `email`, `role` (`user` / `admin`), `address`, `wishlist`. Passwords are stored only as secure hashes |
| `orders` | order | `orderNumber`, `user`, `items`, `market` (country), `currency`, `subtotal`, `discount`, `shipping`, `tax`, `total`, `totalGBP`, `status`, `deliverySlot`, `promoCode` |
| `promos` | discount code | `code`, `type` (`percent` / `flat` / `freeship`), `value`, `minSubtotal` (GBP), `maxUses`, `uses`, `expiresAt`, `active`, `showOnSite` |
| `messages` | contact-form message | `name`, `email`, `subject`, `message`, `status` |

## 6. Useful commands

| Command | What it does |
|---|---|
| `npm run seed` | Adds any catalogue products, starting codes or admin that are missing. Never deletes anything |
| `npm run seed:reset` | Deletes **all** products and re-imports the 145 from `server/data/products.json`. Products you added in Admin will be lost |
| `npm run test:api` | Runs the 51 automatic API checks against a running server. They create test orders, accounts and codes, so run them against the temporary database, not your real one |

**Backups:** the free Atlas tier doesn't take automatic backups. Before big changes, export the collections with Compass (**Export Data → JSON**).
