// ── Accounts Table ────────────────────────────────────────────
function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  const empty = document.getElementById('usersEmpty');

  if (!users.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = users.map(u => {
    const initials   = (u.name || u.fullName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const name       = escHtml(u.name || u.fullName || '—');
    const email      = escHtml(u.email || '—');
    const math       = u.mathScore  != null ? `<span class="score-val">${u.mathScore}</span>`  : `<span class="score-na">—</span>`;
    const rw         = u.rwScore    != null ? `<span class="score-val">${u.rwScore}</span>`    : `<span class="score-na">—</span>`;
    const total      = (u.mathScore != null && u.rwScore != null)
      ? `<span class="score-val">${u.mathScore + u.rwScore}</span>`
      : `<span class="score-na">—</span>`;
    const statusBadge = u.status === 'active'
      ? '<span class="badge badge-active">Active</span>'
      : '<span class="badge badge-inactive">Inactive</span>';
    const lastActive = u.lastActive
      ? new Date(u.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '—';

    return `<tr>
      <td>
        <div class="student-cell">
          <div class="student-avatar">${initials}</div>
          <span class="student-name">${name}</span>
        </div>
      </td>
      <td>${email}</td>
      <td>${statusBadge}</td>
      <td>${math}</td>
      <td>${rw}</td>
      <td>${total}</td>
      <td>${u.testsAssigned ?? '—'}</td>
      <td>${lastActive}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="row-action-btn" onclick="openProgressModal('${u.id}')">View Progress</button>
        <button class="row-action-btn row-action-warn" onclick="toggleDeactivate('${u.id}', '${u.status}')">${u.status === 'active' ? 'Deactivate' : 'Activate'}</button>
        <button class="row-action-btn row-action-danger" onclick="deleteUser('${u.id}', '${escHtml(u.name || u.fullName || '')}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

function filterUsers() {
  const query  = document.getElementById('userSearch').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  const sort   = document.getElementById('filterSort').value;

  let users = allUsers.filter(u => {
    const n = (u.name || u.fullName || '').toLowerCase();
    const e = (u.email || '').toLowerCase();
    return (!query || n.includes(query) || e.includes(query))
        && (!status || u.status === status);
  });

  if (sort === 'score') {
    users.sort((a, b) => ((b.mathScore || 0) + (b.rwScore || 0)) - ((a.mathScore || 0) + (a.rwScore || 0)));
  } else if (sort === 'activity') {
    users.sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''));
  } else {
    users.sort((a, b) => (a.name || a.fullName || '').localeCompare(b.name || b.fullName || ''));
  }

  renderUsersTable(users);
}

// ── Progress Modal ────────────────────────────────────────────
async function openProgressModal(userId) {
  const user = allUsers.find(u => String(u.id) === String(userId));
  if (!user) return;

  const initials = (user.name || user.fullName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const total    = (user.mathScore != null && user.rwScore != null) ? user.mathScore + user.rwScore : null;
  const mathPct  = user.mathScore != null ? Math.round(((user.mathScore - 200) / 600) * 100) : 0;
  const rwPct    = user.rwScore   != null ? Math.round(((user.rwScore   - 200) / 600) * 100) : 0;

  document.getElementById('progressModalTitle').textContent = `Progress — ${user.name || user.fullName}`;
  document.getElementById('progressModalBody').innerHTML = '<p style="padding:24px;color:#aaa">Loading…</p>';
  document.getElementById('progressModal').classList.remove('hidden');

  let userAssignments = [];
  try {
    userAssignments = await apiFetch(`/admin/users/${userId}/assignments`);
  } catch {
    userAssignments = allAssignments.filter(a => String(a.userId) === String(userId));
  }

  document.getElementById('progressModalBody').innerHTML = `
    <div class="progress-student-header">
      <div class="progress-avatar-lg">${initials}</div>
      <div>
        <div class="progress-student-name">${escHtml(user.name || user.fullName || '—')}</div>
        <div class="progress-student-email">${escHtml(user.email || '—')}</div>
      </div>
      <span class="badge ${user.status === 'active' ? 'badge-active' : 'badge-inactive'}" style="margin-left:auto">
        ${user.status === 'active' ? 'Active' : 'Inactive'}
      </span>
    </div>

    <div class="progress-score-grid">
      <div class="progress-score-block">
        <span class="progress-score-val">${user.mathScore != null ? user.mathScore : '—'}</span>
        <span class="progress-score-lbl">Math</span>
      </div>
      <div class="progress-score-block">
        <span class="progress-score-val">${user.rwScore != null ? user.rwScore : '—'}</span>
        <span class="progress-score-lbl">Reading &amp; Writing</span>
      </div>
      <div class="progress-score-block">
        <span class="progress-score-val">${total != null ? total : '—'}</span>
        <span class="progress-score-lbl">Total</span>
      </div>
    </div>

    <div class="progress-bar-row">
      <div class="progress-bar-label"><span>Math</span><span>${user.mathScore != null ? user.mathScore : '—'} / 800</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${mathPct}%"></div></div>
    </div>
    <div class="progress-bar-row">
      <div class="progress-bar-label"><span>Reading &amp; Writing</span><span>${user.rwScore != null ? user.rwScore : '—'} / 800</span></div>
      <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${rwPct}%; background:#9fd4a8"></div></div>
    </div>

    <p class="progress-section-title" style="margin-top:20px">Assigned Tests (${userAssignments.length})</p>
    ${userAssignments.length ? `
      <ul class="progress-test-list">
        ${userAssignments.map(a => `
          <li class="progress-test-item">
            <div>
              <div class="progress-test-name">${escHtml(a.testName || a.name || '—')}</div>
              <div class="progress-test-meta">Due ${a.dueDate || '—'}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              ${a.score != null ? `<span class="score-val">${a.score}</span>` : ''}
              <span class="badge ${badgeClass(a.status)}">${capitalize(a.status)}</span>
            </div>
          </li>`).join('')}
      </ul>` : `<p style="color:#aaa;font-size:0.88rem;margin:0">No tests assigned yet.</p>`}
  `;
}

function closeProgressModal() {
  document.getElementById('progressModal').classList.add('hidden');
}

document.addEventListener('click', e => {
  if (e.target === document.getElementById('progressModal')) closeProgressModal();
});

// ── Create Account ────────────────────────────────────────────
async function submitCreateAccount(e) {
  e.preventDefault();
  const name     = document.getElementById('createName').value.trim();
  const email    = document.getElementById('createEmail').value.trim();
  const password = document.getElementById('createPassword').value;
  const btn      = document.getElementById('createSubmitBtn');

  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: name, email, password, role: 'student' }),
    });
    showToast('Account created for ' + name + '.');
    document.getElementById('createAccountForm').reset();
    await loadUsers();
  } catch {
    showToast('Failed to create account. Email may already be in use.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

// ── Deactivate / Delete User ──────────────────────────────────
async function toggleDeactivate(userId, currentStatus) {
  const isActive = currentStatus === 'active';
  const route = isActive ? `/admin/users/${userId}/deactivate` : `/admin/users/${userId}/reactivate`;
  const action = isActive ? 'deactivate' : 'reactivate';
  try {
    await apiFetch(route, { method: 'PATCH' });
    showToast(`Account ${action}d.`);
    await loadUsers();
    renderUsersTable(allUsers);
    renderStatBar();
  } catch {
    showToast(`Failed to ${action} account.`, true);
  }
}

async function deleteUser(userId, name) {
  if (!confirm(`Delete account for ${name}? This cannot be undone.`)) return;
  try {
    await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
    showToast('Account deleted.');
    await loadUsers();
    renderUsersTable(allUsers);
    renderStatBar();
  } catch {
    showToast('Failed to delete account.', true);
  }
}
