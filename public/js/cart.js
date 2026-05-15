// File Path: /public/js/cart.js
// Purpose: Cart management using localStorage (productId, quantity)
// Linked Files: any page that uses cart (index.html, product.html, cart.html, checkout.html)

const CART_KEY = 'adultClothingCart';

/**
 * Get current cart from localStorage
 * @returns {Array<{productId: string, quantity: number}>}
 */
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Save cart array to localStorage
 * @param {Array} cart
 */
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/**
 * Add product to cart (increment quantity if exists)
 * @param {string} productId
 * @param {number} quantity (default 1)
 */
function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }
  saveCart(cart);
  updateCartCount();
}

/**
 * Update quantity of a specific cart item
 * @param {string} productId
 * @param {number} quantity
 */
function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find(i => i.productId === productId);
  if (item) {
    item.quantity = quantity;
    if (item.quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    saveCart(cart);
  }
}

/**
 * Remove item from cart
 * @param {string} productId
 */
function removeFromCart(productId) {
  const cart = getCart().filter(item => item.productId !== productId);
  saveCart(cart);
}

/**
 * Clear all items
 */
function clearCart() {
  saveCart([]);
}

/**
 * Get total number of items (sum of quantities)
 * @returns {number}
 */
function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Update cart icon count in the header
 */
function updateCartCount() {
  const countEl = document.getElementById('cartCount');
  if (countEl) {
    countEl.textContent = getCartCount();
  }
}

// On any page load, update the cart count if the element exists
document.addEventListener('DOMContentLoaded', updateCartCount);