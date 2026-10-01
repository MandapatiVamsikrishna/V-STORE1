// product-page.js — product.html?id=<sku>
(() => {
  const VS = window.VStore;
  const { esc, stars, GBP } = VS;
  const root = document.getElementById("pd-root") || document.querySelector("main");
  const reviewsRoot = document.getElementById("reviews-root");
  const sku = VS.qs("id");
  let current = null;

  document.addEventListener("DOMContentLoaded", load);

  async function load() {
    if (!sku) return notFound();
    const data = await VS.product(sku);
    if (!data) return notFound();
    current = data.product;
    render(current);
    if (window.VStoreShop) {
      window.VStoreShop.recent.add(current.sku);
      const sec = document.getElementById("recent-section");
      if (sec) sec.dataset.exclude = current.sku;
      window.VStoreShop.renderRecent();
    }
    renderReviews(current);
    document.getElementById("related").innerHTML = (data.related || []).map(VS.productCard).join("");
    reviewsRoot.hidden = false;
  }

  function notFound() {
    root.innerHTML = `<div class="empty"><h2>We couldn't find that product</h2>
      <p>It may have been removed or the link is wrong.</p><a class="btn-primary" href="categories.html">Browse categories</a></div>`;
  }

  function stockText(n) {
    if (n <= 0) return `<span class="stock-out">Out of stock</span>`;
    if (n <= 10) return `<span class="stock-low">Only ${n} left</span>`;
    return `<span class="stock-ok">In stock</span>`;
  }

  const shelf = (gbp) => (window.VMarket ? window.VMarket.fmtGBP(gbp) : GBP.format(gbp));
  const shelfNum = (gbp) => (window.VMarket ? window.VMarket.fromGBP(gbp) : gbp);
  document.addEventListener("market:changed", () => { if (current) render(current); });

  function render(p) {
    const mk = window.VMarket ? window.VMarket.market() : null;
    const ship = !window.VMarket || window.VMarket.canShip(p.department);
    document.title = `${p.name} — V-STORE`;
    const back = p.page ? `<a href="${esc(p.page)}">${esc(p.department)}</a>` : esc(p.department || "");
    const out = p.countInStock <= 0;
    root.innerHTML = `
      <p class="crumbs"><a href="index.html">Home</a> / ${back} / <span aria-current="page">${esc(p.name)}</span></p>
      <article class="pd product-item no-link" data-id="${esc(p.sku)}" data-name="${esc(p.name)}" data-price="${p.price}" data-dept="${esc(p.department || "")}">
        <div class="pd-media"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
        <div class="pd-info">
          <h1>${esc(p.name)}</h1>
          ${p.page ? `<a class="more-from" href="${esc(p.page)}">More from ${esc(p.department)} →</a>` : ""}
          <div><span class="stars" aria-hidden="true">${stars(p.rating)}</span>
            <a href="#reviews-root" class="muted">${p.numReviews ? `${p.rating} · ${p.numReviews} review${p.numReviews > 1 ? "s" : ""}` : `${p.rating || "Not"} rated · no reviews yet`}</a></div>
          ${VS.onSale(p) ? `<div class="pd-sale"><span class="sale-badge static">−${VS.pctOff(p)}%</span> Was <s>${shelf(p.compareAtPrice)}</s>, you save ${window.VMarket ? window.VMarket.format(shelfNum(p.compareAtPrice) - shelfNum(p.price)) : GBP.format(p.compareAtPrice - p.price)}</div>` : ""}
          <div class="pd-price">${shelf(p.price)}${p.priceLabel && p.priceLabel.includes("/") ? `<small>${esc(p.priceLabel.split("/").slice(1).join("/").trim() ? "per " + p.priceLabel.split("/").slice(1).join("/").trim() : "")}</small>` : ""}</div>
          <div>${stockText(p.countInStock)}</div>
          ${p.description ? `<p>${esc(p.description)}</p>` : ""}
          <div class="actions">
            <div class="qty"><button class="dec" aria-label="Decrease" disabled>−</button><span class="q">1</span><button class="inc" aria-label="Increase">+</button></div>
            <button class="add-to-cart"${out || !ship ? " disabled" : ""}>${out ? "Out of stock" : ship ? "Add to Cart" : "UK delivery only"}</button>
            <button class="wish${VS.wishlist.has(p.sku) ? " active" : ""}" style="position:static" aria-label="Save to wishlist">${VS.wishlist.has(p.sku) ? "♥" : "♡"}</button>
          </div>
          ${ship ? "" : `<div class="notice warn">Fresh food is delivered within the UK only, so this can't be sent to ${esc(mk.name)}. Change “Deliver to” at the top of the page to United Kingdom to buy it.</div>`}
          <ul class="pd-delivery">
            ${!mk || mk.slots
              ? `<li><strong>Choose a delivery slot at checkout.</strong> Delivery is ${window.VMarket ? window.VMarket.format(mk.fee) : "£1.99"}, or free on orders over ${window.VMarket ? window.VMarket.format(mk.freeThreshold) : "£49"}.</li>`
              : `<li><strong>Delivers to ${esc(mk.name)} in ${esc(mk.delivery)}</strong> (by about ${window.VMarket.deliveryDate()}). Delivery is ${window.VMarket.format(mk.fee)}, or free over ${window.VMarket.format(mk.freeThreshold)}.</li>`}
            <li><strong>Change your mind?</strong> Cancel any time while your order is still processing.</li>
            <li><strong>Pay with:</strong> ${mk ? mk.payments.map((k) => ({ card: "card", paypal: "PayPal", upi: "UPI", cod: "cash on delivery" }[k])).join(", ") : "card, PayPal or cash on delivery"}. <a href="shipping.html">Delivery details</a></li>
          </ul>
        </div>
      </article>`;
  }

  function renderReviews(p) {
    const list = document.getElementById("reviews-list");
    document.getElementById("reviews-title").textContent = p.numReviews ? `Reviews (${p.numReviews})` : "Reviews";
    const me = VS.auth.user?.id;
    list.innerHTML = (p.reviews || []).length
      ? [...p.reviews].reverse().map((r) => `
        <div class="review">
          <header><strong>${esc(r.name || "Customer")}</strong><span class="muted">${VS.fmtDate(r.createdAt)}</span></header>
          <div class="stars" aria-label="${r.rating} out of 5">${stars(r.rating)}</div>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}
          ${(me && String(r.user) === String(me)) || VS.auth.isAdmin() ? `<button class="btn-danger btn-sm" data-del-review="${r._id}">Delete</button>` : ""}
        </div>`).join("")
      : `<p class="muted">No reviews yet — be the first to share what you think.</p>`;

    // Pre-fill the form with my existing review
    const mine = (p.reviews || []).find((r) => me && String(r.user) === String(me));
    if (mine) {
      const radio = document.getElementById(`r${mine.rating}`); if (radio) radio.checked = true;
      document.getElementById("review-comment").value = mine.comment || "";
      document.querySelector("#review-form [type=submit]").textContent = "Update review";
    }
  }

  document.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del-review]");
    if (!del) return;
    if (!confirm("Delete this review?")) return;
    try {
      await VS.api.del(`/products/${encodeURIComponent(sku)}/reviews/${del.dataset.delReview}`);
      VS.toast("Review deleted");
      load();
    } catch (err) { VS.toast(err.message); }
  });

  document.getElementById("review-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("review-msg");
    msg.className = "form-msg";
    const rating = document.querySelector('input[name="rating"]:checked')?.value;
    if (!rating) { msg.textContent = "Choose a star rating first."; msg.classList.add("error"); return; }
    if (!(await VS.online)) { msg.textContent = "Reviews need the V-STORE server running."; msg.classList.add("error"); return; }
    if (!VS.auth.requireLogin("Sign in to write a review.")) return;
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      const r = await VS.api.post(`/products/${encodeURIComponent(sku)}/reviews`, { rating: Number(rating), comment: document.getElementById("review-comment").value.trim() });
      msg.textContent = r.message === "Review updated" ? "Your review has been updated." : "Thanks — your review is live.";
      msg.classList.add("success");
      load();
    } catch (err) { msg.textContent = err.message; msg.classList.add("error"); }
    finally { if (btn) btn.disabled = false; }
  });
})();
