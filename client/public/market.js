/* =====================================================================
   V-STORE — market.js (load after api.js, before script.js)
   Country rules: currency, tax, delivery fees, what can ship, payment
   methods and address formats. Reads markets.json — the same file the
   server uses — so shown prices always match charged prices.
   ===================================================================== */
(() => {
  const KEY = "vstore-country";
  let DOC = null;
  const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  // GB is the base market: pages render correctly before the rules file loads
  const GB_FALLBACK = { code: "GB", name: "United Kingdom", currency: "GBP", locale: "en-GB", fx: 1, tax: 0.2, taxName: "VAT", taxInclusive: true,
    fee: 1.99, freeThreshold: 49, perishables: true, slots: true, delivery: "Next day — choose a 2-hour slot",
    deliveryDays: [1, 1], payments: ["card", "paypal", "cod"], postcode: { label: "Postcode", pattern: "^[A-Za-z]{1,2}\\d[A-Za-z\\d]?\\s*\\d[A-Za-z]{2}$", example: "SW1A 1AA" }, phone: "+44" };

  const code = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}").code || "GB"; } catch { return "GB"; } };
  const market = () => {
    const c = code();
    const m = DOC?.markets?.[c];
    return m ? { code: c, ...m } : GB_FALLBACK;
  };
  const baseVat = () => DOC?.base?.vat ?? 0.2;
  const perishable = () => new Set(DOC?.perishableDepartments || ["Fruits", "Vegetables", "Dairy", "Eggs", "Meat", "Seafood", "Bakery"]);

  const fmtCache = {};
  function format(amount, currency, locale) {
    const m = market();
    const cur = currency || m.currency;
    const loc = locale || (cur === m.currency ? m.locale : undefined) || "en-GB";
    const k = `${loc}|${cur}`;
    fmtCache[k] ||= new Intl.NumberFormat(loc, { style: "currency", currency: cur });
    return fmtCache[k].format(Number(amount) || 0);
  }
  // Whole amounts without ".00" — for thresholds like "free over £49"
  function whole(amount, currency) {
    const n = Number(amount) || 0;
    if (!Number.isInteger(n)) return format(n, currency);
    const m = market(); const cur = currency || m.currency;
    return new Intl.NumberFormat(cur === m.currency ? m.locale : "en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  }

  /** Catalogue price (GBP incl. UK VAT) → shelf price in the current market */
  const fromGBP = (gbp, m = market()) => round((Number(gbp) / (1 + baseVat())) * m.fx * (m.taxInclusive ? 1 + m.tax : 1));
  const fmtGBP = (gbp) => format(fromGBP(gbp));
  const canShip = (department, m = market()) => !department || m.perishables || !perishable().has(department);

  // Discount codes come from the database (Admin → Discounts). These are only used when the server is offline.
  const DEFAULT_PROMOS = [
    { code: "WELCOME10", description: "10% off for new customers", type: "percent", value: 10, minSubtotal: 0 },
    { code: "SAVE15", description: "15% off orders of £60 or more", type: "percent", value: 15, minSubtotal: 60 },
    { code: "SAVE5", description: "£5 off any order", type: "flat", value: 5, minSubtotal: 0 },
    { code: "FREESHIP", description: "Free delivery", type: "freeship", value: 0, minSubtotal: 0 }
  ];
  let promos = DEFAULT_PROMOS;

  /** "10% off", "£5 off", "Free delivery" (+ minimum spend) in the shopper's currency */
  function promoLabel(p, m = market()) {
    const what = p.type === "percent" ? `${p.value}% off` : p.type === "flat" ? `${whole(fromGBP(p.value, m))} off` : "free delivery";
    return p.minSubtotal ? `${what} orders of ${whole(fromGBP(p.minSubtotal, m))}+` : what;
  }

  /** Same maths as server/utils/pricing.js. items: [{ price (GBP), qty }], promo: { code, type, value, minSubtotal } */
  function totals(items, promo, m = market()) {
    const subtotal = round(items.reduce((s, it) => s + fromGBP(it.price, m) * (Number(it.qty) || 0), 0));
    if (promo && !promo.type) promo = null;
    const minSpend = promo?.minSubtotal ? fromGBP(promo.minSubtotal, m) : 0;
    const qualifies = Boolean(promo) && subtotal >= minSpend;
    let discount = 0;
    if (qualifies && promo.type === "percent") discount = round(subtotal * (promo.value / 100));
    if (qualifies && promo.type === "flat") discount = Math.min(subtotal, fromGBP(promo.value, m));
    const net = round(subtotal - discount);
    let shipping = items.length ? (net >= m.freeThreshold ? 0 : m.fee) : 0;
    if (qualifies && promo.type === "freeship") shipping = 0;
    const tax = m.taxInclusive ? 0 : round(net * m.tax);
    const total = round(net + shipping + tax);
    const taxIncluded = m.taxInclusive ? round(total - total / (1 + m.tax)) : 0;
    return { currency: m.currency, subtotal, discount, shipping, tax, taxIncluded, total, promo, qualifies, minSpend, toFree: Math.max(0, round(m.freeThreshold - net)) };
  }

  const deliveryDate = (m = market()) => {
    const d = new Date(); let added = 0;
    while (added < m.deliveryDays[1]) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  /* ---------- Paint every price on the page in the current market ---------- */
  function paint() {
    const m = market();
    document.documentElement.dataset.market = m.code;
    document.querySelectorAll("[data-id][data-name][data-price]").forEach((card) => {
      const gbp = Number(card.dataset.gbp || card.dataset.price);
      card.dataset.gbp = String(gbp);
      const priceEl = card.querySelector(".price");
      if (priceEl) {
        if (priceEl.dataset.unit === undefined) {
          const t = priceEl.textContent;
          priceEl.dataset.unit = t.includes("/") ? t.slice(t.indexOf("/")) : "";
        }
        priceEl.textContent = fmtGBP(gbp) + (priceEl.dataset.unit ? ` ${priceEl.dataset.unit}` : "");
      }
      const wasEl = card.querySelector(".was");
      if (wasEl) {
        if (!wasEl.dataset.gbp) wasEl.dataset.gbp = String(parseFloat(wasEl.textContent.replace(/[^\d.]/g, "")) || 0);
        wasEl.textContent = fmtGBP(Number(wasEl.dataset.gbp));
      }
      // Fresh food is UK-only
      const ok = canShip(card.dataset.dept, m);
      card.classList.toggle("not-shippable", !ok);
      const btn = card.querySelector(".add-to-cart");
      if (btn && !card.classList.contains("sold-out")) {
        btn.disabled = !ok;
        btn.textContent = ok ? "Add to Cart" : "UK delivery only";
      }
    });
    // Code hints list the live discount codes, in the local currency
    const list = promos.slice(0, 3).map((p) => `<strong>${p.code}</strong> (${promoLabel(p, m)})`).join(", ");
    document.querySelectorAll("#promo-hint, .form-hint.promo-codes").forEach((el) => { el.innerHTML = promos.length ? `Codes: ${list}` : ""; });
    document.querySelectorAll(".form-hint").forEach((el) => {
      if (/FREESHIP/.test(el.textContent) && /SAVE5/.test(el.textContent)) { el.classList.add("promo-codes"); el.innerHTML = promos.length ? `Codes: ${list}` : ""; }
    });
    // Top strip message follows the market
    const strip = document.getElementById("topstrip-msg");
    if (strip) strip.innerHTML = m.code === "GB"
      ? `Free delivery on orders over ${whole(m.freeThreshold)}${promos[0] ? ` · Use code <strong>${promos[0].code}</strong> for ${promoLabel(promos[0], m)}` : ""}`
      : `Delivering to ${m.name} in ${m.delivery.toLowerCase()} · Free delivery over ${whole(m.freeThreshold)} · Prices in ${m.currency}${m.taxInclusive ? ` incl. ${m.taxName}` : `, ${m.taxName.toLowerCase()} added at checkout`}`;
  }

  async function load() {
    try {
      const r = await fetch("markets.json", { cache: "no-cache" });
      if (r.ok) DOC = await r.json();
    } catch {}
    try {
      const r = await fetch("/api/promos/public", { cache: "no-cache" });
      if (r.ok) promos = await r.json();
    } catch {}
    paint();
    document.dispatchEvent(new CustomEvent("market:changed", { detail: market() }));
  }

  window.addEventListener("country:changed", () => {
    paint();
    document.dispatchEvent(new CustomEvent("market:changed", { detail: market() }));
  });
  window.addEventListener("storage", (e) => { if (e.key === KEY) { paint(); document.dispatchEvent(new CustomEvent("market:changed", { detail: market() })); } });

  const ready = load();
  document.addEventListener("DOMContentLoaded", paint);

  window.VMarket = { ready, market, code, format, whole, fromGBP, fmtGBP, canShip, totals, promoLabel, promos: () => promos, defaultPromos: DEFAULT_PROMOS, deliveryDate, paint, perishable };
})();
