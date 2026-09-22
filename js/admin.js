/* admin.js — Admin Dashboard (API-driven) */
// Feature modules: admin-users.js, admin-assignments.js, admin-upload.js, admin-manage-tests.js

// ── API helpers ───────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── State ─────────────────────────────────────────────────────
let allUsers       = [];
let allTests       = [];
let allGroups      = [];
let allAssignments = [];
let currentAssignTarget = 'individual';

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadUsers(), loadTests(), loadGroups(), loadAssignments()]);
  renderStatBar();
  renderUsersTable(allUsers);
  renderAssignmentsTable(allAssignments);
  populateAssignDropdowns();
  populateManageTestDropdown();
});

// ── Data loaders ──────────────────────────────────────────────

async function loadUsers() {
  try {
    allUsers = await apiFetch('/admin/users');
  } catch {
    showToast('Failed to load students.', true);
    allUsers = [];
  }
}

async function loadTests() {
  try {
    allTests = await apiFetch('/admin/tests');
  } catch {
    showToast('Failed to load tests.', true);
    allTests = [];
  }
}

async function loadGroups() {
  try {
    allGroups = await apiFetch('/admin/groups');
  } catch {
    allGroups = [];
  }
}

async function loadAssignments() {
  try {
    allAssignments = await apiFetch('/admin/assignments');
  } catch {
    showToast('Failed to load assignments.', true);
    allAssignments = [];
  }
}

// ── Stats Bar ─────────────────────────────────────────────────
function renderStatBar() {
  const scored     = allUsers.filter(u => u.mathScore != null && u.rwScore != null);
  const avgTotal   = scored.length
    ? Math.round(scored.reduce((s, u) => s + u.mathScore + u.rwScore, 0) / scored.length)
    : '—';
  const activeAssn = allAssignments.filter(a => a.status === 'pending' || a.status === 'overdue').length;
  const completed  = allAssignments.filter(a => a.status === 'done').length;

  document.getElementById('statTotalUsers').textContent  = allUsers.length || '—';
  document.getElementById('statActiveTests').textContent = activeAssn || '—';
  document.getElementById('statAvgScore').textContent    = avgTotal;
  document.getElementById('statCompleted').textContent   = completed || '—';
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('admin-tab-active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('admin-tab-active');
}

// ── Helpers ───────────────────────────────────────────────────
function badgeClass(status) {
  return { pending: 'badge-pending', done: 'badge-done', overdue: 'badge-overdue', active: 'badge-active', inactive: 'badge-inactive' }[status] || '';
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function showToast() {}
