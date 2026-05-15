// File Path: /public/js/main.js
// Purpose: Mobile menu, fetch products, search and category filter, add to cart
// Linked Files: index.html, cart.js

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Mobile navigation ----------
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true' || false;
      navToggle.setAttribute('aria-expanded', !expanded);
      mainNav.classList.toggle('open');
      document.body.classList.toggle('nav-open');
    });
  }

  // Smooth scroll for contact link (already handled by #footer, but add for safety)
  document.querySelector('a[href="#footer"]')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('footer').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('shopNowButton')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('productsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- Global variables ----------
  let allProducts = [];
  let categories = [];

  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const productGrid = document.getElementById('productGrid');
  const loadingMessage = document.getElementById('loadingMessage');

  // ---------- Fetch products and categories ----------
  async function fetchInitialData() {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories')
      ]);
      if (!productsRes.ok || !categoriesRes.ok) throw new Error('Network error');
      allProducts = await productsRes.json();
      categories = await categoriesRes.json();
      populateCategoryFilter();
      renderFilteredProducts();
    } catch (err) {
      console.error('Failed to fetch data:', err);
      if (loadingMessage) {
        loadingMessage.textContent = 'Failed to load products. Please try again later.';
      }
    }
  }

  function populateCategoryFilter() {
    if (!categoryFilter) return;
    // Keep first option "All Categories"
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      categoryFilter.appendChild(option);
    });
  }

  // ---------- Filtering logic ----------
  function getFilteredProducts() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const categoryId = categoryFilter ? categoryFilter.value : '';

    return allProducts.filter(product => {
      const matchesSearch = searchTerm === '' || product.name.toLowerCase().includes(searchTerm);
      const matchesCategory = categoryId === '' || product.categoryId === categoryId;
      return matchesSearch && matchesCategory;
    });
  }

  function renderFilteredProducts() {
    if (!productGrid) return;
    const filtered = getFilteredProducts();
    productGrid.innerHTML = '';
    if (loadingMessage) loadingMessage.style.display = 'none';

    if (filtered.length === 0) {
      productGrid.innerHTML = '<p>No products found.</p>';
      return;
    }

    filtered.forEach(product => {
      const card = createProductCard(product);
      productGrid.appendChild(card);
    });
  }

  // ---------- Event listeners ----------
  if (searchInput) searchInput.addEventListener('input', renderFilteredProducts);
  if (categoryFilter) categoryFilter.addEventListener('change', renderFilteredProducts);

  // ---------- Product card creation ----------
  function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const imageUrl = (product.images && product.images.length > 0)
      ? product.images[0]
      : 'https://via.placeholder.com/400x300?text=No+Image';

    card.innerHTML = `
      <a href="/product.html?id=${product.id}">
        <img src="${imageUrl}" alt="${product.name}" class="product-card__image" loading="lazy">
      </a>
      <div class="product-card__body">
        <div class="product-card__category">${product.categoryName || ''}</div>
        <h3 class="product-card__name">${product.name}</h3>
        <div class="product-card__price">DA ${parseFloat(product.price).toFixed(2)}</div>
        <div class="product-card__stock">${product.stock > 0 ? 'In Stock' : 'Out of Stock'}</div>
        <button class="btn-add-to-cart" data-id="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>
          Add to Cart
        </button>
      </div>
    `;
    return card;
  }

  // ---------- Add to cart delegation ----------
  productGrid?.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-add-to-cart') && !e.target.disabled) {
      const productId = e.target.dataset.id;
      addToCart(productId);  // from cart.js
      alert('Added to cart!');
    }
  });

  // Kick off
  fetchInitialData();
});
