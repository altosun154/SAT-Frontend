/* ============================================================
   admin-import.js — Question bank import / review modal.

   Stage machine:
     upload   → user picks a file
     parsing  → POST in flight
     failed   → server error or network error
     summary  → review/edit meta + warnings list
     question → review/edit individual question

   Mode:
     review   → new import (pending_review draft)
     edit     → existing committed bank

   Entry points (called from admin-question-banks.js):
     openImportModalForUpload()          — Import button
     openImportModal(parseResult, mode)  — row click / post-parse
     _setParsingStage(filename)          — called by startImportFile
   ============================================================ */

// ── Validation ─────────────────────────────────────────────────

var ALLOWED_EXTS = ['.docx', '.pdf'];
var MAX_BYTES    = 10 * 1024 * 1024; // 10 MB

function validateFile(file) {
  var ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (ext === '.doc')
    return "Old .doc files aren't supported. Open in Word and save as .docx.";
  if (!ALLOWED_EXTS.includes(ext))
    return "Can't import " + ext + " files. Use .docx or .pdf.";
  if (file.size > MAX_BYTES)
    return 'That file is ' + (file.size / 1048576).toFixed(1) + ' MB. Limit is 10 MB.';
  return null;
}

// ── State ──────────────────────────────────────────────────────

var importState = {
  parseId:     null,
  meta:        {},
  questions:   [],
  warnings:    [],
  stage:       'upload',  // 'upload'|'parsing'|'failed'|'summary'|'question'
  mode:        'review',  // 'review'|'edit'
  index:       0,
  reviewed:    new Set(),
  dirty:       false,
  notes:       '',
  filename:    '',
  parseError:  '',
  duplicateOf: null,
  _file:       null,      // selected file in upload stage
  _fileError:  null,      // validation error in upload stage
  _pendingFile: null,     // file being parsed (kept for retry)
  _saving:     false,     // true while saveEdits fetch is in-flight
};

// ── Entry points ───────────────────────────────────────────────

function openImportModalForUpload() {
  Object.assign(importState, {
    parseId: null, meta: {}, questions: [], warnings: [],
    stage: 'upload', mode: 'review',
    index: 0, reviewed: new Set(), dirty: false,
    notes: '', filename: '', parseError: '', duplicateOf: null,
    _file: null, _fileError: null, _pendingFile: null,
  });
  _showImportModal();
}

function openImportModal(parseResult, mode) {
  Object.assign(importState, {
    parseId:     parseResult.parse_id || null,
    meta:        parseResult.meta || {},
    questions:   parseResult.questions || [],
    warnings:    parseResult.warnings || [],
    stage:       parseResult._stage || 'summary',
    mode:        mode || 'review',
    index:       0,
    reviewed:    new Set(),
    dirty:       false,
    notes:       parseResult._notes || '',
    filename:    parseResult._filename || '',
    parseError:  parseResult._error || '',
    duplicateOf: parseResult.duplicate_of || null,
    _file:       null,
    _fileError:  null,
    _pendingFile: null,
  });
  _showImportModal();
}

// Called by startImportFile to transition from upload → parsing
function _setParsingStage(filename) {
  importState.stage    = 'parsing';
  importState.filename = filename;
  if (!document.getElementById('importModal').classList.contains('hidden')) {
    render();
  } else {
    Object.assign(importState, {
      parseId: null, meta: {}, questions: [], warnings: [],
      mode: 'review', index: 0, reviewed: new Set(), dirty: false,
      notes: '', parseError: '', duplicateOf: null,
      _file: null, _fileError: null,
    });
    _showImportModal();
  }
}

function _showImportModal() {
  document.getElementById('importModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  window._importUnloadGuard = function(e) {
    if (importState.dirty) { e.preventDefault(); e.returnValue = ''; }
  };
  window.addEventListener('beforeunload', window._importUnloadGuard);
  render();
}

function closeImportModal() {
  var isParsing = importState.stage === 'parsing';
  if (!isParsing && !importState._saving && importState.dirty && !confirm('You have unsaved changes. Close anyway?')) return;
  document.getElementById('importModal').classList.add('hidden');
  document.body.style.overflow = '';
  window.removeEventListener('beforeunload', window._importUnloadGuard);
  clearTimeout(window._importAutosaveTimer);
  clearTimeout(window._importNotesSaveTimer);
  if (isParsing && typeof loadQuestionBanks === 'function') {
    loadQuestionBanks();
  }
}

// ── Main render ────────────────────────────────────────────────

function render() {
  var body   = document.getElementById('importModalBody');
  var footer = document.getElementById('importModalFooter');
  var title  = document.getElementById('importModalTitle');
  var badge  = document.getElementById('importModalBadge');
  if (!body) return;

  if (badge) badge.innerHTML = '';

  switch (importState.stage) {
    case 'upload':
      title.textContent = 'Import Questions';
      _renderUpload(body, footer);
      break;

    case 'parsing':
      title.textContent = 'Parsing…';
      _renderParsing(body, footer);
      break;

    case 'failed':
      title.textContent = 'Import Failed';
      _renderFailed(body, footer);
      break;

    case 'summary':
      title.textContent = importState.mode === 'edit' ? 'Question Bank' : 'Review Import';
      if (badge) badge.innerHTML = importState.mode === 'edit'
        ? '<span class="bank-status-badge bank-status-committed">Committed</span>'
        : '<span class="bank-status-badge bank-status-pending">Pending review</span>';
      renderSummary(body);
      _renderSummaryFooter(footer);
      break;

    case 'question':
      title.textContent = 'Question ' + (importState.index + 1) + ' of ' + importState.questions.length;
      if (badge) badge.innerHTML = importState.mode === 'edit'
        ? '<span class="bank-status-badge bank-status-committed">Committed</span>'
        : '<span class="bank-status-badge bank-status-pending">Pending review</span>';
      var q      = importState.questions[importState.index];
      var qWarns = importState.warnings.filter(function(w) {
        return w.question_number === (q && q.number);
      });
      renderQuestion(body, q, qWarns);
      _renderQuestionFooter(footer);
      break;
  }
}

// ── Upload stage ───────────────────────────────────────────────

function _renderUpload(body, footer) {
  var filenameHtml = importState.filename && !importState._fileError
    ? '<p class="dropzone-filename">' + escHtml(importState.filename) + '</p>'
    : '';
  var errorHtml = importState._fileError
    ? '<div class="upload-error">' + escHtml(importState._fileError) + '</div>'
    : '';

  body.innerHTML =
    '<div class="upload-stage">' +
      '<div class="dropzone" id="dropzone" role="button" tabindex="0" aria-label="Select a file to import">' +
        '<svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
          '<polyline points="14 2 14 8 20 8"/>' +
          '<line x1="12" y1="18" x2="12" y2="12"/>' +
          '<line x1="9" y1="15" x2="15" y2="15"/>' +
        '</svg>' +
        '<p class="dropzone-title">Click to select a file or drag one here</p>' +
        '<p class="dropzone-hint">Word (.docx) or PDF (.pdf) · up to 10 MB</p>' +
        filenameHtml +
      '</div>' +
      errorHtml +
    '</div>';

  var canParse = !!(importState._file && !importState._fileError);
  footer.innerHTML =
    '<div></div>' +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn btn-outline" data-action="close">Cancel</button>' +
      '<button class="btn btn-primary" data-action="parse-review"' + (canParse ? '' : ' disabled') + '>Parse &amp; Review</button>' +
    '</div>';

  var dropzone = document.getElementById('dropzone');
  if (!dropzone) return;

  dropzone.addEventListener('click', function() {
    document.getElementById('importFile').click();
  });
  dropzone.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('importFile').click(); }
  });
  dropzone.addEventListener('dragover', function(e) {
    e.preventDefault(); dropzone.classList.add('dropzone-drag-over');
  });
  dropzone.addEventListener('dragleave', function(e) {
    if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('dropzone-drag-over');
  });
  dropzone.addEventListener('drop', function(e) {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.remove('dropzone-drag-over');
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    var err = validateFile(file);
    importState._file      = err ? null : file;
    importState._fileError = err || null;
    importState.filename   = file.name;
    render();
  });
}

// ── Parsing stage ──────────────────────────────────────────────

function _renderParsing(body, footer) {
  body.innerHTML =
    '<div class="parsing-stage" aria-live="polite">' +
      '<div class="parsing-spinner"></div>' +
      '<p class="parsing-filename">' + escHtml(importState.filename) + '</p>' +
      '<p class="parsing-label">Parsing your file, this may take a moment…</p>' +
    '</div>';
  footer.innerHTML =
    '<div></div>' +
    '<button class="btn btn-outline" data-action="close">Cancel</button>';
}

// ── Failed stage ───────────────────────────────────────────────

function _renderFailed(body, footer) {
  body.innerHTML =
    '<div class="failed-stage">' +
      '<div class="failed-icon">✕</div>' +
      '<p class="failed-filename">' + escHtml(importState.filename) + '</p>' +
      '<p class="failed-error">' + escHtml(importState.parseError || 'Parse failed') + '</p>' +
    '</div>';
  footer.innerHTML =
    '<div></div>' +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn btn-outline" data-action="close">Cancel</button>' +
      '<button class="btn btn-outline" data-action="try-another">Try another file</button>' +
      (importState._pendingFile ? '<button class="btn btn-primary" data-action="retry">Retry</button>' : '') +
    '</div>';
}

// ── Summary stage ──────────────────────────────────────────────

function renderSummary(body) {
  var noQuestions = importState.questions.length === 0;
  var blocking = importState.warnings.filter(function(w) { return w.severity === 'blocking'; });
  var warnings = importState.warnings.filter(function(w) { return w.severity === 'warning'; });
  var infos    = importState.warnings.filter(function(w) { return w.severity === 'info'; });
  var statusColor = noQuestions ? '#b91c1c' : blocking.length ? '#b91c1c' : warnings.length ? '#d97706' : infos.length ? '#1d4ed8' : '#166534';
  var statusBg    = noQuestions ? '#fef2f2' : blocking.length ? '#fef2f2' : warnings.length ? '#fffbeb' : infos.length ? '#eff6ff' : '#f0fdf4';
  var statusText  = noQuestions
    ? 'No questions found — the file may be empty or in an unsupported format'
    : blocking.length
    ? blocking.length + ' blocking issue' + (blocking.length > 1 ? 's' : '') + ' — must fix before committing'
    : warnings.length
    ? warnings.length + ' warning' + (warnings.length > 1 ? 's' : '') + ' — review recommended'
    : infos.length
    ? infos.length + ' notice' + (infos.length > 1 ? 's' : '') + ' — no action required, but worth reviewing'
    : 'All checks passed — ready to commit';

  var duplicateBanner = importState.duplicateOf
    ? '<div class="import-status-banner" style="background:#fffbeb;border-color:#d97706;color:#92400e;margin-bottom:12px">' +
        '⚠ Similar content detected — this may overlap with an existing bank.' +
      '</div>'
    : '';

  body.innerHTML =
    '<div class="import-summary">' +

    '<div class="import-meta-row">' +
      '<div class="import-field" style="flex:2;min-width:180px"><label class="import-field-label">Name</label>' +
        '<input id="metaName" class="assign-input" value="" placeholder="' +
          escHtml(importState.meta.name || importState.filename || 'Bank name…') + '" /></div>' +
      '<div class="import-field"><label class="import-field-label">Subject</label>' +
        '<select id="metaSubject" class="filter-select">' +
          '<option value="">— select —</option>' +
          '<option value="Math"' + (importState.meta.subject === 'Math' ? ' selected' : '') + '>Math</option>' +
          '<option value="Reading &amp; Writing"' + (importState.meta.subject === 'Reading & Writing' ? ' selected' : '') + '>Reading &amp; Writing</option>' +
        '</select></div>' +
      '<div class="import-field"><label class="import-field-label">Topic</label>' +
        '<input id="metaTopic" class="assign-input" value="' + escHtml(importState.meta.topic || '') + '" placeholder="e.g. Algebra" /></div>' +
      '<div class="import-field"><label class="import-field-label">Skill</label>' +
        '<input id="metaSkill" class="assign-input" value="' + escHtml(importState.meta.skill || '') + '" placeholder="e.g. Linear Equations" /></div>' +
      '<div class="import-field">' +
        '<label class="import-field-label">Questions</label>' +
        '<div class="import-stat-val">' + importState.questions.length + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="import-field" style="margin-bottom:16px">' +
      '<label class="import-field-label" for="bankNotes">Notes</label>' +
      '<textarea id="bankNotes" class="import-q-edit-area" rows="3" placeholder="Add internal notes about this question bank…">' + escHtml(importState.notes) + '</textarea>' +
    '</div>' +

    duplicateBanner +

    '<div class="import-status-banner" style="background:' + statusBg + ';border-color:' + statusColor + ';color:' + statusColor + '">' +
      statusText +
    '</div>' +

    (importState.warnings.length > 0
      ? '<div class="import-warnings-list">' +
          '<p class="import-section-label">Warnings — click a row to go to that question</p>' +
          importState.warnings.map(function(w) {
            var qi = w.question_number != null ? getQuestionIndex(w.question_number) : -1;
            var clickable = qi >= 0
              ? ' data-action="jump-to-q" data-value="' + qi + '" style="cursor:pointer" title="Go to Question ' + w.question_number + '"'
              : '';
            return '<div class="import-warn-item import-warn-' + w.severity + '"' + clickable + '>' +
              (qi >= 0 ? '<span class="import-warn-jump">Q' + w.question_number + '</span>' : '') +
              '<span class="import-warn-code">' + escHtml(w.code) + '</span>' +
              '<span class="import-warn-msg">' + escHtml(w.message) + '</span>' +
            '</div>';
          }).join('') +
        '</div>'
      : '') +

    '</div>';

  document.getElementById('metaName').addEventListener('input', function() {
    importState.meta.name = this.value; importState.dirty = true; scheduleAutosave();
  });
  document.getElementById('metaSubject').addEventListener('change', function() {
    importState.meta.subject = this.value; importState.dirty = true; scheduleAutosave();
  });
  document.getElementById('metaTopic').addEventListener('input', function() {
    importState.meta.topic = this.value; importState.dirty = true; scheduleAutosave();
  });
  document.getElementById('metaSkill').addEventListener('input', function() {
    importState.meta.skill = this.value; importState.dirty = true; scheduleAutosave();
  });
  var notesEl = document.getElementById('bankNotes');
  if (notesEl) {
    notesEl.addEventListener('input', function() {
      importState.notes = this.value; scheduleNotesSave();
    });
  }
}

function _renderSummaryFooter(footer) {
  var total         = importState.questions.length;
  var reviewed      = importState.reviewed.size;
  var blockingCount = importState.warnings.filter(function(w) { return w.severity === 'blocking'; }).length;
  var canCommit     = blockingCount === 0 && total > 0;

  var reviewBtn = total > 0 ? '<button class="btn btn-outline" data-action="start-review">Review Questions →</button>' : '';

  if (importState.mode === 'review') {
    footer.innerHTML =
      '<span class="import-progress-lbl">' + reviewed + ' / ' + total + ' reviewed</span>' +
      '<div style="display:flex;gap:10px">' +
        '<button class="btn btn-outline" data-action="close">Cancel</button>' +
        reviewBtn +
        '<button class="btn btn-primary" data-action="commit"' +
          (canCommit ? '' : ' disabled title="Resolve blocking warnings first"') + '>' +
          (canCommit ? 'Commit Import' : 'Fix Warnings (' + blockingCount + ')') +
        '</button>' +
      '</div>';
  } else {
    footer.innerHTML =
      '<div></div>' +
      '<div style="display:flex;gap:10px">' +
        '<button class="btn btn-outline" data-action="close">Cancel</button>' +
        reviewBtn +
        '<button class="btn btn-primary" data-action="save-edits" id="saveEditsBtn">Save Changes</button>' +
      '</div>';
  }
}

// ── Question stage ─────────────────────────────────────────────

function renderQuestion(body, q, qWarns) {
  if (!q) {
    body.innerHTML = '<p style="padding:24px;color:#aaa">No question data.</p>';
    return;
  }

  importState.reviewed.add(importState.index);

  var isGridIn   = !!q.is_grid_in;
  var letters    = ['A', 'B', 'C', 'D'];
  var choiceKeys = ['choice_a', 'choice_b', 'choice_c', 'choice_d'];
  var currentAnswer = q.correct_answer || '';

  var choicesSection = isGridIn
    ? '<div class="import-q-section">' +
        '<div class="import-field-label" style="margin-bottom:8px">Choices</div>' +
        '<div style="font-size:0.85rem;color:#9ca3af;font-style:italic;padding:8px 0">Grid-in question — no multiple choice options</div>' +
      '</div>'
    : '<div class="import-q-section">' +
        '<div class="import-field-label" style="margin-bottom:8px">Choices</div>' +
        letters.map(function(l, i) {
          var isCorrect = currentAnswer === l;
          return '<div class="import-choice-edit' + (isCorrect ? ' import-choice-correct' : '') + '" id="choiceRow' + l + '">' +
            '<span class="choice-letter">' + l + '</span>' +
            '<input id="qChoice' + l + '" class="import-q-edit-input" value="' + escHtml(q[choiceKeys[i]] || '') + '" placeholder="Choice ' + l + '…" />' +
          '</div>';
        }).join('') +
      '</div>';

  var answerSection = isGridIn
    ? '<div class="import-q-section">' +
        '<label class="import-field-label" style="margin-bottom:6px">Correct Answer <span style="font-size:0.75rem;color:#6b7280;font-weight:400">(numeric)</span></label>' +
        '<input id="qAnswerInput" class="import-q-edit-input" style="max-width:180px" value="' + escHtml(currentAnswer) + '" placeholder="e.g. 6 or 3/4" />' +
      '</div>'
    : '<div class="import-q-section">' +
        '<label class="import-field-label" style="margin-bottom:6px">Correct Answer</label>' +
        '<select id="qAnswerSel" class="filter-select" style="max-width:120px">' +
          '<option value="">-- select --</option>' +
          letters.map(function(l) {
            return '<option value="' + l + '"' + (currentAnswer === l ? ' selected' : '') + '>' + l + '</option>';
          }).join('') +
        '</select>' +
      '</div>';

  var imageSection = q.image_url
    ? '<div class="import-q-section">' +
        '<div class="import-field-label" style="margin-bottom:6px">Image</div>' +
        '<img src="' + escHtml(q.image_url) + '" alt="Question image" style="max-width:100%;max-height:220px;border-radius:6px;border:1px solid #e5e7eb;display:block;margin-bottom:4px" />' +
        '<a href="' + escHtml(q.image_url) + '" target="_blank" rel="noopener" style="font-size:0.8rem;color:#3b82f6">Open full image ↗</a>' +
      '</div>'
    : '';

  body.innerHTML =
    '<div class="import-q-layout">' +
    '<div class="import-q-main">' +

    (qWarns.length
      ? '<div class="import-q-warn-bar">' +
          qWarns.map(function(w) {
            return '<span class="import-warn-badge import-warn-' + w.severity + '">' +
              escHtml(w.code) + ': ' + escHtml(w.message) + '</span>';
          }).join('') +
        '</div>'
      : '') +

    '<div class="import-q-num">Question ' + q.number + (isGridIn ? ' <span style="font-size:0.75rem;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:4px;padding:2px 6px;vertical-align:middle">Grid-in</span>' : '') + '</div>' +

    imageSection +

    '<div class="import-q-section">' +
      '<label class="import-field-label" style="margin-bottom:6px">Stem</label>' +
      '<textarea id="qStem" class="import-q-edit-area" rows="5" placeholder="Question text…">' + escHtml(q.text || '') + '</textarea>' +
    '</div>' +

    choicesSection +
    answerSection +

    '<div class="import-q-section">' +
      '<label class="import-field-label" style="margin-bottom:6px">Explanation</label>' +
      '<textarea id="qExpl" class="import-q-edit-area" rows="4" placeholder="Add an explanation…">' + escHtml(q.explanation || '') + '</textarea>' +
    '</div>' +

    (q.difficulty
      ? '<div class="import-q-section">' +
          '<div class="import-field-label" style="margin-bottom:6px">Difficulty</div>' +
          '<div style="font-size:0.9rem;text-transform:capitalize">' + escHtml(q.difficulty) + '</div>' +
        '</div>'
      : '') +

    '</div>' +
    '</div>';

  document.getElementById('qStem').addEventListener('input', function() {
    importState.questions[importState.index].text = this.value;
    importState.dirty = true; scheduleAutosave();
  });

  if (isGridIn) {
    document.getElementById('qAnswerInput').addEventListener('input', function() {
      importState.questions[importState.index].correct_answer = this.value;
      importState.dirty = true; scheduleAutosave();
    });
  } else {
    letters.forEach(function(l, i) {
      document.getElementById('qChoice' + l).addEventListener('input', function() {
        importState.questions[importState.index][choiceKeys[i]] = this.value;
        importState.dirty = true; scheduleAutosave();
      });
    });
    document.getElementById('qAnswerSel').addEventListener('change', function() {
      importState.questions[importState.index].correct_answer = this.value;
      importState.dirty = true; scheduleAutosave();
      var newAnswer = this.value;
      letters.forEach(function(l) {
        document.getElementById('choiceRow' + l).classList.toggle('import-choice-correct', l === newAnswer);
      });
    });
  }

  document.getElementById('qExpl').addEventListener('input', function() {
    importState.questions[importState.index].explanation = this.value;
    importState.dirty = true; scheduleAutosave();
  });
}

function _renderQuestionFooter(footer) {
  var total    = importState.questions.length;
  var reviewed = importState.reviewed.size;
  var nextWarn = findNextWarningIndex();

  var primaryBtn;
  if (importState.mode === 'review') {
    var blockingCount = importState.warnings.filter(function(w) { return w.severity === 'blocking'; }).length;
    var canCommit = blockingCount === 0 && importState.questions.length > 0;
    primaryBtn = '<button class="btn btn-primary" data-action="commit"' + (canCommit ? '' : ' disabled') + '>' +
      (canCommit ? 'Commit Import' : 'Fix Warnings (' + blockingCount + ')') + '</button>';
  } else {
    primaryBtn = '<button class="btn btn-primary" data-action="save-edits" id="saveEditsBtn">Save Changes</button>';
  }

  footer.innerHTML =
    '<button class="btn btn-outline" data-action="prev"' + (importState.index === 0 ? ' disabled' : '') + '>← Prev</button>' +
    '<div style="display:flex;gap:8px;align-items:center">' +
      (importState.mode === 'review' ? '<span class="import-progress-lbl">' + reviewed + ' / ' + total + ' reviewed</span>' : '') +
      (nextWarn !== -1 ? '<button class="btn btn-outline" data-action="jump-warning" data-value="' + nextWarn + '">Next Warning ⚠</button>' : '') +
      '<button class="btn btn-outline" data-action="summary">← Summary</button>' +
      primaryBtn +
    '</div>' +
    '<button class="btn btn-outline" data-action="next"' + (importState.index >= total - 1 ? ' disabled' : '') + '>Next →</button>';
}

// ── Navigation helpers ─────────────────────────────────────────

function findNextWarningIndex() {
  var total = importState.questions.length;
  for (var pass = 0; pass < 2; pass++) {
    var start = pass === 0 ? importState.index + 1 : 0;
    var end   = pass === 0 ? total : importState.index + 1;
    for (var i = start; i < end; i++) {
      var num = importState.questions[i] && importState.questions[i].number;
      if (importState.warnings.some(function(w) { return w.question_number === num && w.severity !== 'info'; })) {
        return i;
      }
    }
  }
  return -1;
}

function getQuestionIndex(num) {
  return importState.questions.findIndex(function(q) { return q.number === num; });
}

// ── Autosave ───────────────────────────────────────────────────

function scheduleAutosave() {
  clearTimeout(window._importAutosaveTimer);
  window._importAutosaveTimer = setTimeout(doAutosave, 2000);
}

async function doAutosave() {
  if (!importState.parseId || !importState.dirty) return;
  try {
    var token = getToken();
    await fetch(API_BASE + '/api/parse/' + importState.parseId, {
      method:  'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body:    JSON.stringify({ parse_id: importState.parseId, meta: importState.meta, questions: importState.questions }),
    });
    importState.dirty = false;
  } catch (_) {}
}

function scheduleNotesSave() {
  clearTimeout(window._importNotesSaveTimer);
  window._importNotesSaveTimer = setTimeout(doNotesSave, 1500);
}

async function doNotesSave() {
  if (!importState.parseId) return;
  try {
    await fetch(API_BASE + '/api/parse/' + importState.parseId + '/notes', {
      method:  'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, { Authorization: 'Bearer ' + getToken() }),
      body:    JSON.stringify({ notes: importState.notes }),
    });
  } catch (_) {}
}

async function saveEdits(btn) {
  if (!importState.parseId) return;
  var orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'Saving…';
  importState._saving = true;
  clearTimeout(window._importAutosaveTimer);
  clearTimeout(window._importNotesSaveTimer);
  try {
    var token = getToken();
    var r1 = await fetch(API_BASE + '/api/parse/' + importState.parseId, {
      method:  'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body:    JSON.stringify({ parse_id: importState.parseId, meta: importState.meta, questions: importState.questions }),
    });
    if (!r1.ok) throw new Error('Save failed (' + r1.status + ')');
    await fetch(API_BASE + '/api/parse/' + importState.parseId + '/notes', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body:    JSON.stringify({ notes: importState.notes }),
    });
    importState.dirty = false;
    importState._saving = false;
    btn.textContent = 'Saved ✓';
    btn.style.background = '#16a34a';
    if (typeof loadQuestionBanks === 'function') loadQuestionBanks();
    setTimeout(function() {
      closeImportModal();
      if (typeof _showBankToast === 'function') {
        _showBankToast('"' + escHtml(importState.filename) + '" saved.');
      }
    }, 1400);
  } catch (err) {
    importState._saving = false;
    btn.textContent = orig;
    btn.disabled = false;
    var errBanner = document.getElementById('saveErrorBanner');
    if (!errBanner) {
      var footer = document.getElementById('importModalFooter');
      errBanner = document.createElement('div');
      errBanner.id = 'saveErrorBanner';
      errBanner.style.cssText = 'color:#b91c1c;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:8px 12px;font-size:0.85rem;margin-bottom:8px;text-align:center';
      footer.parentNode.insertBefore(errBanner, footer);
    }
    errBanner.textContent = 'Save failed — ' + (err.message || 'check your connection and try again');
    setTimeout(function() { if (errBanner.parentNode) errBanner.parentNode.removeChild(errBanner); }, 4000);
  }
}

// ── Commit ─────────────────────────────────────────────────────

async function commitImport() {
  await doAutosave();

  var commitBtns = document.querySelectorAll('[data-action="commit"]');
  commitBtns.forEach(function(b) { b.disabled = true; b.textContent = 'Committing…'; });

  try {
    var token = getToken();
    var res = await fetch(API_BASE + '/api/parse/' + importState.parseId + '/commit', {
      method:  'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body:    JSON.stringify({ meta: importState.meta, questions: importState.questions }),
    });

    if (!res.ok) {
      var b = await res.json().catch(function() { return {}; });
      if (b.warnings && b.warnings.length) {
        importState.warnings = b.warnings;
        importState.stage = 'summary';
        render();
        return;
      }
      throw new Error(b.message || b.error || 'Commit failed (' + res.status + ').');
    }

    var result = await res.json();
    closeImportModal();

    var count = result.questions_added || result.count || importState.questions.length;
    if (typeof showBankCommitNotice === 'function') showBankCommitNotice(count);
    if (typeof loadQuestionBanks    === 'function') loadQuestionBanks();
    if (typeof loadTests === 'function') loadTests();
    if (typeof populateAssignDropdowns === 'function') populateAssignDropdowns();

  } catch (err) {
    alert('Commit failed: ' + (err.message || 'Unknown error. Please try again.'));
    commitBtns.forEach(function(b) { b.disabled = false; b.textContent = 'Commit Import'; });
  }
}

// ── Event delegation ───────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById('importModal');
  if (!modal) return;

  modal.addEventListener('click', function(e) {
    if (e.target === modal) { closeImportModal(); return; }

    var el = e.target.closest('[data-action]');
    if (!el) return;

    var action = el.dataset.action;
    var value  = el.dataset.value != null ? +el.dataset.value : null;

    switch (action) {
      case 'close':        closeImportModal(); break;
      case 'commit':       commitImport(); break;
      case 'save-edits':   saveEdits(el); break;

      case 'parse-review':
        if (importState._file && typeof startImportFile === 'function') {
          startImportFile(importState._file);
        }
        break;

      case 'try-another':
        Object.assign(importState, { stage: 'upload', _file: null, _fileError: null });
        render();
        break;

      case 'retry':
        if (importState._pendingFile && typeof startImportFile === 'function') {
          startImportFile(importState._pendingFile);
        } else {
          Object.assign(importState, { stage: 'upload', _file: null, _fileError: null });
          render();
        }
        break;

      case 'summary':      importState.stage = 'summary'; render(); break;
      case 'start-review': importState.stage = 'question'; importState.index = 0; render(); break;

      case 'prev':
        if (importState.index > 0) { importState.index--; render(); }
        break;
      case 'next':
        if (importState.index < importState.questions.length - 1) { importState.index++; render(); }
        break;

      case 'jump-warning':
      case 'jump-to-q':
        if (value != null && value >= 0) {
          importState.stage = 'question';
          importState.index = value;
          render();
        }
        break;
    }
  });

  document.getElementById('importModalClose').addEventListener('click', closeImportModal);
});
