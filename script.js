// Initialize cart from localStorage
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Function to update cart display on the nav bar and cart page
function updateCart() {
    // Update cart count in the navigation bar
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.textContent = cart.length;
    }

    // If on the cart page, update the cart items
    const cartItemsElement = document.getElementById("cart-items");
    if (cartItemsElement) {
        cartItemsElement.innerHTML = '';
        let totalPrice = 0;

        cart.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.name} - $${item.price.toFixed(2)}`;
            cartItemsElement.appendChild(li);
            totalPrice += item.price;
        });

        document.getElementById("total-price").textContent = totalPrice.toFixed(2);
    }

    // Save cart data to localStorage
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Event listener for adding products to the cart
document.querySelectorAll('.add-to-cart').forEach(button => {
    button.addEventListener('click', () => {
        const product = button.parentElement;
        const id = product.dataset.id;
        const name = product.dataset.name;
        const price = parseFloat(product.dataset.price);

        // Add selected product to cart
        cart.push({ id, name, price });
        updateCart();
        alert(`${name} has been added to your cart!`);
    });
});

// Proceed to checkout button event listener
document.getElementById('proceed-to-checkout')?.addEventListener('click', () => {
    window.location.href = 'checkout.html'; // Redirect to checkout page
});

// Handle checkout form submission
document.getElementById('checkout-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    
    const name = document.getElementById('name').value;
    const address = document.getElementById('address').value;
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    
    let paymentInfo = `Order placed by ${name}\nAddress: ${address}\nPayment Method: ${paymentMethod}\nOrder Summary:\n`;
    
    cart.forEach(item => {
        paymentInfo += `${item.name} - $${item.price.toFixed(2)}\n`;
    });
    
    paymentInfo += `Total: $${cart.reduce((total, item) => total + item.price, 0).toFixed(2)}`;
    
    alert(paymentInfo);
    
    // Clear cart
    localStorage.removeItem('cart');
    cart = [];
    
    // Redirect to a thank you page or home page after successful checkout
    window.location.href = 'thank-you.html'; // Create this page to show a thank-you message
});

// Payment selection interaction
document.addEventListener('DOMContentLoaded', function() {
    const paymentOptions = document.querySelectorAll('input[name="payment-method"]');
    const creditCardDetails = document.getElementById('credit-card-details');
    const paypalDetails = document.getElementById('paypal-details');
    const upiDetails = document.getElementById('upi-details');
    const upiOptions = document.getElementById('upi-options');
    const upiOptionInputs = document.querySelectorAll('input[name="upi-option"]');

    // Function to hide all payment details
    function hideAllPaymentDetails() {
        creditCardDetails.style.display = 'none';
        paypalDetails.style.display = 'none';
        upiDetails.style.display = 'none';
        upiOptions.style.display = 'none';
    }

    // Event listener for payment method selection
    paymentOptions.forEach(option => {
        option.addEventListener('change', function () {
            hideAllPaymentDetails();

            if (this.value === 'credit-card') {
                creditCardDetails.style.display = 'block';
            } else if (this.value === 'paypal') {
                paypalDetails.style.display = 'block';
            } else if (this.value === 'upi') {
                upiOptions.style.display = 'block';  // Show UPI options
            }
        });
    });

    // Event listener for UPI options selection
    upiOptionInputs.forEach(option => {
        option.addEventListener('change', function () {
            upiDetails.style.display = 'block';  // Show UPI ID input
        });
    });

    // Call updateCart to set the initial state of the cart
    updateCart();
});