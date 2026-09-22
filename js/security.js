// Security Modal Functions — Two-Factor Authentication (TOTP)

async function openSecurityModal() {
  const modal = document.getElementById('security-modal');
  modal.classList.remove('hidden');
  resetEnrollForm();

  try {
    const res = await fetch(API_BASE + '/auth/2fa/status', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    const data = await res.json();
    showMfaView(res.ok && data.enabled ? 'mfa-enabled-view' : 'mfa-disabled-view');
  } catch (err) {
    showMfaView('mfa-disabled-view');
  }
}

function closeSecurityModal() {
  const modal = document.getElementById('security-modal');
  modal.classList.add('hidden');
  resetEnrollForm();
}

function showMfaView(viewId) {
  ['mfa-disabled-view', 'mfa-enroll-view', 'mfa-enabled-view'].forEach(function (id) {
    document.getElementById(id).classList.toggle('hidden', id !== viewId);
  });
}

function resetEnrollForm() {
  document.getElementById('mfaEnrollCode').value = '';
  document.getElementById('mfaEnrollCode').classList.remove('input-error');
  document.getElementById('mfaEnrollCodeError').classList.remove('visible');
  document.getElementById('mfa-qr-container').innerHTML = '';
  document.getElementById('mfa-manual-secret').textContent = '';
  document.getElementById('mfaDisablePassword').value = '';
  document.getElementById('mfaDisableError').textContent = '';
  document.getElementById('mfaDisableError').classList.remove('visible');
  closeDisableDialog();
}

function openDisableDialog() {
  document.getElementById('disable-2fa-dialog').classList.remove('hidden');
  document.getElementById('mfaDisablePassword').focus();
}

function closeDisableDialog() {
  document.getElementById('disable-2fa-dialog').classList.add('hidden');
  document.getElementById('mfaDisablePassword').value = '';
  document.getElementById('mfaDisableError').classList.remove('visible');
}

async function startEnrollment() {
  try {
    const res = await fetch(API_BASE + '/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Unable to start 2FA setup. Please try again.');
      return;
    }

    document.getElementById('mfa-manual-secret').textContent = data.secret;

    const qrContainer = document.getElementById('mfa-qr-container');
    qrContainer.innerHTML = '';
    const img = document.createElement('img');
    img.src = 'data:image/png;base64,' + data.qr_code_png_base64;
    img.alt = 'Scan with your authenticator app';
    img.width = 200;
    img.height = 200;
    qrContainer.appendChild(img);

    showMfaView('mfa-enroll-view');
  } catch (err) {
    alert('Unable to connect. Please try again.');
  }
}

async function confirmEnrollment(code) {
  const res = await fetch(API_BASE + '/auth/2fa/enable', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getToken()
    },
    body: JSON.stringify({ code })
  });

  const data = await res.json();

  if (!res.ok) {
    const error = document.getElementById('mfaEnrollCodeError');
    document.getElementById('mfaEnrollCode').classList.add('input-error');
    error.textContent = data.error || 'Invalid code. Please try again.';
    error.classList.add('visible');
    return;
  }

  resetEnrollForm();
  showMfaView('mfa-enabled-view');
}

async function disableMfa(password) {
  const errorEl = document.getElementById('mfaDisableError');
  errorEl.classList.remove('visible');

  const res = await fetch(API_BASE + '/auth/2fa/disable', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getToken()
    },
    body: JSON.stringify({ password })
  });

  const data = await res.json();

  if (!res.ok) {
    errorEl.textContent = data.error || 'Unable to disable 2FA. Please check your password.';
    errorEl.classList.add('visible');
    return;
  }

  closeDisableDialog();
  showMfaView('mfa-disabled-view');
}

document.addEventListener('DOMContentLoaded', function () {
  const startEnrollBtn = document.getElementById('startEnrollBtn');
  if (startEnrollBtn) {
    startEnrollBtn.addEventListener('click', startEnrollment);
  }

  const cancelEnrollBtn = document.getElementById('cancelEnrollBtn');
  if (cancelEnrollBtn) {
    cancelEnrollBtn.addEventListener('click', function () {
      resetEnrollForm();
      showMfaView('mfa-disabled-view');
    });
  }

  const confirmForm = document.getElementById('mfa-confirm-form');
  if (confirmForm) {
    confirmForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const code = document.getElementById('mfaEnrollCode').value.trim();
      if (!/^\d{6}$/.test(code)) {
        const error = document.getElementById('mfaEnrollCodeError');
        document.getElementById('mfaEnrollCode').classList.add('input-error');
        error.textContent = 'Please enter the 6-digit code.';
        error.classList.add('visible');
        return;
      }
      confirmEnrollment(code);
    });
  }

  const showDisableFormBtn = document.getElementById('showDisableFormBtn');
  if (showDisableFormBtn) {
    showDisableFormBtn.addEventListener('click', openDisableDialog);
  }

  const cancelDisableBtn = document.getElementById('cancelDisableBtn');
  if (cancelDisableBtn) {
    cancelDisableBtn.addEventListener('click', closeDisableDialog);
  }

  const disableForm = document.getElementById('mfa-disable-form');
  if (disableForm) {
    disableForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const password = document.getElementById('mfaDisablePassword').value;
      if (!password) {
        const error = document.getElementById('mfaDisableError');
        error.textContent = 'Please enter your password.';
        error.classList.add('visible');
        return;
      }
      disableMfa(password);
    });
  }

  const securityModal = document.getElementById('security-modal');
  if (securityModal) {
    window.addEventListener('click', function (event) {
      if (event.target === securityModal) {
        closeSecurityModal();
      }
    });
  }

  const disableDialog = document.getElementById('disable-2fa-dialog');
  if (disableDialog) {
    window.addEventListener('click', function (event) {
      if (event.target === disableDialog) {
        closeDisableDialog();
      }
    });
  }
});
