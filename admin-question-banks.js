/* admin-question-banks.js — Question Banks tab */

var _allBanks = [];

// ── Filter & Render ───────────────────────────────────────────

function filterBanks() {
  var query    = (document.getElementById('banksSearch').value || '').toLowerCase().trim();
  var subject  = (document.getElementById('banksSubjectFilter').value || '').toLowerCase();
  var topic    = (document.getElementById('banksTopicFilter').value || '').toLowerCase();
  var empty    = document.getElementById('banksEmpty');
  var emptyMsg = document.getElementById('banksEmptyMsg');

  var matched = _allBanks.filter(function(b) {
    // Always show optimistic rows regardless of search
    if (b._status === 'parsing' || b._status === 'failed') return true;
    var matchSearch  = !query ||
      (b.filename || '').toLowerCase().includes(query) ||
      (b.topic    || '').toLowerCase().includes(query);
    var matchSubject = !subject || (b.subject || '').toLowerCase() === subject;
    var matchTopic   = !topic   || (b.topic   || '').toLowerCase() === topic;
    return matchSearch && matchSubject && matchTopic;
  });

  renderBankRows(matched);

  if (!matched.length) {
    emptyMsg.textContent = _allBanks.filter(function(b) { return !b._status || b._status === 'committed'; }).length
      ? 'No banks match your search.'
      : 'No question banks imported yet. Drag a file here or click Import.';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
  }
}

function renderBankRows(banks) {
  var tbody = document.getElementById('banksTableBody');
  tbody.innerHTML = '';

  banks.forEach(function(b) {
    var rowStatus = b._status || 'committed';

    var date = b.created_at
      ? new Date(b.created_at).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })
      : '—';

    // Warn badge (warnings column)
    var warnBadge = '';
    if (b.blocking_count > 0) {
      var warnTip = b.blocking_count + ' blocking' + ((b.warning_count - b.blocking_count) > 0 ? ', ' + (b.warning_count - b.blocking_count) + ' warning' : '');
      warnBadge = '<span class="bank-warn-badge bank-warn-blocking" title="' + escHtml(warnTip) + '">⚠ ' + b.blocking_count + ' blocking</span>';
    } else if (b.warning_count > 0) {
      var warnTip2 = b.warning_count + ' warning' + (b.warning_count !== 1 ? 's' : '');
      warnBadge = '<span class="bank-warn-badge bank-warn-warning" title="' + escHtml(warnTip2) + '">⚠ ' + b.warning_count + '</span>';
    }

    // Status badge
    var statusBadge;
    if (rowStatus === 'parsing') {
      statusBadge = '<span class="bank-status-badge bank-status-parsing">Parsing…</span>';
    } else if (rowStatus === 'failed') {
      statusBadge = '<span class="bank-status-badge bank-status-failed">Failed</span>';
    } else if (rowStatus === 'pending_review') {
      statusBadge = '<span class="bank-status-badge bank-status-pending">Pending</span>';
    } else {
      statusBadge = '<span class="bank-status-badge bank-status-committed">Committed</span>';
    }

    // Notes cell
    var notesCell;
    if (rowStatus === 'failed') {
      notesCell = '<span style="color:#b91c1c;font-style:italic;font-size:0.82rem">' + escHtml(b._error || 'Parse failed') + '</span>';
    } else if (b.notes) {
      notesCell = escHtml(b.notes.length > 60 ? b.notes.slice(0, 60) + '…' : b.notes);
    } else {
      notesCell = '<span style="color:#aaa;font-style:italic">—</span>';
    }

    // Delete button (committed + failed rows)
    var deleteBtn = (rowStatus === 'committed' || rowStatus === 'failed')
      ? '<button class="row-action-btn row-action-danger bank-delete-btn"' +
          ' data-id="'       + escHtml(String(b.id))       + '"' +
          ' data-filename="' + escHtml(b.filename)          + '"' +
          ' data-count="'    + (b.question_count || 0)      + '">' +
          'Delete' +
        '</button>'
      : '';

    var displayName = b.name || b.filename;

    var tr = document.createElement('tr');
    tr.className = 'bank-row' + (rowStatus === 'parsing' ? ' bank-row-parsing' : '');
    tr.dataset.id       = b.id;
    tr.dataset.filename = b.filename;
    tr.dataset.notes    = b.notes || '';
    tr.dataset.status   = rowStatus;
    tr.dataset.error    = b._error || '';

    tr.innerHTML =
      '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(b.filename) + '">' + escHtml(displayName) + '</td>' +
      '<td>' + escHtml(b.subject || '—') + '</td>' +
      '<td>' + escHtml(b.topic   || '—') + '</td>' +
      '<td>' + escHtml(b.skill   || '—') + '</td>' +
      '<td style="text-align:center;font-weight:600">' + (b.question_count === '…' ? '…' : (b.question_count || 0)) + '</td>' +
      '<td style="width:1px;white-space:nowrap">' + warnBadge + '</td>' +
      '<td aria-live="polite">' + statusBadge + '</td>' +
      '<td style="max-width:180px;color:#555;font-size:0.85rem">' + notesCell + '</td>' +
      '<td style="color:#888;font-size:0.85rem;white-space:nowrap">' + date + '</td>' +
      '<td class="bank-row-actions">' + deleteBtn + '</td>';

    tbody.appendChild(tr);
  });
}

// ── Load from API ─────────────────────────────────────────────

async function loadQuestionBanks() {
  var tbody    = document.getElementById('banksTableBody');
  var empty    = document.getElementById('banksEmpty');
  var emptyMsg = document.getElementById('banksEmptyMsg');
  if (!tbody) return;

  // Preserve optimistic rows (parsing / failed) across refreshes
  var pendingRows = _allBanks.filter(function(b) { return b._status === 'parsing' || b._status === 'failed'; });

  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#888;padding:20px">Loading…</td></tr>';
  empty.classList.add('hidden');

  try {
    var res = await fetch(API_BASE + '/api/parse', {
      headers: { Authorization: 'Bearer ' + getToken() },
    });
    if (!res.ok) throw new Error('Failed to load (' + res.status + ')');
    var apiRows = await res.json();

    _allBanks = pendingRows.concat(apiRows);

    // Populate subject + topic filter dropdowns
    var subjectSel = document.getElementById('banksSubjectFilter');
    if (subjectSel) {
      var prevSubject = subjectSel.value;
      subjectSel.innerHTML =
        '<option value="">All Subjects</option>' +
        '<option value="Math">Math</option>' +
        '<option value="Reading &amp; Writing">Reading &amp; Writing</option>';
      subjectSel.value = prevSubject;
    }

    var topicSel = document.getElementById('banksTopicFilter');
    if (topicSel) {
      var topics = Array.from(new Set(apiRows.map(function(b) { return b.topic || ''; }).filter(Boolean))).sort();
      var prevTopic = topicSel.value;
      topicSel.innerHTML = '<option value="">All Topics</option>' +
        topics.map(function(t) { return '<option value="' + escHtml(t) + '">' + escHtml(t) + '</option>'; }).join('');
      topicSel.value = prevTopic;
    }

    // Delegated click listener (attach once)
    if (!tbody._bankListenerAttached) {
      tbody._bankListenerAttached = true;
      tbody.addEventListener('click', function(e) {
        var deleteBtn = e.target.closest('.bank-delete-btn');
        if (deleteBtn) {
          e.stopPropagation();
          deleteQuestionBank(deleteBtn.dataset.id, deleteBtn.dataset.filename, parseInt(deleteBtn.dataset.count, 10));
          return;
        }
        var row = e.target.closest('.bank-row');
        if (!row) return;
        var s = row.dataset.status;
        if (s === 'parsing') return;
        if (s === 'failed') {
          // Open modal at failed stage to show the error
          Object.assign(importState, {
            parseId: null, meta: {}, questions: [], warnings: [],
            stage: 'failed', mode: 'review',
            index: 0, reviewed: new Set(), dirty: false,
            notes: '', filename: row.dataset.filename,
            parseError: row.dataset.error || 'Parse failed',
            duplicateOf: null, _file: null, _fileError: null, _pendingFile: null,
          });
          _showImportModal();
          return;
        }
        viewQuestionBank(row.dataset.id, row.dataset.filename, row.dataset.notes, s);
      });
    }

    filterBanks();

  } catch (err) {
    tbody.innerHTML = '';
    emptyMsg.textContent = 'Could not load question banks: ' + err.message;
    empty.classList.remove('hidden');
  }
}

// ── File import (triggered by file input or drag-drop) ────────

function onImportFileSelected() {
  var fileInput = document.getElementById('importFile');
  var file = fileInput.files[0];
  fileInput.value = ''; // reset so same file can be re-selected
  if (!file) return;
  // Always goes through modal upload stage — validate and update UI
  var err = validateFile(file);
  importState._file      = err ? null : file;
  importState._fileError = err || null;
  importState.filename   = file.name;
  if (importState.stage === 'upload') render();
}

async function startImportFile(file) {
  // Store for retry
  importState._pendingFile = file;

  // Transition modal to parsing stage (opens it if not already open)
  _setParsingStage(file.name);

  // Optimistic row in table so the list shows activity
  var tempId = '_pending_' + Date.now();
  _allBanks.unshift({
    id: tempId, filename: file.name,
    subject: '', topic: '', skill: '',
    question_count: '…', warning_count: 0, blocking_count: 0,
    notes: '', created_at: null, _status: 'parsing',
  });
  filterBanks();

  var unloadGuard = function(e) { e.preventDefault(); e.returnValue = ''; };
  window.addEventListener('beforeunload', unloadGuard);

  try {
    var token = getToken();
    var formData = new FormData();
    formData.append('file', file);

    var res = await fetch(API_BASE + '/api/parse', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: formData,
    });

    _allBanks = _allBanks.filter(function(b) { return b.id !== tempId; });

    // Helper: is this parse still the one the modal is showing?
    var modal = document.getElementById('importModal');
    var modalLive = !modal.classList.contains('hidden') && importState.stage === 'parsing';

    if (!res.ok) {
      var errData = {};
      try { errData = await res.json(); } catch (_) {}
      var errMsg = errData.message || errData.error || 'Parse failed (' + res.status + ')';
      _allBanks.unshift({
        id: tempId, filename: file.name,
        subject: '', topic: '', skill: '',
        question_count: 0, warning_count: 0, blocking_count: 0,
        notes: '', created_at: null, _status: 'failed', _error: errMsg,
      });
      filterBanks();
      if (modalLive) {
        importState.stage      = 'failed';
        importState.parseError = errMsg;
        render();
      }
      return;
    }

    var parseResult = await res.json();
    await loadQuestionBanks();

    if (parseResult.status === 'committed') {
      // Duplicate — close modal quietly
      if (modalLive) {
        document.getElementById('importModal').classList.add('hidden');
        document.body.style.overflow = '';
        window.removeEventListener('beforeunload', window._importUnloadGuard);
      }
      showBankDuplicateNotice(file.name);
      return;
    }

    // Success — transition modal to summary
    if (modalLive) {
      importState.parseId     = parseResult.parse_id;
      importState.meta        = parseResult.meta || {};
      importState.questions   = parseResult.questions || [];
      importState.warnings    = parseResult.warnings || [];
      importState.stage       = 'summary';
      importState.mode        = 'review';
      importState.filename    = file.name;
      importState.duplicateOf = parseResult.duplicate_of || null;
      importState.index       = 0;
      importState.reviewed    = new Set();
      importState.dirty       = false;
      importState.notes       = '';
      render();
    }

  } catch (err) {
    _allBanks = _allBanks.filter(function(b) { return b.id !== tempId; });
    var catchMsg = err.message || 'Unknown error';
    _allBanks.unshift({
      id: tempId, filename: file.name,
      subject: '', topic: '', skill: '',
      question_count: 0, warning_count: 0, blocking_count: 0,
      notes: '', created_at: null, _status: 'failed', _error: catchMsg,
    });
    filterBanks();
    var modal2 = document.getElementById('importModal');
    if (!modal2.classList.contains('hidden') && importState.stage === 'parsing') {
      importState.stage      = 'failed';
      importState.parseError = catchMsg;
      render();
    }
  } finally {
    window.removeEventListener('beforeunload', unloadGuard);
  }
}

// ── View / Edit ───────────────────────────────────────────────

async function viewQuestionBank(id, filename, notes, status) {
  try {
    var res = await fetch(API_BASE + '/api/parse/' + id, {
      headers: { Authorization: 'Bearer ' + getToken() },
    });
    if (!res.ok) throw new Error('Failed to load (' + res.status + ')');
    var data = await res.json();
    data.parse_id  = data.parse_id || id;  // restore if stripped by old PUT
    data._notes    = notes || '';
    data._filename = filename;
    var mode = (status === 'committed') ? 'edit' : 'review';
    openImportModal(data, mode);
  } catch (err) {
    alert('Could not load question bank: ' + err.message);
  }
}

// ── Delete ────────────────────────────────────────────────────

async function deleteQuestionBank(id, filename, questionCount) {
  var isFailed = String(id).startsWith('_pending_');
  var msg = isFailed
    ? 'Remove "' + filename + '" from the list?\n\nThis entry failed to parse — removing it just clears it from view.'
    : 'Delete "' + filename + '"?\n\nThis will permanently remove ' + questionCount + ' question' + (questionCount !== 1 ? 's' : '') + ' from the database.\n\nYou can reimport the original file afterwards.';
  if (!confirm(msg)) return;

  // Optimistic (failed-fetch) rows have no backend record — just remove locally
  if (isFailed) {
    _allBanks = _allBanks.filter(function(b) { return b.id !== id; });
    filterBanks();
    showBankDeletedNotice(filename);
    return;
  }

  try {
    var res = await fetch(API_BASE + '/api/parse/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + getToken() },
    });
    if (!res.ok) {
      var b = await res.json().catch(function() { return {}; });
      throw new Error(b.error || 'Delete failed (' + res.status + ')');
    }
    await loadQuestionBanks();
    showBankDeletedNotice(filename);
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
}

// ── Toast notices ─────────────────────────────────────────────

function showBankDeletedNotice(filename) {
  _showBankToast(
    '"' + escHtml(filename) + '" deleted.',
    '<button onclick="openImportModalForUpload()" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:0.85rem">Reimport file →</button>'
  );
}

function showBankDuplicateNotice(filename) {
  _showBankToast(
    '"' + escHtml(filename) + '" was already imported (same file content).',
    ''
  );
}

function showBankCommitNotice(count) {
  _showBankToast(
    count + ' question' + (count !== 1 ? 's' : '') + ' committed successfully.',
    ''
  );
}

function _showBankToast(html, actionHtml) {
  var existing = document.getElementById('bankToast');
  if (existing) existing.remove();

  var notice = document.createElement('div');
  notice.id = 'bankToast';
  notice.style.cssText =
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
    'background:#1e293b;color:#f8fafc;padding:12px 20px;border-radius:8px;' +
    'font-size:0.9rem;display:flex;align-items:center;gap:12px;z-index:9999;' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.3);white-space:nowrap';
  notice.innerHTML =
    '<span>' + html + '</span>' +
    actionHtml +
    '<button onclick="this.parentNode.remove()" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:1.1rem;line-height:1;padding:0 0 0 4px">×</button>';

  document.body.appendChild(notice);
  setTimeout(function() { if (notice.parentNode) notice.remove(); }, 6000);
}

// ── DOMContentLoaded ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {

  // Load banks when switching to the Banks tab
  var orig = window.switchTab;
  window.switchTab = function(tab) {
    if (orig) orig(tab);
    if (tab === 'banks') loadQuestionBanks();
  };

  // Drag-and-drop import on the Banks pane
  var banksPane = document.getElementById('tab-banks');
  if (banksPane) {
    banksPane.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      banksPane.classList.add('banks-drag-over');
    });

    banksPane.addEventListener('dragleave', function(e) {
      // Avoid flickering when cursor moves over child elements
      if (!banksPane.contains(e.relatedTarget)) {
        banksPane.classList.remove('banks-drag-over');
      }
    });

    banksPane.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      banksPane.classList.remove('banks-drag-over');
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      var dropErr = validateFile(file);
      if (dropErr) {
        // Show error in modal upload stage instead of a raw alert
        Object.assign(importState, {
          parseId: null, meta: {}, questions: [], warnings: [],
          stage: 'upload', mode: 'review',
          index: 0, reviewed: new Set(), dirty: false,
          notes: '', filename: file.name, parseError: '', duplicateOf: null,
          _file: null, _fileError: dropErr, _pendingFile: null,
        });
        _showImportModal();
        return;
      }
      startImportFile(file);
    });
  }

});
