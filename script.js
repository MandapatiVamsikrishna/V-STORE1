/* ========================= V-STORE — single, unified script.js ========================= */
(() => {
  /* ========================= Helpers / Config ========================= */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;

  // ----- GH Pages base-path fix -----
  const BASE = (() => {
    const seg = location.pathname.split('/').filter(Boolean)[0] || "";
    return location.hostname.endsWith("github.io") && seg ? `/${seg}` : "";
  })();
  const withBase = (url) => {
    if (!url) return BASE + "/";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith(BASE + "/")) return url;
    if (url.startsWith("/")) return BASE + url;
    return `${BASE}/${url.replace(/^\//, "")}`;
  };

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

    initChatAssistant();        // chat with commands + inline product cards + health tips
  });
function initNav() {
  if (!(navToggle && navMenu)) return;
  const overlay = document.getElementById('nav-overlay');

  const setOpen = (open) => {
    navToggle.setAttribute('aria-expanded', String(open));
    navMenu.setAttribute('aria-expanded', String(open));
    navMenu.classList.toggle('open', open);
    if (overlay) {
      overlay.hidden = !open;
      overlay.classList.toggle('show', open);
    }
    // focus first link when opening (accessibility nicety)
    if (open) navMenu.querySelector('a,button')?.focus();
  };

  navToggle.addEventListener('click', () => {
    const ex = navToggle.getAttribute('aria-expanded') === 'true';
    setOpen(!ex);
  });

  // close when clicking the overlay
  overlay?.addEventListener('click', () => setOpen(false));

  // close after choosing a link (so it feels like an app drawer)
  navMenu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  // close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

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
      navMenu.classList.toggle("open", !ex); // ensure CSS can show mobile menu
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
/* ========================= delivery to ========================= */
(function(){
  const sel = document.getElementById('deliver-select');
  if(!sel) return;
  const saved = JSON.parse(localStorage.getItem('vstore-country')||'{}');
  if(saved?.code) sel.value = saved.code;
  sel.addEventListener('change', ()=>{
    const code = sel.value;
    const name = sel.options[sel.selectedIndex].text;
    localStorage.setItem('vstore-country', JSON.stringify({code, name}));
    const live = document.getElementById('a11y-live');
    if(live){ live.textContent = `Delivery country set to ${name}`; setTimeout(()=>live.textContent='',1200); }
    // window.dispatchEvent(new CustomEvent('country:changed',{detail:{code,name}}));
  });
})();
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
/* ========================= currency value ========================= */
// after saving the selected country to localStorage
(function(){
  // Map country -> currency
  const currencyByCountry = {
    GB:'GBP', IE:'EUR', FR:'EUR', DE:'EUR', ES:'EUR', IT:'EUR', NL:'EUR',
    SE:'SEK', PL:'PLN', US:'USD', CA:'CAD', AU:'AUD', IN:'INR'
  };

  // Display locale per currency (for Intl formatting)
  const localeByCurrency = {
    GBP:'en-GB', EUR:'de-DE', SEK:'sv-SE', PLN:'pl-PL',
    USD:'en-US', CAD:'en-CA', AUD:'en-AU', INR:'en-IN'
  };

  // FX rates: GBP -> target currency (example static rates; update server-side in production)
  const fx = {
    GBP: 1,
    EUR: 1.18,
    USD: 1.28,
    CAD: 1.74,
    AUD: 1.95,
    INR: 106,
    SEK: 13.7,
    PLN: 5.0
  };

  // VAT (standard rate) per country (approx; adapt to your catalog rules)
  const vatRate = {
    GB:0.20, IE:0.23, FR:0.20, DE:0.19, ES:0.21, IT:0.22, NL:0.21,
    SE:0.25, PL:0.23, US:0.00, CA:0.00, AU:0.10, IN:0.18
  };

  // Whether displayed prices should be tax-inclusive (EU typically yes; US/CA often pre-tax)
  const taxInclusive = {
    GB:true, IE:true, FR:true, DE:true, ES:true, IT:true, NL:true,
    SE:true, PL:true, AU:true, IN:true, US:false, CA:false
  };

  // Optional regional price multiplier (e.g., market adjustments, duties); 1 means no change
  const regionalAdj = {
    GB:1, IE:1, FR:1, DE:1, ES:1, IT:1, NL:1, SE:1, PL:1, US:1, CA:1, AU:1, IN:1
  };

  // Helpers
  function getSelectedCountry(){
    try { return JSON.parse(localStorage.getItem('vstore-country') || '{}'); }
    catch { return {}; }
  }

  function formatCurrency(amount, currency){
    const loc = localeByCurrency[currency] || 'en-GB';
    try {
      return new Intl.NumberFormat(loc, { style:'currency', currency }).format(amount);
    } catch {
      // Fallback basic formatting with symbol guess
      const symbol = { GBP:'£', EUR:'€', USD:'$', CAD:'CA$', AUD:'A$', INR:'₹', SEK:'kr', PLN:'zł' }[currency] || '';
      return symbol + amount.toFixed(2);
    }
  }

  function gbpToCountryPrice(baseGbp, countryCode){
    const currency = currencyByCountry[countryCode] || 'GBP';
    const rate = fx[currency] || 1;
    const vat = vatRate[countryCode] ?? 0;
    const incl = taxInclusive[countryCode] ?? true;
    const adj = regionalAdj[countryCode] ?? 1;

    // Convert, apply regional adj
    let local = baseGbp * rate * adj;

    // If tax-inclusive region, add VAT into display price
    if (incl && vat > 0) {
      local = local * (1 + vat);
    }

    // Round to sensible decimals (2 for most; 0 for JPY-like, but not used here)
    const rounded = Math.round(local * 100) / 100;
    return { currency, amount: rounded, formatted: formatCurrency(rounded, currency) };
  }

  function ensureBasePrice(el){
    if (!el.dataset.baseGbp) {
      // Prefer explicit data-price
      const asAttr = parseFloat(el.dataset.price);
      if (!isNaN(asAttr)) {
        el.dataset.baseGbp = String(asAttr);
        return asAttr;
      }
      // Fallback: parse text content (e.g., £29.99)
      const priceNode = el.querySelector('.price');
      if (priceNode) {
        const num = parseFloat(String(priceNode.textContent || '').replace(/[^\d.]/g,''));
        if (!isNaN(num)) {
          el.dataset.baseGbp = String(num);
          return num;
        }
      }
      el.dataset.baseGbp = '0';
      return 0;
    }
    return parseFloat(el.dataset.baseGbp);
  }

  function updateAllProductPrices(countryCode){
    const items = document.querySelectorAll('.product-item');
    items.forEach(item => {
      const base = ensureBasePrice(item) || 0;
      const out = gbpToCountryPrice(base, countryCode);
      const priceNode = item.querySelector('.price');
      if (priceNode) priceNode.textContent = out.formatted;
      // If you want a data attribute for QA
      item.dataset.currency = out.currency;
      item.dataset.displayPrice = String(out.amount);
    });

    // (Optional) Also convert any standalone totals with data-money-gbp="123.45"
    document.querySelectorAll('[data-money-gbp]').forEach(node => {
      const base = parseFloat(node.getAttribute('data-money-gbp') || '0') || 0;
      const out = gbpToCountryPrice(base, countryCode);
      node.textContent = out.formatted;
      node.setAttribute('data-currency', out.currency);
    });
  }

  function init(){
    // 1) On load, hydrate to saved country or default GB
    const saved = getSelectedCountry();
    const countryCode = saved?.code || 'GB';
    updateAllProductPrices(countryCode);

    // 2) React to explicit selection event from picker
    window.addEventListener('country:changed', (e) => {
      const code = e.detail?.code || 'GB';
      updateAllProductPrices(code);
    });

    // 3) React if another tab changes localStorage
    window.addEventListener('storage', (e) => {
      if (e.key === 'vstore-country') {
        try {
          const data = JSON.parse(e.newValue || '{}');
          if (data?.code) updateAllProductPrices(data.code);
        } catch {}
      }
    });
  }

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
(function(){
  // ---------- Helpers / shared ----------
  const CURRENCY_MAP = { GB:'GBP', IE:'EUR', FR:'EUR', DE:'EUR', ES:'EUR', IT:'EUR', NL:'EUR', SE:'SEK', PL:'PLN', US:'USD', CA:'CAD', AU:'AUD', IN:'INR' };
  const LOCALE_MAP   = { GBP:'en-GB', EUR:'de-DE', SEK:'sv-SE', PLN:'pl-PL', USD:'en-US', CAD:'en-CA', AUD:'en-AU', INR:'en-IN' };

  // Fallback FX+VAT if global converter not present (replace with live rates if you have them)
  const FX          = { GBP:1, EUR:1.18, USD:1.28, CAD:1.74, AUD:1.95, INR:106, SEK:13.7, PLN:5.0 };
  const VAT         = { GB:0.20, IE:0.23, FR:0.20, DE:0.19, ES:0.21, IT:0.22, NL:0.21, SE:0.25, PL:0.23, US:0, CA:0, AU:0.10, IN:0.18 };
  const TAX_INCL    = { GB:true, IE:true, FR:true, DE:true, ES:true, IT:true, NL:true, SE:true, PL:true, AU:true, IN:true, US:false, CA:false };
  const ADJ         = { GB:1, IE:1, FR:1, DE:1, ES:1, IT:1, NL:1, SE:1, PL:1, US:1, CA:1, AU:1, IN:1 };

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function getCountryCode(){
    try { return (JSON.parse(localStorage.getItem('vstore-country')||'{}').code) || 'GB'; }
    catch { return 'GB'; }
  }

  function fmt(amount, currency){
    const loc = LOCALE_MAP[currency] || 'en-GB';
    try { return new Intl.NumberFormat(loc, {style:'currency', currency}).format(amount); }
    catch {
      const sym = { GBP:'£', EUR:'€', USD:'$', CAD:'CA$', AUD:'A$', INR:'₹', SEK:'kr', PLN:'zł' }[currency] || '';
      return sym + amount.toFixed(2);
    }
  }

  // Use global converter if present (from your universal pricing module). Else fallback here.
  function convertGBP(baseGbp, countryCode){
    if (typeof window.vstoreConvertGBP === 'function') {
      const out = window.vstoreConvertGBP(baseGbp, countryCode);
      return { currency: out.currency || CURRENCY_MAP[countryCode] || 'GBP', amount: out.amount, formatted: out.formatted };
    }
    const cur = CURRENCY_MAP[countryCode] || 'GBP';
    let local = baseGbp * (FX[cur] || 1) * (ADJ[countryCode] || 1);
    if ((TAX_INCL[countryCode] ?? true) && (VAT[countryCode] ?? 0) > 0) local *= (1 + VAT[countryCode]);
    local = Math.round(local * 100) / 100;
    return { currency: cur, amount: local, formatted: fmt(local, cur) };
  }

  function extractGBPFromText(node){
    const t = (node && node.textContent) ? node.textContent : '';
    const m = t.replace(',', '').match(/(\d+(\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function ensureBase(node){
    // Prefer explicit attribute; else parse once from text and set it.
    if (!node) return 0;
    if (!node.hasAttribute('data-money-gbp')) {
      const parsed = extractGBPFromText(node);
      node.setAttribute('data-money-gbp', isNaN(parsed) ? '0' : String(parsed));
    }
    return parseFloat(node.getAttribute('data-money-gbp') || '0') || 0;
  }

  function render(node, baseGbp, code){
    if (!node) return;
    const out = convertGBP(baseGbp, code);
    node.textContent = out.formatted;
    node.setAttribute('data-currency', out.currency);
    node.setAttribute('data-money-local', String(out.amount));
  }

  // ---------- CART PAGE ----------
  // Works with:
  //  - row: .cart-row or tr[data-sku]
  //  - unit price cell: .unit-price (or [data-role="unit-price"])
  //  - qty input: .qty input / .quantity input / input[name*="qty"]
  //  - line subtotal: .line-subtotal (or [data-role="line-subtotal"])
  //  - totals: #cart-subtotal, #shipping, #tax, #discount, #grand-total (or [data-role="..."])
  function updateCart(){
    const code = getCountryCode();

    // Rows
    $$('.cart-row, tr[data-sku], li.cart-row').forEach(row => {
      const unitCell = row.querySelector('.unit-price, [data-role="unit-price"]');
      const qtyInput = row.querySelector('.qty input, .quantity input, input[type="number"][name*="qty"]');
      const subtotal = row.querySelector('.line-subtotal, [data-role="line-subtotal"]');

      const unitBase = ensureBase(unitCell);
      const qty = parseInt(qtyInput ? qtyInput.value : (row.getAttribute('data-qty') || '1'), 10) || 1;
      const lineBase = Math.max(0, Math.round(unitBase * qty * 100) / 100);

      if (subtotal) subtotal.setAttribute('data-money-gbp', String(lineBase));

      // render unit & line
      if (unitCell) render(unitCell, unitBase, code);
      if (subtotal) render(subtotal, lineBase, code);
    });

    // Totals
    const subtotalEl = $('#cart-subtotal, [data-role="cart-subtotal"]');
    const shippingEl = $('#shipping, [data-role="shipping"]');
    const taxEl      = $('#tax, [data-role="tax"]');
    const discountEl = $('#discount, [data-role="discount"]');
    const grandEl    = $('#grand-total, [data-role="grand-total"]');

    // derive subtotal from line items if missing
    if (subtotalEl && !subtotalEl.hasAttribute('data-money-gbp')) {
      let sum = 0;
      $$('.line-subtotal, [data-role="line-subtotal"]').forEach(n => sum += ensureBase(n));
      subtotalEl.setAttribute('data-money-gbp', sum.toFixed(2));
    }

    // make sure others have base
    [shippingEl, taxEl, discountEl, grandEl].forEach(n => { if (n) ensureBase(n); });

    // If we can compute grand total, do it (unless explicitly locked by data attr)
    if (grandEl && !grandEl.dataset.locked) {
      const sub  = subtotalEl ? ensureBase(subtotalEl) : 0;
      const ship = shippingEl ? ensureBase(shippingEl) : 0;
      const tax  = taxEl ? ensureBase(taxEl) : 0;
      const disc = discountEl ? ensureBase(discountEl) : 0;
      const total = Math.max(0, Math.round((sub + ship + tax - disc) * 100) / 100);
      grandEl.setAttribute('data-money-gbp', total.toFixed(2));
    }

    // render totals
    if (subtotalEl) render(subtotalEl, ensureBase(subtotalEl), code);
    if (shippingEl) render(shippingEl, ensureBase(shippingEl), code);
    if (taxEl)      render(taxEl,      ensureBase(taxEl),      code);
    if (discountEl) render(discountEl, ensureBase(discountEl), code);
    if (grandEl)    render(grandEl,    ensureBase(grandEl),    code);
  }

  function initCart(){
    // quantity changes
    document.addEventListener('input', (e) => {
      if (e.target.matches('.qty input, .quantity input, input[type="number"][name*="qty"]')) updateCart();
    });
    document.addEventListener('change', (e) => {
      if (e.target.matches('.qty input, .quantity input, input[type="number"][name*="qty"]')) updateCart();
    });

    // country changes
    window.addEventListener('country:changed', updateCart);

    // first paint
    updateCart();

    // watch for dynamic additions (AJAX cart, etc.)
    const root = $('#main') || document.body;
    const mo = new MutationObserver(() => {
      clearTimeout(initCart._t);
      initCart._t = setTimeout(updateCart, 25);
    });
    mo.observe(root, { childList:true, subtree:true });
  }

  // ---------- ORDERS (list & details) ----------
  function updateOrders(){
    const code = getCountryCode();

    // Convert anything already marked
    $$('[data-money-gbp]').forEach(n => render(n, ensureBase(n), code));

    // Parse and mark any plain-currency cells (only once)
    $$('.orders-table td, .orders-table th, .order-total, .amount').forEach(n => {
      if (!n.hasAttribute('data-money-gbp') && /[£€$₹]|USD|EUR|GBP|INR|CAD|AUD|SEK|PLN/.test(n.textContent||'')) {
        const base = extractGBPFromText(n);
        if (base > 0) {
          n.setAttribute('data-money-gbp', base.toFixed(2));
          render(n, base, code);
        }
      }
    });
  }

  function initOrders(){
    window.addEventListener('country:changed', updateOrders);
    updateOrders();

    const root = $('#main') || document.body;
    const mo = new MutationObserver(() => {
      clearTimeout(initOrders._t);
      initOrders._t = setTimeout(updateOrders, 25);
    });
    mo.observe(root, { childList:true, subtree:true });
  }

  // ---------- Bootstrap per-page ----------
  function boot(){
    const isCart   = !!($('.cart-row, tr[data-sku], [data-role="cart-subtotal"], #cart-subtotal'));
    const isOrders = !!($('.orders-table, .order-total, .order-details'));
    if (isCart)   initCart();
    if (isOrders) initOrders();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
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
          <div style="display:grid;grid-template-columns:72px 1fr auto;gap:.6rem;align-items:center;">
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

  /* ========================= Chat Assistant (site-wide search + links + health) ========================= */

  // -------- Normalizers to make search forgiving (apples vs apple, accents, punctuation) ------
  const normalize = (s) => String(s||"")
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g,"") // strip accents
    .replace(/&/g," and ")
    .replace(/[^a-z0-9\s]/g," ") // remove punctuation
    .replace(/\s+/g," ")
    .trim();

  const singularize = (w) => {
    if (w.endsWith("ies")) return w.slice(0,-3) + "y";
    if (w.endsWith("ses") || w.endsWith("xes") || w.endsWith("zes") || w.endsWith("ches") || w.endsWith("shes")) return w.slice(0,-2);
    if (w.endsWith("s") && w.length > 3) return w.slice(0,-1);
    return w;
  };

  const tokenize = (s) => {
    const n = normalize(s);
    const words = n.split(" ").filter(Boolean);
    const set = new Set(words.concat(words.map(singularize)));
    return Array.from(set);
  };

  // Build link for a product if none provided
  function productLink(p) {
    if (p.link) return withBase(p.link);
    return withBase(`product.html?id=${encodeURIComponent(p.id)}`);
  }

  // Parse HTML into Document to scrape cards
  function parseHTML(htmlText) {
    const parser = new DOMParser();
    return parser.parseFromString(htmlText, "text/html");
  }

  // Scrape .product-item cards from a *document* (page or parsed HTML)
  function scrapeProductsFromDoc(doc) {
    return [...doc.querySelectorAll('.product-item')].map(el => {
      const id = el.getAttribute('data-id') || slugify(el.getAttribute('data-name'));
      const name = el.getAttribute('data-name') || el.querySelector('.product-title')?.textContent?.trim() || 'Item';
      const category = el.getAttribute('data-category') || (doc.querySelector('h1,.page-title')?.textContent?.trim() || '');
      const price = parseFloat(el.getAttribute('data-price')) || 0;
      const img = el.querySelector('img')?.src || '';
      const linkEl = el.querySelector('a[href*=".html"], a[href*="?id="]');
      const link = linkEl ? linkEl.getAttribute('href') : productLink({ id, name });
      const tags = (el.getAttribute('data-tags')||"").split(",").map(x=>x.trim()).filter(Boolean);
      return { id, name, category, price, img, link, tags };
    });
  }

  function initChatAssistant(){
    const chatOpen = $("#chat-open");
    const chatBox  = $("#chat-box");
    const chatClose= $("#chat-close");
    const chatLog  = $("#chat-log");
    const chatForm = $("#chat-form");
    const chatInput= $("#chat-input");

    // ---------- 1) SITE INDEX (pages) ----------
    let SITE_INDEX = [
      { title:"Home",       url:"/index.html",           keywords:["home","start","v-store"] },
      { title:"Categories", url:"/categories.html",      keywords:["categories","browse","shop by category"] },
      { title:"Fruits",     url:"/fruits.html",          keywords:["fruit","fruits","fresh fruits"] },
      { title:"Vegatables", url:"/vegatables.html",      keywords:["veg","vegetable","vegatables"] },
      { title:"sea food",   url:"/sea food.html",        keywords:["sea","sea food","live"] },
      { title:"backery",    url:"/backery.html",         keywords:["backery","fresh","bread"] },
      { title:"Groceries",  url:"/groceries.html",       keywords:["grocery","staples","pantry"] },
      { title:"Pantry",     url:"/pantry.html",          keywords:["pantry","pantery"] },
      { title:"Dairy",      url:"/dairy.html",           keywords:["dairy","milk","diary"] },
      { title:"Eggs",       url:"/eggs.html",            keywords:["eggs","egges"] },
      { title:"Beverages",  url:"/beverages.html",       keywords:["drinks","beverage"] },
      { title:"Home",       url:"/home.html",            keywords:["home supplies","home goods"] },
      { title:"Electronics",url:"/electronics.html",     keywords:["electronics","gadgets"] },
      { title:"Meat",       url:"/meat.html",            keywords:["meat","butcher"] },
      { title:"Cart",       url:"/cart.html",            keywords:["cart","basket","bag","checkout"] },
      { title:"Orders",     url:"/orders.html",          keywords:["orders","order history","track","status"] },
      { title:"Contact",    url:"/contact.html",         keywords:["contact","support","help","customer service"] },
      { title:"Shipping",   url:"/shipping.html",        keywords:["shipping","delivery","postage"] },
      { title:"Returns",    url:"/returns.html",         keywords:["returns","refund","exchange"] },
      { title:"Gadgets Under £50", url:"/gadgets-under-50.html", keywords:["gadgets","electronics","under 50"] },
      { title:"Home Refresh",      url:"/home-refresh.html",     keywords:["home","refresh","decor"] },
      { title:"Summer Essentials", url:"/summer-essentials.html",keywords:["summer","apparel","essentials"] },
    ];

    // Also learn links from your current nav
    $$("#nav-menu a[href]").forEach(a => {
      const url = a.getAttribute("href");
      const title = a.textContent.trim();
      if (!url) return;
      if (!SITE_INDEX.some(p => p.url === url)) {
        SITE_INDEX.push({ title, url, keywords:[normalize(title)] });
      }
    });

    // ---------- 2) PRODUCT CATALOG ----------
    const CATALOG_SOURCES = [
      "/index.html",
      "/categories.html",
      "/fruits.html",
      "/groceries.html",
      "/electronics.html",
      "/home.html",
      "/vegatables.html",
      "/sea food.html",
      "/pantery.html",
      "/meat.html",
      "/beverages.html",
      "/Diary.html",
      "/eggs.html",
      "/backery.html"
    ];

    let CATALOG = [];

    // ---------- 3) SEARCH ----------
    function searchPages(q) {
      const tokens = tokenize(q);
      const scored = SITE_INDEX.map(p => {
        const hay = normalize(p.title + " " + (p.keywords||[]).join(" "));
        let score = 0;
        if (tokens.every(tok => hay.includes(tok))) score += 5;
        else if (tokens.some(tok => hay.includes(tok))) score += 3;
        return { p, score };
      }).filter(r => r.score > 0);
      return scored.sort((a,b)=>b.score-a.score).map(r => r.p).slice(0,6);
    }

    function searchProducts(q, cap=null) {
      const tokens = tokenize(q);
      const match = (s) => {
        const hay = normalize(s);
        return tokens.every(tok => hay.includes(tok));
      };
      let list = CATALOG.filter(p =>
        match(p.name) || match(p.category||"") || (p.tags||[]).some(match)
      );
      if (cap != null) list = list.filter(p => (p.price||0) <= cap);

      const nQ = normalize(q);
      list.sort((a,b) => {
        const aStart = normalize(a.name).startsWith(nQ) ? 1 : 0;
        const bStart = normalize(b.name).startsWith(nQ) ? 1 : 0;
        return bStart - aStart;
      });

      return list.slice(0, 10);
    }

    // ---------- 4) CHAT UI helpers ----------
    function logMsg(role, text){
      if (!chatLog || !text) return;
      const d = document.createElement('div');
      d.className = `chat-msg ${role}`;
      d.textContent = text;
      chatLog.appendChild(d);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    function renderPagesInChat(pages){
      if (!chatLog) return;
      const wrap = document.createElement('div');
      wrap.className = 'chat-msg bot';
      if (!pages.length) {
        wrap.textContent = "No relevant pages found.";
      } else {
        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.padding = '0';
        list.style.margin = '0';
        pages.forEach(pg => {
          const li = document.createElement('li');
          li.style.margin = '6px 0';
          li.innerHTML = `
            <a href="${withBase(pg.url)}" style="text-decoration:underline" target="_self" rel="noopener">
              ${pg.title}
            </a>`;
          list.appendChild(li);
        });
        wrap.appendChild(list);
      }
      chatLog.appendChild(wrap);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    function renderProductsInChat(list){
      if (!chatLog) return;
      const wrap = document.createElement('div');
      wrap.className = 'chat-msg bot';

      if (!list.length) {
        wrap.textContent = "No products matched that.";
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
              <a href="${productLink(p)}" target="_self" rel="noopener" style="font-size:.9rem;text-decoration:underline">View</a>
            </div>
            <div style="text-align:right;">
              <div>£${(p.price||0).toFixed(2)}</div>
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

    // --- tips renderer + product aggregation (NEW) ---
    function renderTipsInChat(lines){
      if (!chatLog) return;
      const wrap = document.createElement('div');
      wrap.className = 'chat-msg bot';
      const ul = document.createElement('ul');
      ul.style.margin = '0';
      ul.style.paddingLeft = '1em';
      lines.forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        ul.appendChild(li);
      });
      const note = document.createElement('div');
      note.className = 'muted';
      note.style.marginTop = '6px';
      note.style.fontSize = '.9rem';
      note.textContent = 'This is general wellness advice, not a diagnosis. Seek medical care if symptoms worsen, last >48 hours, or include chest pain, confusion, severe dehydration, or temperature ≥39.5°C.';
      wrap.appendChild(ul);
      wrap.appendChild(note);
      chatLog.appendChild(wrap);
      chatLog.scrollTop = chatLog.scrollHeight;
    }
    function productsForKeywords(keywords, cap=null){
      const seen = new Map();
      keywords.forEach(kw => {
        searchProducts(kw, cap).forEach(p => {
          if (!seen.has(p.id)) seen.set(p.id, p);
        });
      });
      return Array.from(seen.values()).slice(0, 10);
    }

// --- mini health knowledge base (NEW) ---
    const HEALTH_KB = {
      fever: {
        aliases: ['fever','feaver','high temperature','temperature','pyrexia','running temperature'],
        tips: [
          'Rest and avoid overexertion.',
          'Drink plenty of fluids (water, oral rehydration, clear soups).',
          'Wear light clothing and keep the room cool; apply a cool damp cloth to forehead/neck.',
          'Eat easy foods if hungry (toast/bread, soups, yogurt, fruits).',
          'Consider OTC fever reducers as directed on the label (e.g., paracetamol/acetaminophen). Avoid taking multiple medicines with the same ingredient.'
        ],
        keywords: ['water','electrolyte','oral rehydration','ORS','juice','soup','broth','bread','toast','milk','yogurt','paracetamol','acetaminophen','ibuprofen','thermometer']
      },

      cold: {
        aliases: ['cold','common cold','runny nose','blocked nose','stuffy nose','sneezing','sore throat','chills'],
        tips: [
          'Stay hydrated with warm fluids like tea, broth, or warm water.',
          'Use honey with warm water or tea to soothe the throat.',
          'Inhale steam or use a humidifier to ease congestion.',
          'Rest well to support your immune system.',
          'Use lozenges or throat sprays for temporary relief.',
          'Avoid cold drinks or exposure to chilled environments if they worsen symptoms.'
        ],
        keywords: ['honey','ginger','herbal tea','lozenge','throat spray','cough drops','steam','soup','broth','warm water','humidifier']
      },

      cough: {
        aliases: ['cough','coughing','dry cough','wet cough'],
        tips: [
          'Sip warm water with honey and ginger to soothe irritation.',
          'Keep hydrated to thin mucus and ease coughing.',
          'Use lozenges or cough drops for quick relief.',
          'Elevate your head when sleeping to reduce coughing at night.',
          'Seek medical advice if cough persists more than 2 weeks or worsens.'
        ],
        keywords: ['honey','ginger','lozenge','cough drops','herbal tea','warm water','humidifier','syrup']
      },

      flu: {
        aliases: ['flu','influenza','seasonal flu'],
        tips: [
          'Get plenty of rest to allow your body to recover.',
          'Stay hydrated with water, ORS, and warm fluids.',
          'Eat light meals like soups, broth, and fruits.',
          'Use OTC fever reducers (paracetamol/ibuprofen) if needed.',
          'Seek medical help if you have difficulty breathing, chest pain, or severe dehydration.'
        ],
        keywords: ['water','ORS','juice','broth','soup','paracetamol','ibuprofen','thermometer','blanket']
      },

      headache: {
        aliases: ['headache','migraine','head pain','tension headache'],
        tips: [
          'Rest in a quiet, dark room and avoid bright screens.',
          'Drink water — dehydration is a common cause.',
          'Apply a cold or warm compress to your head or neck.',
          'Avoid skipping meals; eat something light.',
          'Seek medical help if you experience sudden, severe headache or vision changes.'
        ],
        keywords: ['water','snack','paracetamol','ibuprofen','coffee','tea','compress']
      },

      stomach: {
        aliases: ['stomach','stomach ache','stomach pain','diarrhea','loose motions','food poisoning','upset stomach'],
        tips: [
          'Drink small sips of water or ORS to stay hydrated.',
          'Eat bland foods like rice, toast, bananas, and yogurt.',
          'Avoid spicy, oily, or heavy foods until you recover.',
          'Rest and avoid unnecessary exertion.',
          'Seek medical help if pain is severe, persistent, or includes blood in stool.'
        ],
        keywords: ['ORS','water','rice','banana','toast','bread','yogurt','soup','ginger tea']
      },

      dehydration: {
        aliases: ['dehydration','dehydrated','lack of fluids','fluid loss'],
        tips: [
          'Sip water frequently in small amounts.',
          'Use oral rehydration salts (ORS) to replace electrolytes.',
          'Avoid alcohol, caffeine, and very sugary drinks.',
          'Eat water-rich foods like fruits (watermelon, cucumber, oranges).',
          'Seek immediate medical care if symptoms include confusion, fainting, or very low urine output.'
        ],
        keywords: ['water','ORS','juice','coconut water','electrolyte drink','fruit','hydration']
      }
    };

    // clicks on product "Add" inside chat
    chatLog?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-chat-add]');
      if (!btn) return;
      const id = btn.getAttribute('data-chat-add');
      const p  = CATALOG.find(x => String(x.id) === String(id));
      if (!p) return;
      window.cart.add({ id:p.id, name:p.name, price:p.price, qty:1, img:p.img });
      logMsg('bot', `Added 1 × ${p.name} to your cart.`);
    });

    // ---------- 5) Intent parsing ----------
    const WORD_TO_NUM = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10 };
    const numberFrom = (text, def=1) => {
      const n = text.match(/\b(\d+)\b/); if(n) return parseInt(n[1],10);
      for (const [w,v] of Object.entries(WORD_TO_NUM)){ if (new RegExp(`\\b${w}\\b`,'i').test(text)) return v; }
      return def;
    };
    const priceCapFrom = (text) => {
      const m = text.match(/(?:under|below|<=?|less than)\s*£?\s*(\d+(?:\.\d{1,2})?)/i);
      return m ? parseFloat(m[1]) : null;
    };

    function bestPageFor(term){
      const results = searchPages(term);
      return results[0] || null;
    }

    function parseIntent(text){
      const s = (text||"").trim();

      // Health intents (NEW)
      for (const [topic, cfg] of Object.entries(HEALTH_KB)) {
        const hay = normalize(s);
        if (cfg.aliases.some(a => hay.includes(normalize(a)))) {
          return { type: 'health', topic };
        }
      }

      // Navigation intents
      if (/^(open|go to|take me to)\s+/i.test(s)) {
        const q = s.replace(/^(open|go to|take me to)\s+/i,'').trim();
        return { type:'nav', page: bestPageFor(q) || { title:q, url:q } };
      }

      if (/^(show|what('| )?s)\s+(in\s+)?(my\s+)?cart$/i.test(s)) return { type:'show_cart' };
      if (/^(empty|clear)\s+cart$/i.test(s)) return { type:'clear_cart' };

      // add 2 product 1 | add earbuds
      let m = s.match(/^add\s+(?:(\d+|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b)\s*)?(?:product\s+(\w+)|(.+))$/i);
      if (m) {
        const qty = numberFrom(m[1]||"", 1);
        const term = (m[2] || m[3] || "").trim();
        return { type:'add', qty, term };
      }

      // remove 1 product 2 | remove earbuds
      m = s.match(/^remove\s+(?:(\d+|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b)\s*)?(?:product\s+(\w+)|(.+))$/i);
      if (m) {
        const qty = numberFrom(m[1]||"", 1);
        const term = (m[2] || m[3] || "").trim();
        return { type:'remove', qty, term };
      }

      // "<category> under £price" or just "under £price"
      m = s.match(/^(?:(\w+)\s+)?under\s+£?\s*(\d+(?:\.\d{1,2})?)$/i);
      if (m) {
        return { type:'search', query: (m[1]||'').trim(), cap: parseFloat(m[2]) };
      }

      // Generic: do both page + product search
      return { type:'search_all', query: s, cap: priceCapFrom(s) };
    }

    function handleIntent(i){
      // Health (NEW)
      if(i.type === 'health'){
        const cfg = HEALTH_KB[i.topic];
        if (!cfg) return "I can share some general tips and items.";
        logMsg('bot', `Here are some self-care tips for ${i.topic}:`);
        renderTipsInChat(cfg.tips);
        const list = productsForKeywords(cfg.keywords);
        if (list.length) {
          logMsg('bot', 'You might also find these helpful:');
          renderProductsInChat(list);
          return "Tap View to open a page, or Add to put it in your cart.";
        } else {
          return "I couldn’t find matching items right now, but staying hydrated (water/ORS) and light foods usually help.";
        }
      }

      if(i.type==='nav'){
        if (i.page?.url) {
          renderPagesInChat([i.page]);
          window.location.href = withBase(i.page.url); // base-aware navigation
          return `Opening ${i.page.title || i.page.url}…`;
        }
        return "I couldn't find that page.";
      }
      if(i.type==='show_cart'){
        const cart = window.cart.get();
        if(!cart.length) return "Your cart is empty.";
        const lines = cart.map(x=>`${x.qty} × ${x.name} (£${x.price.toFixed(2)})`).join('\n');
        const total = cart.reduce((s,x)=>s+(x.price||0)*(x.qty||0),0).toFixed(2);
        return `In your cart:\n${lines}\nTotal: £${total}`;
      }
      if(i.type==='clear_cart'){ window.cart.clear(); return "Cart cleared."; }

      if(i.type==='add'){
        const byId = i.term && /^\w+$/.test(i.term) && CATALOG.find(p => String(p.id)===String(i.term));
        if (byId) {
          window.cart.add({ id:byId.id, name:byId.name, price:byId.price, qty:i.qty||1, img:byId.img });
          return `Added ${i.qty||1} × ${byId.name} to your cart.`;
        }
        const list = searchProducts(i.term);
        if(!list.length) return `I couldn't find "${i.term}".`;
        const p = list[0];
        window.cart.add({ id:p.id, name:p.name, price:p.price, qty:i.qty||1, img:p.img });
        return `Added ${i.qty||1} × ${p.name} to your cart.`;
      }

      if(i.type==='remove'){
        const s = String(i.term||"").toLowerCase().trim();
        const items = window.cart.get();
        const byId = items.find(x => String(x.id)===s);
        const byName = items.find(x => (x.name||"").toLowerCase().includes(s));
        const it = byId || byName;
        if (!it) return `I couldn't find "${i.term}" in your cart.`;
        const newQty = (it.qty||1) - (i.qty||1);
        if (newQty > 0) window.cart.setQty(it.id, newQty);
        else window.cart.remove(it.id);
        return `Removed ${i.qty||1} × ${it.name} from your cart.`;
      }

      if(i.type==='search'){
        const products = searchProducts(i.query || "", i.cap ?? null);
        renderProductsInChat(products);
        if (!products.length) return "No products found.";
        const capMsg = i.cap != null ? ` under £${i.cap}` : "";
        return `Here are some options${capMsg}.`;
      }

      if(i.type==='search_all'){
        const pages = searchPages(i.query);
        const products = searchProducts(i.query, i.cap ?? null);
        if (pages.length) {
          logMsg('bot', `Pages matching “${i.query}” :`);
          renderPagesInChat(pages);
        }
        if (products.length) {
          logMsg('bot', `Products matching “${i.query}” :`);
          renderProductsInChat(products);
          return "Tap View to open a page, or Add to put it in your cart.";
        }
        return "No pages or products matched that. Try a different phrase.";
      }

      return "Sorry, I didn't catch that.";
    }

    // ---------- 6) Wire UI ----------
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

    // Preload quietly so first search is snappy
    loadCatalog();

    async function loadCatalog(){
      const collected = [];

      // 1) Try products.json first (if you maintain one)
      try{
        const res = await fetch(withBase('products.json'), { cache: 'no-store' });
        if(!res.ok) throw new Error('no products.json');
        const raw = await res.json();
        raw.forEach(p => {
          collected.push({
            id: p.id ?? p.slug ?? slugify(p.name),
            name: p.name,
            category: p.category ?? "",
            price: Number(p.price||0),
            img: p.img || p.image || "",
            link: p.link || p.url || productLink({ id: p.id ?? p.slug, name: p.name }),
            tags: p.tags || []
          });
        });
      } catch(_) {
        // optional: ignore if missing
      }

      // 2) Always scrape the current page (quick win)
      collected.push(...scrapeProductsFromDoc(document));

      // 3) Fetch and scrape other known product pages (skip current path)
      const here = withBase(location.pathname).replace(/\/+$/, '').toLowerCase();
      const toFetch = CATALOG_SOURCES
        .map(u => withBase(u).replace(/\/+$/, '').toLowerCase())
        .filter(u => u && u !== here);

      const results = await Promise.allSettled(
        toFetch.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Fetch failed: ${url}`);
            const text = await res.text();
            const doc = parseHTML(text);
            return scrapeProductsFromDoc(doc);
          } catch {
            return []; // tolerate 404s or typos
          }
        })
      );

      results.forEach(r => { if (r.status === 'fulfilled') collected.push(...r.value); });

      // 4) De-duplicate (prefer first occurrence)
      const seen = new Map();
      for (const p of collected) {
        const key = String(p.id || slugify(p.name));
        if (!seen.has(key)) seen.set(key, { ...p, id: key });
      }
      CATALOG = Array.from(seen.values());
    }
  }
})();
