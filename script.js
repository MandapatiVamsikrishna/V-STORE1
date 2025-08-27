/* ========================= V-STORE — single, unified script.js ========================= */
(() => {
  /* ========================= Helpers / Config ========================= */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;

  // Storage keys
  const STORAGE_KEY = "vstore_cart";
  const PROMO_KEY   = "vstore_promo";
  const ORDER_KEY   = "vstore_last_order";     // thank-you page reads this
  const CKOUT_INFO  = "vstore_checkout_info";  // optional saved shipping info
  const ORDERS_KEY  = "vstore_orders";

  // UI nodes (if present on page)
  const themeBtn  = $("#theme-toggle");
  const navToggle = $(".nav-toggle");
  const navMenu   = $("#nav-menu");
  const toastEl   = $("#toast");
  const yearEl    = $("#year");
  const badge     = $("#cart-count");

  // Misc
  const ORDERS_PAGE_SIZE   = 8;
  const GBP  = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const QMIN = 1, QMAX = 99;
  const FREE_SHIP_THRESHOLD = 49;

  /* ========================= Boot ========================= */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNav();
    initYear();

    initPromoTicker();          // safe no-op if absent
    initCartAPI();              // window.cart*
    updateBadge();

    initGlobalClicks();         // add-to-cart, qty +/-, wishlist
    initSearch();               // search forms (safe no-op if absent)
    initFiltersAndSort();       // category pages (safe no-op)
    initCartRendering();        // cart page (safe no-op)
    initPromoUI();              // promo inputs (safe no-op)
    initCheckout();             // checkout form (safe no-op)
    initOrderSummaryInline();   // inline summary on checkout page (safe no-op)
    initOrdersPage();           // orders.html logic (safe no-op)
    initThankYou();             // thank-you.html receipt (safe no-op)

    initChatAssistant();        // chat with commands + inline product cards
  });

  /* ========================= UI basics ========================= */
  function toast(msg, ms=2000) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toastEl.classList.remove("show");
      toastEl.hidden = true;
    }, ms);
  }

  function initTheme() {
    try {
      const saved = localStorage.getItem("theme");
      if (saved) html.setAttribute("data-theme", saved);
    } catch {}
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const next = (html.getAttribute("data-theme") || "light") === "light" ? "dark" : "light";
        html.setAttribute("data-theme", next);
        try { localStorage.setItem("theme", next); } catch {}
      });
    }
  }

  function initNav() {
    if (!(navToggle && navMenu)) return;
    navToggle.addEventListener("click", () => {
      const ex = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!ex));
      navMenu.setAttribute("aria-expanded", String(!ex));
      // IMPORTANT: toggle .open so your CSS can display the mobile menu
      navMenu.classList.toggle("open", !ex);
    });
  }

  function initYear() { if (yearEl) yearEl.textContent = new Date().getFullYear(); }

  /* ========================= Optional promo ticker ========================= */
  function initPromoTicker() {
    const bar   = $(".promo");
    const track = $(".promo .promo-track");
    if (!bar || !track) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    try {
      if (localStorage.getItem("promo:hidden") === "1") {
        bar.style.display = "none"; return;
      }
    } catch {}

    track.innerHTML = track.innerHTML + track.innerHTML;
    const SPEED = 90; // px/s
    const recalc = () => {
      const baseWidth = track.scrollWidth / 2;
      const dur = Math.max(12, Math.round(baseWidth / SPEED));
      track.style.setProperty("--dur", `${dur}s`);
      track.classList.add("is-ready");
    };
    recalc();

    bar.addEventListener("mouseenter", () => track.style.animationPlayState = "paused");
    bar.addEventListener("mouseleave", () => track.style.animationPlayState = "running");

    const close = $(".promo-close", bar);
    if (close) close.addEventListener("click", () => {
      bar.style.display = "none";
      try { localStorage.setItem("promo:hidden","1"); } catch {}
    });

    let raf;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recalc);
    });
  }

  /* ========================= Cart storage API ========================= */
  function readCart() {
    try {
      const legacy = localStorage.getItem("cart"); // migration support
      const raw = localStorage.getItem(STORAGE_KEY) ?? legacy;
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function writeCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent("cart:updated"));
  }
  function initCartAPI() {
    if (window.cart) return;
    window.cart = {
      get: () => readCart(),
      set: (items) => writeCart(items),
      count: () => readCart().reduce((n, it) => n + (it.qty || 0), 0),
      add: (item) => {
        const items = readCart();
        const f = items.find(i => String(i.id) === String(item.id));
        if (f) f.qty = Math.min(QMAX, (f.qty || 0) + (item.qty || 1));
        else items.push({ ...item, qty: Math.max(QMIN, item.qty || 1) });
        writeCart(items);
        updateBadge();
      },
      setQty: (id, qty) => {
        const items = readCart();
        const it = items.find(i => String(i.id) === String(id));
        if (!it) return;
        it.qty = Math.max(QMIN, Math.min(QMAX, qty|0));
        writeCart(items);
        updateBadge();
      },
      remove: (id) => { writeCart(readCart().filter(i => String(i.id) !== String(id))); updateBadge(); },
      removeByName: (name) => {
        const items = readCart().map(it => ({...it}));
        const idx = items.findIndex(i => (i.name||"").toLowerCase().includes(String(name||"").toLowerCase()));
        if (idx === -1) return false;
        items.splice(idx,1); writeCart(items); updateBadge(); return true;
      },
      clear: () => { writeCart([]); updateBadge(); }
    };
    document.addEventListener("cart:updated", updateBadge);
    window.addEventListener("storage", (e) => { if (e.key === STORAGE_KEY) updateBadge(); });
  }
  function updateBadge() { if (badge) badge.textContent = String(window.cart.count()); }

  /* ========================= Promos + totals ========================= */
  function getPromo() {
    try { return JSON.parse(localStorage.getItem(PROMO_KEY)) || { code:null, type:null, value:0 }; }
    catch { return { code:null, type:null, value:0 }; }
  }
  function setPromo(p) {
    localStorage.setItem(PROMO_KEY, JSON.stringify(p || { code:null, type:null, value:0 }));
    document.dispatchEvent(new CustomEvent("promo:updated"));
  }
  function normalizePromo(codeRaw) {
    const code = (codeRaw || "").trim().toUpperCase();
    if (!code) return null;
    if (code === "WELCOME10") return { code, type: "percent", value: 10 };
    if (code === "FREESHIP")  return { code, type: "freeship", value: 0 };
    if (code === "SAVE5")     return { code, type: "flat", value: 5.00 };
    if (code === "SAVE15")    return { code, type: "percent", value: 15, minSubtotal: 60 };
    return null;
  }
  function computeTotals(items) {
    const subtotal = items.reduce((s, it) => s + (Number(it.price)||0) * (Number(it.qty)||0), 0);
    const promo = getPromo();
    let discount = 0;

    if (promo?.type === "percent") {
      if (!promo.minSubtotal || subtotal >= promo.minSubtotal) {
        discount = +(subtotal * (promo.value/100)).toFixed(2);
      }
    } else if (promo?.type === "flat") {
      discount = Math.min(subtotal, promo.value||0);
    }

    let shipping = 0;
    if (items.length) shipping = (subtotal - discount) >= FREE_SHIP_THRESHOLD ? 0 : 1.99;
    if (promo?.type === "freeship" && items.length) shipping = 0;

    const total = Math.max(0, subtotal - discount + shipping);
    return { subtotal, discount, shipping, total, promo };
  }

  /* ========================= Product helpers ========================= */
  function parsePrice(str) {
    if (typeof str === "number") return str;
    if (!str) return 0;
    const m = String(str).replace(",", ".").match(/(\d+(\.\d{1,2})?)/);
    return m ? parseFloat(m[1]) : 0;
  }
  function slugify(s) {
    return String(s || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  function getCardFromButton(btn) {
    return btn.closest("[data-id][data-name]") ||
           btn.closest(".product-item, article, .product-card");
  }
  function readProductFromCard(card) {
    const id = card?.dataset.id || slugify(card?.dataset.name || card?.querySelector(".title, .product-title")?.textContent);
    const name = card?.dataset.name || card?.querySelector(".title, .product-title")?.textContent?.trim() || "Item";
    const price = card?.dataset.price ? parseFloat(card.dataset.price)
      : parsePrice(card?.querySelector(".price, .product-price")?.textContent);
    const img = card?.querySelector("img")?.src;
    const qtyWrap = card?.querySelector(".qty, .quantity-controls");
    const qEl = qtyWrap?.querySelector(".q, .quantity");
    const qty = Math.max(QMIN, Math.min(QMAX, parseInt(qEl?.textContent || "1", 10)));
    return { id, name, price, qty, img };
  }

  /* ========================= Global clicks (works on all pages) ========================= */
  function initGlobalClicks() {
    document.addEventListener("click", (e) => {
      const t = e.target;

      // Add to cart
      const addBtn = t.closest(".add-to-cart");
      if (addBtn) {
        e.preventDefault();
        const card = getCardFromButton(addBtn);
        if (!card) return;
        const item = readProductFromCard(card);
        if (!item || !item.id) return;
        window.cart.add(item);
        toast(`Added ${item.qty} × ${item.name} 🛒`);
        return;
      }

      // Quantity +/- on product cards
      if (t.closest(".inc") || t.closest(".dec")) {
        const wrap = t.closest(".qty, .quantity-controls");
        const qEl  = wrap?.querySelector(".q, .quantity");
        if (!qEl) return;
        e.preventDefault();
        let q = parseInt(qEl.textContent, 10) || 1;
        q = t.closest(".inc") ? Math.min(QMAX, q + 1) : Math.max(QMIN, q - 1);
        qEl.textContent = String(q);
        return;
      }

      // Wishlist heart toggles
      const wish = t.closest(".wishlist, .wish");
      if (wish) {
        e.preventDefault();
        wish.classList.toggle("active");
        if (/^[♡♥]$/.test(wish.textContent.trim())) {
          wish.textContent = wish.classList.contains("active") ? "♥" : "♡";
        }
        toast(wish.classList.contains("active") ? "Saved to wishlist ♥" : "Removed from wishlist");
      }
    });
  }

  /* ========================= Search (any page) ========================= */
  function initSearch() {
    $$("#search-form").forEach(form => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = form.querySelector('input[type="search"]')?.value?.trim() ?? "";
        const grid = $("#product-grid, .grid");
        if (!grid) { if (q) toast(`Searching “${q}” 🔎`); return; }
        currentSearch = q.toLowerCase();
        filterAndSort();
      });
    });
  }

  /* ========================= Sort + Filters (category pages) ========================= */
  let currentSearch = "";
  const grid = $("#product-grid, .grid");
  const resultCount = $("#result-count");
  const sortSelect  = $("#sort-select");
  const chipsWrap   = $("#active-chips") || $("#active-chips.chips");
  const minPriceEl  = $("#min-price");
  const maxPriceEl  = $("#max-price");
  const ratingRadios= $$('input[name="rating"]');
  const catChecks   = $$('input[name="cat"]');
  const applyBtn    = $("#apply-filters");
  const clearBtn    = $("#clear-filters");

  function initFiltersAndSort() {
    if (!grid) return;
    filterAndSort(); // initial
    sortSelect?.addEventListener("change", filterAndSort);
    applyBtn?.addEventListener("click", filterAndSort);
    [...catChecks, ...ratingRadios].forEach(el => el.addEventListener("change", filterAndSort));
    minPriceEl?.addEventListener("input", debounce(filterAndSort, 250));
    maxPriceEl?.addEventListener("input", debounce(filterAndSort, 250));
    clearBtn?.addEventListener("click", () => {
      catChecks.forEach(c => c.checked = true);
      ratingRadios.forEach(r => r.checked = r.value === "all");
      if (minPriceEl) minPriceEl.value = "0";
      if (maxPriceEl) maxPriceEl.value = "9999";
      const s = $("#search-input"); if (s) s.value = "";
      currentSearch = "";
      if (sortSelect) sortSelect.value = "relevance";
      filterAndSort();
    });
  }

  function activeFilterState() {
    const cats = catChecks.filter(c => c.checked).map(c => c.value);
    const minP = minPriceEl ? parseFloat(minPriceEl.value || "0") : 0;
    const maxP = maxPriceEl ? parseFloat(maxPriceEl.value || "9999") : 9999;
    const rSel = ratingRadios.find(r => r.checked)?.value ?? "all";
    const rMin = rSel === "all" ? 0 : parseFloat(rSel);
    return { cats, minP, maxP, rMin, search: currentSearch.trim() };
  }

  function filterAndSort() {
    const cards = $$(".product-item, .card.product-item, [data-name]", grid);
    const { cats, minP, maxP, rMin, search } = activeFilterState();

    let shown = 0;
    cards.forEach(c => {
      const name  = (c.dataset.name || c.querySelector(".title, .product-title")?.textContent || "").toLowerCase();
      const cat   = (c.dataset.category || "").toLowerCase();
      const price = c.dataset.price ? parseFloat(c.dataset.price) : parsePrice(c.querySelector(".price, .product-price")?.textContent);
      const rate  = parseFloat(c.dataset.rating || "0");

      const okCat   = cats.length ? cats.includes(cat) : true;
      const okPrice = price >= minP && price <= maxP;
      const okRate  = rate >= rMin;
      const okSearch= search ? name.includes(search) : true;

      const visible = okCat && okPrice && okRate && okSearch;
      c.style.display = visible ? "" : "none";
      if (visible) shown++;
    });

    if (sortSelect) {
      const v = sortSelect.value;
      const vis = cards.filter(c => c.style.display !== "none");
      const nameF  = c => (c.dataset.name || c.querySelector(".title, .product-title")?.textContent || "").trim().toLowerCase();
      const priceF = c => c.dataset.price ? parseFloat(c.dataset.price) : parsePrice(c.querySelector(".price, .product-price")?.textContent);
      const rateF  = c => parseFloat(c.dataset.rating || "0");
      const sorters = {
        "relevance":    () => 0,
        "price-asc":    (a,b) => priceF(a) - priceF(b),
        "price-desc":   (a,b) => priceF(b) - priceF(a),
        "name-asc":     (a,b) => nameF(a).localeCompare(nameF(b)),
        "name-desc":    (a,b) => nameF(b).localeCompare(nameF(a)),
        "rating-desc":  (a,b) => rateF(b) - rateF(a),
      };
      (vis.sort(sorters[v] || sorters.relevance)).forEach(c => grid.appendChild(c));
    }

    if (resultCount) resultCount.textContent = `${shown} item${shown===1?"":"s"}`;

    if (chipsWrap) {
      chipsWrap.innerHTML = "";
      const addChip = (label, onRemove) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `${label} <button type="button" aria-label="Remove">×</button>`;
        chip.querySelector("button").addEventListener("click", onRemove);
        chipsWrap.appendChild(chip);
      };
      if (catChecks.some(c => !c.checked))
        catChecks.filter(c => c.checked).forEach(c => addChip(c.value, () => { c.checked = false; filterAndSort(); }));
      const { minP, maxP } = activeFilterState();
      if (minP > 0)    addChip(`Min ${GBP.format(minP)}`, () => { if(minPriceEl) minPriceEl.value = "0"; filterAndSort(); });
      if (maxP < 9999) addChip(`Max ${GBP.format(maxP)}`, () => { if(maxPriceEl) maxPriceEl.value = "9999"; filterAndSort(); });
      const rSel2 = ratingRadios.find(r => r.checked)?.value ?? "all";
      if (rSel2 !== "all") addChip(`${rSel2}★ & up`, () => { const all = ratingRadios.find(r => r.value === "all"); if (all) all.checked = true; filterAndSort(); });
      if (currentSearch) addChip(`“${currentSearch}”`, () => { const s = $("#search-input"); if (s) s.value = ""; currentSearch = ""; filterAndSort(); });
    }
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); }; }

  /* ========================= Cart / Summary rendering ========================= */
  function initCartRendering() {
    document.addEventListener("cart:updated", renderCart);
    document.addEventListener("promo:updated", renderCart);
    renderCart();

    $("#clear-cart")?.addEventListener("click", () => {
      if (!confirm("Clear all items from the cart?")) return;
      window.cart.clear();
      renderCart();
      toast("Cart cleared");
    });

    const checkoutBtn = $("#proceed-to-checkout") || $("#checkout");
    checkoutBtn?.addEventListener("click", () => { window.location.href = "checkout.html"; });

    $("#cart-items")?.addEventListener("click", (e) => {
      const row = e.target.closest("li.card"); if (!row) return;
      const id = row.dataset.id;
      if (e.target.classList.contains("remove")) {
        window.cart.remove(id);
        renderCart();
        toast("Item removed");
        return;
      }
      if (e.target.classList.contains("inc") || e.target.classList.contains("dec")) {
        const qEl = row.querySelector(".q");
        let q = parseInt(qEl.textContent, 10) || 1;
        q = e.target.classList.contains("inc") ? Math.min(QMAX, q + 1) : Math.max(QMIN, q - 1);
        qEl.textContent = q;
        window.cart.setQty(id, q);
        renderCart();
      }
    });
  }

  function renderCart() {
    const list = $("#cart-items");
    const items = window.cart.get();

    const count = window.cart.count();
    $("#item-count") && ($("#item-count").textContent = `${count} item${count===1?"":"s"}`);
    updateBadge();

    if (!list) { updateSummariesOnly(items); return; }

    const emptyCard  = $("#empty-cart");
    const listAction = $("#list-actions");
    if (emptyCard) {
      if (items.length === 0) {
        emptyCard.style.display = "";
        list.innerHTML = "";
        if (listAction) listAction.style.display = "none";
      } else {
        emptyCard.style.display = "none";
        if (listAction) listAction.style.display = "flex";
      }
    }

    list.innerHTML = "";
    for (const it of items) {
      const line = (it.price || 0) * (it.qty || 0);
      const li = document.createElement("li");
      li.className = "card";
      li.dataset.id = it.id;
      li.innerHTML = `
        <div style="display:grid;grid-template-columns:96px 1fr auto;gap:.8rem;align-items:center;">
          <div class="media" style="aspect-ratio:1/1;">
            <img src="${it.img || 'https://via.placeholder.com/200?text=Item'}" alt="">
          </div>
          <div>
            <h3 class="title" style="margin:.1rem 0;">${it.name}</h3>
            <div class="meta"><span class="muted">Unit</span> <strong>${GBP.format(it.price || 0)}</strong></div>
            <button class="btn-ghost remove" type="button" style="margin-top:.4rem;">Remove</button>
          </div>
          <div style="justify-self:end;text-align:right;">
            <div class="qty" style="margin-bottom:.4rem;">
              <button class="dec" aria-label="Decrease">−</button>
              <span class="q">${it.qty || 1}</span>
              <button class="inc" aria-label="Increase">+</button>
            </div>
            <div><strong>${GBP.format(line)}</strong></div>
          </div>
        </div>`;
      list.appendChild(li);
    }

    updateSummariesOnly(items);
  }

  function updateSummariesOnly(items) {
    const { subtotal, discount, shipping, total, promo } = computeTotals(items);

    const simpleTotal = $("#total-price");
    if (simpleTotal) simpleTotal.textContent = total.toFixed(2);

    const subEl = $("#summary-subtotal"),
          discEl= $("#summary-discount"),
          shipEl= $("#summary-shipping"),
          totEl = $("#summary-total"),
          noteEl= $("#shipping-note");
    if (subEl && discEl && shipEl && totEl) {
      subEl.textContent  = GBP.format(subtotal);
      discEl.textContent = discount ? `– ${GBP.format(discount)}` : "– £0.00";
      shipEl.textContent = shipping === 0 ? "Free" : GBP.format(shipping);
      totEl.textContent  = GBP.format(total);
      if (noteEl) {
        const thresholdMsg = (promo?.code === "SAVE15" && subtotal < 60) ? "SAVE15 applies only on orders £60+." : "";
        const shipMsg = items.length === 0 ? "" :
          (shipping === 0 ? "🎉 Free shipping applied." :
            `Add ${GBP.format(Math.max(0, FREE_SHIP_THRESHOLD - (subtotal - discount)))} more for free shipping.`);
        noteEl.textContent = [thresholdMsg, shipMsg].filter(Boolean).join(" ");
      }
    }
  }

  /* ========================= Promo UI (cart + checkout) ========================= */
  function initPromoUI() {
    $("#apply-promo")?.addEventListener("click", () => {
      const code = $("#promo")?.value;
      const p = normalizePromo(code);
      if (!p) { toast("Invalid promo code"); return; }
      setPromo(p);
      toast(`Applied code ${p.code}`);
      renderCart();
    });
    $("#promo")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        $("#apply-promo")?.click();
      }
    });
    $("#promo-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = $("#promo-code")?.value;
      const p = normalizePromo(raw);
      if (!p) { toast("Invalid promo code"); return; }
      setPromo(p);
      toast(`Applied code ${p.code}`);
      renderCart();
    });
  }

  /* ========================= Orders storage/helpers ========================= */
  function readOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); }
    catch { return []; }
  }
  function writeOrders(list) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list || []));
  }
  function addOrderToHistory(o) {
    const list = readOrders();
    list.push(o);
    writeOrders(list);
  }
  function formatGBP(n){ return GBP.format(Number(n||0)); }
  function fmtDate(iso){ return new Date(iso).toLocaleString("en-GB",{year:"numeric",month:"short",day:"2-digit"}); }

  // (Optional) demo data so Orders page isn't empty during dev
  function seedOrdersIfEmpty(){
    const have = readOrders();
    if (have.length) return;
    writeOrders([
      {
        id: "ORD-240812-0012",
        createdAt: new Date(Date.now()-1000*60*60*24*9).toISOString(),
        status: "Delivered",
        subtotal: 74.97, shipping: 1.00, discount: 7.50, total: 68.47,
        items: [
          { id:"SKU-TSHIRT-001", name:"Classic Tee", qty:1, price:19.99 },
          { id:"SKU-MUG-002",    name:"Ceramic Mug", qty:2, price:12.99 },
          { id:"SKU-CABLE-USB",  name:"USB-C Cable 2m", qty:1, price:28.00 }
        ],
        address: { name:"P. C. Chilukuri", line1:"221B Baker St", city:"London", postcode:"NW1 6XE", country:"UK" }
      },
      {
        id: "ORD-240818-0044",
        createdAt: new Date(Date.now()-1000*60*60*24*3).toISOString(),
        status: "Shipped",
        subtotal: 129.98, shipping: 1.00, discount: 0, total: 130.98,
        items: [
          { id:"SKU-HDST-009", name:"Wireless Headset", qty:1, price:89.99 },
          { id:"SKU-MOUSE-003", name:"Ergo Mouse", qty:1, price:39.99 }
        ],
        address: { name:"Triveni Kandimalla", line1:"10 Downing St", city:"London", postcode:"SW1A 2AA", country:"UK" }
      },
      {
        id: "ORD-240820-0102",
        createdAt: new Date(Date.now()-1000*60*60*24*1).toISOString(),
        status: "Processing",
        subtotal: 59.99, shipping: 1.00, discount: 6.00, total: 54.99,
        items: [
          { id:"SKU-LED-STRIP", name:"LED Strip Light (5m)", qty:1, price:19.99 },
          { id:"SKU-KEYB-004", name:"Mechanical Keyboard", qty:1, price:40.00 }
        ],
        address: { name:"V-STORE Customer", line1:"5 Market St", city:"Manchester", postcode:"M1 1AA", country:"UK" }
      }
    ]);
  }

  /* ========================= Checkout (payment UI + submit) ========================= */
  function initCheckout() {
    const payRadios = $$('input[name="payment-method"]');
    const ccBox  = $("#credit-card-details");
    const ppBox  = $("#paypal-details");
    const upiBox = $("#upi-details");

    if (payRadios.length) {
      const showBox = (which) => {
        if (ccBox)  ccBox.style.display  = which==="credit-card" ? "" : "none";
        if (ppBox)  ppBox.style.display  = which==="paypal"     ? "" : "none";
        if (upiBox) upiBox.style.display = which==="upi"        ? "" : "none";
      };
      const sel = payRadios.find(r => r.checked) || payRadios[0];
      sel.checked = true; showBox(sel.value);
      payRadios.forEach(r => r.addEventListener("change", () => showBox(r.value)));
    }

    // ---- Compatible selectors (works across old/new ids) ----
    const numEl = $("#card-number") || $("#cardNumber") || $("input[autocomplete='cc-number']");
    const expEl = $("#expiry-date") || $("#card-expiry") || $("#card-exp") || $("input[autocomplete='cc-exp']");
    const cvvEl = $("#cvv") || $("#card-cvc") || $("#cardCvc") || $("input[autocomplete='cc-csc']");
    let   brandEl = $("#card-brand");
    if (!brandEl && $("#credit-card-details")) {
      brandEl = document.createElement("span");
      brandEl.id = "card-brand";
      brandEl.className = "chip";
      brandEl.style.display = "none";
      $("#credit-card-details").appendChild(brandEl);
    }

    // Formatting + validation helpers
    const detectBrand = (panDigits) => {
      const s = (panDigits||"").replace(/\D/g,"");
      if (/^4\d{6,}/.test(s)) return { brand:"Visa", cvcLen:3 };
      if (/^(5[1-5]\d{4}|2(2[2-9]\d{3}|[3-6]\d{4}|7[01]\d{3}|720\d{2}))/.test(s)) return { brand:"Mastercard", cvcLen:3 };
      if (/^3[47]\d{5,}/.test(s)) return { brand:"American Express", cvcLen:4 };
      if (/^(6011|65|64[4-9]|622(12[6-9]|1[3-9]\d|[2-8]\d{2}|9[01]\d|92[0-5]))/.test(s)) return { brand:"Discover", cvcLen:3 };
      if (/^(508[5-9]|606985|607|608|65|81|82|35)/.test(s)) return { brand:"RuPay", cvcLen:3 };
      return { brand:null, cvcLen:3 };
    };
    const luhnOk = (panDigits) => {
      const s = (panDigits||"").replace(/\D/g,"");
      let sum=0, alt=false;
      for (let i=s.length-1;i>=0;i--){
        let n=+s[i];
        if (alt){ n*=2; if(n>9) n-=9; }
        sum+=n; alt=!alt;
      }
      return s.length>=12 && (sum%10===0);
    };
    const expiryOk = (mmYY) => {
      const m = (mmYY||"").trim();
      if (!/^\d{2}\/\d{2}$/.test(m)) return false;
      let [MM, YY] = m.split("/").map(n=>+n);
      if (MM<1 || MM>12) return false;
      const now = new Date();
      const yearBase = 2000 + YY;
      const exp = new Date(yearBase, MM, 0, 23,59,59,999);
      return exp >= now;
    };
    const sanitizeDigits = (el, max=19) => (el?.value||"").replace(/\D/g,"").slice(0,max);
    const formatCardNumber = (digits) => {
      if (/^3[47]/.test(digits)){ // AmEx 4-6-5
        return digits.slice(0,15).replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (__,a,b,c)=>[a,b,c].filter(Boolean).join(" "));
      }
      return digits.slice(0,19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    };

    // Bind formatting (if fields exist)
    numEl?.addEventListener("input", () => {
      const digits = sanitizeDigits(numEl, 19);
      const { brand, cvcLen } = detectBrand(digits);
      numEl.value = formatCardNumber(digits);
      if (brandEl) {
        if (brand){ brandEl.style.display = "inline-flex"; brandEl.textContent = brand; }
        else { brandEl.style.display = "none"; brandEl.textContent = ""; }
      }
      if (cvvEl) { cvvEl.maxLength = cvcLen; cvvEl.placeholder = "•".repeat(cvcLen) || "123"; }
    });
    expEl?.addEventListener("input", () => {
      let v = expEl.value.replace(/\D/g,"").slice(0,4);
      if (v.length >= 3) v = v.slice(0,2) + "/" + v.slice(2);
      expEl.value = v;
    });
    cvvEl?.addEventListener("input", () => {
      cvvEl.value = cvvEl.value.replace(/\D/g,"").slice(0,4);
    });

    // UPI detection/validation
    const upiIdEl = $("#upi-id");
    const upiWrap = $("#upi-platform-display");
    const upiName = $("#upi-platform-name");
    const upiIcon = $("#upi-platform-icon");

    const detectUPI = (handle) => {
      const s = (handle||"").toLowerCase();
      if (!/@/.test(s)) return null;
      const dom = s.split("@")[1] || "";
      if (/(ybl|phonepe)/.test(dom))      return { name:"PhonePe", icon:'<img src="https://www.google.com/url?sa=i&url=https%3A%2F%2Fbrandfetch.com%2Fphonepe.com&psig=AOvVaw2bGQmLNjZ2snOzhmUdcP93&ust=1756403936148000&source=images&cd=vfe&opi=89978449&ved=0CBMQjRxqFwoTCKCboNbIq48DFQAAAAAdAAAAABAK">' };
      if (/(ok|google)/.test(dom))        return { name:"Google Pay", icon:"🟦" };
      if (/paytm/.test(dom))              return { name:"Paytm", icon:"🟦" };
      if (/(oksbi|sbi)/.test(dom))        return { name:"SBI UPI", icon:"🔵" };
      if (/okicici|icici|ibl/.test(dom))  return { name:"ICICI UPI", icon:"🟧" };
      if (/okaxis|axis/.test(dom))        return { name:"Axis UPI", icon:"🟥" };
      if (/okhdfcbank|hdfc/.test(dom))    return { name:"HDFC UPI", icon:"🟦" };
      return { name: dom.toUpperCase(), icon:"💳" };
    };
    const upiValid = (v) => /^[a-z0-9.\-_]{2,}@[a-z0-9.\-_]{2,}$/i.test(v||"");

    upiIdEl?.addEventListener("input", () => {
      const info = detectUPI(upiIdEl.value);
      if (!info) { if (upiWrap) upiWrap.style.display="none"; return; }
      if (upiWrap) {
        upiWrap.style.display = "inline-flex";
        if (upiName) upiName.textContent = info.name;
        if (upiIcon) upiIcon.textContent = info.icon;
      }
    });

    // Submit order
    $("#checkout-form")?.addEventListener("submit", (e) => {
      e.preventDefault();

      const items = window.cart.get();
      if (!items.length) { toast("Your cart is empty"); return; }

      const name = ($("#name")?.value || "").trim();
      const addr = ($("#address")?.value || "").trim();
      if (name.length < 2){ toast("Enter your full name"); return; }
      if (addr.length < 5){ toast("Enter a valid address"); return; }

      const method = document.querySelector('input[name="payment-method"]:checked')?.value;
      if (!method){ toast("Choose a payment method"); return; }

      let payMeta = { method };

      if (method === "credit-card") {
        const rawDigits = (numEl?.value||"").replace(/\D/g,"");
        const brandInfo = detectBrand(rawDigits);
        if (!luhnOk(rawDigits)){ toast("Invalid card number"); return; }
        if (!expiryOk(expEl?.value || "")){ toast("Invalid expiry"); return; }
        const cvcNeeded = brandInfo.cvcLen || 3;
        if (!new RegExp(`^\\d{${cvcNeeded}}$`).test((cvvEl?.value || "").trim())){ toast(`CVC must be ${cvcNeeded} digits`); return; }
        payMeta = { method:"card", brand: brandInfo.brand || "Card", last4: rawDigits.slice(-4) };
      } else if (method === "upi") {
        const id = (upiIdEl?.value || "").trim();
        if (!upiValid(id)) { toast("Enter a valid UPI ID"); return; }
        const info = detectUPI(id) || { name:"UPI" };
        payMeta = { method:"upi", handle:id, platform:info.name };
      } else if (method === "paypal") {
        payMeta = { method:"paypal" };
      }

      const customer = {
        name,
        address: addr,
        email:   $("#email")?.value?.trim() || "",
        phone:   $("#phone")?.value?.trim() || "",
        city:    $("#city")?.value?.trim() || "",
        state:   $("#state")?.value?.trim() || "",
        zip:     $("#zip")?.value?.trim() || "",
        country: $("#country")?.value?.trim() || "",
      };
      try { sessionStorage.setItem(CKOUT_INFO, JSON.stringify(customer)); } catch {}

      const totals = computeTotals(items);
      const order = {
        id: "ORD-" + Date.now(),
        createdAt: new Date().toISOString(),
        items: items.map(it => ({ id:it.id, name:it.name, price:+it.price||0, qty:+it.qty||1, img:it.img||null })),        totals,
        customer,
        payment: payMeta
      };

      // Persist to Orders history (used by orders.html)
      const normalized = {
        id: order.id,
        createdAt: order.createdAt,
        status: "Processing",
        subtotal: +(totals.subtotal||0),
        shipping: +(totals.shipping||0),
        discount: +(totals.discount||0),
        total: +(totals.total||0),
        items: order.items.map(i => ({ id:i.id, name:i.name, qty:i.qty, price:i.price })),
        address: {
          name: customer.name,
          line1: customer.address,
          city: customer.city,
          postcode: customer.zip,
          country: customer.country
        }
      };
      addOrderToHistory(normalized);

      // Save full order for thank-you page
      try { sessionStorage.setItem(ORDER_KEY, JSON.stringify(order)); }
      catch { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); }

      // Clear cart & promo AFTER saving
      window.cart.clear();
      try { localStorage.removeItem(PROMO_KEY); } catch {}

      toast("Payment successful ✅");
      setTimeout(()=>{ window.location.href = "thank-you.html"; }, 800);
    });
  }

  /* ========================= Order summary block (payment page) ========================= */
  function initOrderSummaryInline() {
    if (!$("#order-summary")) return;
    const items = readCart();
    const list = $("#order-summary");
    list.innerHTML = "";
    for (const it of items){
      const line = (it.price||0)*(it.qty||0);
      const li = document.createElement("li");
      li.className = "card";
      li.innerHTML = `
        <div style="display:grid;grid-template-columns:72px 1fr auto;gap:.6rem;align-items:center;">
          <div class="media" style="aspect-ratio:1/1;">
            <img src="${it.img||'https://via.placeholder.com/120?text=Item'}" alt="">
          </div>
          <div>
            <strong>${it.name||"Item"}</strong>
            <div class="muted">${GBP.format(it.price||0)} × ${it.qty||1}</div>
          </div>
          <div style="font-weight:700">${GBP.format(line)}</div>
        </div>`;
      list.appendChild(li);
    }

    const { subtotal, discount, shipping, total } = computeTotals(items);
    $("#total-price-summary") && ($("#total-price-summary").textContent = total.toFixed(2));
    $("#summary-subtotal") && ($("#summary-subtotal").textContent = GBP.format(subtotal));
    $("#summary-discount") && ($("#summary-discount").textContent = discount ? "– " + GBP.format(discount) : "– £0.00");
    $("#summary-shipping") && ($("#summary-shipping").textContent = shipping === 0 ? "Free" : GBP.format(shipping));
    $("#summary-total") && ($("#summary-total").textContent = GBP.format(total));
    $("#shipping-note") && ($("#shipping-note").textContent =
      items.length === 0 ? "" :
      (shipping === 0 ? "🎉 Free shipping applied." :
        `Add ${GBP.format(Math.max(0,FREE_SHIP_THRESHOLD-(subtotal-discount)))} more for free shipping.`)
    );
  }

  /* ========================= Orders page controller ========================= */
  function initOrdersPage(){
    const els = {
      count: $("#orders-count"),
      body: $("#orders-body"),
      empty: $("#empty-orders"),
      card: $("#orders-card"),
      prev: $("#prev"),
      next: $("#next"),
      pageInfo: $("#page-info"),
      exportCsv: $("#export-csv"),
      filtersForm: $("#filters"),
      resetFilters: $("#reset-filters"),
      q: $("#q"),
      status: $("#status"),
      from: $("#from"),
      to: $("#to"),
    };
    if (!els.body && !els.empty && !els.exportCsv) return; // not on orders.html

    seedOrdersIfEmpty();

    const badges = {
      Processing: "badge processing",
      Shipped:    "badge shipped",
      Delivered:  "badge success",
      Cancelled:  "badge danger",
    };

    const state = { page: 1, filtered: [] };

    function matchFilters(o){
      const q = (els.q?.value || "").trim().toLowerCase();
      const st = els.status?.value || "";
      const from = els.from?.value ? new Date(els.from.value) : null;
      const to   = els.to?.value   ? new Date(els.to.value)   : null;

      if (st && o.status !== st) return false;
      if (from && new Date(o.createdAt) < from) return false;
      if (to) {
        const end = new Date(to); end.setHours(23,59,59,999);
        if (new Date(o.createdAt) > end) return false;
      }
      if (q) {
        const inId = o.id.toLowerCase().includes(q);
        const inItems = (o.items||[]).some(it => (it.name||"").toLowerCase().includes(q));
        if (!inId && !inItems) return false;
      }
      return true;
    }

    function paginate(){
      const start = (state.page-1)*ORDERS_PAGE_SIZE;
      return state.filtered.slice(start, start + ORDERS_PAGE_SIZE);
    }

    function render(){
      const orders = readOrders().sort((a,b) => (a.createdAt > b.createdAt ? -1 : 1));
      state.filtered = orders.filter(matchFilters);

      if (els.count) els.count.textContent = `${state.filtered.length} ${state.filtered.length===1?"order":"orders"}`;

      if (els.empty && els.card) {
        const empty = state.filtered.length === 0;
        els.empty.style.display = empty ? "" : "none";
        els.card.style.display  = empty ? "none" : "";
      }
      if (!els.body) return;

      els.body.innerHTML = "";
      paginate().forEach(o => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${o.id}</strong></td>
          <td>${fmtDate(o.createdAt)}</td>
          <td>${(o.items||[]).map(i => `${i.name} ×${i.qty}`).join(", ")}</td>
          <td style="text-align:right;">${formatGBP(o.total)}</td>
          <td><span class="${badges[o.status]||"badge"}">${o.status}</span></td>
          <td>
            <button class="btn-ghost view" data-id="${o.id}"><i class="fa-regular fa-file-lines"></i> View</button>
            ${o.status === "Processing" ? `<button class="btn-ghost cancel" data-id="${o.id}"><i class="fa-regular fa-circle-xmark"></i> Cancel</button>` : ""}
          </td>
        `;
        els.body.appendChild(tr);
      });

      const pages = Math.max(1, Math.ceil(state.filtered.length / ORDERS_PAGE_SIZE));
      if (els.prev) els.prev.disabled = state.page <= 1;
      if (els.next) els.next.disabled = state.page >= pages;
      if (els.pageInfo) els.pageInfo.textContent = `Page ${state.page} / ${pages}`;
    }

    function exportCSV(){
      const rows = [['Order ID','Date','Status','Subtotal','Discount','Shipping','Total','Items']];
      readOrders().filter(matchFilters).forEach(o => {
        rows.push([
          o.id,
          new Date(o.createdAt).toISOString(),
          o.status,
          o.subtotal,
          o.discount,
          o.shipping,
          o.total,
          (o.items||[]).map(i => `${i.name} x${i.qty}`).join('; ')
        ]);
      });
      const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "vstore-orders.csv"; a.click();
      URL.revokeObjectURL(url);
    }

    function viewOrder(id){
      const o = readOrders().find(x => x.id === id); if (!o) return;
      const lines = (o.items||[]).map(i => `• ${i.name} ×${i.qty} — ${formatGBP((i.price||0)*(i.qty||0))}`).join("\n");
      alert(
`Order ${o.id}

Date: ${fmtDate(o.createdAt)}
Status: ${o.status}

Items:
${lines}

Subtotal: ${formatGBP(o.subtotal)}
Discount: −${formatGBP(o.discount)}
Shipping: ${formatGBP(o.shipping)}
Total: ${formatGBP(o.total)}

Ship to:
${o.address?.name||""}
${o.address?.line1||""}, ${o.address?.city||""}
${o.address?.postcode||""}, ${o.address?.country||""}`
      );
    }

    function cancelOrder(id){
      const list = readOrders();
      const idx = list.findIndex(o => o.id === id);
      if (idx === -1) return;
      if (!confirm("Cancel this order?")) return;
      list[idx].status = "Cancelled";
      writeOrders(list);
      toast("Order cancelled");
      render();
    }

    // Events
    els.prev?.addEventListener("click", () => { state.page = Math.max(1, state.page-1); render(); });
    els.next?.addEventListener("click", () => { state.page = state.page+1; render(); });
    els.exportCsv?.addEventListener("click", exportCSV);
    els.filtersForm?.addEventListener("submit", (e)=>{ e.preventDefault(); state.page = 1; render(); });
    els.resetFilters?.addEventListener("click", ()=>{ els.filtersForm?.reset(); state.page=1; render(); });

    // Delegated row actions
    els.body?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.classList.contains("view")) return viewOrder(id);
      if (btn.classList.contains("cancel")) return cancelOrder(id);
    });

    render();
  }

  /* ========================= Thank-You page (receipt) ========================= */
  function initThankYou(){
    const host = $("#thank-you");
    if (!host) return;

    let o = null;
    try { o = JSON.parse(sessionStorage.getItem(ORDER_KEY) || "null"); } catch {}
    if (!o) { try { o = JSON.parse(localStorage.getItem(ORDER_KEY) || "null"); } catch {} }
    if (!o) { host.innerHTML = `<p class="muted">No recent order found.</p>`; return; }

    $("#thank-order-id") && ($("#thank-order-id").textContent = o.id);
    $("#thank-order-date") && ($("#thank-order-date").textContent = fmtDate(o.createdAt));
    $("#thank-order-total") && ($("#thank-order-total").textContent = formatGBP(o.totals?.total||0));
    $("#thank-shipping-name") && ($("#thank-shipping-name").textContent = o.customer?.name || "");
    $("#thank-shipping-addr") && ($("#thank-shipping-addr").textContent = [
      o.customer?.address, o.customer?.city, o.customer?.state, o.customer?.zip, o.customer?.country
    ].filter(Boolean).join(", "));

    const list = $("#thank-items");
    if (list) {
      list.innerHTML = "";
      (o.items||[]).forEach(it => {
        const li = document.createElement("li");
        li.className = "card";
        li.innerHTML = `
          <div style="display:grid;grid-template-columns:72px 1/1 1fr auto;gap:.6rem;align-items:center;">
            <div class="media" style="aspect-ratio:1/1;">
              <img src="${it.img||'https://via.placeholder.com/120?text=Item'}" alt="">
            </div>
            <div>
              <strong>${it.name||"Item"}</strong>
              <div class="muted">${GBP.format(it.price||0)} × ${it.qty||1}</div>
            </div>
            <div style="font-weight:700">${GBP.format((it.price||0)*(it.qty||0))}</div>
          </div>`;
        list.appendChild(li);
      });
    }

    $("#thank-subtotal") && ($("#thank-subtotal").textContent = formatGBP(o.totals?.subtotal||0));
    $("#thank-discount") && ($("#thank-discount").textContent = o.totals?.discount ? "– " + formatGBP(o.totals.discount) : "– £0.00");
    $("#thank-shipping") && ($("#thank-shipping").textContent = (o.totals?.shipping||0) === 0 ? "Free" : formatGBP(o.totals?.shipping||0));
    $("#thank-total")    && ($("#thank-total").textContent    = formatGBP(o.totals?.total||0));

    $("#thank-print")?.addEventListener("click", () => window.print());
    $("#thank-view-orders")?.addEventListener("click", () => { window.location.href = `orders.html`; });
  }

  /* ========================= Debug helpers (optional) ========================= */
  window.vstoreDebug = {
    listOrders: () => JSON.parse(localStorage.getItem(ORDERS_KEY)||"[]"),
    seedOrders: () => { localStorage.removeItem(ORDERS_KEY); seedOrdersIfEmpty(); console.log("Seeded demo orders."); }
  };

  /* ========================= Chat Assistant (commands + inline cards) ========================= */
  function initChatAssistant(){
    const chatOpen = $("#chat-open");
    const chatBox  = $("#chat-box");
    const chatClose= $("#chat-close");
    const chatLog  = $("#chat-log");
    const chatForm = $("#chat-form");
    const chatInput= $("#chat-input");

    // Local catalog shared by chat
    let CATALOG = [];

    async function loadCatalog(){
      try{
        const res = await fetch('products.json', { cache: 'no-store' });
        if(!res.ok) throw new Error('No products.json found');
        CATALOG = await res.json();
      } catch (e){
        // Fallback: scrape visible products on the current page
        CATALOG = [...document.querySelectorAll('.product-item')].map(el => ({
          id: el.getAttribute('data-id'),
          name: el.getAttribute('data-name'),
          category: el.getAttribute('data-category'),
          price: parseFloat(el.getAttribute('data-price')),
          img: el.querySelector('img')?.src || ''
        }));
      }
    }

    // Add/remove via window.cart using catalog item
    function addToCartById(id, qty=1){
      const p = CATALOG.find(x=>String(x.id)===String(id));
      if(!p) return false;
      window.cart.add({ id: p.id, name: p.name, price: p.price, qty, img: p.img });
      toast(`${qty} × ${p.name} added to cart`);
      return true;
    }
    function removeFromCartByIdOrName(term, qty=1){
      const s = String(term||"").toLowerCase().trim();
      const items = window.cart.get();
      const byId = items.find(i => String(i.id)===s);
      const byName = items.find(i => (i.name||"").toLowerCase().includes(s));
      const it = byId || byName;
      if (!it) return false;
      const newQty = (it.qty||1) - (qty||1);
      if (newQty > 0) window.cart.setQty(it.id, newQty);
      else window.cart.remove(it.id);
      return true;
    }

    // Text helpers
    const WORD_TO_NUM = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10 };
    const numFrom = (text, def=1) => {
      const n = text.match(/\b(\d+)\b/); if(n) return parseInt(n[1],10);
      for (const [w,v] of Object.entries(WORD_TO_NUM)){ if (new RegExp(`\\b${w}\\b`,'i').test(text)) return v; }
      return def;
    };
    const priceCapFrom = (text) => {
      const m = text.match(/(?:under|below|<=?|less than)\s*£?\s*(\d+(?:\.\d{1,2})?)/i);
      return m ? parseFloat(m[1]) : null;
    };

    // Catalog search
    function chatSearch(q, cap=null){
      q = (q||"").trim().toLowerCase();
      let list = CATALOG.filter(p =>
        (p.name||"").toLowerCase().includes(q) || (p.category||"").toLowerCase().includes(q)
      );
      if(cap!=null) list = list.filter(p=> (p.price||0) <= cap);
      return list.slice(0, 10);
    }

    // Chat log
    function logMsg(role, text){
      if (!chatLog || !text) return;
      const d = document.createElement('div');
      d.className = `chat-msg ${role}`;
      d.textContent = text;
      chatLog.appendChild(d);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    // Render product cards INSIDE chat
    function chatRenderProducts(list){
      if (!chatLog) return;
      const wrap = document.createElement('div');
      wrap.className = 'chat-msg bot';

      if (!list.length) {
        wrap.textContent = "No matches. Try another name or category.";
      } else {
        const box = document.createElement('div');
        box.style.display = 'grid';
        box.style.gap = '8px';
        box.style.maxWidth = '100%';

        list.slice(0,5).forEach(p => {
          const card = document.createElement('div');
          card.style.border = '1px solid var(--border)';
          card.style.borderRadius = '10px';
          card.style.padding = '8px';
          card.style.display = 'grid';
          card.style.gridTemplateColumns = '56px 1fr auto';
          card.style.alignItems = 'center';
          card.style.gap = '8px';
          card.innerHTML = `
            <img src="${p.img||'https://via.placeholder.com/80'}" alt="${p.name}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;">
            <div>
              <div style="font-weight:600">${p.name}</div>
              <div class="muted" style="font-size:.9rem">${p.category||''}</div>
            </div>
            <div style="text-align:right;">
              <div>£${p.price}</div>
              <button data-chat-add="${p.id}" style="margin-top:6px;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);cursor:pointer">Add</button>
            </div>
          `;
          box.appendChild(card);
        });

        wrap.appendChild(box);
      }

      chatLog.appendChild(wrap);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    // Delegate Add clicks inside chat
    chatLog?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-chat-add]');
      if (!btn) return;
      const id = btn.getAttribute('data-chat-add');
      const ok = addToCartById(id, 1);
      const p = ok && CATALOG.find(x => String(x.id) === String(id));
      if (p) logMsg('bot', `Added 1 × ${p.name} to your cart.`);
    });

    // Intent parsing — supports:
    // add X product Y | add X <name> | add <name>
    // remove X product Y | remove X <name> | remove <name>
    // show cart | clear cart
    // <category> under £price | under £price
    // fallback: search
    function parseIntent(text){
      const s = (text||"").toLowerCase().trim();

      if (/^(show|what('| )?s)\s+(in\s+)?(my\s+)?cart/.test(s)) return { type:'show_cart' };
      if (/^(empty|clear)\s+cart$/.test(s)) return { type:'clear_cart' };

      // add 2 product 1 / add product 1 / add 2 earbuds / add earbuds
      let m = s.match(/^add\s+(?:(\d+|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b)\s*)?(?:product\s+(\w+)|(.+))$/i);
      if (m) {
        const qty = numFrom(m[1]||"", 1);
        const term = (m[2] || m[3] || "").trim();
        return { type:'add', qty, term };
      }

      // remove 1 product 2 / remove product 2 / remove 1 earbuds / remove earbuds
      m = s.match(/^remove\s+(?:(\d+|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b)\s*)?(?:product\s+(\w+)|(.+))$/i);
      if (m) {
        const qty = numFrom(m[1]||"", 1);
        const term = (m[2] || m[3] || "").trim();
        return { type:'remove', qty, term };
      }

      // "<category> under £price" or just "under £price"
      m = s.match(/^(?:(\w+)\s+)?under\s+£?\s*(\d+(?:\.\d{1,2})?)$/i);
      if (m) {
        return { type:'search', query: (m[1]||'').trim(), cap: parseFloat(m[2]) };
      }

      return { type:'search', query: s.replace(/^(find|show|search|browse)\s+/,'').trim()||'all', cap: priceCapFrom(s) };
    }

    function handleIntent(i){
      if(i.type==='show_cart'){
        const cart = window.cart.get();
        if(!cart.length) return "Your cart is empty.";
        const lines = cart.map(x=>`${x.qty} × ${x.name} (${GBP.format(x.price)})`).join('\n');
        const total = cart.reduce((s,x)=>s+(x.price||0)*(x.qty||0),0).toFixed(2);
        return `In your cart:\n${lines}\nTotal: £${total}`;
      }
      if(i.type==='clear_cart'){ window.cart.clear(); return "Cart cleared."; }
      if(i.type==='add'){
        // If they said "product 1", try ID match first; else search by name
        const byId = i.term && /^\w+$/.test(i.term) && CATALOG.find(p => String(p.id)===String(i.term));
        if (byId) {
          addToCartById(byId.id, i.qty||1);
          return `Added ${i.qty||1} × ${byId.name} to your cart.`;
        }
        const list = chatSearch(i.term, null);
        if(!list.length) return `I couldn't find "${i.term}".`;
        addToCartById(list[0].id, i.qty||1);
        return `Added ${i.qty||1} × ${list[0].name} to your cart.`;
      }
      if(i.type==='remove'){
        const ok = removeFromCartByIdOrName(i.term, i.qty||1);
        return ok ? `Removed ${i.qty||1} × ${i.term} from your cart.` : `I couldn't find "${i.term}" in your cart.`;
      }
      if(i.type==='search'){
        const list = i.query==='all' ? CATALOG.slice(0,5) : chatSearch(i.query, i.cap ?? null);
        chatRenderProducts(list);
        if(!list.length) return "";
        const capMsg = i.cap != null ? ` under £${i.cap}` : "";
        return `Here are some options${capMsg}. Tap Add to put one in your cart.`;
      }
      return "Sorry, I didn't catch that.";
    }

    // Wire UI
    chatOpen?.addEventListener("click", ()=> chatBox && (chatBox.hidden=false));
    chatClose?.addEventListener("click", ()=> chatBox && (chatBox.hidden=true));
    chatForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const text = (chatInput?.value || "").trim();
      if(!text) return;
      logMsg('user', text);
      if (CATALOG.length === 0) await loadCatalog();
      const intent = parseIntent(text);
      const reply = handleIntent(intent);
      if (reply) logMsg('bot', reply);
      if (chatInput) chatInput.value = '';
    });

    // Preload catalog quietly (not required, but snappier)
    loadCatalog();
  }
})();
