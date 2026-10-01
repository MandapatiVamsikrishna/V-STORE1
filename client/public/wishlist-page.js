// wishlist-page.js
(() => {
  const VS = window.VStore;
  const grid = document.getElementById("wish-grid");
  const empty = document.getElementById("wish-empty");
  const summary = document.getElementById("wish-summary");
  const addAll = document.getElementById("wish-add-all");
  const clear = document.getElementById("wish-clear");
  let items = [];

  async function render() {
    const skus = VS.wishlist.all();
    const all = await VS.catalog();
    items = skus.map((s) => all.find((p) => p.sku === s)).filter(Boolean);
    grid.innerHTML = items.map(VS.productCard).join("");
    empty.hidden = items.length > 0;
    addAll.hidden = clear.hidden = !items.length;
    summary.textContent = items.length ? `${items.length} saved item${items.length > 1 ? "s" : ""}` : "";
  }

  addAll.addEventListener("click", () => {
    let n = 0;
    items.filter((p) => p.countInStock > 0).forEach((p) => { window.cart.add({ id: p.sku, name: p.name, price: p.price, qty: 1, img: p.image }); n++; });
    VS.toast(`Added ${n} item${n === 1 ? "" : "s"} to your cart 🛒`);
  });
  clear.addEventListener("click", () => {
    if (confirm("Remove everything from your wishlist?")) VS.wishlist.write([]);
  });

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("wishlist:updated", render);
})();
