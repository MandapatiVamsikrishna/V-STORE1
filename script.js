// ================== CART (shared across pages) ==================
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function updateCart() {
  // navbar count
  const cartCount = document.getElementById('cart-count');
  if (cartCount) cartCount.textContent = cart.length;

  // (optional) cart page list + total
  const cartItemsElement = document.getElementById('cart-items');
  if (cartItemsElement) {
    cartItemsElement.innerHTML = '';
    let totalPrice = 0;
    cart.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.name} - $${Number(item.price).toFixed(2)}`;
      cartItemsElement.appendChild(li);
      totalPrice += Number(item.price) || 0;
    });
    const totalEl = document.getElementById('total-price');
    if (totalEl) totalEl.textContent = totalPrice.toFixed(2);
  }

  localStorage.setItem('cart', JSON.stringify(cart));
}

document.addEventListener('DOMContentLoaded', () => {
  updateCart();

  // Add-to-cart (works on index/categories etc.)
  document.querySelectorAll('.add-to-cart').forEach(button => {
    button.addEventListener('click', () => {
      // find nearest product element that has the required data attributes
      const product =
        button.closest('[data-id][data-name][data-price]') ||
        button.parentElement; // fallback (your original)
      if (!product) return;

      const id = product.dataset.id;
      const name = product.dataset.name;
      const price = parseFloat(product.dataset.price);
      if (!id || !name || isNaN(price)) return;

      cart.push({ id, name, price });
      updateCart();
      alert(`${name} has been added to your cart!`);
    });
  });

  // Proceed to checkout (if present)
  document.getElementById('proceed-to-checkout')?.addEventListener('click', () => {
    window.location.href = 'checkout.html';
  });

  // ================== CHECKOUT PAGE ONLY ==================
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    // Payment selection UI (guards to avoid null errors on other pages)
    const paymentOptions = document.querySelectorAll('input[name="payment-method"]');
    const creditCardDetails = document.getElementById('credit-card-details');
    const paypalDetails = document.getElementById('paypal-details');
    const upiDetails = document.getElementById('upi-details');
    const upiOptions = document.getElementById('upi-options');
    const upiOptionInputs = document.querySelectorAll('input[name="upi-option"]');

    const hide = el => { if (el) el.style.display = 'none'; };
    const show = el => { if (el) el.style.display = 'block'; };

    function hideAllPaymentDetails() {
      hide(creditCardDetails);
      hide(paypalDetails);
      hide(upiDetails);
      hide(upiOptions);
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
      upiOptionInputs.forEach(opt => {
        opt.addEventListener('change', () => show(upiDetails));
      });
    }

    // Handle checkout submit
    checkoutForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const name = document.getElementById('name')?.value || '';
      const address = document.getElementById('address')?.value || '';
      const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'N/A';

      let paymentInfo =
        `Order placed by ${name}\nAddress: ${address}\nPayment Method: ${paymentMethod}\nOrder Summary:\n`;
      cart.forEach(item => paymentInfo += `${item.name} - $${Number(item.price).toFixed(2)}\n`);
      paymentInfo += `Total: $${cart.reduce((t, i) => t + (Number(i.price) || 0), 0).toFixed(2)}`;

      alert(paymentInfo);

      // Clear cart and redirect
      localStorage.removeItem('cart');
      cart = [];
      window.location.href = 'thank-you.html';
    });
  }

  // ================== DYNAMIC UI (INDEX PAGE) ==================

  // Parallax for hero content + floaters
  (function () {
    const hero = document.querySelector('.hero');
    const content = document.querySelector('.hero-content');
    const floaters = document.querySelector('.hero-floaters');
    if (!hero || !content || !floaters) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      const rx = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
      const ry = (e.clientY - r.top) / r.height - 0.5;
      content.style.transform = `translate3d(${rx * 12}px, ${ry * 12}px, 0)`;
      floaters.style.transform = `translate3d(${rx * -18}px, ${ry * -18}px, 0)`;
    });
    hero.addEventListener('mouseleave', () => {
      content.style.transform = '';
      floaters.style.transform = '';
    });
  })();

  // Reveal-on-scroll for featured products
  (function () {
    const cards = document.querySelectorAll('.product-item');
    if (!cards.length || !('IntersectionObserver' in window)) return;

    // set initial state
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
});
