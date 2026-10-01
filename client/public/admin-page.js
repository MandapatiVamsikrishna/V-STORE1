// admin-page.js — store admin dashboard
(() => {
  const VS = window.VStore;
  const { esc, GBP } = VS;
  const $ = (id) => document.getElementById(id);
  const STATUSES = ["Processing", "Shipped", "Delivered", "Cancelled"];
  const cash = (n, cur) => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur || "GBP" }).format(Number(n) || 0);
  let products = [];
  let editing = null; // sku being edited, or null for new

  document.addEventListener("DOMContentLoaded", async () => {
    const main = document.querySelector("main");
    if (!(await VS.online)) {
      main.innerHTML = `<div class="empty"><h2>The admin area needs the V-STORE server</h2><p>Start it with <code>npm run dev</code>.</p></div>`;
      return;
    }
    if (!VS.auth.requireLogin("Sign in with an admin account.")) return;
    const user = await VS.auth.refresh();
    if (user?.role !== "admin") {
      main.innerHTML = `<div class="empty"><h2>Admins only</h2><p>You're signed in as ${esc(user?.email || "a customer")}, which doesn't have admin access.</p>
        <a class="btn-primary" href="index.html">Back to the shop</a></div>`;
      return;
    }
    initTabs();
    loadOverview();
  });

  /* ---------- Tabs ---------- */
  const loaders = { overview: loadOverview, products: loadProducts, discounts: loadPromos, orders: loadOrders, messages: loadMessages, users: loadUsers };
  function initTabs() {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const show = (name) => {
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
      document.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== name; });
      history.replaceState(null, "", `#${name}`);
      loaders[name]();
    };
    tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
    document.querySelector('[role="tablist"]').addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const i = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); show(next.dataset.tab);
    });
    const initial = location.hash.slice(1);
    if (loaders[initial] && initial !== "overview") show(initial);
  }

  const statusPill = (s) => `<span class="status ${esc(s)}">${esc(s)}</span>`;
  const fail = (err) => VS.toast(err.message, 4000);

  /* ---------- Overview ---------- */
  async function loadOverview() {
    try {
      const s = await VS.api.get("/admin/stats");
      const b = s.byStatus || {};
      $("kpis").innerHTML = [
        [GBP.format(s.revenue), "Revenue in GBP (excl. cancelled)"],
        [s.orders, "Orders"],
        [b.Processing || 0, "Waiting to ship"],
        [s.users, "Customers"],
        [s.products, "Products"],
        [s.newMessages, "New messages"]
      ].map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
      $("recent-orders").innerHTML = s.recent.length
        ? `<table class="data"><tbody>${s.recent.map((o) => `<tr><td>${esc(o.orderNumber)}</td><td>${esc(o.user?.name || "")}</td>
            <td class="num">${cash(o.total, o.currency)}</td><td>${statusPill(o.status)}</td></tr>`).join("")}</tbody></table>`
        : `<p class="muted">No orders yet.</p>`;
      $("low-stock").innerHTML = s.lowStock.length
        ? `<table class="data"><tbody>${s.lowStock.map((p) => `<tr><td>${esc(p.name)}</td><td class="muted">${esc(p.sku)}</td>
            <td class="num">${p.countInStock}</td></tr>`).join("")}</tbody></table>`
        : `<p class="muted">Everything is well stocked.</p>`;
    } catch (err) { fail(err); }
  }

  /* ---------- Products ---------- */
  async function loadProducts() {
    try {
      products = (await VS.api.get("/products?all=true&limit=200&sort=name-asc")).products;
      const depts = [...new Set(products.map((p) => p.department).filter(Boolean))].sort();
      const sel = $("prod-dept"), keep = sel.value;
      sel.innerHTML = `<option value="">All departments</option>` + depts.map((d) => `<option>${esc(d)}</option>`).join("");
      sel.value = keep;
      $("dept-list").innerHTML = depts.map((d) => `<option value="${esc(d)}">`).join("");
      renderProducts();
    } catch (err) { fail(err); }
  }

  function renderProducts() {
    const q = $("prod-search").value.trim().toLowerCase();
    const d = $("prod-dept").value;
    const rows = products.filter((p) => (!d || p.department === d) && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
    $("prod-body").innerHTML = rows.map((p) => `
      <tr>
        <td><img src="${esc(p.image)}" alt="" loading="lazy"></td>
        <td><a href="product.html?id=${encodeURIComponent(p.sku)}">${esc(p.name)}</a></td>
        <td class="muted">${esc(p.sku)}</td>
        <td>${esc(p.department)}</td>
        <td class="num">${p.compareAtPrice > p.price ? `<s class="was">${GBP.format(p.compareAtPrice)}</s> ` : ""}${GBP.format(p.price)}</td>
        <td class="num"><input type="number" min="0" value="${p.countInStock}" data-stock="${esc(p.sku)}" aria-label="Stock for ${esc(p.name)}" style="width:5.5em;padding:.3rem .4rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)"></td>
        <td>${p.isActive === false ? '<span class="status Cancelled">Hidden</span>' : '<span class="status Delivered">Visible</span>'}</td>
        <td style="white-space:nowrap"><button class="btn-ghost btn-sm" data-edit="${esc(p.sku)}">Edit</button>
          <button class="btn-danger btn-sm" data-delete="${esc(p.sku)}">Delete</button></td>
      </tr>`).join("") || `<tr><td colspan="8" class="muted">No products match.</td></tr>`;
    $("prod-count").textContent = `${rows.length} of ${products.length} products`;
  }

  $("prod-search").addEventListener("input", renderProducts);
  $("prod-dept").addEventListener("change", renderProducts);

  $("prod-body").addEventListener("change", async (e) => {
    const input = e.target.closest("[data-stock]");
    if (!input) return;
    const n = parseInt(input.value, 10);
    if (!(n >= 0)) { VS.toast("Stock must be 0 or more"); return; }
    try {
      await VS.api.put(`/products/${encodeURIComponent(input.dataset.stock)}`, { countInStock: n });
      const p = products.find((x) => x.sku === input.dataset.stock); if (p) p.countInStock = n;
      VS.toast("Stock updated");
    } catch (err) { fail(err); }
  });

  $("prod-body").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-delete]");
    if (edit) openProductForm(products.find((p) => p.sku === edit.dataset.edit));
    if (del) {
      const p = products.find((x) => x.sku === del.dataset.delete);
      if (!confirm(`Delete “${p.name}”? This can't be undone. To just hide it, edit it and set Visible to No.`)) return;
      try { await VS.api.del(`/products/${encodeURIComponent(p.sku)}`); VS.toast("Product deleted"); loadProducts(); }
      catch (err) { fail(err); }
    }
  });

  const FIELDS = ["name", "sku", "department", "category", "page", "price", "compareAtPrice", "priceLabel", "countInStock", "isActive", "image", "description"];
  const dialog = $("prod-dialog");

  function openProductForm(p) {
    editing = p ? p.sku : null;
    $("prod-dialog-title").textContent = p ? `Edit ${p.name}` : "Add product";
    $("prod-save").textContent = p ? "Save changes" : "Add product";
    $("prod-msg").textContent = "";
    FIELDS.forEach((f) => { $(`f-${f}`).value = p ? String(p[f] ?? "") : ""; });
    if (!p) { $("f-countInStock").value = "100"; $("f-isActive").value = "true"; }
    dialog.showModal();
    $("f-name").focus();
  }
  $("prod-new").addEventListener("click", () => openProductForm(null));
  $("prod-close").addEventListener("click", () => dialog.close());
  $("prod-cancel").addEventListener("click", () => dialog.close());

  $("prod-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("prod-msg");
    const data = Object.fromEntries(FIELDS.map((f) => [f, $(`f-${f}`).value.trim()]));
    data.compareAtPrice = data.compareAtPrice === "" ? null : Number(data.compareAtPrice);
    if (data.compareAtPrice !== null && !(data.compareAtPrice > data.price)) { msg.textContent = "The was price must be higher than the price (or leave it empty)."; msg.className = "form-msg error"; return; }
    data.price = Number(data.price); data.countInStock = parseInt(data.countInStock, 10); data.isActive = data.isActive === "true";
    if (!data.name || !data.sku || !data.department) { msg.textContent = "Name, SKU and department are required."; msg.className = "form-msg error"; return; }
    if (!(data.price >= 0) || !(data.countInStock >= 0)) { msg.textContent = "Price and stock must be 0 or more."; msg.className = "form-msg error"; return; }
    try {
      if (editing) await VS.api.put(`/products/${encodeURIComponent(editing)}`, data);
      else await VS.api.post("/products", data);
      dialog.close();
      VS.toast(editing ? "Product saved" : "Product added");
      loadProducts();
    } catch (err) { msg.textContent = err.message; msg.className = "form-msg error"; }
  });

  /* ---------- Discount codes ---------- */
  let promoList = [];
  let editingPromo = null;
  const promoDialog = $("promo-dialog");
  const promoWhat = (p) => p.type === "percent" ? `${p.value}% off` : p.type === "flat" ? `${GBP.format(p.value)} off` : "Free delivery";
  function promoStatus(p) {
    if (!p.active) return '<span class="status Cancelled">Paused</span>';
    if (p.expiresAt && new Date(p.expiresAt) < new Date()) return '<span class="status Cancelled">Expired</span>';
    if (p.maxUses && p.uses >= p.maxUses) return '<span class="status Cancelled">Used up</span>';
    return '<span class="status Delivered">Active</span>';
  }
  async function loadPromos() {
    try {
      promoList = await VS.api.get("/promos");
      $("promo-body").innerHTML = promoList.map((p) => `
        <tr>
          <td><strong>${esc(p.code)}</strong>${p.description ? `<br><span class="muted small">${esc(p.description)}</span>` : ""}</td>
          <td>${promoWhat(p)}</td>
          <td>${p.minSubtotal ? GBP.format(p.minSubtotal) : "—"}</td>
          <td class="num">${p.uses}${p.maxUses ? ` / ${p.maxUses}` : ""}</td>
          <td>${p.expiresAt ? VS.fmtDate(p.expiresAt) : "Never"}</td>
          <td>${promoStatus(p)}</td>
          <td>${p.showOnSite ? "Yes" : "Hidden"}</td>
          <td style="white-space:nowrap"><button class="btn-ghost btn-sm" data-promo-toggle="${p._id}">${p.active ? "Pause" : "Activate"}</button>
            <button class="btn-ghost btn-sm" data-promo-edit="${p._id}">Edit</button>
            <button class="btn-danger btn-sm" data-promo-delete="${p._id}">Delete</button></td>
        </tr>`).join("") || `<tr><td colspan="8" class="muted">No discount codes yet. Create one with “New discount code”.</td></tr>`;
    } catch (err) { fail(err); }
  }
  function syncValueField() {
    const t = $("d-type").value;
    $("d-value-wrap").hidden = t === "freeship";
    $("d-value-label").textContent = t === "percent" ? "Percent off (1–90)" : "Amount off (£)";
  }
  function openPromo(p) {
    editingPromo = p ? p._id : null;
    $("promo-dialog-title").textContent = p ? `Edit ${p.code}` : "New discount code";
    $("d-code").value = p?.code || ""; $("d-type").value = p?.type || "percent"; $("d-value").value = p?.value ?? "";
    $("d-min").value = p?.minSubtotal || ""; $("d-max").value = p?.maxUses ?? 0;
    $("d-expires").value = p?.expiresAt ? String(p.expiresAt).slice(0, 10) : "";
    $("d-desc").value = p?.description || ""; $("d-active").checked = p ? p.active : true; $("d-show").checked = p ? p.showOnSite : true;
    $("promo-msg").textContent = ""; syncValueField();
    promoDialog.showModal(); $("d-code").focus();
  }
  $("d-type").addEventListener("change", syncValueField);
  $("promo-new").addEventListener("click", () => openPromo(null));
  $("promo-close").addEventListener("click", () => promoDialog.close());
  $("promo-cancel").addEventListener("click", () => promoDialog.close());
  $("promo-body").addEventListener("click", async (e) => {
    const find = (id) => promoList.find((p) => p._id === id);
    const tog = e.target.closest("[data-promo-toggle]"), ed = e.target.closest("[data-promo-edit]"), del = e.target.closest("[data-promo-delete]");
    try {
      if (tog) { const p = find(tog.dataset.promoToggle); await VS.api.put(`/promos/${p._id}`, { active: !p.active }); VS.toast(p.active ? `${p.code} paused` : `${p.code} active`); loadPromos(); }
      if (ed) openPromo(find(ed.dataset.promoEdit));
      if (del) { const p = find(del.dataset.promoDelete); if (!confirm(`Delete code ${p.code}? Shoppers won't be able to use it.`)) return; await VS.api.del(`/promos/${p._id}`); VS.toast(`${p.code} deleted`); loadPromos(); }
    } catch (err) { fail(err); }
  });
  $("promo-form-admin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("promo-msg");
    const data = {
      code: $("d-code").value.trim().toUpperCase(), type: $("d-type").value, description: $("d-desc").value.trim(),
      value: $("d-type").value === "freeship" ? 0 : Number($("d-value").value), minSubtotal: Number($("d-min").value || 0),
      maxUses: parseInt($("d-max").value || "0", 10), expiresAt: $("d-expires").value ? new Date($("d-expires").value + "T23:59:59").toISOString() : null,
      active: $("d-active").checked, showOnSite: $("d-show").checked
    };
    if (!/^[A-Z0-9_-]{3,20}$/.test(data.code)) { msg.textContent = "Codes use 3–20 letters, numbers, - or _"; msg.className = "form-msg error"; return; }
    if (data.type === "percent" && !(data.value >= 1 && data.value <= 90)) { msg.textContent = "Percent off must be between 1 and 90."; msg.className = "form-msg error"; return; }
    if (data.type === "flat" && !(data.value > 0)) { msg.textContent = "Enter the amount to take off."; msg.className = "form-msg error"; return; }
    try {
      if (editingPromo) await VS.api.put(`/promos/${editingPromo}`, data);
      else await VS.api.post("/promos", data);
      promoDialog.close(); VS.toast(editingPromo ? "Code saved" : `Code ${data.code} created`); loadPromos();
    } catch (err) { msg.textContent = err.message; msg.className = "form-msg error"; }
  });

  /* ---------- Orders ---------- */
  async function loadOrders() {
    try {
      const f = $("order-filter").value;
      const orders = await VS.api.get(`/orders${f ? `?status=${encodeURIComponent(f)}` : ""}`);
      $("order-body").innerHTML = orders.map((o) => `
        <tr>
          <td><strong>${esc(o.orderNumber)}</strong></td>
          <td>${VS.fmtDate(o.createdAt)}</td>
          <td>${esc(o.user?.name || o.shippingAddress?.name || "")}<br><span class="muted">${esc(o.user?.email || "")}</span></td>
          <td>${o.items.map((i) => `${esc(i.name)} ×${i.qty}`).join(", ")}</td>
          <td class="num">${cash(o.total, o.currency)}${o.currency && o.currency !== "GBP" ? `<br><span class="muted small">${esc(o.market || "")}</span>` : ""}</td>
          <td>${o.isPaid ? "Yes" : `No <span class="muted">(${esc(o.payment?.method || "")})</span>`}</td>
          <td>${o.status === "Cancelled" ? statusPill(o.status)
            : `<select data-order="${o._id}" aria-label="Status for ${esc(o.orderNumber)}">${STATUSES.map((s) => `<option${s === o.status ? " selected" : ""}>${s}</option>`).join("")}</select>`}</td>
        </tr>`).join("") || `<tr><td colspan="7" class="muted">No orders${f ? ` with status ${esc(f)}` : " yet"}.</td></tr>`;
    } catch (err) { fail(err); }
  }
  $("order-filter").addEventListener("change", loadOrders);
  $("order-body").addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-order]");
    if (!sel) return;
    if (sel.value === "Cancelled" && !confirm("Cancel this order? Items go back into stock.")) { loadOrders(); return; }
    try { await VS.api.put(`/orders/${sel.dataset.order}/status`, { status: sel.value }); VS.toast(`Order marked ${sel.value}`); loadOrders(); }
    catch (err) { fail(err); loadOrders(); }
  });

  /* ---------- Messages ---------- */
  async function loadMessages() {
    try {
      const msgs = await VS.api.get("/contact");
      $("msg-body").innerHTML = msgs.map((m) => `
        <tr>
          <td>${VS.fmtDate(m.createdAt)}</td>
          <td>${esc(m.name)}<br><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td>
          <td>${esc(m.subject)}</td>
          <td style="max-width:40ch;white-space:pre-wrap">${esc(m.message)}</td>
          <td><select data-msg="${m._id}" aria-label="Message status">${["new", "read", "resolved"].map((s) => `<option${s === m.status ? " selected" : ""}>${s}</option>`).join("")}</select></td>
        </tr>`).join("") || `<tr><td colspan="5" class="muted">No messages yet.</td></tr>`;
    } catch (err) { fail(err); }
  }
  $("msg-body").addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-msg]");
    if (!sel) return;
    try { await VS.api.put(`/contact/${sel.dataset.msg}`, { status: sel.value }); VS.toast("Message updated"); }
    catch (err) { fail(err); }
  });

  /* ---------- Customers ---------- */
  async function loadUsers() {
    try {
      const users = await VS.api.get("/admin/users");
      const me = VS.auth.user?.id;
      $("user-body").innerHTML = users.map((u) => `
        <tr>
          <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone || "—")}</td><td>${VS.fmtDate(u.createdAt)}</td>
          <td>${u._id === me ? `${esc(u.role)} <span class="muted">(you)</span>`
            : `<select data-user="${u._id}" aria-label="Role for ${esc(u.name)}"><option value="user"${u.role === "user" ? " selected" : ""}>Customer</option><option value="admin"${u.role === "admin" ? " selected" : ""}>Admin</option></select>`}</td>
        </tr>`).join("");
    } catch (err) { fail(err); }
  }
  $("user-body").addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-user]");
    if (!sel) return;
    try { await VS.api.put(`/admin/users/${sel.dataset.user}/role`, { role: sel.value }); VS.toast("Role updated"); }
    catch (err) { fail(err); loadUsers(); }
  });
})();
