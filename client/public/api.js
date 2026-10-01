/* =====================================================================
   V-STORE — api.js  (load BEFORE script.js on every page)
   Shared API client, session, wishlist, nav account links and live
   stock/price sync. Works in "offline" mode (GitHub Pages, no backend):
   everything falls back to localStorage.
   ===================================================================== */
(() => {
  const TOKEN_KEY = "vstore_token";
  const USER_KEY = "vstore_user";
  const WISH_KEY = "vstore_wishlist";
  const API_BASE = (window.VSTORE_API_BASE || "/api").replace(/\/$/, "");

  const store = {
    get(key) { try { return sessionStorage.getItem(key) ?? localStorage.getItem(key); } catch { return null; } },
    set(key, val, persist) {
      try { (persist ? localStorage : sessionStorage).setItem(key, val); (persist ? sessionStorage : localStorage).removeItem(key); } catch {}
    },
    del(key) { try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch {} }
  };

  /* ---------------- HTTP ---------------- */
  class ApiError extends Error {
    constructor(status, data) {
      super(data?.message || `Request failed (${status})`);
      this.status = status; this.errors = data?.errors || [];
    }
  }

  async function request(method, path, body) {
    const token = store.get(TOKEN_KEY);
    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new ApiError(0, { message: "Can't reach the V-STORE server. Check that it's running (npm run dev)." });
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token && path !== "/auth/login") auth.clear(); // expired session
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }

  const api = {
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b ?? {}),
    put: (p, b) => request("PUT", p, b ?? {}),
    del: (p) => request("DELETE", p)
  };

  // Is there a backend? (false on GitHub Pages) — checked once per tab
  const online = (async () => {
    const cached = sessionStorage.getItem("vstore_online");
    if (cached !== null && cached !== "0") return cached === "1";
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(API_BASE + "/health", { signal: ctrl.signal });
      clearTimeout(t);
      const ok = r.ok && (await r.json()).ok === true;
      sessionStorage.setItem("vstore_online", ok ? "1" : "0");
      return ok;
    } catch { sessionStorage.setItem("vstore_online", "0"); return false; }
  })();

  /* ---------------- Auth ---------------- */
  const auth = {
    get token() { return store.get(TOKEN_KEY); },
    get user() { try { return JSON.parse(store.get(USER_KEY) || "null"); } catch { return null; } },
    isLoggedIn() { return Boolean(store.get(TOKEN_KEY)); },
    isAdmin() { return auth.user?.role === "admin"; },
    save({ user, token }, remember = true) {
      if (token) store.set(TOKEN_KEY, token, remember);
      if (user) store.set(USER_KEY, JSON.stringify(user), remember || !!localStorage.getItem(TOKEN_KEY));
      document.dispatchEvent(new CustomEvent("auth:changed", { detail: user }));
    },
    clear() { store.del(TOKEN_KEY); store.del(USER_KEY); document.dispatchEvent(new CustomEvent("auth:changed")); },
    async login(email, password, remember) {
      const data = await api.post("/auth/login", { email, password });
      auth.save(data, remember);
      await wishlist.syncAfterLogin();
      return data.user;
    },
    async register(payload) {
      const data = await api.post("/auth/register", payload);
      auth.save(data, true);
      await wishlist.syncAfterLogin();
      return data.user;
    },
    async refresh() {
      if (!auth.isLoggedIn()) return null;
      try { const { user } = await api.get("/auth/me"); auth.save({ user }, !!localStorage.getItem(TOKEN_KEY)); return user; }
      catch { return null; }
    },
    logout(redirect = "index.html") { auth.clear(); if (redirect) location.href = redirect; },
    /** Sends the visitor to sign in, then brings them back here */
    requireLogin(message) {
      if (auth.isLoggedIn()) return true;
      if (message) sessionStorage.setItem("flash", message);
      const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
      location.href = `login.html?next=${next}`;
      return false;
    }
  };

  /* ---------------- Wishlist (localStorage + server sync) ---------------- */
  const wishlist = {
    all() { try { return JSON.parse(localStorage.getItem(WISH_KEY) || "[]"); } catch { return []; } },
    has(sku) { return wishlist.all().includes(sku); },
    write(list) {
      localStorage.setItem(WISH_KEY, JSON.stringify([...new Set(list)]));
      document.dispatchEvent(new CustomEvent("wishlist:updated"));
      if (auth.isLoggedIn()) api.put("/auth/wishlist", { wishlist: wishlist.all() }).catch(() => {});
    },
    toggle(sku) {
      const list = wishlist.all();
      const on = !list.includes(sku);
      wishlist.write(on ? [...list, sku] : list.filter((s) => s !== sku));
      return on;
    },
    async syncAfterLogin() {
      try {
        const { wishlist: remote } = await api.get("/auth/wishlist");
        wishlist.write([...new Set([...(remote || []), ...wishlist.all()])]);
      } catch {}
    }
  };

  /* ---------------- Helpers ---------------- */
  const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stars = (r) => { const n = Math.round(Number(r) || 0); return "★".repeat(n) + "☆".repeat(5 - n); };
  const qs = (name) => new URLSearchParams(location.search).get(name);

  function toast(msg, ms = 2400) {
    let el = document.getElementById("toast");
    if (!el) {
      el = Object.assign(document.createElement("div"), { id: "toast", className: "toast" });
      el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg; el.hidden = false; el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.classList.remove("show"); el.hidden = true; }, ms);
  }

  /* ---------------- Catalog (API, or bundled products.json when offline) ---------------- */
  let catalogPromise = null;
  function catalog() {
    catalogPromise ||= (async () => {
      if (await online) {
        try { return (await api.get("/products?limit=200")).products; } catch {}
      }
      const r = await fetch("products.json");
      return r.ok ? (await r.json()).map((p) => ({ countInStock: 100, numReviews: 0, ...p })) : [];
    })();
    return catalogPromise;
  }
  async function product(sku) {
    if (await online) {
      try { return await api.get(`/products/${encodeURIComponent(sku)}`); }
      catch (err) { if (err.status === 404) return null; }
    }
    const all = await catalog();
    const p = all.find((x) => x.sku === sku);
    return p ? { product: { reviews: [], ...p }, related: all.filter((x) => x.department === p.department && x.sku !== sku).slice(0, 4) } : null;
  }
  /** Product card markup that script.js's add-to-cart / qty / wishlist handlers understand */
  const onSale = (p) => Number(p.compareAtPrice) > Number(p.price);
  const pctOff = (p) => Math.round((1 - p.price / p.compareAtPrice) * 100);
  // Prices shown in the shopper's market (market.js); catalogue prices are GBP
  const show = (gbp) => (window.VMarket ? window.VMarket.fmtGBP(gbp) : GBP.format(gbp));
  const unitOf = (p) => (p.priceLabel && p.priceLabel.includes("/") ? ` ${p.priceLabel.slice(p.priceLabel.indexOf("/"))}` : "");
  const priceHTML = (p) => onSale(p)
    ? `<span class="price-wrap"><s class="was" data-gbp="${p.compareAtPrice}">${show(p.compareAtPrice)}</s><span class="price" data-unit="${esc(unitOf(p).trim())}">${show(p.price)}${esc(unitOf(p))}</span></span>`
    : `<span class="price" data-unit="${esc(unitOf(p).trim())}">${show(p.price)}${esc(unitOf(p))}</span>`;
  function productCard(p) {
    const out = p.countInStock <= 0;
    const ship = !window.VMarket || window.VMarket.canShip(p.department);
    return `<article class="card product-item${out ? " sold-out" : ""}${ship ? "" : " not-shippable"}" data-id="${esc(p.sku)}" data-name="${esc(p.name)}" data-dept="${esc(p.department || "")}"
        data-price="${p.price}" data-category="${esc(p.category)}" data-rating="${p.rating || 0}">
      <button class="wish${wishlist.has(p.sku) ? " active" : ""}" aria-label="Save ${esc(p.name)} to wishlist">${wishlist.has(p.sku) ? "♥" : "♡"}</button>
      <div class="media">${onSale(p) ? `<span class="sale-badge">−${pctOff(p)}%</span>` : ""}<a href="product.html?id=${encodeURIComponent(p.sku)}" tabindex="-1" aria-hidden="true"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" /></a></div>
      <h3 class="title"><a href="product.html?id=${encodeURIComponent(p.sku)}">${esc(p.name)}</a></h3>
      <div class="meta"><span class="rating" aria-label="Rated ${p.rating || 0} out of 5">${stars(p.rating)}</span>
        ${priceHTML(p)}</div>
      <div class="actions">
        <div class="qty"><button class="dec" aria-label="Decrease" disabled>−</button><span class="q">1</span><button class="inc" aria-label="Increase">+</button></div>
        <button class="add-to-cart"${out || !ship ? " disabled" : ""}>${out ? "Out of stock" : ship ? "Add to Cart" : "UK delivery only"}</button>
      </div>
    </article>`;
  }
  const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  /* ---------------- Header: account links (icons + labels) ---------------- */
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    heart: svg('<path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9z"/>'),
    box: svg('<path d="m3 7.5 9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    shield: svg('<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>')
  };
  function renderNavAccount() {
    const menu = document.querySelector("#nav-menu");
    if (!menu) return;
    menu.querySelectorAll(".nav-account").forEach((n) => n.remove());
    const anchor = menu.querySelector(".basket-li") || menu.querySelector("#theme-toggle")?.closest("li") || null;
    const here = location.pathname.split("/").pop() || "index.html";
    const add = (href, ico, label, extra = "") => {
      const li = document.createElement("li");
      li.className = "nav-account";
      li.innerHTML = `<a class="head-link" href="${href}"${here === href ? ' aria-current="page"' : ""}>${ICONS[ico]}<span class="label">${label}</span>${extra}</a>`;
      menu.insertBefore(li, anchor);
    };
    const n = wishlist.all().length;
    add("wishlist.html", "heart", "Wishlist", `<span id="wish-count" class="count" data-zero="${n === 0}">${n}</span>`);
    if (auth.isLoggedIn()) {
      add("orders.html", "box", "Orders");
      if (auth.isAdmin()) add("admin.html", "shield", "Admin");
      add("account.html", "user", esc((auth.user?.name || "Account").split(" ")[0]));
    } else {
      add("login.html", "user", "Sign in");
    }
  }

  /* ---------------- Product cards: links, hearts, live stock ---------------- */
  const cardSelector = "[data-id][data-name]";

  function paintHearts() {
    document.querySelectorAll(cardSelector).forEach((card) => {
      const btn = card.querySelector(".wish, .wishlist");
      if (!btn) return;
      const on = wishlist.has(card.dataset.id);
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
      if (/^[♡♥]$/.test(btn.textContent.trim())) btn.textContent = on ? "♥" : "♡";
    });
  }

  function linkCards() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("button, a, input, select, label")) return;
      const hit = e.target.closest(".media, .title, .product-title, img");
      const card = hit?.closest(cardSelector);
      if (!card || card.closest(".chat-box, .no-link") || card.classList.contains("no-link")) return;
      location.href = `product.html?id=${encodeURIComponent(card.dataset.id)}`;
    });
    document.querySelectorAll(cardSelector).forEach((card) => card.classList.add("is-linked"));
  }

  async function syncStock() {
    const cards = [...document.querySelectorAll(cardSelector)];
    if (!cards.length || !(await online)) return;
    try {
      const { products } = await api.get("/products?limit=200");
      const bySku = new Map(products.map((p) => [p.sku, p]));
      cards.forEach((card) => {
        const p = bySku.get(card.dataset.id);
        const btn = card.querySelector(".add-to-cart");
        if (!p) return;
        if (p.rating) card.dataset.rating = p.rating;
        if (btn && p.countInStock <= 0) {
          btn.disabled = true; btn.textContent = "Out of stock"; card.classList.add("sold-out");
        }
      });
    } catch {}
  }

  /* ---------------- Checkout prefill ---------------- */
  function prefillCheckout() {
    if (!document.getElementById("checkout-form") || !auth.isLoggedIn()) return;
    const u = auth.user || {};
    const fill = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
    fill("name", u.name); fill("phone", u.phone); fill("email", u.email);
    fill("address", u.address?.line1); fill("city", u.address?.city); fill("state", u.address?.state);
    fill("zip", u.address?.postcode); fill("country", u.address?.country);
    const note = document.getElementById("checkout-signin-note");
    if (note) { note.hidden = false; document.getElementById("checkout-user").textContent = u.email || u.name || ""; }
  }

  /* ---------------- Boot ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    renderNavAccount();
    paintHearts();
    linkCards();
    syncStock();
    prefillCheckout();
    if (matchMedia("(max-width: 900px)").matches) document.querySelectorAll("details.filters-details").forEach((d) => { d.open = false; });
    const flash = sessionStorage.getItem("flash");
    if (flash) { sessionStorage.removeItem("flash"); setTimeout(() => toast(flash, 3500), 300); }
    online.then((ok) => { if (ok) auth.refresh().then(() => { renderNavAccount(); prefillCheckout(); }); });
  });
  document.addEventListener("auth:changed", renderNavAccount);
  document.addEventListener("wishlist:updated", () => { paintHearts(); renderNavAccount(); });
  window.addEventListener("storage", (e) => { if (e.key === WISH_KEY) { paintHearts(); renderNavAccount(); } });

  window.VStore = { api, ApiError, auth, wishlist, online, toast, GBP, esc, stars, qs, catalog, product, productCard, fmtDate, onSale, pctOff };
})();
