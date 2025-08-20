// thank-you.js — renders last order + print
document.addEventListener("DOMContentLoaded", () => {
  const brand = `${document.title.replace(/—.*/,'').trim() || 'V-STORE'} — ${location.host}`;
  document.documentElement.style.setProperty("--print-brand", `"${brand}"`);
});

(() => {
  const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const ORDER_KEYS = ["vstore_last_order"]; // sessionStorage first, fallback to localStorage

  function loadOrder() {
    for (const key of ORDER_KEYS) {
      try { const ss = sessionStorage.getItem(key); if (ss) return JSON.parse(ss); } catch {}
      try { const ls = localStorage.getItem(key);  if (ls) return JSON.parse(ls); } catch {}
    }
    return null;
  }

  const byId = (id) => document.getElementById(id);
  const currency = (n) => GBP.format(+n || 0);
  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
    } catch { return iso; }
  };

  function render() {
    const order = loadOrder();
    const year = byId("year"); if (year) year.textContent = new Date().getFullYear();

    if (!order) {
      const list = byId("order-items");
      if (list) {
        list.innerHTML = `<li class="card" style="padding:.8rem;">We couldn't find a recent order.
          <a class="btn-ghost" href="index.html" style="margin-left:.5rem;">Shop now →</a>
        </li>`;
      }
      return;
    }

    // Header
    byId("order-id").textContent   = order.id || "—";
    byId("order-date").textContent = fmtDate(order.date || order.createdAt);

    // Items
    const ul = byId("order-items");
    ul.innerHTML = "";
    (order.items || []).forEach(it => {
      const qty   = +it.qty || 1;
      const price = +it.price || 0;
      const line  = qty * price;
      const li = document.createElement("li");
      li.className = "card";
      li.innerHTML = `
        <div style="display:grid;grid-template-columns:80px 1fr auto;gap:.7rem;align-items:center;">
          <div class="media" style="aspect-ratio:1/1;"><img src="${it.img || 'https://via.placeholder.com/160?text=Item'}" alt=""></div>
          <div>
            <strong>${it.name || "Item"}</strong>
            <div class="muted">${currency(price)} × ${qty}</div>
          </div>
          <div style="font-weight:700">${currency(line)}</div>
        </div>`;
      ul.appendChild(li);
    });

    // Totals (supports both shapes)
    const totals = order.pricing || order.totals || { subtotal:0, discount:0, shipping:0, total:0 };
    byId("sum-subtotal").textContent = currency(totals.subtotal);
    byId("sum-discount").textContent = totals.discount ? `– ${currency(totals.discount)}` : "– £0.00";
    byId("sum-shipping").textContent = totals.shipping === 0 ? "Free" : currency(totals.shipping);
    byId("sum-total").textContent    = currency(totals.total);
    const freeNote = byId("free-ship-note");
    if (freeNote) freeNote.textContent = totals.shipping === 0 ? "🎉 Free shipping applied." : "";

    // Payment
    const p = order.payment || {};
    const pText =
      p.display ||
      (p.method === "card" || p.method === "credit-card"
        ? `${p.brand || "Card"} •••• ${p.last4 || ""}`.trim()
      : p.method === "paypal"
        ? "PayPal"
      : p.method === "upi"
        ? `UPI ${p.handle || ""}${p.platform ? " (" + p.platform + ")" : ""}`.trim()
      : (p.method || "—"));
    byId("payment-line").textContent = pText || "—";

    // Promo
    const promo = (order.promo && String(order.promo)) || "";
    byId("promo-line").textContent = promo ? `Promo applied: ${promo}` : "";

    // Shipping
    const c = order.customer || {};
    byId("ship-name").textContent = c.name || "—";
    const addrParts = [c.address, c.city, c.state, c.zip || c.postcode, c.country].filter(Boolean);
    byId("ship-address").textContent = addrParts.length ? addrParts.join(", ") : "—";
    const contactBits = [c.phone, c.email].filter(Boolean);
    byId("ship-contact").textContent = contactBits.length ? contactBits.join(" · ") : "—";
  }

  // Print
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "print-receipt") window.print();
  });

  document.addEventListener("DOMContentLoaded", render);
})();
