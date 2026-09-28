// ── Test drafts: review/edit an uploaded test before publishing ─────────────
// Backend (admin.py, all admin-only):
//   POST   /admin/test-drafts            multipart "file" → 201 DRAFT (400 {error} if unparseable)
//   GET    /admin/test-drafts            → [{ id, test_name, filename, question_count, created_at, updated_at }]
//   GET    /admin/test-drafts/:id        → DRAFT
//   PUT    /admin/test-drafts/:id        { test_name, questions } → DRAFT (saves as-is, no validation)
//   POST   /admin/test-drafts/:id/publish → 201 { test_id, test_name, questions_added }
//                                          422 { error, problems: [{ index, field, message }] }
//   DELETE /admin/test-drafts/:id        → { success }
// DRAFT = { id, test_name, filename, created_at, updated_at, questions: [...] }; questions are
// identified by array index and carry the same fields as a published Question.
// Every edit is saved straight away (PUT of the whole draft), so there is no separate
// "save" step to forget — Publish is the only thing that makes the test visible.

const DRAFT_MODULES = [
  'Section 1, Module 1: Reading and Writing',
  'Section 1, Module 2: Reading and Writing',
  'Section 2, Module 1: Math',
  'Section 2, Module 2: Math',
];

let allDrafts = [];
let draft = null;            // the draft open in the editor
let draftProblems = [];      // from the last failed publish
let draftSaveState = 'saved'; // 'saved' | 'saving' | 'error'
let draftPendingSaves = 0;
let draftSaveChain = Promise.resolve(true);
let draftEditIndex = null;   // index being edited, or null when adding

// ── API ─────────────────────────────────────────────────────────
// Unlike apiFetch, keeps the response body on errors (publish problems, parse errors).
async function draftFetch(path, options = {}) {
  const token = getToken();
  const isForm = options.body instanceof FormData;
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    const err = new Error((body && body.error) || `Server returned ${res.status}.`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// ── Drafts list ─────────────────────────────────────────────────
async function loadDrafts() {
  try {
    allDrafts = await draftFetch('/admin/test-drafts');
  } catch {
    allDrafts = null;
  }
  renderDraftsList();
}

function renderDraftsList() {
  const list = document.getElementById('draftsList');
  if (!list) return;
  if (allDrafts === null) {
    list.innerHTML = '<p class="drafts-empty">Couldn’t load drafts. Refresh the page to try again.</p>';
    return;
  }
  if (!allDrafts.length) {
    list.innerHTML = '<p class="drafts-empty">No drafts. Uploaded tests wait here for review until you publish them.</p>';
    return;
  }
  list.innerHTML = allDrafts.map(d => `
    <div class="draft-list-row${draft && draft.id === d.id ? ' draft-list-row-open' : ''}">
      <div class="draft-list-info">
        <div class="draft-list-name">${escHtml(d.test_name || 'Untitled test')}</div>
        <div class="draft-list-meta">${escHtml(d.filename || '')} · ${d.question_count} question${d.question_count === 1 ? '' : 's'} · edited ${formatDraftTime(d.updated_at)}</div>
      </div>
      <div class="draft-list-actions">
        <button type="button" class="row-action-btn" onclick="openDraft('${escHtml(d.id)}')">Review</button>
        <button type="button" class="row-action-btn row-action-danger" onclick="discardDraft('${escHtml(d.id)}')">Discard</button>
      </div>
    </div>`).join('');
}

function formatDraftTime(iso) {
  if (!iso) return '—';
  // The backend sends UTC timestamps without an offset; without the "Z" they'd be read as local time.
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : iso + 'Z');
  return isNaN(d) ? '—' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ── Open / close ────────────────────────────────────────────────
async function openDraft(id) {
  if (draft && draft.id === id) {
    document.getElementById('draftEditor').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  try {
    showDraftEditor(await draftFetch(`/admin/test-drafts/${encodeURIComponent(id)}`));
  } catch (err) {
    setUploadResult(err.message || 'Couldn’t open that draft.', 'error');
  }
}

function showDraftEditor(data) {
  draft = data;
  draft.questions = Array.isArray(draft.questions) ? draft.questions : [];
  draftProblems = [];
  draftSaveState = 'saved';
  document.getElementById('draftTestName').value = draft.test_name || '';
  document.getElementById('draftFileName').textContent = draft.filename || '';
  document.getElementById('draftEditor').hidden = false;
  renderDraftEditor();
  renderDraftsList();
  document.getElementById('draftEditor').scrollIntoView({ behavior: 'smooth' });
}

function closeDraftEditor() {
  if (draftSaveState !== 'saved' && !confirm('Some changes haven’t been saved yet. Close anyway?')) return;
  draft = null;
  draftProblems = [];
  document.getElementById('draftEditor').hidden = true;
  renderDraftsList();
}

// ── Editor rendering ────────────────────────────────────────────
function renderDraftEditor() {
  if (!draft) return;
  renderDraftSummary();
  renderDraftProblems();
  renderDraftTable();
  renderDraftSaveStatus();
}

function renderDraftSummary() {
  document.getElementById('draftModuleSummary').innerHTML = DRAFT_MODULES.map(subject => {
    const qs = draft.questions.filter(q => q.subject === subject);
    const explained = qs.filter(q => (q.explanation || '').trim()).length;
    return `<div class="draft-module-chip">
      <div class="draft-module-chip-label">${escHtml(SUBJECT_LABELS[subject])}</div>
      <div class="draft-module-chip-count">${qs.length} question${qs.length === 1 ? '' : 's'}</div>
      <div class="draft-module-chip-sub">${explained} with explanations</div>
    </div>`;
  }).join('');
}

function renderDraftProblems() {
  const box = document.getElementById('draftProblems');
  if (!draftProblems.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <div class="draft-problems-title">Fix ${draftProblems.length} problem${draftProblems.length === 1 ? '' : 's'} before publishing:</div>
    <ul>${draftProblems.map(p => {
      const where = p.index == null ? 'Test' : draftQuestionLabel(p.index);
      const action = p.index == null ? 'focusDraftName()' : `editDraftQuestion(${p.index})`;
      return `<li><button type="button" class="link-btn" onclick="${action}">${escHtml(where)}</button> — ${escHtml(p.message)}</li>`;
    }).join('')}</ul>`;
}

// "R&W · Module 1, Q3" — the question's position within its module, as students see it.
function draftQuestionLabel(index) {
  const q = draft.questions[index];
  if (!q) return `Question ${index + 1}`;
  const num = draft.questions.slice(0, index + 1).filter(qq => qq.subject === q.subject).length;
  return `${SUBJECT_LABELS[q.subject] || 'Unknown module'}, Q${num}`;
}

function renderDraftTable() {
  const tbody = document.getElementById('draftTableBody');
  const problemIndexes = new Set(draftProblems.filter(p => p.index != null).map(p => p.index));
  const groups = DRAFT_MODULES.map(subject => ({ subject, label: SUBJECT_LABELS[subject] }));
  // Questions whose module isn't one of the four still need to be visible (and fixable).
  if (draft.questions.some(q => !DRAFT_MODULES.includes(q.subject))) {
    groups.push({ subject: null, label: 'No module — pick one' });
  }

  tbody.innerHTML = groups.map(g => {
    const rows = draft.questions
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => g.subject ? q.subject === g.subject : !DRAFT_MODULES.includes(q.subject));
    const addBtn = g.subject
      ? `<button type="button" class="row-action-btn" onclick="addDraftQuestion('${escHtml(g.subject)}')">+ Add question</button>`
      : '';
    const header = `<tr class="draft-group-row"><td colspan="9">
        <span>${escHtml(g.label)}</span><span class="draft-group-count">${rows.length} question${rows.length === 1 ? '' : 's'}</span>${addBtn}
      </td></tr>`;
    const body = rows.length
      ? rows.map(({ q, i }, n) => draftRowHtml(q, i, n + 1, problemIndexes.has(i))).join('')
      : '<tr><td colspan="9" class="draft-group-empty">No questions in this module.</td></tr>';
    return header + body;
  }).join('');
}

function draftRowHtml(q, index, num, hasProblem) {
  const gridIn = isGridIn(q);
  const difficulty = (q.difficulty || '').toLowerCase();
  const diffBadge = difficulty
    ? `<span class="badge ${difficultyBadgeClass(difficulty)}">${capitalize(difficulty)}</span>`
    : '<span class="score-na">—</span>';
  const typeBadge = gridIn
    ? '<span class="badge badge-pending">Grid-In</span>'
    : '<span class="badge badge-active">MCQ</span>';
  const text = q.text || '';
  const preview = escHtml(text.length > 110 ? text.slice(0, 110) + '…' : text) || '<em class="score-na">No question text</em>';
  const image = q.image_url
    ? `<a href="${escHtml(q.image_url)}" target="_blank" rel="noopener"><img class="draft-thumb" src="${escHtml(q.image_url)}" alt="Question ${num} figure" loading="lazy"></a>`
    : '<span class="score-na">—</span>';
  const explanation = (q.explanation || '').trim()
    ? '<span class="badge badge-active">Yes</span>'
    : '<span class="badge badge-inactive">None</span>';
  return `<tr class="${hasProblem ? 'draft-row-problem' : ''}">
    <td>${num}</td>
    <td class="draft-q-cell">${preview}</td>
    <td>${diffBadge}</td>
    <td>${typeBadge}</td>
    <td>${escHtml(q.correct_answer || '—')}</td>
    <td>${image}</td>
    <td>${explanation}</td>
    <td class="draft-row-actions">
      <button type="button" class="row-action-btn" onclick="editDraftQuestion(${index})">Edit</button>
      <button type="button" class="row-action-btn row-action-danger" onclick="removeDraftQuestion(${index})">Remove</button>
    </td>
  </tr>`;
}

function renderDraftSaveStatus() {
  const el = document.getElementById('draftSaveStatus');
  const text = { saved: 'All changes saved', saving: 'Saving…', error: 'Couldn’t save changes' }[draftSaveState];
  el.textContent = text;
  el.className = 'draft-save-status draft-save-' + draftSaveState;
  document.getElementById('draftRetrySaveBtn').hidden = draftSaveState !== 'error';
}

function focusDraftName() {
  const input = document.getElementById('draftTestName');
  input.focus();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Saving ──────────────────────────────────────────────────────
// Saves run one at a time in order, each sending the draft as it is when that save
// starts, so the server always ends up with the newest version. The returned promise
// settles once this save (and every earlier one) is done — publish waits on it.
function saveDraft() {
  if (!draft) return Promise.resolve(false);
  const id = draft.id;
  draftPendingSaves++;
  draftSaveState = 'saving';
  renderDraftSaveStatus();

  const run = async () => {
    if (!draft || draft.id !== id) return false; // editor closed or switched meanwhile
    try {
      const saved = await draftFetch(`/admin/test-drafts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ test_name: draft.test_name, questions: draft.questions }),
      });
      if (draft && draft.id === id && saved) draft.updated_at = saved.updated_at;
      return true;
    } catch {
      return false;
    }
  };
  draftSaveChain = draftSaveChain.then(run, run).then(ok => {
    draftPendingSaves--;
    if (draft && draft.id === id) {
      // A later successful save sends the full draft, so it clears an earlier failure.
      if (!ok) draftSaveState = 'error';
      else if (draftPendingSaves === 0) draftSaveState = 'saved';
      renderDraftSaveStatus();
    }
    return ok;
  });
  return draftSaveChain;
}

function onDraftNameChange() {
  if (!draft) return;
  const name = document.getElementById('draftTestName').value.trim();
  if (name === (draft.test_name || '')) return;
  draft.test_name = name;
  draftProblems = draftProblems.filter(p => p.index != null);
  renderDraftProblems();
  saveDraft().then(loadDrafts);
}

window.addEventListener('beforeunload', e => {
  if (draft && draftSaveState !== 'saved') {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── Question edit modal ─────────────────────────────────────────
function editDraftQuestion(index) {
  const q = draft && draft.questions[index];
  if (!q) return;
  draftEditIndex = index;
  fillDraftQuestionForm(q, 'Edit ' + draftQuestionLabel(index));
}

function addDraftQuestion(subject) {
  draftEditIndex = null;
  fillDraftQuestionForm({ subject, difficulty: 'medium' }, 'Add question — ' + SUBJECT_LABELS[subject]);
}

function fillDraftQuestionForm(q, title) {
  document.getElementById('draftQuestionModalTitle').textContent = title;
  const set = (id, v) => { document.getElementById(id).value = v || ''; };
  set('draftQText', q.text);
  set('draftQPassage', q.passage);
  set('draftQChoiceA', q.choice_a);
  set('draftQChoiceB', q.choice_b);
  set('draftQChoiceC', q.choice_c);
  set('draftQChoiceD', q.choice_d);
  set('draftQExplanation', q.explanation);
  set('draftQSkill', q.skill);
  set('draftQImageUrl', q.image_url);
  document.getElementById('draftQSubject').value = DRAFT_MODULES.includes(q.subject) ? q.subject : '';
  document.getElementById('draftQDifficulty').value = (q.difficulty || '').toLowerCase();

  const isNew = draftEditIndex === null;
  const gridIn = !isNew && isGridIn(q);
  setDraftQuestionType(gridIn ? 'gridin' : 'mcq');
  const answer = (q.correct_answer || '').trim();
  if (gridIn) {
    set('draftQAnswerText', answer);
  } else {
    document.getElementById('draftQAnswerSelect').value = ['A', 'B', 'C', 'D'].includes(answer.toUpperCase()) ? answer.toUpperCase() : '';
  }
  updateDraftImagePreview();

  const problems = isNew ? [] : draftProblems.filter(p => p.index === draftEditIndex);
  const box = document.getElementById('draftQProblems');
  box.hidden = !problems.length;
  box.innerHTML = problems.map(p => `<div>${escHtml(p.message)}</div>`).join('');

  document.getElementById('draftQuestionModal').classList.remove('hidden');
  document.getElementById('draftQText').focus();
}

function setDraftQuestionType(type) {
  document.querySelectorAll('#draftQuestionForm .assign-toggle-btn').forEach(btn => {
    btn.classList.toggle('assign-toggle-active', btn.dataset.qtype === type);
  });
  const gridIn = type === 'gridin';
  document.getElementById('draftQChoicesGroup').hidden = gridIn;
  document.getElementById('draftQAnswerMcqGroup').hidden = gridIn;
  document.getElementById('draftQAnswerTextGroup').hidden = !gridIn;
}

function updateDraftImagePreview() {
  const url = document.getElementById('draftQImageUrl').value.trim();
  const img = document.getElementById('draftQImagePreview');
  img.hidden = !url;
  if (url) img.src = url; else img.removeAttribute('src');
}

function closeDraftQuestionModal() {
  document.getElementById('draftQuestionModal').classList.add('hidden');
  draftEditIndex = null;
}

document.addEventListener('click', e => {
  if (e.target === document.getElementById('draftQuestionModal')) closeDraftQuestionModal();
});

function submitDraftQuestion(e) {
  e.preventDefault();
  if (!draft) return;
  const val = id => document.getElementById(id).value.trim();
  const gridIn = document.getElementById('draftQChoicesGroup').hidden;
  const existing = draftEditIndex === null ? {} : draft.questions[draftEditIndex];

  const q = {
    ...existing, // keeps fields the form doesn't show (e.g. module_variant)
    text:        val('draftQText'),
    passage:     val('draftQPassage') || null,
    choice_a:    gridIn ? '' : document.getElementById('draftQChoiceA').value.trim(),
    choice_b:    gridIn ? '' : document.getElementById('draftQChoiceB').value.trim(),
    choice_c:    gridIn ? '' : document.getElementById('draftQChoiceC').value.trim(),
    choice_d:    gridIn ? '' : document.getElementById('draftQChoiceD').value.trim(),
    correct_answer: gridIn ? val('draftQAnswerText') : document.getElementById('draftQAnswerSelect').value,
    explanation: val('draftQExplanation') || null,
    subject:     document.getElementById('draftQSubject').value || null,
    difficulty:  document.getElementById('draftQDifficulty').value || null,
    skill:       val('draftQSkill') || null,
    image_url:   val('draftQImageUrl') || null,
  };

  if (draftEditIndex === null) {
    // New questions go after the last question of their module, keeping modules contiguous.
    let at = -1;
    draft.questions.forEach((qq, i) => { if (qq.subject === q.subject) at = i; });
    draft.questions.splice(at === -1 ? draft.questions.length : at + 1, 0, q);
    draftProblems = []; // indexes shifted; the next publish attempt re-checks everything
  } else {
    draft.questions[draftEditIndex] = q;
    draftProblems = draftProblems.filter(p => p.index !== draftEditIndex);
  }
  closeDraftQuestionModal();
  renderDraftEditor();
  saveDraft().then(loadDrafts);
}

function removeDraftQuestion(index) {
  if (!draft || !draft.questions[index]) return;
  if (!confirm(`Remove ${draftQuestionLabel(index)} from this draft?`)) return;
  draft.questions.splice(index, 1);
  draftProblems = [];
  renderDraftEditor();
  saveDraft().then(loadDrafts);
}

// ── Publish / discard ───────────────────────────────────────────
async function publishDraft() {
  if (!draft) return;
  onDraftNameChange(); // pick up a name typed without leaving the field
  const btn = document.getElementById('draftPublishBtn');
  btn.disabled = true;
  btn.textContent = 'Publishing…';
  try {
    if (!(await saveDraft())) throw new Error('Couldn’t save your latest changes, so the draft wasn’t published. Try again.');
    const res = await draftFetch(`/admin/test-drafts/${encodeURIComponent(draft.id)}/publish`, { method: 'POST' });
    const count = res.questions_added;
    draft = null;
    draftProblems = [];
    document.getElementById('draftEditor').hidden = true;
    setUploadResult(`"${res.test_name}" published — ${count} question${count === 1 ? '' : 's'} added. You can find it under Manage Tests.`, 'success');
    document.getElementById('uploadResult').scrollIntoView({ behavior: 'smooth', block: 'center' });
    await Promise.all([loadDrafts(), loadTests()]);
    populateManageTestDropdown();
    populateAssignDropdowns();
  } catch (err) {
    if (err.status === 422 && err.body && Array.isArray(err.body.problems)) {
      draftProblems = err.body.problems;
      renderDraftEditor();
      document.getElementById('draftProblems').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      draftProblems = [];
      renderDraftProblems();
      alertDraft(err.message || 'Publishing failed. Try again.');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish Test';
  }
}

// Non-validation failures (network, 500) shown above the table.
function alertDraft(message) {
  const box = document.getElementById('draftProblems');
  box.hidden = false;
  box.innerHTML = `<div class="draft-problems-title">${escHtml(message)}</div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function discardDraft(id) {
  const target = id || (draft && draft.id);
  if (!target) return;
  const d = (allDrafts || []).find(x => x.id === target) || draft;
  const name = (d && d.test_name) || 'this draft';
  if (!confirm(`Discard "${name}"? The uploaded questions will be deleted. This can’t be undone.`)) return;
  try {
    await draftFetch(`/admin/test-drafts/${encodeURIComponent(target)}`, { method: 'DELETE' });
    if (draft && draft.id === target) {
      draft = null;
      draftProblems = [];
      draftSaveState = 'saved';
      document.getElementById('draftEditor').hidden = true;
    }
  } catch (err) {
    setUploadResult(err.message || 'Couldn’t discard that draft.', 'error');
  }
  await loadDrafts();
}

document.addEventListener('DOMContentLoaded', loadDrafts);
