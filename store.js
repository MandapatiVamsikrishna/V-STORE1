/* ========================================================================
   V-STORE — store.js
   Loaded on every page after script.js. Adds the store-wide features that
   work without a server (so they run on GitHub Pages):
     • product catalogue (products.json) + store-wide search & suggestions
     • product detail page (product.html?id=...)
     • wishlist (saved in this browser) + wishlist.html
     • accounts: register / sign in / sign out / reset password / account page
     • category hub shelves, vouchers, hero carousels, newsletter, contact form
     • broken-image fallback so every product always shows a picture
   Everything is stored in this browser's localStorage — there is no backend.
   ======================================================================== */
(() => {
  "use strict";

  /* ---------------- helpers ---------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const params = new URLSearchParams(location.search);
  const page = () => document.body?.dataset.page || "";
  const onReady = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn());

  function toast(msg, ms = 2200) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg; el.hidden = false; el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.classList.remove("show"); el.hidden = true; }, ms);
  }

  /* ---------------- broken-image fallback ---------------- */
  function placeholderFor(label) {
    const text = esc(String(label || "V-STORE").slice(0, 30));
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='360' viewBox='0 0 480 360'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff4e0'/><stop offset='1' stop-color='#e8f1fb'/></linearGradient></defs>` +
      `<rect width='480' height='360' fill='url(#g)'/>` +
      `<text x='240' y='170' font-family='Segoe UI,Arial,sans-serif' font-size='64' text-anchor='middle'>🛒</text>` +
      `<text x='240' y='235' font-family='Segoe UI,Arial,sans-serif' font-size='24' font-weight='600' fill='#333' text-anchor='middle'>${text}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function useFallback(img) {
    if (img.dataset.fallback) return;
    img.dataset.fallback = "1";
    img.src = placeholderFor(img.alt || img.closest("[data-name]")?.dataset.name);
  }
  document.addEventListener("error", (e) => { if (e.target?.tagName === "IMG") useFallback(e.target); }, true);
  onReady(() => $$("img").forEach((img) => {
    const src = img.getAttribute("src") || "";
    // Images pointing at a file on someone's PC or at a shut-down placeholder service can never load online
    if (/^[a-z]:\\/i.test(src) || /via\.placeholder\.com/.test(src)) return useFallback(img);
    if (img.complete && img.naturalWidth === 0 && src) useFallback(img);
  }));

  /* ---------------- catalogue ---------------- */
  let catalogPromise = null;
  function catalog() {
    catalogPromise ||= fetch("products.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    return catalogPromise;
  }
  const normalize = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9£.\s]/g, " ").replace(/\s+/g, " ").trim();
  const singular = (w) => (w.length > 3 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);

  function inScope(p, scope) {
    scope = normalize(scope);
    if (!scope || scope === "all") return true;
    return p.group === scope || normalize(p.department) === scope || p.category === scope;
  }
  function searchProducts(list, q, scope) {
    const terms = normalize(q).split(" ").filter(Boolean).map(singular);
    if (!terms.length) return list.filter((p) => inScope(p, scope));
    return list
      .filter((p) => inScope(p, scope))
      .map((p) => {
        const name = normalize(p.name);
        const hay = normalize([p.name, p.department, p.category, (p.tags || []).join(" ")].join(" "));
        let score = 0;
        for (const t of terms) {
          if (name.includes(t)) score += name.startsWith(t) ? 4 : 3;
          else if (hay.includes(t)) score += 1;
          else return null;
        }
        return { p, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || (b.p.rating || 0) - (a.p.rating || 0))
      .map((x) => x.p);
  }
  const stars = (r) => { if (r == null) return ""; const n = Math.max(0, Math.min(5, Math.round(r))); return "★".repeat(n) + "☆".repeat(5 - n); };
  const productHref = (p) => `product.html?id=${encodeURIComponent(p.id)}`;

  // Same markup as the department pages, so Add to Cart / quantity / wishlist handlers in script.js just work
  function cardHTML(p) {
    const href = productHref(p);
    return `<article class="card product-item" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${p.price}" data-category="${esc(p.category)}" data-rating="${p.rating ?? ""}">
      <button class="wish" aria-label="Save ${esc(p.name)} to wishlist" aria-pressed="false">♡</button>
      <div class="media"><a class="card-link" href="${href}" tabindex="-1" aria-hidden="true"><img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy"></a></div>
      <h3 class="title"><a class="card-link" href="${href}">${esc(p.name)}</a></h3>
      <div class="meta"><span class="rating" aria-label="${p.rating ?? "No"} out of 5">${stars(p.rating)}</span><span class="price">${GBP.format(p.price)}</span></div>
      <p class="dept-tag"><a href="${esc(p.page)}">${esc(p.department)}</a></p>
      <div class="actions">
        <div class="qty"><button class="dec" aria-label="Decrease">−</button><span class="q">1</span><button class="inc" aria-label="Increase">+</button></div>
        <button class="add-to-cart">Add to Cart</button>
      </div>
    </article>`;
  }
  function renderCards(host, list) {
    host.innerHTML = list.map(cardHTML).join("");
    afterCardsRendered();
  }
  function afterCardsRendered() {
    wishlist.syncHearts();
    // let the currency converter in script.js re-price the new cards for the chosen country
    let code = "GB";
    try { code = JSON.parse(localStorage.getItem("vstore-country") || "{}").code || "GB"; } catch {}
    window.dispatchEvent(new CustomEvent("country:changed", { detail: { code } }));
  }

  // Department pages: make each product's picture and name open its own product page
  function linkExistingCards() {
    $$(".product-item[data-id][data-price], article.card[data-id][data-price]").forEach((card) => {
      if (card.dataset.linked) return;
      card.dataset.linked = "1";
      const href = `product.html?id=${encodeURIComponent(card.dataset.id)}`;
      const title = card.querySelector(".title, .product-title");
      if (title && !title.querySelector("a")) title.innerHTML = `<a class="card-link" href="${href}">${title.innerHTML}</a>`;
      const img = card.querySelector(".media img, img");
      if (img && !img.closest("a")) {
        const a = document.createElement("a");
        a.href = href; a.className = "card-link"; a.tabIndex = -1; a.setAttribute("aria-hidden", "true");
        img.replaceWith(a); a.appendChild(img);
      }
    });
  }

  /* ---------------- wishlist ---------------- */
  const WISH_KEY = "vstore_wishlist";
  const wishlist = {
    all: () => load(WISH_KEY, []),
    has: (id) => wishlist.all().some((w) => String(w.id) === String(id)),
    toggle(card) {
      const id = card.dataset.id;
      let list = wishlist.all();
      const on = !list.some((w) => String(w.id) === String(id));
      if (on) {
        list.unshift({
          id, name: card.dataset.name || card.querySelector(".title,.product-title")?.textContent.trim() || "Item",
          price: parseFloat(card.dataset.baseGbp || card.dataset.price) || 0,
          img: card.querySelector("img")?.getAttribute("src") || "",
          addedAt: new Date().toISOString(),
        });
      } else {
        list = list.filter((w) => String(w.id) !== String(id));
      }
      save(WISH_KEY, list);
      wishlist.syncHearts();
      document.dispatchEvent(new CustomEvent("wishlist:changed"));
      return on;
    },
    remove(id) { save(WISH_KEY, wishlist.all().filter((w) => String(w.id) !== String(id))); wishlist.syncHearts(); document.dispatchEvent(new CustomEvent("wishlist:changed")); },
    syncHearts() {
      const ids = new Set(wishlist.all().map((w) => String(w.id)));
      $$(".wish, .wishlist").forEach((btn) => {
        const card = btn.closest("[data-id]");
        if (!card) return;
        const on = ids.has(String(card.dataset.id));
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-pressed", String(on));
        if (/^[♡♥]$/.test(btn.textContent.trim())) btn.textContent = on ? "♥" : "♡";
      });
      $$(".wish-count").forEach((n) => (n.textContent = String(ids.size)));
    },
  };
  window.vstoreWishlist = wishlist;

  /* ---------------- accounts (stored in this browser) ---------------- */
  const USERS_KEY = "vstore_users";
  const SESSION_KEY = "vstore_session";
  async function hashPassword(password, salt) {
    const data = `${salt}:${password}`;
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 0x811c9dc5; // FNV-1a fallback for browsers without WebCrypto
    for (let i = 0; i < data.length; i++) { h ^= data.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return "fnv" + (h >>> 0).toString(16);
  }
  const newSalt = () => Array.from(crypto.getRandomValues?.(new Uint8Array(12)) || [Date.now()]).map((b) => b.toString(16)).join("");
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

  const auth = {
    users: () => load(USERS_KEY, []),
    find: (email) => auth.users().find((u) => u.email === String(email || "").trim().toLowerCase()) || null,
    current() {
      let s = null;
      try { s = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null"); } catch {}
      if (!s) return null;
      const u = auth.find(s.email);
      return u ? {
        name: u.name, email: u.email, phone: u.phone || "", createdAt: u.createdAt,
        picture: u.picture || "", google: Boolean(u.googleSub), hasPassword: Boolean(u.hash),
      } : null;
    },
    // Called by google-signin.js after Google confirms who the user is.
    // Same email = same account, so an email/password account gets Google linked to it.
    loginWithGoogle({ sub, email, name, picture }) {
      email = String(email || "").trim().toLowerCase();
      if (!isEmail(email) || !sub) throw new Error("Google didn't return an email address. Please try again.");
      const users = auth.users();
      let u = users.find((x) => x.email === email);
      if (u) {
        if (u.googleSub && u.googleSub !== sub) throw new Error("This email is linked to a different Google account.");
        u.googleSub = sub;
        if (picture) u.picture = picture;
        if (!u.name) u.name = name;
      } else {
        u = { name: String(name || email.split("@")[0]).trim(), email, phone: "", googleSub: sub, picture: picture || "", createdAt: new Date().toISOString() };
        users.push(u);
      }
      save(USERS_KEY, users);
      auth.startSession(u, true);
      return u;
    },
    async register({ name, email, password, phone }) {
      email = String(email || "").trim().toLowerCase();
      if (String(name || "").trim().length < 2) throw new Error("Please enter your full name.");
      if (!isEmail(email)) throw new Error("Enter a valid email address.");
      if (String(password || "").length < 8) throw new Error("Password must be at least 8 characters.");
      const existing = auth.find(email);
      if (existing?.googleSub && !existing.hash) throw new Error("This email already has an account that uses Google. Use “Sign up with Google”.");
      if (existing) throw new Error("This email is already registered. Try signing in.");
      const salt = newSalt();
      const user = { name: name.trim(), email, phone: (phone || "").trim(), salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
      save(USERS_KEY, [...auth.users(), user]);
      auth.startSession(user, true);
      return user;
    },
    async login(email, password, remember) {
      const u = auth.find(email);
      if (u && !u.hash && u.googleSub) throw new Error("This account signs in with Google. Use the Google button below.");
      if (!u || (await hashPassword(password, u.salt)) !== u.hash) throw new Error("Email or password is incorrect.");
      auth.startSession(u, remember);
      return u;
    },
    startSession(u, remember) {
      const s = JSON.stringify({ email: u.email, at: new Date().toISOString() });
      try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch {}
      try { (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, s); } catch {}
    },
    logout() { try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch {} },
    async resetPassword(email, password) {
      const users = auth.users();
      const u = users.find((x) => x.email === String(email || "").trim().toLowerCase());
      if (!u) throw new Error("No account uses that email on this device.");
      if (String(password || "").length < 8) throw new Error("Password must be at least 8 characters.");
      u.salt = newSalt(); u.hash = await hashPassword(password, u.salt);
      save(USERS_KEY, users);
    },
    async changePassword(current, next) {
      const me = auth.current();
      if (!me) throw new Error("Please sign in again.");
      const u = auth.find(me.email);
      // Google-only accounts have no password yet, so they can set one without a current password
      if (u.hash && (await hashPassword(current, u.salt)) !== u.hash) throw new Error("Your current password is incorrect.");
      await auth.resetPassword(me.email, next);
    },
    updateProfile({ name, phone }) {
      const me = auth.current();
      if (!me) throw new Error("Please sign in again.");
      if (String(name || "").trim().length < 2) throw new Error("Please enter your full name.");
      const users = auth.users();
      const u = users.find((x) => x.email === me.email);
      u.name = name.trim(); u.phone = String(phone || "").trim();
      save(USERS_KEY, users);
    },
  };
  window.vstoreAuth = auth;

  /* ---------------- header: account + wishlist links ---------------- */
  function enhanceHeader() {
    const me = auth.current();
    $$("ul.nav-links, #nav-menu").forEach((ul) => {
      if (ul.dataset.enhanced) return;
      const cartLi = ul.querySelector('a[href="cart.html"]')?.closest("li");
      if (!cartLi) return; // only store pages (not the sign-in pages)
      ul.dataset.enhanced = "1";
      const wishLi = document.createElement("li");
      wishLi.innerHTML = `<a class="wish-link" href="wishlist.html" aria-label="Wishlist">♡ Wishlist (<span class="wish-count">0</span>)</a>`;
      const accLi = document.createElement("li");
      accLi.innerHTML = me
        ? `<a class="account-link" href="account.html">👤 Hi, ${esc(me.name.split(" ")[0])}</a>`
        : `<a class="account-link" href="authentication.html?next=${encodeURIComponent(location.pathname.split("/").pop() || "index.html")}">👤 Sign in</a>`;
      cartLi.before(accLi, wishLi);
    });
    // home page hero panel
    const panelLink = $('.hero-panels a[href="authentication.html"]');
    if (panelLink && me) {
      panelLink.closest(".panel").querySelector("h3").textContent = `Welcome back, ${me.name.split(" ")[0]}`;
      panelLink.textContent = "Your account →";
      panelLink.href = "account.html";
    }
    wishlist.syncHearts();
  }

  /* ---------------- live search suggestions under the header search ---------------- */
  function initSuggestions() {
    const input = $("#search-input");
    const form = $("#search-form");
    // only the store-wide header search gets suggestions (department pages filter their own grid)
    if (!input || !form || !form.classList.contains("header-search")) return;
    let box = $("#search-results");
    if (!box) {
      box = document.createElement("div");
      box.id = "search-results"; box.className = "search-results"; box.hidden = true;
      (form.closest("header, nav") || form).after(box);
    }
    box.setAttribute("role", "listbox");
    const hide = () => { box.hidden = true; };
    let timer;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = input.value.trim();
        if (q.length < 2) return hide();
        const scope = form.querySelector("select")?.value || "all";
        const hits = searchProducts(await catalog(), q, scope).slice(0, 6);
        box.innerHTML = hits.length
          ? hits.map((p) => `<a class="suggestion" role="option" href="${productHref(p)}"><img src="${esc(p.img)}" alt=""><span>${esc(p.name)}<small>${esc(p.department)}</small></span><b>${GBP.format(p.price)}</b></a>`).join("") +
            `<a class="suggestion all" href="search.html?q=${encodeURIComponent(q)}&scope=${encodeURIComponent(scope)}">See all results for “${esc(q)}” →</a>`
          : `<p class="suggestion none">No products match “${esc(q)}”.</p>`;
        box.hidden = false;
      }, 150);
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
    document.addEventListener("click", (e) => { if (!box.contains(e.target) && e.target !== input) hide(); });
  }

  /* ---------------- search results page ---------------- */
  async function initSearchPage() {
    if (page() !== "search") return;
    const grid = $("#search-grid");
    const sortSel = $("#search-sort");
    const input = $("#search-input");
    const scopeSel = $("#search-scope");
    const state = { q: params.get("q") || "", scope: params.get("scope") || "all" };
    if (input) input.value = state.q;
    if (scopeSel && [...scopeSel.options].some((o) => o.value === state.scope)) scopeSel.value = state.scope;
    const all = await catalog();

    function render() {
      let list = searchProducts(all, state.q, state.scope);
      const s = sortSel?.value || "relevance";
      if (s === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
      if (s === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
      if (s === "rating") list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      $("#search-heading").textContent = state.q ? `Results for “${state.q}”` : "All products";
      $("#search-count").textContent = `${list.length} product${list.length === 1 ? "" : "s"}${state.scope !== "all" ? " in " + state.scope : ""}`;
      $("#search-empty").hidden = list.length > 0;
      renderCards(grid, list);
      document.title = `${state.q ? state.q + " — " : ""}Search — V-STORE`;
    }
    document.addEventListener("vstore:search", (e) => {
      state.q = e.detail.q; state.scope = e.detail.scope || "all";
      history.replaceState(null, "", `search.html?q=${encodeURIComponent(state.q)}&scope=${encodeURIComponent(state.scope)}`);
      render();
    });
    sortSel?.addEventListener("change", render);
    $$("[data-suggest]").forEach((b) => b.addEventListener("click", () => {
      input.value = b.dataset.suggest;
      document.dispatchEvent(new CustomEvent("vstore:search", { detail: { q: b.dataset.suggest, scope: "all" } }));
    }));
    render();
  }

  /* ---------------- product photo gallery ----------------
     Extra photos live in assets/products/<folder>/ and are listed in
     assets/products/photos.json by update-photos.py:  { "p-apple": ["assets/products/Red Apples/1.jpg", ...] }
     With no extra photos, the gallery shows the product photo plus two close-up views. */
  // Your own photos (photos.json, written by update-photos.py) come first, then the free-licence
  // sample photos (sample-photos.json: { src, credit, license, licenseUrl, source }) with a credit line.
  function productPhotos() {
    const get = (url) => fetch(url, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    return Promise.all([get("assets/products/photos.json"), get("assets/products/sample-photos.json")]).then(([own, samples]) => {
      const merged = {};
      Object.entries(own || {}).forEach(([id, list]) => { if (Array.isArray(list)) merged[id] = list.map((path) => ({ src: encodeURI(path) })); });
      Object.entries(samples || {}).forEach(([id, list]) => { if (Array.isArray(list)) merged[id] = [...(merged[id] || []), ...list.filter((x) => x && x.src)]; });
      return merged;
    });
  }

  function creditHTML(v) {
    if (!v.credit) return "";
    const who = v.source ? `<a href="${esc(v.source)}" target="_blank" rel="noopener">${esc(v.credit)}</a>` : esc(v.credit);
    const lic = v.licenseUrl ? `<a href="${esc(v.licenseUrl)}" target="_blank" rel="noopener license">${esc(v.license)}</a>` : esc(v.license || "");
    return `Photo: ${who}${lic ? " · " + lic : ""} · Wikimedia Commons`;
  }

  function buildGallery(host, p, extra) {
    // each view: { src, label, zoom, x, y, credit… }  (zoom > 1 = a close-up of the same photo)
    const views = [{ src: p.img, label: "Product photo", zoom: 1, x: 50, y: 50 }];
    extra.forEach((x, i) => views.push({ ...x, label: `Photo ${i + 2}`, zoom: 1, x: 50, y: 50 }));
    if (!extra.length) {
      views.push({ src: p.img, label: "Close-up", zoom: 1.8, x: 50, y: 50 });
      views.push({ src: p.img, label: "Detail", zoom: 2.6, x: 50, y: 60 });
    }
    const n = views.length;
    let i = 0;

    host.innerHTML = `
      <div class="pd-stage" tabindex="0" role="group" aria-roledescription="image gallery" aria-label="${esc(p.name)} images — use the arrow keys to browse">
        <img class="pd-main" src="${esc(views[0].src)}" alt="${esc(p.name)}" draggable="false">
        <button type="button" class="pd-nav prev" aria-label="Previous image">‹</button>
        <button type="button" class="pd-nav next" aria-label="Next image">›</button>
        <button type="button" class="pd-expand" aria-label="View full screen" title="View full screen">⤢</button>
        <span class="pd-count" aria-live="polite">1 / ${n}</span>
        <span class="pd-hint">Hover to zoom · click for full screen</span>
      </div>
      <p class="pd-credit" aria-live="polite"></p>
      <div class="pd-thumbs">
        ${views.map((v, k) => `<button type="button" class="pd-thumb${v.zoom > 1 ? " is-zoom" : ""}" data-k="${k}" aria-label="Show image ${k + 1} of ${n}: ${esc(v.label)}">
            <img src="${esc(v.src)}" alt="" loading="lazy" draggable="false" style="${zoomStyle(v)}">${v.zoom > 1 ? `<small>${esc(v.label)}</small>` : ""}
          </button>`).join("")}
      </div>`;

    const stage = $(".pd-stage", host);
    const main = $(".pd-main", host);
    const thumbs = $$(".pd-thumb", host);
    function zoomStyle(v) { return v.zoom > 1 ? `transform:scale(${v.zoom});transform-origin:${v.x}% ${v.y}%` : ""; }
    // photos that failed to load show the placeholder and are not retried on every switch
    const broken = new Set();
    main.addEventListener("error", () => broken.add(views[i].src));
    function setSrc(img, src) {
      if (broken.has(src)) { if (!img.dataset.fallback) useFallback(img); return; }
      if (img.getAttribute("src") !== src) { img.dataset.fallback = ""; img.src = src; }
    }
    function applyView() {
      const v = views[i];
      setSrc(main, v.src);
      main.alt = `${p.name} — ${v.label} (${i + 1} of ${n})`;
      main.style.transformOrigin = `${v.x}% ${v.y}%`;
      main.style.transform = v.zoom > 1 ? `scale(${v.zoom})` : "";
      $(".pd-count", host).textContent = `${i + 1} / ${n}`;
      const credit = $(".pd-credit", host);
      credit.innerHTML = creditHTML(v);
      credit.hidden = !v.credit;
      thumbs.forEach((t, k) => { t.classList.toggle("on", k === i); if (k === i) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current"); });
      if (lightbox.open) lightbox.show();
    }
    const go = (k) => { i = (k + n) % n; applyView(); };
    thumbs.forEach((t) => t.addEventListener("click", () => go(Number(t.dataset.k))));
    $(".pd-nav.prev", host).addEventListener("click", (e) => { e.stopPropagation(); go(i - 1); });
    $(".pd-nav.next", host).addEventListener("click", (e) => { e.stopPropagation(); go(i + 1); });
    $(".pd-expand", host).addEventListener("click", (e) => { e.stopPropagation(); lightbox.openAt(); });
    stage.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
      if (e.key === "Enter") { e.preventDefault(); lightbox.openAt(); }
    });

    // hover zoom (mouse only) — follows the pointer
    stage.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || e.target.closest("button")) return;
      const r = stage.getBoundingClientRect();
      main.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      main.style.transform = `scale(${Math.max(2.2, views[i].zoom * 1.5)})`;
      stage.classList.add("zooming");
    });
    stage.addEventListener("pointerleave", () => { stage.classList.remove("zooming"); applyView(); });

    // swipe on touch screens; tap/click opens full screen
    let downX = null;
    stage.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) downX = e.clientX; });
    stage.addEventListener("pointerup", (e) => {
      if (downX === null) return;
      const dx = e.clientX - downX; downX = null;
      if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1);
      else lightbox.openAt();
    });

    // full-screen viewer
    const lightbox = {
      open: false, el: null, lastFocus: null,
      build() {
        const el = document.createElement("div");
        el.className = "pd-lightbox"; el.hidden = true;
        el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", `${p.name} images`);
        el.innerHTML = `<button type="button" class="lb-close" aria-label="Close">✕</button>
          <button type="button" class="lb-nav prev" aria-label="Previous image">‹</button>
          <figure><div class="lb-frame"><img alt=""></div><figcaption></figcaption></figure>
          <button type="button" class="lb-nav next" aria-label="Next image">›</button>`;
        document.body.appendChild(el);
        el.addEventListener("click", (e) => { if (e.target === el) lightbox.close(); });
        $(".lb-close", el).addEventListener("click", () => lightbox.close());
        $(".lb-nav.prev", el).addEventListener("click", () => go(i - 1));
        $(".lb-nav.next", el).addEventListener("click", () => go(i + 1));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Escape") lightbox.close();
          if (e.key === "ArrowLeft") go(i - 1);
          if (e.key === "ArrowRight") go(i + 1);
          if (e.key === "Tab") { // keep focus inside the viewer
            const f = $$("button", el); const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        });
        let sx = null;
        el.addEventListener("pointerdown", (e) => { sx = e.clientX; });
        el.addEventListener("pointerup", (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 40) go(e.clientX < sx ? i + 1 : i - 1); sx = null; });
        this.el = el;
      },
      show() {
        const v = views[i]; const img = $("img", this.el);
        setSrc(img, v.src);
        img.alt = `${p.name} — ${v.label}`;
        img.style.transform = v.zoom > 1 ? `scale(${v.zoom})` : "";
        img.style.transformOrigin = `${v.x}% ${v.y}%`;
        $("figcaption", this.el).innerHTML = `${esc(p.name)} · ${esc(v.label)} · ${i + 1} / ${n}${v.credit ? "<br><small>" + creditHTML(v) + "</small>" : ""}`;
      },
      openAt() {
        if (!this.el) this.build();
        this.lastFocus = document.activeElement;
        this.open = true; this.el.hidden = false; document.body.classList.add("lb-open");
        this.show(); $(".lb-close", this.el).focus();
      },
      close() {
        this.open = false; this.el.hidden = true; document.body.classList.remove("lb-open");
        this.lastFocus?.focus?.();
      },
    };

    if (n < 2) $$(".pd-nav, .pd-thumbs, .pd-count", host).forEach((x) => (x.hidden = true));
    applyView();
  }

  /* ---------------- product detail page ---------------- */
  async function initProductPage() {
    if (page() !== "product") return;
    const host = $("#product-detail");
    const [all, photos] = await Promise.all([catalog(), productPhotos()]);
    const id = params.get("id");
    const p = all.find((x) => String(x.id) === String(id));
    if (!p) {
      host.innerHTML = `<div class="empty-state"><h1>Product not found</h1><p class="muted">This product may have been removed. Try searching or browse all departments.</p><a class="btn-primary" href="categories.html">Browse departments</a></div>`;
      return;
    }
    document.title = `${p.name} — V-STORE`;
    const free = p.price >= 49;
    host.innerHTML = `
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> › <a href="${esc(p.page)}">${esc(p.department)}</a> › <span aria-current="page">${esc(p.name)}</span></nav>
      <article class="product-detail product-item" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${p.price}" data-category="${esc(p.category)}">
        <div class="pd-gallery" id="pd-gallery"></div>
        <div class="pd-info">
          <p class="pd-dept"><a href="${esc(p.page)}">${esc(p.department)}</a></p>
          <h1 class="pd-title title">${esc(p.name)}</h1>
          ${p.rating != null ? `<p class="pd-rating"><span class="rating">${stars(p.rating)}</span> <span class="muted">${p.rating.toFixed(1)} out of 5</span></p>` : ""}
          <p class="pd-price"><span class="price">${GBP.format(p.price)}</span> <span class="muted small">incl. VAT</span></p>
          <ul class="pd-perks">
            <li>🚚 ${free ? "Free delivery on this item" : "Free delivery on orders over £49 (otherwise £1.99)"}</li>
            <li>⚡ Dispatched within 1–3 working days in the UK</li>
            <li>↩️ 30-day returns — <a href="shipping.html#returns">see returns policy</a></li>
          </ul>
          <div class="actions pd-actions">
            <div class="qty"><button class="dec" aria-label="Decrease">−</button><span class="q">1</span><button class="inc" aria-label="Increase">+</button></div>
            <button class="add-to-cart btn-primary">Add to Cart</button>
            <button class="wish pd-wish" aria-label="Save to wishlist" aria-pressed="false">♡</button>
          </div>
          <p class="pd-buy-now"><a class="btn-ghost" href="cart.html" id="buy-now">Buy now →</a></p>
        </div>
      </article>`;
    buildGallery($("#pd-gallery"), p, photos[p.id] || []);
    // "Buy now" = add the chosen quantity then go to checkout
    $("#buy-now").addEventListener("click", (e) => {
      e.preventDefault();
      $(".product-detail .add-to-cart").click();
      setTimeout(() => (location.href = "checkout.html"), 300);
    });
    const related = all.filter((x) => x.page === p.page && x.id !== p.id).slice(0, 4);
    const also = all.filter((x) => x.group === p.group && x.page !== p.page).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
    if (related.length) { $("#related-title").textContent = `More from ${p.department}`; renderCards($("#related-grid"), related); $("#related").hidden = false; }
    if (also.length) { renderCards($("#also-grid"), also); $("#also").hidden = false; }
    afterCardsRendered();
  }

  /* ---------------- wishlist page ---------------- */
  async function initWishlistPage() {
    if (page() !== "wishlist") return;
    const all = await catalog();
    const byId = new Map(all.map((p) => [String(p.id), p]));
    function render() {
      const saved = wishlist.all().map((w) => byId.get(String(w.id)) || { ...w, department: "Saved item", page: "categories.html", category: "", rating: null });
      $("#wish-empty").hidden = saved.length > 0;
      $("#wish-tools").hidden = saved.length === 0;
      $("#wish-count-text").textContent = `${saved.length} saved item${saved.length === 1 ? "" : "s"}`;
      renderCards($("#wish-grid"), saved);
    }
    document.addEventListener("wishlist:changed", render);
    $("#wish-add-all")?.addEventListener("click", () => {
      const items = $$("#wish-grid .product-item");
      items.forEach((card) => window.cart?.add({ id: card.dataset.id, name: card.dataset.name, price: parseFloat(card.dataset.price) || 0, qty: 1, img: card.querySelector("img")?.src }));
      toast(`Added ${items.length} item${items.length === 1 ? "" : "s"} to your cart 🛒`);
    });
    $("#wish-clear")?.addEventListener("click", () => { save(WISH_KEY, []); wishlist.syncHearts(); render(); toast("Wishlist cleared"); });
    render();
  }

  /* ---------------- categories hub shelves + vouchers ---------------- */
  async function initCategoriesHub() {
    if (page() !== "categories") return;
    const all = await catalog();
    const counts = {};
    all.forEach((p) => (counts[p.page] = (counts[p.page] || 0) + 1));
    $$("[data-count-for]").forEach((n) => { const c = counts[n.dataset.countFor] || 0; n.textContent = `${c} item${c === 1 ? "" : "s"}`; });
    const rated = [...all].filter((p) => p.rating != null).sort((a, b) => b.rating - a.rating);
    const shelves = {
      "best-sellers": rated.slice(0, 8),
      "new-releases": all.filter((p) => ["summer essiential page.html", "Home Refresh.html"].includes(p.page)).slice(0, 8),
      "gift-ideas": rated.filter((p) => ["electronics", "home"].includes(p.group) && p.price >= 10 && p.price <= 50).slice(0, 8),
      "prime": rated.filter((p) => p.price < 20).slice(0, 8),
      "electronics-top": rated.filter((p) => p.group === "electronics").slice(0, 4),
      "home-top": rated.filter((p) => p.group === "home").slice(0, 4),
    };
    Object.entries(shelves).forEach(([key, list]) => { const host = $(`[data-shelf="${key}"]`); if (host) renderCards(host, list); });
    $$("[data-apply-code]").forEach((b) => b.addEventListener("click", () => {
      if (window.vstoreApplyPromo?.(b.dataset.applyCode)) { b.textContent = "Applied ✓"; b.disabled = true; }
    }));
    // jump to the section named in the link (content loads after the browser's first jump)
    if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 50);
  }

  /* ---------------- hero / testimonial carousels ---------------- */
  function initCarousels() {
    $$(".carousel").forEach((car) => {
      const slides = $$(":scope > .slide", car);
      if (slides.length < 2 || car.dataset.live) return;
      car.dataset.live = "1";
      car.classList.add("is-live");
      let i = Math.max(0, slides.findIndex((s) => s.getAttribute("aria-current") === "true"));
      const dots = document.createElement("div");
      dots.className = "carousel-dots";
      dots.innerHTML = slides.map((_, k) => `<button type="button" aria-label="Show slide ${k + 1}"></button>`).join("");
      const prev = Object.assign(document.createElement("button"), { type: "button", className: "carousel-btn prev", innerHTML: "‹" });
      const next = Object.assign(document.createElement("button"), { type: "button", className: "carousel-btn next", innerHTML: "›" });
      prev.setAttribute("aria-label", "Previous slide"); next.setAttribute("aria-label", "Next slide");
      car.append(prev, next, dots);
      const show = (n) => {
        i = (n + slides.length) % slides.length;
        slides.forEach((s, k) => s.setAttribute("aria-current", String(k === i)));
        $$("button", dots).forEach((d, k) => d.classList.toggle("on", k === i));
      };
      prev.onclick = () => { show(i - 1); restart(); };
      next.onclick = () => { show(i + 1); restart(); };
      $$("button", dots).forEach((d, k) => (d.onclick = () => { show(k); restart(); }));
      let timer;
      const restart = () => { clearInterval(timer); timer = setInterval(() => show(i + 1), 5000); };
      car.addEventListener("mouseenter", () => clearInterval(timer));
      car.addEventListener("mouseleave", restart);
      car.addEventListener("focusin", () => clearInterval(timer));
      show(i); restart();
    });
  }

  /* ---------------- newsletter ---------------- */
  function initNewsletter() {
    $$("#newsletter-form, form.newsletter").forEach((form) => form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const hint = form.querySelector(".form-hint");
      const email = (input?.value || "").trim().toLowerCase();
      if (!isEmail(email)) { if (hint) hint.textContent = "Please enter a valid email address."; input?.focus(); return; }
      const list = load("vstore_newsletter", []);
      const already = list.includes(email);
      if (!already) save("vstore_newsletter", [...list, email]);
      if (hint) hint.textContent = already ? "You're already subscribed — thanks!" : "Thanks! You're subscribed to V-STORE deals.";
      toast(already ? "Already subscribed ✉️" : "Subscribed ✉️");
      input.value = "";
    }));
  }

  /* ---------------- contact form ---------------- */
  function initContact() {
    const form = $("#contact-form");
    if (!form) return;
    const me = auth.current();
    if (me) { form.name.value ||= me.name; form.email.value ||= me.email; }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = $("#contact-status");
      const data = { name: form.name.value.trim(), email: form.email.value.trim(), topic: form.topic.value, order: form.order.value.trim(), message: form.message.value.trim() };
      const problem = data.name.length < 2 ? "Please enter your name." : !isEmail(data.email) ? "Please enter a valid email address." : data.message.length < 10 ? "Please write a message of at least 10 characters." : "";
      if (problem) { msg.textContent = problem; msg.className = "form-status error"; return; }
      const ref = "MSG-" + Date.now().toString(36).toUpperCase();
      save("vstore_messages", [...load("vstore_messages", []), { ref, ...data, sentAt: new Date().toISOString() }]);
      form.reset();
      if (me) { form.name.value = me.name; form.email.value = me.email; }
      // No server here, so the message is saved in this browser; offer to email it so it reaches the store owner
      const to = form.dataset.email || "";
      const mail = to ? `mailto:${to}?subject=${encodeURIComponent(`[V-STORE] ${data.topic} (${ref})`)}&body=${encodeURIComponent(
        `${data.message}\n\nName: ${data.name}\nEmail: ${data.email}${data.order ? `\nOrder: ${data.order}` : ""}\nReference: ${ref}`)}` : "";
      msg.innerHTML = `Thanks, ${esc(data.name.split(" ")[0])}! Your message was saved. Reference <strong>${ref}</strong>.` +
        (mail ? `<br><a class="btn-primary contact-mail" href="${esc(mail)}">✉️ Email it to us</a> <span class="muted small">Opens your email app with the message ready to send.</span>` : "");
      msg.className = "form-status ok";
      toast("Message sent ✅");
    });
  }

  /* ---------------- account page ---------------- */
  function initAccountPage() {
    if (page() !== "account") return;
    const me = auth.current();
    if (!me) { location.replace("authentication.html?next=account.html"); return; }
    $("#acc-name").textContent = me.name;
    $("#acc-email").textContent = me.email;
    $("#acc-since").textContent = new Date(me.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    if (me.picture) { const av = $("#acc-avatar"); av.src = me.picture; av.hidden = false; }
    $("#acc-provider").textContent = me.google
      ? (me.hasPassword ? "Signs in with Google or email + password" : "Signed in with Google")
      : "Signs in with email + password";
    if (!me.hasPassword) {
      // Google-only account: no current password to ask for
      $("#pw-current-row").hidden = true;
      $("#password-form").current.required = false;
      $("#pw-title").textContent = "Set a password (optional)";
      $("#pw-note").hidden = false;
    }
    const orders = load("vstore_orders", []);
    $("#acc-orders").textContent = String(orders.length);
    $("#acc-wish").textContent = String(wishlist.all().length);
    $("#acc-cart").textContent = String(window.cart?.count?.() ?? 0);
    const pf = $("#profile-form");
    pf.name.value = me.name; pf.phone.value = me.phone;
    const status = (el, text, ok) => { el.textContent = text; el.className = "form-status " + (ok ? "ok" : "error"); };
    pf.addEventListener("submit", (e) => {
      e.preventDefault();
      try { auth.updateProfile({ name: pf.name.value, phone: pf.phone.value }); $("#acc-name").textContent = pf.name.value.trim(); status($("#profile-status"), "Profile saved.", true); }
      catch (err) { status($("#profile-status"), err.message, false); }
    });
    const pw = $("#password-form");
    pw.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (pw.next.value !== pw.confirm.value) return status($("#password-status"), "New passwords don't match.", false);
      try {
        const hadPassword = auth.current()?.hasPassword;
        await auth.changePassword(pw.current.value, pw.next.value);
        pw.reset();
        status($("#password-status"), hadPassword ? "Password changed." : "Password set — you can now also sign in with your email.", true);
        if (!hadPassword) {
          $("#pw-current-row").hidden = false; pw.current.required = true;
          $("#pw-title").textContent = "Change password"; $("#pw-note").hidden = true;
          $("#acc-provider").textContent = "Signs in with Google or email + password";
        }
      }
      catch (err) { status($("#password-status"), err.message, false); }
    });
    $("#sign-out").addEventListener("click", () => { auth.logout(); toast("Signed out"); setTimeout(() => (location.href = "index.html"), 500); });
  }

  /* ---------------- forgot password page ---------------- */
  function initForgotPage() {
    const form = $("#reset-form");
    if (!form) return;
    const status = $("#reset-status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.password.value !== form.confirm.value) { status.textContent = "Passwords don't match."; status.className = "form-status error"; return; }
      try {
        await auth.resetPassword(form.email.value, form.password.value);
        status.innerHTML = `Password updated. <a href="authentication.html">Sign in now →</a>`;
        status.className = "form-status ok";
        form.reset();
      } catch (err) { status.textContent = err.message; status.className = "form-status error"; }
    });
  }

  /* ---------------- checkout: prefill from account ---------------- */
  function initCheckoutPrefill() {
    const form = $("#checkout-form");
    const me = auth.current();
    if (!form || !me) return;
    [["#name", me.name], ["#email", me.email], ["#phone", me.phone]].forEach(([sel, v]) => { const el = $(sel, form); if (el && !el.value && v) el.value = v; });
  }

  /* ---------------- boot ---------------- */
  onReady(() => {
    enhanceHeader();
    linkExistingCards();
    initSuggestions();
    initCarousels();
    initNewsletter();
    initContact();
    initAccountPage();
    initForgotPage();
    initCheckoutPrefill();
    initSearchPage();
    initProductPage();
    initWishlistPage();
    initCategoriesHub();
    catalog(); // warm the catalogue for search suggestions
  });
})();
