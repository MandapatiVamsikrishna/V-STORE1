/* =====================================================================
   V-STORE — shop.js (load after api.js + script.js on every page)
   Standard shop features: mini cart drawer, search suggestions,
   recently viewed, delivery-slot picker, order details + tracking.
   ===================================================================== */
(() => {
  const VS = window.VStore;
  const { esc, GBP } = VS;
  const FREE_DELIVERY = 49;
  const here = location.pathname.split("/").pop() || "index.html";
  const M = () => window.VMarket;
  const money = (n, cur) => (M() ? M().format(n, cur) : GBP.format(Number(n) || 0));   // amount already in a currency
  const shelfMoney = (gbp) => (M() ? M().fmtGBP(gbp) : GBP.format(Number(gbp) || 0));  // catalogue GBP → shopper's market

  /* ================= Mini cart drawer ================= */
  let drawer = null;
  let lastFocus = null;

  function buildDrawer() {
    drawer = document.createElement("div");
    drawer.className = "drawer";
    drawer.hidden = true;
    drawer.innerHTML = `
      <div class="drawer-backdrop" data-close></div>
      <aside class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header class="drawer-head">
          <h2 id="drawer-title">Your cart</h2>
          <button class="drawer-x" type="button" data-close aria-label="Close cart">✕</button>
        </header>
        <div class="drawer-ship" id="drawer-ship"></div>
        <ul class="drawer-items" id="drawer-items"></ul>
        <footer class="drawer-foot" id="drawer-foot">
          <div class="drawer-sub"><span>Subtotal</span><strong id="drawer-sub"></strong></div>
          <p class="muted small">Delivery and promo codes are worked out at checkout.</p>
          <a class="btn-primary btn-lg" href="checkout.html">Checkout</a>
          <a class="btn-ghost" href="cart.html">View full cart</a>
        </footer>
      </aside>`;
    document.body.append(drawer);

    drawer.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) return closeDrawer();
      const row = e.target.closest("[data-line]");
      if (!row) return;
      const id = row.dataset.line;
      const it = window.cart.get().find((i) => String(i.id) === id);
      if (!it) return;
      if (e.target.closest(".d-inc")) window.cart.setQty(id, (it.qty || 1) + 1);
      else if (e.target.closest(".d-dec")) (it.qty || 1) <= 1 ? window.cart.remove(id) : window.cart.setQty(id, it.qty - 1);
      else if (e.target.closest(".d-remove")) window.cart.remove(id);
    });
    document.addEventListener("keydown", (e) => {
      if (drawer.hidden) return;
      if (e.key === "Escape") closeDrawer();
      if (e.key === "Tab") { // keep focus inside the drawer
        const f = [...drawer.querySelectorAll("a[href],button:not([disabled])")];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    document.addEventListener("cart:updated", () => { if (!drawer.hidden) renderDrawer(); });
  }

  function renderDrawer(justAdded) {
    const items = window.cart.get();
    const t = M() ? M().totals(items, null) : null;
    const m = M() ? M().market() : { freeThreshold: FREE_DELIVERY, name: "UK" };
    const sub = t ? t.subtotal : items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0);
    const count = items.reduce((n, i) => n + (i.qty || 0), 0);
    drawer.querySelector("#drawer-title").textContent = count ? `Your cart (${count})` : "Your cart";
    const FREE = m.freeThreshold;
    const left = Math.max(0, FREE - sub);
    const pct = Math.min(100, (sub / FREE) * 100);
    drawer.querySelector("#drawer-ship").innerHTML = items.length ? `
      <p>${left > 0 ? `Add <strong>${money(left)}</strong> more for free delivery` : "<strong>You've got free delivery</strong>"}</p>
      <div class="ship-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${FREE}" aria-valuenow="${Math.min(sub, FREE).toFixed(2)}" aria-label="Progress to free delivery"><span style="width:${pct}%"></span></div>` : "";
    drawer.querySelector("#drawer-items").innerHTML = items.length
      ? items.map((i) => `
        <li class="d-line${String(i.id) === String(justAdded) ? " just-added" : ""}" data-line="${esc(i.id)}">
          <a class="d-img" href="product.html?id=${encodeURIComponent(i.id)}">${i.img ? `<img src="${esc(i.img)}" alt="">` : ""}</a>
          <div class="d-info">
            <a class="d-name" href="product.html?id=${encodeURIComponent(i.id)}">${esc(i.name)}</a>
            <span class="muted small">${shelfMoney(i.price)} each</span>
            ${M() && !M().canShip(i.dept) ? `<span class="line-warn">Not available for delivery to ${esc(m.name)}</span>` : ""}
            <div class="d-row">
              <div class="qty"><button class="d-dec" type="button" aria-label="${(i.qty || 1) <= 1 ? "Remove" : "Decrease"} ${esc(i.name)}">−</button><span class="q">${i.qty || 1}</span><button class="d-inc" type="button" aria-label="Increase ${esc(i.name)}">+</button></div>
              <button class="d-remove" type="button">Remove</button>
            </div>
          </div>
          <strong class="d-total">${money((M() ? M().fromGBP(i.price) : i.price || 0) * (i.qty || 0))}</strong>
        </li>`).join("")
      : `<li class="d-empty"><p><strong>Your cart is empty</strong></p><p class="muted">Add something from the shop and it will appear here.</p><a class="btn-ghost" href="categories.html">Browse departments</a></li>`;
    drawer.querySelector("#drawer-sub").textContent = money(sub);
    drawer.querySelector("#drawer-foot").hidden = !items.length;
  }

  function openDrawer(justAdded) {
    if (!drawer) buildDrawer();
    renderDrawer(justAdded);
    lastFocus = document.activeElement;
    drawer.hidden = false;
    document.documentElement.classList.add("no-scroll");
    requestAnimationFrame(() => drawer.classList.add("open"));
    drawer.querySelector(".drawer-x").focus();
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    document.documentElement.classList.remove("no-scroll");
    setTimeout(() => { drawer.hidden = true; }, 180);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  /** Called by script.js after an item is added. Returns true when the drawer handled the feedback. */
  function onAdd(item) {
    if (here === "checkout.html" || here === "cart.html") return false;
    openDrawer(item?.id);
    return true;
  }

  /* ================= Search suggestions ================= */
  function initSuggest() {
    const input = document.getElementById("site-q");
    if (!input) return;
    const form = input.closest("form");
    const box = document.createElement("div");
    box.className = "suggest";
    box.id = "site-suggest";
    box.setAttribute("role", "listbox");
    box.hidden = true;
    form.append(box);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", "site-suggest");
    input.setAttribute("aria-expanded", "false");

    let options = [];
    let active = -1;
    let timer;
    const hide = () => { box.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
    const setActive = (i) => {
      options.forEach((o, n) => o.setAttribute("aria-selected", String(n === i)));
      active = i;
      if (i >= 0) input.setAttribute("aria-activedescendant", options[i].id);
    };
    const mark = (text, q) => {
      const i = text.toLowerCase().indexOf(q);
      return i < 0 ? esc(text) : `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
    };

    async function update() {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) return hide();
      const all = await VS.catalog();
      const words = q.split(/\s+/);
      const hits = all
        .filter((p) => words.every((w) => `${p.name} ${p.department} ${p.category}`.toLowerCase().includes(w)))
        .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || (b.rating || 0) - (a.rating || 0))
        .slice(0, 6);
      box.innerHTML = (hits.length
        ? hits.map((p, i) => `
          <a class="sugg" role="option" id="sugg-${i}" aria-selected="false" href="product.html?id=${encodeURIComponent(p.sku)}">
            <span class="s-img">${p.image ? `<img src="${esc(p.image)}" alt="">` : ""}</span>
            <span class="s-txt"><span class="s-name">${mark(p.name, words[0])}</span><span class="s-dept">${esc(p.department)}</span></span>
            <span class="s-price">${p.compareAtPrice > p.price ? `<s class="was">${shelfMoney(p.compareAtPrice)}</s>` : ""}${shelfMoney(p.price)}</span>
          </a>`).join("")
        : `<p class="sugg-none">No quick matches. Press Enter to search everything.</p>`)
        + `<a class="sugg-all" role="option" id="sugg-all" aria-selected="false" href="search.html?q=${encodeURIComponent(input.value.trim())}">See all results for “${esc(input.value.trim())}”</a>`;
      options = [...box.querySelectorAll("[role=option]")];
      active = -1;
      box.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 120); });
    input.addEventListener("focus", () => { if (input.value.trim().length >= 2) update(); });
    input.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(options.length - 1, active + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(-1, active - 1)); }
      else if (e.key === "Escape") hide();
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); location.href = options[active].href; }
    });
    document.addEventListener("click", (e) => { if (!form.contains(e.target)) hide(); });
  }

  /* ================= Recently viewed ================= */
  const RECENT_KEY = "vstore_recent";
  const recent = {
    all() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; } },
    add(sku) {
      if (!sku) return;
      const list = [sku, ...recent.all().filter((s) => s !== sku)].slice(0, 12);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch {}
    }
  };

  async function renderRecent() {
    const sections = document.querySelectorAll("[data-recent]");
    if (!sections.length) return;
    const all = await VS.catalog();
    sections.forEach((sec) => {
      const exclude = sec.dataset.exclude || "";
      const items = recent.all().filter((s) => s !== exclude).map((s) => all.find((p) => p.sku === s)).filter(Boolean).slice(0, 4);
      const grid = sec.querySelector(".product-grid, .grid");
      if (!items.length || !grid) { sec.hidden = true; return; }
      grid.innerHTML = items.map(VS.productCard).join("");
      sec.hidden = false;
    });
  }

  /* ================= Delivery slots (checkout) ================= */
  const WINDOWS = ["08:00–10:00", "10:00–12:00", "12:00–14:00", "14:00–16:00", "16:00–18:00", "18:00–20:00"];

  function initSlots() {
    const host = document.getElementById("slot-picker");
    if (!host) return;
    const m = M() ? M().market() : { slots: true };
    if (!m.slots) {
      // Outside the UK: standard delivery with an estimated date instead of slots
      host.innerHTML = `
        <h2 style="margin:1rem 0 .3rem;">Delivery</h2>
        <div class="notice"><strong>${esc(m.delivery)}</strong> to ${esc(m.name)}. Estimated arrival by <strong>${M().deliveryDate()}</strong>.</div>
        <input type="hidden" id="delivery-slot" name="deliverySlot" value="">`;
      return;
    }
    const days = [];
    for (let d = 1; d <= 5; d++) {
      const date = new Date(); date.setDate(date.getDate() + d);
      days.push(date);
    }
    const dayLabel = (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    // Some slots show as full so the picker feels real (stable per date)
    const isFull = (d, w) => ((d.getDate() * 7 + w * 3) % 5) === 0;
    let dayIdx = 0;
    let chosen = null;

    host.innerHTML = `
      <h2 style="margin:1rem 0 .3rem;">Delivery slot</h2>
      <p class="muted small" style="margin:0 0 .6rem;">Choose when you'd like your order to arrive.</p>
      <div class="slot-days" role="tablist" aria-label="Delivery day"></div>
      <div class="slot-grid" role="radiogroup" aria-label="Delivery time"></div>
      <input type="hidden" id="delivery-slot" name="deliverySlot">`;
    const daysEl = host.querySelector(".slot-days");
    const gridEl = host.querySelector(".slot-grid");
    const hidden = host.querySelector("#delivery-slot");

    function render() {
      daysEl.innerHTML = days.map((d, i) => `<button type="button" role="tab" aria-selected="${i === dayIdx}" data-day="${i}">${i === 0 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short" })}<small>${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</small></button>`).join("");
      const d = days[dayIdx];
      gridEl.innerHTML = WINDOWS.map((w, i) => {
        const full = isFull(d, i);
        const value = `${dayLabel(d)}, ${w}`;
        return `<label class="slot${full ? " full" : ""}"><input type="radio" name="slot" value="${value}"${full ? " disabled" : ""}${chosen === value ? " checked" : ""}><span>${w}</span><small>${full ? "Full" : `Free over ${money(m.freeThreshold)}`}</small></label>`;
      }).join("");
    }
    daysEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-day]");
      if (!b) return;
      dayIdx = Number(b.dataset.day);
      render();
    });
    gridEl.addEventListener("change", (e) => {
      chosen = e.target.value;
      hidden.value = chosen;
    });
    // Pre-select the first free slot tomorrow; the shopper can change it
    const first = WINDOWS.findIndex((_, i) => !isFull(days[0], i));
    chosen = `${dayLabel(days[0])}, ${WINDOWS[first]}`;
    hidden.value = chosen;
    render();
  }

  /* ================= Checkout follows the delivery country ================= */
  const PAY_KEY = { "credit-card": "card", card: "card", paypal: "paypal", upi: "upi", cod: "cod" };
  function applyCheckoutMarket() {
    const form = document.getElementById("checkout-form");
    if (!form || !M()) return;
    const m = M().market();

    // "Delivering to" box with a country switcher
    let box = document.getElementById("deliver-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "deliver-box";
      box.className = "notice deliver-box";
      form.prepend(box);
      box.addEventListener("change", (e) => {
        if (e.target.id !== "checkout-country") return;
        const header = document.getElementById("deliver-select");
        if (header) { header.value = e.target.value; header.dispatchEvent(new Event("change")); }
      });
    }
    const header = document.getElementById("deliver-select");
    const options = header ? header.innerHTML : `<option value="${m.code}">${esc(m.name)}</option>`;
    box.innerHTML = `
      <div><span class="muted small">Delivering to</span><strong>${esc(m.name)}</strong>
        <span class="muted small">${esc(m.delivery)} · Prices in ${m.currency}${m.taxInclusive ? ` incl. ${esc(m.taxName)}` : ` + ${esc(m.taxName.toLowerCase())}`}</span></div>
      <label class="change-country">Change <select id="checkout-country" aria-label="Delivery country">${options}</select></label>`;
    box.querySelector("#checkout-country").value = m.code;

    // Address format
    const zip = document.getElementById("zip");
    const zipLabel = form.querySelector('label[for="zip"]');
    if (zipLabel) zipLabel.textContent = m.postcode.label;
    if (zip) {
      zip.placeholder = m.postcode.example;
      zip.setAttribute("pattern", m.postcode.pattern);
      zip.title = `${m.postcode.label}, e.g. ${m.postcode.example}`;
      const check = () => zip.setCustomValidity(!zip.value.trim() || new RegExp(m.postcode.pattern).test(zip.value.trim()) ? "" : `Enter a valid ${m.postcode.label} for ${m.name}, e.g. ${m.postcode.example}`);
      zip.oninput = check;
      check();
    }
    const phone = document.getElementById("phone");
    if (phone) phone.placeholder = `${m.phone} …`;

    // Payment methods allowed in this country
    let firstAllowed = null, checkedHidden = false;
    form.querySelectorAll('input[name="payment-method"]').forEach((r) => {
      const ok = m.payments.includes(PAY_KEY[r.value] || r.value);
      const wrap = r.closest(".payment-option, label") || r.parentElement;
      if (wrap) wrap.hidden = !ok;
      if (ok && !firstAllowed) firstAllowed = r;
      if (!ok && r.checked) { r.checked = false; checkedHidden = true; }
    });
    if (checkedHidden && firstAllowed) { firstAllowed.checked = true; firstAllowed.dispatchEvent(new Event("change", { bubbles: true })); }
    initSlots();
  }

  /* ================= Order details + tracking ================= */
  function showOrder(o) {
    let dlg = document.getElementById("order-dialog");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "order-dialog";
      dlg.className = "modal order-modal";
      dlg.setAttribute("aria-labelledby", "order-dialog-title");
      document.body.append(dlg);
      dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
    }
    const when = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
    const cancelled = o.status === "Cancelled";
    const steps = cancelled
      ? [["Order placed", o.createdAt, true], ["Cancelled", o.cancelledAt, true]]
      : [["Order placed", o.createdAt, true],
         ["Shipped", o.shippedAt, ["Shipped", "Delivered"].includes(o.status)],
         ["Delivered", o.deliveredAt, o.status === "Delivered"]];
    const a = o.address || {};
    const cur = o.currency || "GBP";
    dlg.innerHTML = `
      <div class="order-body">
        <header><h2 id="order-dialog-title">Order ${esc(o.id)}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></header>
        <ol class="track${cancelled ? " cancelled" : ""}">
          ${steps.map(([label, at, done]) => `<li class="${done ? "done" : ""}"><span class="dot" aria-hidden="true"></span><strong>${label}</strong><span class="muted small">${done ? when(at) : "Not yet"}</span></li>`).join("")}
        </ol>
        <div class="order-facts">
          ${o.deliverySlot ? `<div><span class="muted small">Delivery slot</span><strong>${esc(o.deliverySlot)}</strong></div>` : ""}
          ${!o.deliverySlot && o.deliveryEstimate ? `<div><span class="muted small">Delivery</span><strong>${esc(o.deliveryEstimate)}</strong></div>` : ""}
          <div><span class="muted small">Deliver to</span><strong>${esc([a.name, a.line1, a.city, a.postcode].filter(Boolean).join(", ") || "—")}</strong></div>
          ${o.paymentMethod ? `<div><span class="muted small">Payment</span><strong>${esc({ card: "Card", upi: "UPI", paypal: "PayPal", cod: "Cash on delivery" }[o.paymentMethod] || o.paymentMethod)}</strong></div>` : ""}
        </div>
        <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th></tr></thead><tbody>
          ${(o.items || []).map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${i.qty}</td><td class="num">${money((i.price || 0) * (i.qty || 0), cur)}</td></tr>`).join("")}
        </tbody></table>
        <dl class="order-totals">
          <dt>Subtotal</dt><dd>${money(o.subtotal, cur)}</dd>
          ${o.discount ? `<dt>Discount</dt><dd>−${money(o.discount, cur)}</dd>` : ""}
          <dt>Delivery</dt><dd>${o.shipping ? money(o.shipping, cur) : "Free"}</dd>
          ${o.tax ? `<dt>Tax</dt><dd>${money(o.tax, cur)}</dd>` : ""}
          <dt class="grand">Total</dt><dd class="grand">${money(o.total, cur)}</dd>
          ${o.taxIncluded ? `<dt class="muted small">Tax included</dt><dd class="muted small">${money(o.taxIncluded, cur)}</dd>` : ""}
        </dl>
        <div class="modal-actions"><button class="btn-ghost" type="button" onclick="window.print()">Print</button><button class="btn-primary" type="button" data-close>Close</button></div>
      </div>`;
    dlg.showModal();
  }

  /* ================= Thank-you page: show the chosen slot ================= */
  function showSlotOnThankYou() {
    if (here !== "thank-you.html") return;
    let r = null;
    try { r = JSON.parse(sessionStorage.getItem("vstore_last_order") || "null"); } catch {}
    const inner = document.querySelector(".page-hero .hero-inner");
    if (!(r?.deliverySlot || r?.deliveryEstimate) || !inner) return;
    const p = document.createElement("p");
    p.className = "slot-note";
    p.innerHTML = r.deliverySlot ? `Delivery slot: <strong>${esc(r.deliverySlot)}</strong>` : `Estimated delivery: <strong>${esc(r.deliveryEstimate)}</strong>`;
    inner.append(p);
  }

  /* ================= Sale prices only make sense in pounds ================= */
  function syncCurrencyClass() {
    let code = "GB";
    try { code = JSON.parse(localStorage.getItem("vstore-country") || "{}").code || "GB"; } catch {}
    document.documentElement.classList.toggle("non-gbp", code !== "GB");
  }
  window.addEventListener("country:changed", syncCurrencyClass);
  document.addEventListener("market:changed", () => { applyCheckoutMarket(); if (drawer && !drawer.hidden) renderDrawer(); });

  /* ================= Small interaction details ================= */
  // "−" is disabled at quantity 1 so it's clear it can't go lower
  document.addEventListener("click", (e) => {
    const q = e.target.closest(".qty");
    if (!q || q.closest(".drawer")) return;
    setTimeout(() => {
      const n = parseInt(q.querySelector(".q")?.textContent || "1", 10);
      const dec = q.querySelector(".dec");
      if (dec) dec.disabled = n <= 1;
    }, 0);
  });
  // Clicking anywhere on a filter chip removes it (not just the small ×)
  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".chips .chip, .chips > span");
    if (!chip || e.target.closest("button")) return;
    chip.querySelector("button")?.click();
  });

  async function renderHomeCodes() {
    const grid = document.querySelector(".codes");
    if (!grid || !M()) return;
    await M().ready;
    const list = M().promos();
    const sec = grid.closest("section");
    if (!list.length) { if (sec) sec.hidden = true; return; }
    if (sec) sec.hidden = false;
    grid.innerHTML = list.slice(0, 4).map((p) => `<div class="code-card"><span class="code">${esc(p.code)}</span><strong>${esc(M().promoLabel(p).replace(/^./, (c) => c.toUpperCase()))}</strong><p>${esc(p.description || "Enter it in your cart or at checkout.")}</p></div>`).join("");
  }
  document.addEventListener("market:changed", renderHomeCodes);

  document.addEventListener("DOMContentLoaded", () => {
    syncCurrencyClass();
    initSuggest();
    applyCheckoutMarket();
    renderRecent();
    showSlotOnThankYou();
  });

  window.VStoreShop = { onAdd, openDrawer, recent, renderRecent, showOrder };
})();
