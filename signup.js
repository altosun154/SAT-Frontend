// signup.js

document.addEventListener('DOMContentLoaded', function () {
  redirectIfLoggedIn();

  const form        = document.getElementById('signupForm');
  const submitBtn   = document.getElementById('submitBtn');
  const errorBanner = document.getElementById('errorBanner');
  const passwordInput = document.getElementById('password');

  // Password strength indicator
  passwordInput.addEventListener('input', function () {
    updateStrength(this.value);
    clearFieldError('password', 'passwordError');
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validateForm()) return;

    const fullName        = document.getElementById('fullName').value.trim();
    const email           = document.getElementById('email').value.trim();
    const password        = document.getElementById('password').value;

    setSubmitting(true);
    hideError();

    try {
      const res = await fetch(API_BASE + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fullName, email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.message || 'Could not create account. Please try again.');
        return;
      }

      // Store auth data
      setToken(data.token);
      sessionStorage.setItem('authUserId', data.user_id);
      sessionStorage.setItem('userFullName', fullName);
      sessionStorage.setItem('userEmail', email);

      window.location.href = 'index.html';

    } catch (err) {
      showError('Unable to connect. Please try again.');
    } finally {
      setSubmitting(false);
    }
  });

  // Clear errors on input
  document.getElementById('fullName').addEventListener('input', function () {
    clearFieldError('fullName', 'fullNameError');
  });
  document.getElementById('email').addEventListener('input', function () {
    clearFieldError('email', 'emailError');
  });
  document.getElementById('confirmPassword').addEventListener('input', function () {
    clearFieldError('confirmPassword', 'confirmPasswordError');
  });

  // ── Helpers ──────────────────────────────────────

  function validateForm() {
    let valid = true;

    const fullName = document.getElementById('fullName').value.trim();
    if (!fullName) {
      showFieldError('fullName', 'fullNameError', 'Please enter your full name.');
      valid = false;
    }

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

    const confirm = document.getElementById('confirmPassword').value;
    if (confirm !== password) {
      showFieldError('confirmPassword', 'confirmPasswordError', 'Passwords do not match.');
      valid = false;
    }

    return valid;
  }

  function updateStrength(password) {
    const strengthEl = document.getElementById('passwordStrength');
    const fill       = document.getElementById('strengthFill');
    const label      = document.getElementById('strengthLabel');

    if (!password) {
      strengthEl.classList.remove('visible');
      return;
    }

    strengthEl.classList.add('visible');

    const hasLower   = /[a-z]/.test(password);
    const hasUpper   = /[A-Z]/.test(password);
    const hasDigit   = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    const score = [password.length >= 8, hasLower, hasUpper, hasDigit, hasSpecial]
      .filter(Boolean).length;

    fill.className = 'strength-fill';
    label.className = 'strength-label';

    if (score <= 2) {
      fill.classList.add('weak');
      label.classList.add('weak');
      label.textContent = 'Weak';
    } else if (score <= 3) {
      fill.classList.add('medium');
      label.classList.add('medium');
      label.textContent = 'Medium';
    } else {
      fill.classList.add('strong');
      label.classList.add('strong');
      label.textContent = 'Strong';
    }
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
    submitBtn.textContent = loading ? 'Creating account…' : 'Create Account';
  }
});
