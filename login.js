// login.js

document.addEventListener('DOMContentLoaded', function () {
  redirectIfLoggedIn();

  const form       = document.getElementById('loginForm');
  const submitBtn  = document.getElementById('submitBtn');
  const errorBanner = document.getElementById('errorBanner');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validateForm()) return;

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setSubmitting(true);
    hideError();

    try {
      const res = await fetch(API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Invalid email or password.');
        return;
      }

      if (data.requires_2fa) {
        setPendingMfaToken(data.pending_token);
        sessionStorage.setItem('pendingMfaEmail', email);
        window.location.href = 'verify-2fa.html';
        return;
      }

      // Store auth data
      setToken(data.token);
      sessionStorage.setItem('authUserId', data.user_id);
      sessionStorage.setItem('userFullName', data.name || '');
      sessionStorage.setItem('userEmail', email);
      sessionStorage.setItem('userRole', data.role || 'student');

      // Mark account as active on login
      fetch(API_BASE + '/admin/users/' + data.user_id + '/reactivate', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + data.token }
      }).catch(function() {});

      // Record login date for streak tracking
      const _d = new Date();
      const today = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0');
      console.log('[streak] posting activity for', data.user_id, today);
      await fetch(API_BASE + '/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + data.token
        },
        body: JSON.stringify({ user_id: data.user_id, date: today, type: 'login' })
      }).catch(function() {});

      window.location.href = data.role === 'admin' ? 'admin.html' : 'index.html';

    } catch (err) {
      showError('Unable to connect. Please try again.');
    } finally {
      setSubmitting(false);
    }
  });

  // Clear field errors on input
  document.getElementById('email').addEventListener('input', function () {
    clearFieldError('email', 'emailError');
  });
  document.getElementById('password').addEventListener('input', function () {
    clearFieldError('password', 'passwordError');
  });

  // ── Helpers ──────────────────────────────────────

  function validateForm() {
    let valid = true;

    const email = document.getElementById('email').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('email', 'emailError', 'Please enter a valid email address.');
      valid = false;
    }

    const password = document.getElementById('password').value;
    if (!password) {
      showFieldError('password', 'passwordError', 'Password is required.');
      valid = false;
    }

    return valid;
  }

  function showFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    input.classList.add('input-error');
    error.textContent = message;
    error.classList.add('visible');
  }

  function clearFieldError(inputId, errorId) {
    document.getElementById(inputId).classList.remove('input-error');
    document.getElementById(errorId).classList.remove('visible');
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.add('visible');
  }

  function hideError() {
    errorBanner.classList.remove('visible');
  }

  function setSubmitting(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Signing in…' : 'Sign In';
  }
});
