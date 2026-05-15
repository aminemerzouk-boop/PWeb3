// File Path: /public/js/auth.js
// Purpose: Token and user management helpers
// Linked Files: any page that needs authentication

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function isLoggedIn() {
  return !!getToken();
}

function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}

function removeUser() {
  localStorage.removeItem(USER_KEY);
}

function logout() {
  removeToken();
  removeUser();
  window.location.href = '/login.html';
}