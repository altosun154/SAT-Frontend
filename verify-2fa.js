// verify-2fa.js

document.addEventListener('DOMContentLoaded', function () {
  const mfaToken = getPendingMfaToken();
  if (!mfaToken) {
    window.location.href = 'login.html';
    return;
  }

  const form       = document.getElementById('verify2faForm');
  const submitBtn  = document.getElementById('submitBtn');
  const errorBanner = document.getElementById('errorBanner');
  const codeInput  = document.getElementById('code');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validateForm()) return;

    const code = codeInput.value.trim();

    setSubmitting(true);
    hideError();

    try {
      const res = await fetch(API_BASE + '/auth/login/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_token: mfaToken, code })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Invalid or expired code.');
        return;
      }

      const email = sessionStorage.getItem('pendingMfaEmail') || '';
      clearPendingMfaToken();
      sessionStorage.removeItem('pendingMfaEmail');

      // Store auth data — same as the standard login flow
      setToken(data.token);
      sessionStorage.setItem('authUserId', data.user_id);
      sessionStorage.setItem('userFullName', data.name || '');
      sessionStorage.setItem('userEmail', email);
      sessionStorage.setItem('userRole', data.role || 'student');

      window.location.href = data.role === 'admin' ? 'admin.html' : 'index.html';

    } catch (err) {
      showError('Unable to connect. Please try again.');
    } finally {
      setSubmitting(false);
    }
  });

  codeInput.addEventListener('input', function () {
    clearFieldError();
  });

  document.getElementById('backToLogin').addEventListener('click', function () {
    clearPendingMfaToken();
    sessionStorage.removeItem('pendingMfaEmail');
  });

  // ── Helpers ──────────────────────────────────────

  function validateForm() {
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      showFieldError('Please enter the 6-digit code.');
      return false;
    }
    return true;
  }

  function showFieldError(message) {
    const error = document.getElementById('codeError');
    codeInput.classList.add('input-error');
    error.textContent = message;
    error.classList.add('visible');
  }

  function clearFieldError() {
    codeInput.classList.remove('input-error');
    document.getElementById('codeError').classList.remove('visible');
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
    submitBtn.textContent = loading ? 'Verifying…' : 'Verify';
  }
});
