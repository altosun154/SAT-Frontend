// ── Assign Tab — Dropdowns ────────────────────────────────────
function populateAssignDropdowns() {
  const testSel = document.getElementById('assignTest');
  while (testSel.options.length > 1) testSel.remove(1);
  allTests.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name || t.title;
    testSel.appendChild(opt);
  });

  const studentSel = document.getElementById('assignStudent');
  while (studentSel.options.length > 1) studentSel.remove(1);
  allUsers.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.name || u.fullName;
    studentSel.appendChild(opt);
  });

  const groupSel = document.getElementById('assignGroup');
  while (groupSel.options.length > 1) groupSel.remove(1);
  allGroups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    groupSel.appendChild(opt);
  });
}

function setAssignTarget(target) {
  currentAssignTarget = target;
  document.querySelectorAll('.assign-toggle-btn').forEach(btn => btn.classList.remove('assign-toggle-active'));
  event.currentTarget.classList.add('assign-toggle-active');
  document.getElementById('assignTargetIndividual').classList.toggle('hidden', target !== 'individual');
  document.getElementById('assignTargetGroup').classList.toggle('hidden', target !== 'group');
  document.getElementById('assignTargetAll').classList.toggle('hidden', target !== 'all');
}

// ── Submit Assignment ─────────────────────────────────────────
async function submitAssignment(e) {
  e.preventDefault();

  const testId  = document.getElementById('assignTest').value;
  if (!testId) { showToast('Please select a test.', true); return; }

  const dueDate = document.getElementById('assignDueDate').value || null;
  const note    = document.getElementById('assignNote').value.trim() || null;

  const payload = { testId, dueDate, note };

  if (currentAssignTarget === 'individual') {
    const userId = document.getElementById('assignStudent').value;
    if (!userId) { showToast('Please select a student.', true); return; }
    payload.userId = userId;
  } else if (currentAssignTarget === 'group') {
    const groupId = document.getElementById('assignGroup').value;
    if (!groupId) { showToast('Please select a group.', true); return; }
    payload.groupId = groupId;
  } else {
    payload.assignAll = true;
  }

  try {
    await apiFetch('/admin/assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('Test assigned successfully.');
    document.getElementById('assignForm').reset();
    resetAssignForm();
    await loadAssignments();
    renderAssignmentsTable(allAssignments);
    renderStatBar();
  } catch {
    showToast('Failed to assign test. Please try again.', true);
  }
}

function resetAssignForm() {
  currentAssignTarget = 'individual';
  document.querySelectorAll('.assign-toggle-btn').forEach((btn, i) => {
    btn.classList.toggle('assign-toggle-active', i === 0);
  });
  document.getElementById('assignTargetIndividual').classList.remove('hidden');
  document.getElementById('assignTargetGroup').classList.add('hidden');
  document.getElementById('assignTargetAll').classList.add('hidden');
}

// ── Assignments Table ─────────────────────────────────────────
function renderAssignmentsTable(assignments) {
  const tbody = document.getElementById('assignTableBody');
  const empty = document.getElementById('assignEmpty');

  if (!assignments.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = assignments.map(a => `
    <tr>
      <td style="font-weight:600">${escHtml(a.testName || a.name || '—')}</td>
      <td>${escHtml(a.assignedTo || a.userName || '—')}</td>
      <td>${a.dueDate ? new Date(a.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
      <td><span class="badge ${badgeClass(a.status)}">${capitalize(a.status)}</span></td>
      <td>${a.score != null ? `<span class="score-val">${a.score}</span>` : '<span class="score-na">—</span>'}</td>
      <td><button class="row-action-btn" onclick="removeAssignment('${a.id}')">Remove</button></td>
    </tr>`).join('');
}

function filterAssignments() {
  const query = document.getElementById('assignSearch').value.toLowerCase();
  const filtered = allAssignments.filter(a =>
    (a.testName || a.name || '').toLowerCase().includes(query) ||
    (a.assignedTo || a.userName || '').toLowerCase().includes(query)
  );
  renderAssignmentsTable(filtered);
}

async function removeAssignment(id) {
  try {
    await apiFetch(`/admin/assignments/${id}`, { method: 'DELETE' });
    showToast('Assignment removed.');
    await loadAssignments();
    filterAssignments();
    renderStatBar();
  } catch {
    showToast('Failed to remove assignment.', true);
  }
}
