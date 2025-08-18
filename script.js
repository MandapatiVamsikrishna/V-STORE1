
/* =========================================================
   V-STORE script.js — clean final
   - Cart with qty (localStorage)
   - Wishlist (localStorage)
   - Search / Filter / Sort
   - Theme (html.dark)
   - Toast + basic newsletter
   - Works on index & categories safely
   ========================================================= */

/* ---------- Currency ---------- */
const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GBP' });

/* ---------- Dynamic year ---------- */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- Mobile nav toggle ---------- */
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.getElementById('nav-menu');
if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const open = navMenu.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
}

/* ---------- Toast helper ---------- */
function toast(msg){
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>{ t.hidden = true; }, 1800);
}

/* ---------- Storage keys ---------- */
const CART_KEY  = 'vstore_cart';
const WL_KEY    = 'vstore_wishlist';
const THEME_KEY = 'vstore_theme';

/* ---------- Cart (qty-based) ---------- */
function readCart(){ return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
function writeCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); updateCartCount(); }
function updateCartCount(){
  const el = document.getElementById('cart-count');
  if (!el) return;
  const total = readCart().reduce((s,i)=> s + (i.qty||0), 0);
  el.textContent = String(total);
}
function addToCart({id, name, price}, qty = 1){
  if (!id) return;
  const cart = readCart();
  const i = cart.findIndex(it => it.id === id);
  if (i >= 0) cart[i].qty += qty;
  else cart.push({ id, name, price, qty });
  writeCart(cart);
  toast(`${name || 'Item'} added to cart`);
}
updateCartCount();

/* ---------- Wishlist ---------- */
function readWL(){ return new Set(JSON.parse(localStorage.getItem(WL_KEY) || '[]')); }
function writeWL(s){ localStorage.setItem(WL_KEY, JSON.stringify([...s])); }

/* ---------- Bind product card actions ---------- */
function bindCartButtons(scope = document){
  scope.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.currentTarget.closest('.product-item,[data-id][data-name][data-price]');
      if (!card) return;
      const id = card.dataset.id;
      const name = card.dataset.name;
      const price = Number(card.dataset.price || 0);
      if (!id || !name || Number.isNaN(price)) return;

      // If card has quantity controls, use that value; else default 1
      const qc = card.querySelector('.quantity-controls');
      let qty = 1;
      if (qc) {
        const qEl = qc.querySelector('.quantity');
        const n = Number(qEl?.textContent?.trim() || '1');
        qty = Number.isFinite(n) && n > 0 ? n : 1;
      }
      addToCart({ id, name, price }, qty);
    });
  });

  // Optional: hook +/- buttons on categories page
  scope.querySelectorAll('.quantity-controls').forEach(qc => {
    const qEl = qc.querySelector('.quantity');
    const dec = qc.querySelector('.decrement');
    const inc = qc.querySelector('.increment');
    if (!qEl) return;
    let qty = Number(qEl.textContent.trim() || '1');
    const set = (v)=>{ qty = Math.max(1, v); qEl.textContent = qty; };
    dec?.addEventListener('click', ()=> set(qty - 1));
    inc?.addEventListener('click', ()=> set(qty + 1));
  });
}

function bindWishlist(scope = document){
  const wl = readWL();
  scope.querySelectorAll('.product-item').forEach(card => {
    const id = card.dataset.id; const btn = card.querySelector('.wishlist');
    if (!id || !btn) return;
    if (wl.has(id)) btn.classList.add('active');
    btn.addEventListener('click', ()=>{
      const set = readWL();
      if (set.has(id)) { set.delete(id); btn.classList.remove('active'); toast('Removed from wishlist'); }
      else { set.add(id); btn.classList.add('active'); toast(`${card.dataset.name} saved ♥`); }
      writeWL(set);
    });
  });
}

/* ---------- Search + filter + sort ---------- */
const searchInput = document.getElementById('search-input');
const searchForm  = document.getElementById('search-form');
const productGrid = document.getElementById('product-grid');
const sortSelect  = document.getElementById('sort-select');
const chips       = document.querySelectorAll('.chip');

function applyFilters(){
  const q = (searchInput?.value || '').toLowerCase();
  const activeChip = document.querySelector('.chip.active');
  const filter = activeChip?.dataset.filter || 'all';
  const cards = [...document.querySelectorAll('.product-item')];

  // filter
  cards.forEach(card => {
    const name = (card.dataset.name || '').toLowerCase();
    const cat  = card.dataset.category || 'other';
    const show = name.includes(q) && (filter === 'all' || cat === filter);
    card.style.display = show ? '' : 'none';
  });

  // sort visible cards
  const visible = cards.filter(c => c.style.display !== 'none');
  const mode = sortSelect?.value || 'latest';
  visible.sort((a,b)=>{
    const pa = Number(a.dataset.price||0), pb = Number(b.dataset.price||0);
    const na = (a.dataset.name||'').toLowerCase(), nb = (b.dataset.name||'').toLowerCase();
    switch(mode){
      case 'price-asc': return pa - pb;
      case 'price-desc': return pb - pa;
      case 'name-asc': return na.localeCompare(nb);
      case 'name-desc': return nb.localeCompare(na);
      default: return 0; // DOM order as "latest"
    }
  });

  // re-append in new order
  visible.forEach(card => productGrid?.appendChild(card));
}

searchForm?.addEventListener('submit', (e)=>{ e.preventDefault(); applyFilters(); });
searchInput?.addEventListener('input', ()=>{ applyFilters(); });
sortSelect?.addEventListener('change', ()=>{ applyFilters(); });
chips.forEach(chip => chip.addEventListener('click', ()=>{
  chips.forEach(c=>{ c.classList.remove('active'); c.setAttribute('aria-selected','false'); });
  chip.classList.add('active'); chip.setAttribute('aria-selected','true');
  applyFilters();
}));

/* ---------- Format all price elements on load (.price OR .product-price) ---------- */
function formatPrices(scope = document){
  scope.querySelectorAll('.product-item').forEach(card => {
    const p = Number(card.dataset.price || 0);
    const priceEl = card.querySelector('.price') || card.querySelector('.product-price');
    if (priceEl) {
      // If label contains /lb or /dozen etc., keep the unit after the formatted number
      const unit = (priceEl.textContent.match(/\/.+$/) || [''])[0];
      priceEl.textContent = `${fmt.format(p)}${unit}`;
    }
  });
}

/* ---------- Theme toggle (class="dark") ---------- */
(function(){
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
  const btn = document.getElementById('theme-toggle');
  btn?.addEventListener('click', ()=>{
    const root = document.documentElement;
    root.classList.toggle('dark');
    localStorage.setItem(THEME_KEY, root.classList.contains('dark') ? 'dark' : 'light');
  });
})();

/* ---------- Newsletter (simple) ---------- */
(function(){
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = document.getElementById('newsletter-email')?.value.trim() || '';
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Please enter a valid email.'); return; }
    toast('Subscribed! 🎉 Check your inbox.');
    form.reset();
  });
})();

/* ---------- Reveal-on-scroll (safe if present) ---------- */
(function () {
  const cards = document.querySelectorAll('.product-item');
  if (!cards.length || !('IntersectionObserver' in window)) return;
  cards.forEach(c => c.classList.add('reveal-pre'));
  const obs = new IntersectionObserver((entries) => {
    for (const ent of entries) {
      if (ent.isIntersecting) {
        ent.target.classList.add('reveal-in');
        obs.unobserve(ent.target);
      }
    }
  }, { threshold: 0.15 });
  cards.forEach(c => obs.observe(c));
})();

/* ---------- Parallax hero (no-op if not on page) ---------- */
(function () {
  const hero = document.querySelector('.hero');
  const content = document.querySelector('.hero-content');
  const floaters = document.querySelector('.hero-floaters');
  if (!hero || !content || !floaters) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    const rx = (e.clientX - r.left) / r.width - 0.5;
    const ry = (e.clientY - r.top) / r.height - 0.5;
    content.style.transform = `translate3d(${rx * 12}px, ${ry * 12}px, 0)`;
    floaters.style.transform = `translate3d(${rx * -18}px, ${ry * -18}px, 0)`;
  });
  hero.addEventListener('mouseleave', () => {
    content.style.transform = '';
    floaters.style.transform = '';
  });
})();

/* ---------- Page init ---------- */
function init(){
  formatPrices();
  bindCartButtons();
  bindWishlist();
  applyFilters();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();

/* =========================================================
   Cart page (if present): simple renderer & controls
   ========================================================= */
(function cartPage(){
  const list = document.getElementById('cart-items');
  const totalEl = document.getElementById('total-price');
  const checkoutBtn = document.getElementById('proceed-to-checkout');
  if (!list && !totalEl && !checkoutBtn) return;

  renderCartList();
  checkoutBtn?.addEventListener('click', () => { window.location.href = 'checkout.html'; });

  function renderCartList(){
    const cart = readCart();
    if (!list) return;
    list.innerHTML = '';
    let total = 0;
    cart.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${item.name}</span>
        <span>x${item.qty}</span>
        <span>${fmt.format(item.price)}</span>
        <button class="cart-dec" aria-label="Decrease quantity">–</button>
        <button class="cart-inc" aria-label="Increase quantity">+</button>
        <button class="cart-del" aria-label="Remove item">Remove</button>
      `;
      list.appendChild(li);
      total += (Number(item.price)||0) * (item.qty||0);
      li.querySelector('.cart-dec')?.addEventListener('click', ()=> changeQty(item.id, -1));
      li.querySelector('.cart-inc')?.addEventListener('click', ()=> changeQty(item.id, +1));
      li.querySelector('.cart-del')?.addEventListener('click', ()=> removeItem(item.id));
    });
    totalEl && (totalEl.textContent = fmt.format(total));
  }

  function changeQty(id, delta){
    const cart = readCart();
    const idx = cart.findIndex(i => i.id === id);
    if (idx < 0) return;
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx,1);
    writeCart(cart);
    renderCartList();
  }
  function removeItem(id){
    const cart = readCart().filter(i => i.id !== id);
    writeCart(cart);
    renderCartList();
  }
})();

/* =========================================================
   Checkout page (if present)
   ========================================================= */
(function checkoutPage(){
  const form = document.getElementById('checkout-form');
  if (!form) return;

  const paymentOptions = document.querySelectorAll('input[name="payment-method"]');
  const creditCardDetails = document.getElementById('credit-card-details');
  const paypalDetails = document.getElementById('paypal-details');
  const upiDetails = document.getElementById('upi-details');
  const upiOptions = document.getElementById('upi-options');
  const upiOptionInputs = document.querySelectorAll('input[name="upi-option"]');

  const hide = el => { if (el) el.style.display = 'none'; };
  const show = el => { if (el) el.style.display = 'block'; };

  function hideAllPaymentDetails() {
    hide(creditCardDetails); hide(paypalDetails); hide(upiDetails); hide(upiOptions);
  }
  hideAllPaymentDetails();

  if (paymentOptions.length) {
    paymentOptions.forEach(option => {
      option.addEventListener('change', function () {
        hideAllPaymentDetails();
        if (this.value === 'credit-card') show(creditCardDetails);
        else if (this.value === 'paypal') show(paypalDetails);
        else if (this.value === 'upi') show(upiOptions || upiDetails || null);
      });
    });
  }
  if (upiOptionInputs.length && upiDetails) {
    upiOptionInputs.forEach(opt => { opt.addEventListener('change', () => show(upiDetails)); });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('name')?.value || '';
    const address = document.getElementById('address')?.value || '';
    const cart = readCart();
    const total = cart.reduce((t, i) => t + (Number(i.price)||0) * (i.qty||0), 0);
    toast(`Order placed by ${name}. Total ${fmt.format(total)}.`);
    localStorage.removeItem(CART_KEY);
    updateCartCount();
    setTimeout(()=>{ window.location.href = 'thank-you.html'; }, 600);
  });
})();
