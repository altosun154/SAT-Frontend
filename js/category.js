/* ============================================================
   category.js — paginated question list with search & filters
   Data: js/data/category-question-banks.js (QUESTION_BANKS)
   ============================================================ */

// ── Category metadata ──────────────────────────────────────
const CATEGORIES = {
  'algebra':        { name: 'Algebra',                         subject: 'Math' },
  'advanced-math':  { name: 'Advanced Math',                   subject: 'Math' },
  'data-analysis':  { name: 'Problem-Solving & Data Analysis', subject: 'Math' },
  'geometry':       { name: 'Geometry & Trigonometry',         subject: 'Math' },
  'information':    { name: 'Information & Ideas',             subject: 'Reading & Writing' },
  'craft':          { name: 'Craft & Structure',               subject: 'Reading & Writing' },
  'expression':     { name: 'Expression of Ideas',             subject: 'Reading & Writing' },
  'conventions':    { name: 'Standard English Conventions',    subject: 'Reading & Writing' },
  'science':        { name: 'Science',                         subject: 'Reading & Writing' },
  'social-studies': { name: 'Social Studies',                  subject: 'Reading & Writing' },
};

// ── State ──────────────────────────────────────────────────
let allQuestions   = [];
let filtered       = [];
let currentPage    = 1;
let pageSize       = 25;
let selectedChoice = null;
let openQuestion   = null;
let answered       = {};   // { questionId: 'correct' | 'incorrect' }

// ── Init ───────────────────────────────────────────────────
const params      = new URLSearchParams(window.location.search);
const categoryKey = params.get('category') || 'algebra';
const cat         = CATEGORIES[categoryKey] || CATEGORIES['algebra'];

document.getElementById('cat-title').textContent   = cat.name;
document.getElementById('cat-subject').textContent = cat.subject;
document.title = 'SAT Prep – ' + cat.name;

// ── Subject mapping (category → database subject) ──────────
// Math categories fetch from both math modules; R&W categories fetch from their module
const SUBJECT_MAP = {
  'algebra':        ['Section 2, Module 1: Math', 'Section 2, Module 2: Math'],
  'advanced-math':  ['Section 2, Module 1: Math', 'Section 2, Module 2: Math'],
  'geometry':       ['Section 2, Module 1: Math', 'Section 2, Module 2: Math'],
  'data-analysis':  ['Section 2, Module 1: Math', 'Section 2, Module 2: Math'],
  'information':    ['Section 1, Module 1: Reading and Writing', 'Section 1, Module 2: Reading and Writing'],
  'craft':          ['Section 1, Module 1: Reading and Writing', 'Section 1, Module 2: Reading and Writing'],
  'science':        ['Section 1, Module 1: Reading and Writing', 'Section 1, Module 2: Reading and Writing'],
  'social-studies': ['Section 1, Module 1: Reading and Writing', 'Section 1, Module 2: Reading and Writing'],
  'expression':     ['Section 1, Module 1: Reading and Writing', 'Section 1, Module 2: Reading and Writing'],
  'conventions':    ['Section 1, Module 1: Reading and Writing', 'Section 1, Module 2: Reading and Writing'],
};

const dbSubjects = SUBJECT_MAP[categoryKey];

function mapAPIQuestion(q, i) {
  return {
    id:         q.id || (i + 1),
    text:       q.text,
    passage:    q.passage || '',
    image_url:  q.image_url || null,
    choices:    [q.choice_a, q.choice_b, q.choice_c, q.choice_d],
    answer:     null,
    difficulty: (q.difficulty || 'medium').toLowerCase()
  };
}

if (dbSubjects) {
  Promise.all(dbSubjects.map(function(subject) {
    return fetch('https://digital-sat-testing-analytics-platform.onrender.com/questions?subject=' + encodeURIComponent(subject))
      .then(function(res) { return res.json(); })
      .catch(function() { return []; });
  }))
  .then(function(results) {
    var data = [].concat.apply([], results);
    if (data.length === 0) {
      document.getElementById('cat-title').insertAdjacentHTML('afterend',
        '<p style="color:#888;margin-top:8px">No questions available yet for this category — check back soon!</p>');
      allQuestions = [];
    } else {
      allQuestions = data.map(mapAPIQuestion);
    }
    filtered = allQuestions.slice();
    renderPage();
  })
  .catch(function() {
    allQuestions = [];
    filtered     = [];
    renderPage();
    document.getElementById('cat-title').insertAdjacentHTML('afterend',
      '<p style="color:#888;margin-top:8px">Could not load questions. Please check your connection and try again.</p>');
  });
} else {
  allQuestions = [];
  filtered     = [];
  renderPage();
}

// ── Filtering ──────────────────────────────────────────────
function applyFilters() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const diff   = document.getElementById('diffFilter').value;
  const status = document.getElementById('statusFilter').value;

  filtered = allQuestions.filter(function(q) {
    if (search && q.text.toLowerCase().indexOf(search) === -1) return false;
    if (diff   && q.difficulty !== diff)                        return false;
    if (status && (answered[q.id] || 'unattempted') !== status) return false;
    return true;
  });

  currentPage = 1;
  renderPage();
}

function onPageSizeChange() {
  pageSize    = parseInt(document.getElementById('pageSizeSelect').value, 10);
  currentPage = 1;
  renderPage();
}

// ── Render list ────────────────────────────────────────────
function renderPage() {
  var total      = filtered.length;
  var totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  var start = (currentPage - 1) * pageSize;
  var slice = filtered.slice(start, start + pageSize);
  var end   = Math.min(start + pageSize, total);

  document.getElementById('resultCount').textContent =
    total === 0 ? 'No results' : (start + 1) + '–' + end + ' of ' + total;

  var list = document.getElementById('questionList');
  list.innerHTML = '';

  if (total === 0) {
    list.innerHTML = '<div class="empty-state">No questions match your filters.</div>';
  } else {
    slice.forEach(function(q) {
      var status = answered[q.id] || 'unattempted';
      var row = document.createElement('div');
      row.className = 'q-row';
      row.setAttribute('data-id', q.id);
      row.innerHTML =
        '<span class="col-num">' + q.id + '</span>' +
        '<span class="col-preview">' + escapeHTML(q.text) + '</span>' +
        '<span class="col-diff"><span class="diff-badge ' + q.difficulty + '">' + q.difficulty + '</span></span>' +
        '<span class="col-status">' + statusBadgeHTML(status) + '</span>' +
        '<span class="col-action"><button class="start-btn">Open</button></span>';
      row.addEventListener('click', function() { openModal(q); });
      list.appendChild(row);
    });
  }

  renderPagination(totalPages);
}

function statusBadgeHTML(status) {
  var labels = { unattempted: '—', correct: 'Correct', incorrect: 'Incorrect' };
  return '<span class="status-badge ' + status + '"><span class="status-dot"></span>' + labels[status] + '</span>';
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderQuestionText(text) {
  if (!text) return '';
  var lines = text.split('\n');
  var html = '';
  var i = 0;
  while (i < lines.length) {
    var line = lines[i];
    if (line.indexOf('|') !== -1) {
      var tableLines = [];
      while (i < lines.length && lines[i].indexOf('|') !== -1) {
        tableLines.push(lines[i]); i++;
      }
      html += '<table class="q-embedded-table"><tbody>';
      tableLines.forEach(function(row, ri) {
        var cells = row.split('|').map(function(c) { return c.trim(); });
        var tag = ri === 0 ? 'th' : 'td';
        html += '<tr>' + cells.map(function(c) { return '<' + tag + '>' + escapeHTML(c) + '</' + tag + '>'; }).join('') + '</tr>';
      });
      html += '</tbody></table>';
    } else if (line.trim()) {
      html += '<p style="margin:0 0 8px">' + escapeHTML(line) + '</p>';
      i++;
    } else {
      i++;
    }
  }
  return html;
}

// ── Pagination ─────────────────────────────────────────────
function renderPagination(totalPages) {
  var bar = document.getElementById('paginationBar');
  bar.innerHTML = '';
  if (totalPages <= 1) return;

  bar.appendChild(makePageBtn('← Prev', currentPage === 1, function() { goTo(currentPage - 1); }));

  pageRange(currentPage, totalPages).forEach(function(p) {
    if (p === '...') {
      var el = document.createElement('span');
      el.className   = 'page-ellipsis';
      el.textContent = '…';
      bar.appendChild(el);
    } else {
      var btn = makePageBtn(p, false, function() { goTo(p); });
      if (p === currentPage) btn.classList.add('active');
      bar.appendChild(btn);
    }
  });

  bar.appendChild(makePageBtn('Next →', currentPage === totalPages, function() { goTo(currentPage + 1); }));

  if (totalPages > 5) {
    var jump = document.createElement('div');
    jump.className = 'page-jump';
    jump.innerHTML = '<span>Go to</span><input id="jumpInput" type="number" min="1" max="' + totalPages + '" /><button onclick="jumpTo()">Go</button>';
    bar.appendChild(jump);
  }
}

function makePageBtn(label, disabled, onClick) {
  var btn = document.createElement('button');
  btn.className   = 'page-btn';
  btn.textContent = label;
  btn.disabled    = disabled;
  if (!disabled) btn.addEventListener('click', onClick);
  return btn;
}

function pageRange(cur, total) {
  if (total <= 7) {
    var arr = [];
    for (var i = 1; i <= total; i++) arr.push(i);
    return arr;
  }
  if (cur <= 4)          return [1, 2, 3, 4, 5, '...', total];
  if (cur >= total - 3)  return [1, '...', total-4, total-3, total-2, total-1, total];
  return [1, '...', cur-1, cur, cur+1, '...', total];
}

function goTo(page) {
  currentPage = page;
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function jumpTo() {
  var input      = document.getElementById('jumpInput');
  var val        = parseInt(input.value, 10);
  var totalPages = Math.ceil(filtered.length / pageSize);
  if (val >= 1 && val <= totalPages) goTo(val);
}

// ── Modal ──────────────────────────────────────────────────
function openModal(q) {
  openQuestion   = q;
  selectedChoice = null;

  document.getElementById('modalQNum').textContent    = 'Question ' + q.id;
  document.getElementById('modalDiff').textContent    = q.difficulty;
  document.getElementById('modalDiff').className      = 'diff-badge ' + q.difficulty;
  document.getElementById('modalPassage').textContent = q.passage || '';

  // Show image/graph if present
  var imgEl = document.getElementById('modalImage');
  if (imgEl) {
    if (q.image_url) {
      imgEl.src = q.image_url;
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
    }
  }

  document.getElementById('modalQuestion').innerHTML = renderQuestionText(q.text || '');

  var choicesEl       = document.getElementById('modalChoices');
  choicesEl.innerHTML = '';
  var letters         = ['A', 'B', 'C', 'D'];
  var alreadyAnswered = answered[q.id];

  q.choices.forEach(function(choice, i) {
    var btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.disabled  = !!alreadyAnswered;
    if (alreadyAnswered) {
      if (i === q.answer)                                        btn.classList.add('correct-ans');
      else if (alreadyAnswered === 'incorrect' && i === selectedChoice) btn.classList.add('wrong-ans');
    }
    btn.innerHTML = '<span class="choice-letter">' + letters[i] + '</span> ' + escapeHTML(choice);
    btn.addEventListener('click', function() { selectChoice(i); });
    choicesEl.appendChild(btn);
  });

  var feedback = document.getElementById('modalFeedback');
  feedback.className   = 'modal-feedback hidden';
  feedback.textContent = '';

  var submitBtn       = document.getElementById('submitBtn');
  submitBtn.disabled  = !!alreadyAnswered;
  submitBtn.textContent = alreadyAnswered ? 'Already answered' : 'Check Answer';

  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal(e) {
  // Allow clicks on the overlay backdrop to close; clicks inside the modal box do not close it
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.add('hidden');
  openQuestion = null;
  renderPage();
}

function selectChoice(i) {
  if (answered[openQuestion.id]) return;
  selectedChoice = i;
  document.querySelectorAll('.choice-btn').forEach(function(btn, idx) {
    btn.classList.toggle('selected', idx === i);
  });
}

function submitAnswer() {
  if (selectedChoice === null || !openQuestion) return;
  var correct = selectedChoice === openQuestion.answer;
  answered[openQuestion.id] = correct ? 'correct' : 'incorrect';

  document.querySelectorAll('.choice-btn').forEach(function(btn, idx) {
    btn.disabled = true;
    btn.classList.remove('selected');
    if (idx === openQuestion.answer)                               btn.classList.add('correct-ans');
    else if (!correct && idx === selectedChoice) btn.classList.add('wrong-ans');
  });

  var feedback       = document.getElementById('modalFeedback');
  feedback.className = 'modal-feedback ' + (correct ? 'correct-fb' : 'incorrect-fb');
  feedback.textContent = correct
    ? '✓ Correct!'
    : '✗ Incorrect — the answer is ' + ['A','B','C','D'][openQuestion.answer] + '.';

  var submitBtn         = document.getElementById('submitBtn');
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Already answered';
}
