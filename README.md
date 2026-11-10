# V-STORE

An online grocery, electronics and home store that runs entirely in the browser.

**Live site:** https://mandapativamsikrishna.github.io/V-STORE1/

## Features

- 150+ products across 14 departments, with search, filters, sorting and live search suggestions
- Product pages with a photo gallery (thumbnails, zoom, full-screen view, swipe on phones)
- Cart, promo codes, checkout, receipt and order history
- Wishlist, store-wide currency switching (13 countries), dark mode
- Accounts: register, sign in, Sign in with Google, forgot password, account page
- Chat assistant that can search products and add items to the cart

Everything is saved in the visitor's own browser, so the site works on GitHub Pages without a server.
It is a demo store: no real payments are taken.

## Run it on your computer

Open the folder in VS Code and start **Live Server** (or any static server), then visit
`http://localhost:5500`. Google sign-in only works on addresses listed in your Google Client ID.

## Settings

- `config.js` – Google Client ID for "Sign in with Google"
- `assets/products/` – extra product photos; see `assets/products/README.md`, then run `update-photos.bat`

## Author

**Mandapati Vamsi Krishna** · v2401824@gmail.com

© 2026 Mandapati Vamsi Krishna. All rights reserved. See [LICENSE](LICENSE).
