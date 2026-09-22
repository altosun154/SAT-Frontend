// auth.js — shared auth utilities

const API_BASE = 'https://digital-sat-testing-analytics-platform.onrender.com';

// Token management
function getToken() {
  return sessionStorage.getItem('authToken');
}

function setToken(token) {
  sessionStorage.setItem('authToken', token);
}

function clearToken() {
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('authUserId');
  sessionStorage.removeItem('userFullName');
  sessionStorage.removeItem('userEmail');
}

function isLoggedIn() {
  return !!getToken();
}

// Redirect to login if not authenticated
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
  }
}

// Redirect away from login/signup if already authenticated
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = 'index.html';
  }
}

function logout() {
  clearToken();
  window.location.href = 'login.html';
}

// Pending MFA token — bridges the redirect from login.html to verify-2fa.html.
// Stored in sessionStorage (in-memory JS state doesn't survive the page navigation),
// but under its own short-lived key and cleared immediately once consumed.
function setPendingMfaToken(token) {
  sessionStorage.setItem('pendingMfaToken', token);
}

function getPendingMfaToken() {
  return sessionStorage.getItem('pendingMfaToken');
}

function clearPendingMfaToken() {
  sessionStorage.removeItem('pendingMfaToken');
}
