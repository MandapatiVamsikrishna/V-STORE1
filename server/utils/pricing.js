// Country-aware pricing — the server is the source of truth.
// Rules live in client/public/markets.json (the browser reads the same file, so
// the prices a shopper sees are exactly the prices they are charged).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DOC = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "..", "client", "public", "markets.json"), "utf8"));
export const MARKETS = DOC.markets;
export const BASE_VAT = DOC.base.vat;
export const PERISHABLE = new Set(DOC.perishableDepartments);

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const getMarket = (code) => {
  const c = String(code || "GB").toUpperCase();
  return MARKETS[c] ? { code: c, ...MARKETS[c] } : null;
};

/** Catalogue price (GBP incl. UK VAT) → shelf price in a market */
export const unitPrice = (gbp, m) =>
  round((Number(gbp) / (1 + BASE_VAT)) * m.fx * (m.taxInclusive ? 1 + m.tax : 1));

export const canShip = (department, m) => m.perishables || !PERISHABLE.has(department);

export const validPostcode = (postcode, m) => new RegExp(m.postcode.pattern).test(String(postcode || "").trim());

/**
 * items: [{ price (GBP), qty }]
 * promo: a Promo document/object { code, type, value, minSubtotal } or null.
 * Flat amounts and minimum spends are UK amounts (GBP) converted like prices.
 */
export function computeTotals(items, promo, m) {
  const subtotal = round(items.reduce((s, it) => s + unitPrice(it.price, m) * it.qty, 0));
  const minSpend = promo?.minSubtotal ? unitPrice(promo.minSubtotal, m) : 0;
  const qualifies = Boolean(promo) && subtotal >= minSpend;
  let discount = 0;
  if (qualifies && promo.type === "percent") discount = round(subtotal * (promo.value / 100));
  if (qualifies && promo.type === "flat") discount = Math.min(subtotal, unitPrice(promo.value, m));
  const net = round(subtotal - discount);
  let shipping = items.length ? (net >= m.freeThreshold ? 0 : m.fee) : 0;
  if (qualifies && promo.type === "freeship") shipping = 0;
  const tax = m.taxInclusive ? 0 : round(net * m.tax);                       // added on top (US/CA)
  const total = round(net + shipping + tax);
  const taxIncluded = m.taxInclusive ? round(total - total / (1 + m.tax)) : 0; // shown for info
  return { currency: m.currency, subtotal, discount, shipping, tax, taxIncluded, total,
    promoCode: qualifies ? promo.code : null, promoMinSpend: promo && !qualifies ? minSpend : 0 };
}
