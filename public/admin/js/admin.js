// File Path: /public/admin/js/admin.js
// Purpose: Admin dashboard, product performance, product CRUD, tabs
// Linked Files: /admin/index.html, Chart.js

var ADMIN_TOKEN;

try {
  ADMIN_TOKEN = getToken();
} catch (e) {
  console.error('getToken not defined. Did you load auth.js?');
  window.location.href = '/login.html';
}
if (!ADMIN_TOKEN) {
  window.location.href = '/login.html';
}
// ========== UTILITY ==========
async function apiFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
  };
  return fetch(url, { ...options, headers });
}

// ========== HELPERS ==========
function buildProductTable(products) {
  if (!products || products.length === 0) return '<p>No data available.</p>';
  let html = '<table class="products-table"><thead><tr><th>Image</th><th>Name</th><th>Units Sold</th></tr></thead><tbody>';
  products.forEach(p => {
    const img = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/40';
    html += `<tr>
      <td><img src="${img}" alt="${p.name}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></td>
      <td>${p.name}</td>
      <td>${p.unitsSold || 0}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  return html;
}


// ========== DASHBOARD ==========
let revenueChart, categoryChart, ordersChart;

async function loadDashboard() {
  const period = document.getElementById('periodSelect').value;
  try {
    const [revenueRes, trendRes, catRes, orderSummaryRes, inventoryRes] = await Promise.all([
      apiFetch(`/api/dashboard/revenue?period=${period}`),
      apiFetch('/api/dashboard/revenue-trend'),
      apiFetch('/api/dashboard/revenue-by-category'),
      apiFetch('/api/dashboard/orders-summary'),
      apiFetch('/api/dashboard/inventory-alerts'),
    ]);

    const revenueData = await revenueRes.json().catch(() => ({}));
    const trendData = await trendRes.json().catch(() => []);
    const catData = await catRes.json().catch(() => []);
    const orderSummary = await orderSummaryRes.json().catch(() => []);
    const inventoryData = await inventoryRes.json().catch(() => ({ lowStock: [], outOfStock: [] }));

    // Stats cards
    document.getElementById('statsCards').innerHTML = `
      <div class="stat-card">
        <div class="value">DA ${(revenueData.totalRevenue || 0).toFixed(2)}</div>
        <div class="label">Total Revenue</div>
      </div>
      <div class="stat-card">
        <div class="value">${revenueData.unitsSold || 0}</div>
        <div class="label">Units Sold</div>
      </div>
      <div class="stat-card">
        <div class="value">DA${(revenueData.refunds || 0).toFixed(2)}</div>
        <div class="label">Refunds</div>
      </div>
      <div class="stat-card">
        <div class="value">DA ${(revenueData.netRevenue || 0).toFixed(2)}</div>
        <div class="label">Net Revenue</div>
      </div>
    `;

    // Revenue Trend Chart
    const ctx1 = document.getElementById('revenueTrendChart').getContext('2d');
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: trendData.map(d => (d.date || '').slice(0, 10)),
        datasets: [{
          label: 'Daily Revenue',
          data: trendData.map(d => parseFloat(d.revenue)),
          borderColor: '#FFC107',
          backgroundColor: 'rgba(255,193,7,0.1)',
          fill: true,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Revenue Trend (Last 30 Days)' } }
      }
    });

    // Revenue by Category
    const ctx2 = document.getElementById('categoryChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: catData.map(d => d.categoryName),
        datasets: [{
          data: catData.map(d => parseFloat(d.revenue)),
          backgroundColor: ['#FFC107', '#FFA000', '#FF6F00', '#FFD54F'],
        }]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Revenue by Category' } }
      }
    });

    // Orders Status
    const ctx3 = document.getElementById('ordersStatusChart').getContext('2d');
    if (ordersChart) ordersChart.destroy();
    ordersChart = new Chart(ctx3, {
      type: 'doughnut',
      data: {
        labels: orderSummary.map(d => d.status),
        datasets: [{
          data: orderSummary.map(d => d.count),
          backgroundColor: ['#FFC107', '#4CAF50', '#2196F3', '#9C27B0', '#F44336'],
        }]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Order Status Breakdown' } }
      }
    });

    // Inventory alerts
    document.getElementById('lowStockList').innerHTML = inventoryData.lowStock?.length
      ? '<h4>Low Stock (≤5)</h4>' + inventoryData.lowStock.map(p => `<p>${p.name} (${p.stock})</p>`).join('')
      : '<p>No low stock items.</p>';
    document.getElementById('outOfStockList').innerHTML = inventoryData.outOfStock?.length
      ? '<h4>Out of Stock</h4>' + inventoryData.outOfStock.map(p => `<p>${p.name}</p>`).join('')
      : '<p>All items in stock.</p>';

  } catch (err) {
    console.error('Dashboard error:', err);
    document.getElementById('statsCards').innerHTML = '<p>Error loading dashboard data.</p>';
  }
}

// ========== PRODUCT PERFORMANCE ==========
let topSellersChart;

async function loadProductPerformance() {
  try {
    const res = await apiFetch('/api/dashboard/product-performance');
    if (!res.ok) throw new Error('Failed to fetch product performance');
    const data = await res.json();

    // Top selling table
    document.getElementById('topSellingTable').innerHTML = buildProductTable(data.topSelling);
    // Worst selling table
    document.getElementById('worstSellingTable').innerHTML = buildProductTable(data.worstSelling);

    // Out of stock
    const outStockEl = document.getElementById('outOfStockListPerf');
    if (data.outOfStock && data.outOfStock.length > 0) {
      outStockEl.innerHTML = data.outOfStock.map(p => `<p>${p.name}</p>`).join('');
    } else {
      outStockEl.innerHTML = '<p>All products in stock.</p>';
    }

    // Low stock
    const lowStockEl = document.getElementById('lowStockListPerf');
    if (data.lowStock && data.lowStock.length > 0) {
      lowStockEl.innerHTML = data.lowStock.map(p => `<p>${p.name} (${p.stock} left)</p>`).join('');
    } else {
      lowStockEl.innerHTML = '<p>No low stock items.</p>';
    }

    // Top sellers bar chart
    const ctx = document.getElementById('topSellersChart').getContext('2d');
    if (topSellersChart) topSellersChart.destroy();
    topSellersChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.topSelling.map(p => p.name),
        datasets: [{
          label: 'Units Sold',
          data: data.topSelling.map(p => p.unitsSold),
          backgroundColor: '#FFC107',
        }]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Top 10 Best‑Selling Products' } },
        scales: { y: { beginAtZero: true } }
      }
    });

  } catch (err) {
    console.error('Product performance error:', err);
    document.getElementById('topSellingTable').innerHTML = '<p>Error loading data.</p>';
  }
}

// ========== PRODUCT MANAGEMENT ==========
let editingProductId = null;
let existingImages = [];

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();
    const select = document.getElementById('categoryId');
    select.innerHTML = '<option value="">Select category</option>';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Load categories error:', err);
  }
}

async function loadProducts() {
  const container = document.getElementById('productTableContainer');
  try {
    const res = await fetch('/api/products');
    const products = await res.json();
    if (products.length === 0) {
      container.innerHTML = '<p>No products found.</p>';
      return;
    }
    const table = document.createElement('table');
    table.className = 'products-table';
    table.innerHTML = `
      <thead>
        <tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${products.map(p => `
          <tr data-id="${p.id}">
            <td><img src="${p.images?.[0] || 'https://via.placeholder.com/60'}" alt="${p.name}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;"></td>
            <td>${p.name}</td>
            <td>${p.categoryName}</td>
            <td>DA${parseFloat(p.price).toFixed(2)}</td>
            <td>${p.stock}</td>
            <td>
              <button class="btn-sm btn-edit" onclick="editProduct('${p.id}')">Edit</button>
              <button class="btn-sm btn-delete" onclick="deleteProduct('${p.id}')">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    container.innerHTML = '';
    container.appendChild(table);
  } catch (err) {
    container.innerHTML = '<p>Error loading products.</p>';
  }
}

async function editProduct(id) {
  try {
    const res = await fetch(`/api/products/${id}`);
    const product = await res.json();
    document.getElementById('name').value = product.name;
    document.getElementById('description').value = product.description;
    document.getElementById('price').value = product.price;
    document.getElementById('stock').value = product.stock;
    document.getElementById('categoryId').value = product.categoryId;
    existingImages = product.images || [];
    const preview = document.getElementById('imagePreview');
    if (existingImages.length > 0) {
      preview.src = existingImages[0];
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
    document.getElementById('formHeading').textContent = 'Edit Product';
    document.getElementById('submitBtn').textContent = 'Update Product';
    document.getElementById('cancelBtn').style.display = 'inline-block';
    editingProductId = id;
  } catch (err) {
    alert('Failed to load product.');
  }
}

function resetForm() {
  document.getElementById('productForm').reset();
  document.getElementById('formHeading').textContent = 'Add New Product';
  document.getElementById('submitBtn').textContent = 'Add Product';
  document.getElementById('cancelBtn').style.display = 'none';
  document.getElementById('imagePreview').style.display = 'none';
  editingProductId = null;
  existingImages = [];
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      // Try to get the server's error message
      let errorMsg = 'Delete failed';
      try {
        const data = await res.json();
        if (data.error) errorMsg = data.error;
      } catch (_) {}
      throw new Error(errorMsg);
    }
    if (editingProductId === id) resetForm();
    loadProducts();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ========== ORDERS ==========
async function loadOrders() {
  const status = document.getElementById('orderStatusFilter').value;
  const container = document.getElementById('ordersTableContainer');
  try {
    const url = status ? `/api/orders?status=${status}` : '/api/orders';
    const res = await apiFetch(url);
    if (!res.ok) throw new Error('Failed to fetch orders');
    const orders = await res.json();

    if (orders.length === 0) {
      container.innerHTML = '<p>No orders found.</p>';
      return;
    }

    let tableHtml = '<table class="products-table"><thead><tr>';
    tableHtml += '<th>Order ID</th><th>Customer</th><th>Wilaya</th><th>Total</th><th>Status</th><th>Date</th><th>Items</th><th>Actions</th>';
    tableHtml += '</tr></thead><tbody>';

    orders.forEach(order => {
      const shortId = order.id.slice(0, 8) + '...';
      const date = new Date(order.createdAt).toLocaleDateString();
      const itemsList = order.items.map(i => `${i.productName} (x${i.quantity})`).join(', ');
      tableHtml += `<tr>
        <td title="${order.id}">${shortId}</td>
        <td>${order.customerName}<br><small>${order.customerEmail}</small></td>
        <td>${order.wilayaName}</td>
        <td>DA${parseFloat(order.totalAmount).toFixed(2)}</td>
        <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
        <td>${date}</td>
        <td style="max-width:200px;">${itemsList}</td>
        <td>
          <select class="status-change-select" data-order-id="${order.id}">
            <option value="">Change status</option>
            <option value="PROCESSING" ${order.status === 'PROCESSING' ? 'disabled' : ''}>Processing</option>
            <option value="SHIPPED" ${order.status === 'SHIPPED' ? 'disabled' : ''}>Shipped</option>
            <option value="DELIVERED" ${order.status === 'DELIVERED' ? 'disabled' : ''}>Delivered</option>
            <option value="CANCELLED" ${order.status === 'CANCELLED' ? 'disabled' : ''}>Cancel</option>
          </select>
        </td>
      </tr>`;
    });
    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;

    // Attach event listeners to the status change dropdowns
    document.querySelectorAll('.status-change-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        if (!newStatus) return;
        const orderId = e.target.dataset.orderId;
        if (confirm(`Change order ${orderId.slice(0, 8)} to ${newStatus}?`)) {
          try {
            const res = await apiFetch(`/api/orders/${orderId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || 'Update failed');
            }
            alert('Order status updated.');
            loadOrders(); // refresh table
          } catch (err) {
            alert('Error: ' + err.message);
            loadOrders(); // refresh to reset dropdown
          }
        } else {
          e.target.value = ''; // reset if cancelled
        }
      });
    });
  } catch (err) {
    console.error('Orders error:', err);
    container.innerHTML = '<p>Error loading orders.</p>';
  }
}

// ========== CATEGORY MANAGEMENT ==========
let editingCategoryId = null;
async function loadCategoriesAdmin() {
  const container = document.getElementById('categoriesTableContainer');
  if (!container) return;
  try {
    const res = await apiFetch('/api/admin/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    const categories = await res.json();
    if (categories.length === 0) {
      container.innerHTML = '<p>No categories found.</p>';
      return;
    }
    let tableHtml = '<table class="products-table"><thead><tr><th>Name</th><th>Description</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
    categories.forEach(cat => {
      const date = new Date(cat.createdAt).toLocaleDateString();
      tableHtml += `<tr data-category-id="${cat.id}">
        <td>${cat.name}</td>
        <td>${cat.description || ''}</td>
        <td>${date}</td>
        <td>
          <button class="btn-sm btn-edit" onclick="editCategory('${cat.id}')">Edit</button>
          <button class="btn-sm btn-delete" onclick="deleteCategory('${cat.id}')">Delete</button>
        </td>
      </tr>`;
    });
    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
  } catch (err) {
    console.error('Category load error:', err);
    container.innerHTML = '<p>Error loading categories.</p>';
  }
}

async function saveCategory(e) {
  e.preventDefault();
  const name = document.getElementById('categoryName').value.trim();
  const description = document.getElementById('categoryDescription').value.trim();
  if (!name) {
    alert('Category name is required.');
    return;
  }
  const categoryData = { name, description: description || null };
  try {
    let res;
    if (editingCategoryId) {
      res = await apiFetch(`/api/admin/categories/${editingCategoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
    } else {
      res = await apiFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
    }
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Save failed');
    }
    alert(editingCategoryId ? 'Category updated!' : 'Category added!');
    resetCategoryForm();
    loadCategoriesAdmin();
    // Also refresh the product management dropdown
    if (typeof loadCategories === 'function') loadCategories();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function resetCategoryForm() {
  document.getElementById('categoryForm').reset();
  document.getElementById('categoryEditId').value = '';
  document.getElementById('categorySubmitBtn').textContent = 'Add Category';
  document.getElementById('categoryCancelBtn').style.display = 'none';
  editingCategoryId = null;
}

async function editCategory(id) {
  // Fetch all categories to get the one we need (could also do a GET /api/admin/categories/:id)
  try {
    const res = await apiFetch('/api/admin/categories');
    if (!res.ok) throw new Error('Failed to fetch');
    const categories = await res.json();
    const category = categories.find(c => c.id === id);
    if (!category) throw new Error('Category not found');
    document.getElementById('categoryName').value = category.name;
    document.getElementById('categoryDescription').value = category.description || '';
    document.getElementById('categoryEditId').value = category.id;
    document.getElementById('categorySubmitBtn').textContent = 'Update Category';
    document.getElementById('categoryCancelBtn').style.display = 'inline-block';
    editingCategoryId = id;
  } catch (err) {
    alert('Failed to load category for editing.');
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category? All products in this category will also be deleted (CASCADE). Continue?')) return;
  try {
    const res = await apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      let errorMsg = 'Delete failed';
      try {
        const data = await res.json();
        if (data.error) errorMsg = data.error;
      } catch (_) {}
      throw new Error(errorMsg);
    }
    alert('Category deleted.');
    if (editingCategoryId === id) resetCategoryForm();
    loadCategoriesAdmin();
    if (typeof loadCategories === 'function') loadCategories();
    if (typeof loadProducts === 'function') loadProducts();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // ========== TABS ==========
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(`tab-${btn.dataset.tab}`);
      if (!target) return;
      target.classList.add('active');

      if (btn.dataset.tab === 'dashboard') loadDashboard();
      else if (btn.dataset.tab === 'product-performance') loadProductPerformance();
      else if (btn.dataset.tab === 'orders') loadOrders();
      else if (btn.dataset.tab === 'categories') loadCategoriesAdmin();   // <-- added here
      else if (btn.dataset.tab === 'products') loadProducts();
    });
  });

  // Order filter change
  const orderFilter = document.getElementById('orderStatusFilter');
  if (orderFilter) {
    orderFilter.addEventListener('change', loadOrders);
  }

  // Period selector for dashboard
  const periodSelect = document.getElementById('periodSelect');
  if (periodSelect) periodSelect.addEventListener('change', loadDashboard);

  // Cancel button for product form
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

  // Product form submission
  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const description = document.getElementById('description').value;
      const price = parseFloat(document.getElementById('price').value);
      const stock = parseInt(document.getElementById('stock').value);
      const categoryId = document.getElementById('categoryId').value;
      const imageFile = document.getElementById('imageFile').files[0];

      try {
        let images = existingImages;
        if (imageFile) {
          const formData = new FormData();
          formData.append('image', imageFile);
          const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: formData });
          if (!uploadRes.ok) throw new Error('Upload failed');
          const data = await uploadRes.json();
          images = [data.url];
        }
        const productData = { name, description, price, stock, images, categoryId };
        if (editingProductId) {
          const res = await apiFetch(`/api/products/${editingProductId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData),
          });
          if (!res.ok) throw new Error('Update failed');
          alert('Product updated!');
        } else {
          const res = await apiFetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData),
          });
          if (!res.ok) throw new Error('Creation failed');
          alert('Product added!');
        }
        resetForm();
        loadProducts();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Category form submit
  const categoryForm = document.getElementById('categoryForm');
  if (categoryForm) {
    categoryForm.addEventListener('submit', saveCategory);
  }
  // Category cancel button
  const categoryCancelBtn = document.getElementById('categoryCancelBtn');
  if (categoryCancelBtn) {
    categoryCancelBtn.addEventListener('click', resetCategoryForm);
  }

  // Initial load
  loadCategories();
  loadDashboard();  // default active tab
});