// script.js — universal, page-safe logic for V-STORE / FreshMart
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

  // Currency + limits
  const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const QMIN = 1, QMAX = 99;
  const FREE_SHIP_THRESHOLD = 49;

  // Node cache (optional across pages)
  const themeBtn  = $("#theme-toggle");
  const navToggle = $(".nav-toggle");
  const navMenu   = $("#nav-menu");
  const toastEl   = $("#toast");
  const yearEl    = $("#year");
  const badge     = $("#cart-count");

  /* ========================= Boot ========================= */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNav();
    initYear();

    initPromoTicker();          // safe no-op if absent
    initCartAPI();              // window.cart*
    updateBadge();

    initGlobalClicks();         // add-to-cart, qty +/-, wishlist
    initSearch();               // search forms on any page
    initFiltersAndSort();       // category pages (safe no-op)
    initCartRendering();        // cart list + totals (safe no-op)
    initPromoUI();              // promo input(s) (safe no-op)
    initCheckout();             // payment UI, validations, order submit (safe no-op)
    initOrderSummaryInline();   // if a page has #order-summary (safe no-op)
  });

  /* ========================= UI basics ========================= */
  function toast(msg, ms=2000) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toastEl.hidden = true), ms);
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
        const f = items.find(i => i.id === item.id);
        if (f) f.qty = Math.min(QMAX, (f.qty || 0) + (item.qty || 1));
        else items.push({ ...item, qty: Math.max(QMIN, item.qty || 1) });
        writeCart(items);
        updateBadge();
      },
      setQty: (id, qty) => {
        const items = readCart();
        const it = items.find(i => i.id === id);
        if (!it) return;
        it.qty = Math.max(QMIN, Math.min(QMAX, qty|0));
        writeCart(items);
        updateBadge();
      },
      remove: (id) => { writeCart(readCart().filter(i => i.id !== id)); updateBadge(); },
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
    if (items.length) shipping = (subtotal - discount) >= FREE_SHIP_THRESHOLD ? 0 : 4.99;
    if (promo?.type === "freeship" && items.length) shipping = 0;

    const total = Math.max(0, subtotal - discount + shipping);
    return { subtotal, discount, shipping, total, promo };
  }

  /* ========================= Product helpers ========================= */
  function parsePrice(str) {
    if (typeof str === "number") return str;
    if (!str) return 0;
    const m = String(str).replace(",", ".").match(/(\d+(\.\d+)?)/);
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
      if (/(ybl|phonepe)/.test(dom))      return { name:"PhonePe", icon:"🟪" };
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
        const rawDigits = sanitizeDigits(numEl || {value:""});
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
        items: items.map(it => ({ id:it.id, name:it.name, price:+it.price||0, qty:+it.qty||1, img:it.img||null })),
        totals,
        customer,
        payment: payMeta
      };

      // Save order for thank-you page
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
})();
