// ── Manage Tests (edit/delete questions) ────────────────────────

let currentManageTestId  = null;
let currentManageQuestions = [];
let currentEditQuestionId  = null;

const SUBJECT_LABELS = {
  'Section 1, Module 1: Reading and Writing': 'R&W · Module 1',
  'Section 1, Module 2: Reading and Writing': 'R&W · Module 2',
  'Section 2, Module 1: Math':                'Math · Module 1',
  'Section 2, Module 2: Math':                'Math · Module 2',
};

function difficultyBadgeClass(difficulty) {
  return { easy: 'badge-active', medium: 'badge-pending', hard: 'badge-overdue' }[difficulty] || 'badge-inactive';
}

function isGridIn(q) {
  return !(q.choice_a || q.choice_b || q.choice_c || q.choice_d);
}

// ── Test dropdown ────────────────────────────────────────────────
function populateManageTestDropdown() {
  const sel = document.getElementById('manageTestSelect');
  if (!sel) return;
  const prevValue = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  allTests.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name || t.title;
    sel.appendChild(opt);
  });
  if (prevValue && allTests.some(t => String(t.id) === prevValue)) sel.value = prevValue;
}

function onManageTestChange() {
  const sel = document.getElementById('manageTestSelect');
  const testId = sel.value;
  currentManageTestId = testId || null;
  document.getElementById('deleteTestBtn').disabled = !testId;
  if (!testId) {
    currentManageQuestions = [];
    renderManageQuestionsTable();
    return;
  }
  loadManageQuestions(testId);
}

async function loadManageQuestions(testId) {
  const emptyMsg = document.getElementById('manageQuestionsEmptyMsg');
  emptyMsg.textContent = 'Loading…';
  document.getElementById('manageQuestionsEmpty').classList.remove('hidden');
  document.getElementById('manageQuestionsTableBody').innerHTML = '';
  try {
    currentManageQuestions = await apiFetch(`/admin/tests/${testId}/questions`);
  } catch {
    currentManageQuestions = [];
    showToast('Failed to load questions for this test.', true);
  }
  renderManageQuestionsTable();
}

// ── Table ─────────────────────────────────────────────────────
function renderManageQuestionsTable() {
  const tbody = document.getElementById('manageQuestionsTableBody');
  const empty = document.getElementById('manageQuestionsEmpty');
  const emptyMsg = document.getElementById('manageQuestionsEmptyMsg');

  if (!currentManageTestId) {
    tbody.innerHTML = '';
    emptyMsg.textContent = 'Select a test above to view and edit its questions.';
    empty.classList.remove('hidden');
    return;
  }

  if (!currentManageQuestions.length) {
    tbody.innerHTML = '';
    emptyMsg.textContent = 'This test has no questions.';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = currentManageQuestions.map((q, i) => {
    const gridIn = isGridIn(q);
    const subjectLabel = SUBJECT_LABELS[q.subject] || escHtml(q.subject || '—');
    const difficulty = (q.difficulty || '').toLowerCase();
    const diffBadge = difficulty
      ? `<span class="badge ${difficultyBadgeClass(difficulty)}">${capitalize(difficulty)}</span>`
      : '<span class="score-na">—</span>';
    const typeBadge = gridIn
      ? '<span class="badge badge-pending">Grid-In</span>'
      : '<span class="badge badge-active">MCQ</span>';
    const textPreview = escHtml((q.text || '').length > 90 ? q.text.slice(0, 90) + '…' : (q.text || ''));

    return `<tr>
      <td>${i + 1}</td>
      <td style="max-width:360px">${textPreview}</td>
      <td>${subjectLabel}</td>
      <td>${diffBadge}</td>
      <td>${typeBadge}</td>
      <td>${escHtml(q.correct_answer || '—')}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="row-action-btn" onclick="editQuestion(${q.id})">Edit</button>
        <button class="row-action-btn row-action-danger" onclick="deleteQuestion(${q.id})">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Edit modal ────────────────────────────────────────────────
function editQuestion(questionId) {
  const q = currentManageQuestions.find(qq => qq.id === questionId);
  if (!q) return;

  currentEditQuestionId = questionId;

  document.getElementById('editQText').value    = q.text || '';
  document.getElementById('editQPassage').value = q.passage || '';
  document.getElementById('editQChoiceA').value = q.choice_a || '';
  document.getElementById('editQChoiceB').value = q.choice_b || '';
  document.getElementById('editQChoiceC').value = q.choice_c || '';
  document.getElementById('editQChoiceD').value = q.choice_d || '';
  document.getElementById('editQSubject').value = q.subject || 'Section 1, Module 1: Reading and Writing';
  document.getElementById('editQDifficulty').value = (q.difficulty || 'medium').toLowerCase();
  document.getElementById('editQSkill').value = q.skill || '';
  document.getElementById('editQImageUrl').value = q.image_url || '';

  const gridIn = isGridIn(q);
  setEditQuestionType(gridIn ? 'gridin' : 'mcq');

  if (gridIn) {
    document.getElementById('editQAnswerText').value = q.correct_answer || '';
  } else {
    const sel = document.getElementById('editQAnswerSelect');
    sel.value = ['A', 'B', 'C', 'D'].includes((q.correct_answer || '').toUpperCase())
      ? q.correct_answer.toUpperCase()
      : 'A';
  }

  document.getElementById('editQuestionModal').classList.remove('hidden');
}

function setEditQuestionType(type) {
  document.querySelectorAll('#editQuestionForm .assign-toggle-btn').forEach(btn => {
    btn.classList.toggle('assign-toggle-active', btn.dataset.qtype === type);
  });
  const isGridInType = type === 'gridin';
  document.getElementById('editQChoicesGroup').classList.toggle('hidden', isGridInType);
  document.getElementById('editQAnswerMcqGroup').classList.toggle('hidden', isGridInType);
  document.getElementById('editQAnswerTextGroup').classList.toggle('hidden', !isGridInType);
}

function closeEditQuestionModal() {
  document.getElementById('editQuestionModal').classList.add('hidden');
  currentEditQuestionId = null;
}

document.addEventListener('click', e => {
  if (e.target === document.getElementById('editQuestionModal')) closeEditQuestionModal();
});

async function submitEditQuestion(e) {
  e.preventDefault();
  if (!currentEditQuestionId) return;

  const isGridInType = document.getElementById('editQChoicesGroup').classList.contains('hidden');

  const payload = {
    text:       document.getElementById('editQText').value.trim(),
    passage:    document.getElementById('editQPassage').value.trim() || null,
    subject:    document.getElementById('editQSubject').value,
    difficulty: document.getElementById('editQDifficulty').value,
    skill:      document.getElementById('editQSkill').value.trim() || null,
    image_url:  document.getElementById('editQImageUrl').value.trim() || null,
  };

  if (isGridInType) {
    payload.choice_a = '';
    payload.choice_b = '';
    payload.choice_c = '';
    payload.choice_d = '';
    payload.correct_answer = document.getElementById('editQAnswerText').value.trim();
  } else {
    payload.choice_a = document.getElementById('editQChoiceA').value;
    payload.choice_b = document.getElementById('editQChoiceB').value;
    payload.choice_c = document.getElementById('editQChoiceC').value;
    payload.choice_d = document.getElementById('editQChoiceD').value;
    payload.correct_answer = document.getElementById('editQAnswerSelect').value;
  }

  const btn = document.getElementById('editQSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await apiFetch(`/admin/questions/${currentEditQuestionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    showToast('Question updated.');
    closeEditQuestionModal();
    await loadManageQuestions(currentManageTestId);
  } catch {
    showToast('Failed to save question.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

// ── Delete ────────────────────────────────────────────────────
async function deleteQuestion(questionId) {
  if (!confirm('Delete this question? This cannot be undone.')) return;
  try {
    await apiFetch(`/admin/questions/${questionId}`, { method: 'DELETE' });
    showToast('Question deleted.');
    await loadManageQuestions(currentManageTestId);
  } catch {
    showToast('Failed to delete question.', true);
  }
}

async function deleteCurrentTest() {
  if (!currentManageTestId) return;
  const sel = document.getElementById('manageTestSelect');
  const testName = sel.options[sel.selectedIndex]?.textContent || 'this test';
  if (!confirm(`Delete "${testName}"? This will also delete all of its questions and assignments. This cannot be undone.`)) return;

  const btn = document.getElementById('deleteTestBtn');
  btn.disabled = true;
  btn.textContent = 'Deleting…';

  try {
    await apiFetch(`/admin/tests/${currentManageTestId}`, { method: 'DELETE' });
    showToast('Test deleted.');
    currentManageTestId = null;
    currentManageQuestions = [];
    sel.value = '';
    renderManageQuestionsTable();
    await loadTests();
    populateManageTestDropdown();
    populateAssignDropdowns();
  } catch {
    showToast('Failed to delete test.', true);
  } finally {
    btn.disabled = !currentManageTestId;
    btn.textContent = 'Delete Test';
  }
}
