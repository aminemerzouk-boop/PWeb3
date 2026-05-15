// File Path: /public/js/header.js
// Purpose: Dynamically update site header based on authentication state
// Linked Files: auth.js

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  if (!header) return;

  // Find any login link (exact match /login.html)
  const loginLink = header.querySelector('a[href="/login.html"]');
  if (!loginLink) return;

  // Get the parent element (usually an <li> or a <span>)
  const parentEl = loginLink.parentElement;

  if (isLoggedIn()) {
    const user = getUser();
    const firstName = user?.firstName || 'User';
    // Replace the login link's parent with user menu
    parentEl.innerHTML = `
      <span style="cursor:pointer;font-weight:600;position:relative;" id="userMenuTrigger">👤 ${firstName} ▼</span>
      <div id="userDropdown" class="user-dropdown" style="display:none;">
        <a href="/orders.html">My Orders</a>
        <a href="#" id="logoutLink">Logout</a>
      </div>
    `;

    const trigger = document.getElementById('userMenuTrigger');
    const dropdown = document.getElementById('userDropdown');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    document.getElementById('logoutLink').addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  } else {
    // Ensure login link is shown (should already be there, but just in case)
    parentEl.innerHTML = '<a href="/login.html">Login</a>';
  }
});