// search-page.js — search.html?q=… searches the whole catalogue
(() => {
  const VS = window.VStore;
  const $ = (id) => document.getElementById(id);
  const q = (VS.qs("q") || "").trim();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);

  function score(p) {
    if (!words.length) return 1;
    const name = p.name.toLowerCase();
    const hay = `${name} ${p.department} ${p.category} ${p.description || ""}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return 0;
    return words.reduce((s, w) => s + (name.startsWith(w) ? 5 : 0) + (name.includes(w) ? 3 : 1), 0);
  }

  async function render() {
    const all = await VS.catalog();
    let hits = all.map((p) => ({ p, s: score(p) })).filter((x) => x.s > 0);
    const sort = $("search-sort").value;
    const cmp = {
      relevance: (a, b) => b.s - a.s || (b.p.rating || 0) - (a.p.rating || 0),
      "price-asc": (a, b) => a.p.price - b.p.price,
      "price-desc": (a, b) => b.p.price - a.p.price,
      "rating-desc": (a, b) => (b.p.rating || 0) - (a.p.rating || 0),
      "name-asc": (a, b) => a.p.name.localeCompare(b.p.name)
    }[sort];
    hits.sort(cmp);
    $("search-title").textContent = q ? `Results for “${q}”` : "All products";
    $("search-count").textContent = `${hits.length} product${hits.length === 1 ? "" : "s"}`;
    $("search-grid").innerHTML = hits.map((h) => VS.productCard(h.p)).join("");
    $("search-empty").hidden = hits.length > 0;
    document.title = q ? `${q} — Search — V-STORE` : "All products — V-STORE";
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("search-sort").addEventListener("change", render);
    const input = $("site-q"); if (input && q) input.value = q;
    render();
  });
})();
