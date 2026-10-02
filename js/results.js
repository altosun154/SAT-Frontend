// ── Helpers ────────────────────────────────────────
function formatTime(sec) {
  if (!sec) return '—';
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m > 0 ? m + ':' + (s < 10 ? '0' : '') + s : s + 's';
}

// ── API Config ─────────────────────────────────────
const BASE = 'https://digital-sat-testing-analytics-platform.onrender.com';

// ── Fetch Results from Backend ──────────────────────
async function loadResults() {
  const params = new URLSearchParams(window.location.search);
  const testId = params.get('test_id') || localStorage.getItem('lastTestId') || 1;
  const sessionId = params.get('session_id') || null;
  const sessionParam = sessionId ? '&session_id=' + encodeURIComponent(sessionId) : '';

  let correct = [], incorrect = [], skipped = [], summary = null;

  // Try API first
  try {
    [summary, correct, incorrect, skipped] = await Promise.all([
      fetch(`${BASE}/results?test_id=${testId}${sessionParam}`, { headers: { 'Authorization': 'Bearer ' + getToken() } }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${BASE}/results/correct?test_id=${testId}${sessionParam}`, { headers: { 'Authorization': 'Bearer ' + getToken() } }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${BASE}/results/incorrect?test_id=${testId}${sessionParam}`, { headers: { 'Authorization': 'Bearer ' + getToken() } }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${BASE}/results/skipped?test_id=${testId}${sessionParam}`, { headers: { 'Authorization': 'Bearer ' + getToken() } }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
  } catch (e) {}

  const hasData = !!(summary && summary.has_data);

  const emptyEl   = document.getElementById('resultsEmpty');
  const contentEl = document.getElementById('resultsContent');
  if (emptyEl)   emptyEl.classList.toggle('hidden', hasData);
  if (contentEl) contentEl.classList.toggle('hidden', !hasData);

  if (!hasData) {
    return [];
  }

  // Fall back to localStorage question detail if the list endpoints returned nothing
  if (!correct.length && !incorrect.length && !skipped.length) {
    const stored = localStorage.getItem('satResults');
    if (stored) {
      const parsed = JSON.parse(stored);
      correct   = parsed.correct   || [];
      incorrect = parsed.incorrect || [];
      skipped   = parsed.skipped   || [];
    }
  }

  // Overall stat boxes — straight from the authoritative summary, never recomputed
  document.getElementById('correct-btn').querySelector('.stat-val').textContent   = summary.correct;
  document.getElementById('incorrect-btn').querySelector('.stat-val').textContent = summary.incorrect;
  document.getElementById('skipped-btn').querySelector('.stat-val').textContent   = summary.skipped;
  if (document.getElementById('stat-accuracy')) {
    document.getElementById('stat-accuracy').textContent =
      summary.accuracy != null ? Math.round(summary.accuracy) + '%' : '—';
  }

  // ── Skills breakdown (from API, no local section grouping) ──
  const skillList = document.getElementById('skillList');
  if (skillList) {
    skillList.innerHTML = '';
    (summary.skills || []).forEach(skill => {
      const pct = skill.accuracy != null ? Math.round(skill.accuracy) : null;
      const row = document.createElement('div');
      row.className = 'skill-row';
      row.innerHTML = `
        <div class="skill-name">${skill.skill}</div>
        <div class="skill-bar-wrap">
          <div class="skill-bar ${pct != null ? colorClass(pct) : ''}" style="width:0%"
               data-pct="${pct != null ? pct : 0}"></div>
        </div>
        <div class="skill-pct">${pct != null ? pct + '%' : '—'}</div>
      `;
      skillList.appendChild(row);
    });
  }

  // ── Section cards ─────────────────────────────────
  function isMath(q) { return (q.subject || '').toLowerCase().includes('math'); }
  function isRW(q)   { return !isMath(q); }

  const rwC = correct.filter(isRW).length,   rwI = incorrect.filter(isRW).length,   rwS = skipped.filter(isRW).length;
  const mC  = correct.filter(isMath).length, mI  = incorrect.filter(isMath).length, mS  = skipped.filter(isMath).length;
  const rwAnswered = rwC + rwI, mAnswered = mC + mI;

  function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function setBar(id, pct) { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; }

  set('rw-correct',   rwC);
  set('rw-incorrect', rwI);
  set('rw-skipped',   rwS);
  set('rw-accuracy',  rwAnswered > 0 ? Math.round((rwC / rwAnswered) * 100) + '%' : '—');
  set('math-correct',   mC);
  set('math-incorrect', mI);
  set('math-skipped',   mS);
  set('math-accuracy',  mAnswered > 0 ? Math.round((mC / mAnswered) * 100) + '%' : '—');

  // Section scores from summary if available, otherwise just show correct counts
  if (summary) {
    if (summary.rw_score   != null) { set('rw-score-num',   summary.rw_score);   setBar('rw-score-bar',   ((summary.rw_score   - 200) / 600) * 100); }
    if (summary.math_score != null) { set('math-score-num', summary.math_score); setBar('math-score-bar', ((summary.math_score - 200) / 600) * 100); }
  }

  // ── Hero section ──────────────────────────────────
  const meta = JSON.parse(localStorage.getItem('satResultsMeta') || '{}');

  // Total score
  const heroScore = document.getElementById('hero-total-score');
  if (heroScore) {
    const score = summary && summary.total_score != null ? summary.total_score : '—';
    heroScore.innerHTML = `${score}<span class="total-score-max"> / 1600</span>`;
  }
  // Also update the old .total-score selector if it exists
  const oldScore = document.querySelector('.total-score');
  if (oldScore && oldScore.id !== 'hero-total-score' && summary && summary.total_score != null) {
    oldScore.innerHTML = `${summary.total_score}<span class="total-score-max"> / 1600</span>`;
  }

  // Date
  if (meta.completedAt) {
    const d = new Date(meta.completedAt);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const el = document.getElementById('hero-date');
    if (el) el.textContent = dateStr;
    const dateEl = document.getElementById('hero-test-date');
    if (dateEl) dateEl.textContent = 'Completed ' + dateStr;
  }

  // Time taken
  if (meta.elapsedSec) {
    const h = Math.floor(meta.elapsedSec / 3600);
    const m = Math.floor((meta.elapsedSec % 3600) / 60);
    const s = meta.elapsedSec % 60;
    const timeStr = h > 0
      ? `${h} hr ${m.toString().padStart(2,'0')} min`
      : m > 0 ? `${m} min ${s.toString().padStart(2,'0')} sec`
      : `${s} sec`;
    const el = document.getElementById('hero-time');
    if (el) el.textContent = timeStr;
  }

  // Percentile (from summary if backend provides it)
  if (summary && summary.percentile != null) {
    const el = document.getElementById('hero-percentile');
    if (el) el.textContent = summary.percentile + 'th Percentile';
  }

  function mapQ(q, status, num) {
    return {
      num,
      status,
      topic:         q.subject || 'General',
      module:        q.subject || 'General',
      passage:       q.passage || null,
      question:      q.text,
      options:       [q.choice_a, q.choice_b, q.choice_c, q.choice_d],
      correctAnswer: q.correct_answer,
      userAnswer:    q.selected_answer || null,
      time_taken:    q.time_taken || null,
      explanation:   q.explanation || null
    };
  }

  // Merge all, deduplicate by question_id, keep last status if duplicate
  const seen = {};
  [...correct.map(q => ({...q, _status: 'correct'})),
   ...incorrect.map(q => ({...q, _status: 'incorrect'})),
   ...skipped.map(q => ({...q, _status: 'skipped'}))
  ].forEach(q => { seen[q.question_id] = q; });

  const all = Object.values(seen)
    .sort((a, b) => a.question_id - b.question_id)
    .map((q, i) => mapQ(q, q._status, i + 1));

  const timed = all.filter(q => q.time_taken > 0);
  if (timed.length) {
    const avgSec = Math.round(timed.reduce((s, q) => s + q.time_taken, 0) / timed.length);
    const el = document.getElementById('stat-avg-time');
    if (el) el.textContent = formatTime(avgSec);
  }

  return all;
}

// ── Past Results Picker ──────────────────────────────

function pastResultKey(test_id, session_id) {
  return String(test_id) + '::' + (session_id || '');
}

async function loadPastResultsList() {
  const bar    = document.getElementById('pastResultsBar');
  const select = document.getElementById('pastResultsSelect');
  if (!bar || !select) return;

  let history = [];
  try {
    const res = await fetch(`${BASE}/results/history`, { headers: { 'Authorization': 'Bearer ' + getToken() } });
    history = res.ok ? await res.json() : [];
  } catch (e) { history = []; }

  if (!Array.isArray(history) || history.length < 2) {
    // Nothing to pick between — leave the picker hidden.
    return;
  }

  const params    = new URLSearchParams(window.location.search);
  const curTestId = params.get('test_id') || localStorage.getItem('lastTestId') || '1';
  const curKey    = pastResultKey(curTestId, params.get('session_id'));

  select.innerHTML = '';
  history.slice().reverse().forEach(t => {
    const key  = pastResultKey(t.test_id, t.session_id);
    const d    = t.completed_at ? new Date(t.completed_at) : null;
    const date = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date';
    const score = t.total_score != null ? t.total_score + '/1600' : ((t.correct || 0) + ' correct');
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = date + ' — ' + score;
    if (key === curKey) opt.selected = true;
    select.appendChild(opt);
  });

  bar.classList.remove('hidden');
}

function goToPastResult(key) {
  if (!key) return;
  const [testId, sessionId] = key.split('::');
  let url = 'results.html?test_id=' + encodeURIComponent(testId);
  if (sessionId) url += '&session_id=' + encodeURIComponent(sessionId);
  window.location.href = url;
}

// ── Render Skills ──────────────────────────────────

function colorClass(pct) {
  if (pct >= 80) return "high";
  if (pct >= 60) return "mid";
  return "low";
}

// ── Close All Question Sections ─────────────────────

function closeAllQuestionSections() {
  const sections = ['correct-section', 'incorrect-section', 'skipped-section'];
  const buttons = ['correct-btn', 'incorrect-btn', 'skipped-btn'];

  sections.forEach(sectionId => {
    document.getElementById(sectionId).classList.add('hidden');
  });

  buttons.forEach(btnId => {
    document.getElementById(btnId).classList.remove('active');
  });
}

// ── Toggle Incorrect Questions ──────────────────────

function toggleIncorrectQuestions() {
  const section = document.getElementById('incorrect-section');

  // If already open, just close it
  if (!section.classList.contains('hidden')) {
    closeAllQuestionSections();
    return;
  }

  // Close all other sections and open this one
  closeAllQuestionSections();
  section.classList.remove('hidden');
  document.getElementById('incorrect-btn').classList.add('active');

  // Always re-populate to reflect live data
  document.getElementById('incorrectList').innerHTML = '';
  populateIncorrectQuestions();
}

function populateIncorrectQuestions() {
  const incorrectList = document.getElementById('incorrectList');
  const source = liveData || [];
  const incorrectQuestions = source.filter(q => q.status === 'incorrect');

  incorrectQuestions.forEach(q => {
    const item = document.createElement('div');
    item.className = 'incorrect-item';
    item.style.cursor = 'pointer';
    item.onclick = () => openQuestionModal(q);
    item.innerHTML = `
      <div class="incorrect-question-num">${q.num}</div>
      <div class="incorrect-item-content">
        <div class="incorrect-topic">${q.topic}</div>
        <div class="incorrect-module">${q.module}</div>
      </div>
      <div class="incorrect-tag">Incorrect</div>
    `;
    incorrectList.appendChild(item);
  });
}

// ── Toggle Correct Questions ───────────────────────

function toggleCorrectQuestions() {
  const section = document.getElementById('correct-section');

  // If already open, just close it
  if (!section.classList.contains('hidden')) {
    closeAllQuestionSections();
    return;
  }

  // Close all other sections and open this one
  closeAllQuestionSections();
  section.classList.remove('hidden');
  document.getElementById('correct-btn').classList.add('active');

  // Always re-populate to reflect live data
  document.getElementById('correctList').innerHTML = '';
  populateCorrectQuestions();
}

function populateCorrectQuestions() {
  const correctList = document.getElementById('correctList');
  const source = liveData || [];
  const correctQuestions = source.filter(q => q.status === 'correct');

  correctQuestions.forEach(q => {
    const item = document.createElement('div');
    item.className = 'correct-item';
    item.style.cursor = 'pointer';
    item.onclick = () => openQuestionModal(q);
    item.innerHTML = `
      <div class="correct-question-num">${q.num}</div>
      <div class="correct-item-content">
        <div class="correct-topic">${q.topic}</div>
        <div class="correct-module">${q.module}</div>
      </div>
      <div class="correct-tag">Correct</div>
    `;
    correctList.appendChild(item);
  });
}

// ── Toggle Skipped Questions ───────────────────────

function toggleSkippedQuestions() {
  const section = document.getElementById('skipped-section');

  // If already open, just close it
  if (!section.classList.contains('hidden')) {
    closeAllQuestionSections();
    return;
  }

  // Close all other sections and open this one
  closeAllQuestionSections();
  section.classList.remove('hidden');
  document.getElementById('skipped-btn').classList.add('active');

  // Always re-populate to reflect live data
  document.getElementById('skippedList').innerHTML = '';
  populateSkippedQuestions();
}

function populateSkippedQuestions() {
  const skippedList = document.getElementById('skippedList');
  const source = liveData || [];
  const skippedQuestions = source.filter(q => q.status === 'skipped');

  skippedQuestions.forEach(q => {
    const item = document.createElement('div');
    item.className = 'skipped-item';
    item.style.cursor = 'pointer';
    item.onclick = () => openQuestionModal(q);
    item.innerHTML = `
      <div class="skipped-question-num">${q.num}</div>
      <div class="skipped-item-content">
        <div class="skipped-topic">${q.topic}</div>
        <div class="skipped-module">${q.module}</div>
      </div>
      <div class="skipped-tag">Skipped</div>
    `;
    skippedList.appendChild(item);
  });
}

// ── Render Question Grid ────────────────────────────
function renderGrid(data) {
  const grid    = document.getElementById("questionGrid");
  const tooltip = document.getElementById("tooltip");
  grid.innerHTML = '';
  let currentModule = "";

  data.forEach(q => {
    if (q.module !== currentModule) {
      currentModule = q.module;
      const lbl = document.createElement("div");
      lbl.className   = "section-label";
      lbl.textContent = currentModule;
      grid.appendChild(lbl);
    }

    const dot = document.createElement("div");
    dot.className   = `q-dot ${q.status}`;
    dot.textContent = q.num;

    dot.addEventListener("mousemove", (e) => {
      const statusLabel = q.status.charAt(0).toUpperCase() + q.status.slice(1);
      const timePart = q.time_taken ? `<br>⏱ ${formatTime(q.time_taken)}` : '';
      tooltip.innerHTML = `<strong>Question ${q.num}</strong><br>${q.topic}<br>${statusLabel}${timePart}`;
      tooltip.style.display = "block";
      tooltip.style.left    = (e.clientX + 14) + "px";
      tooltip.style.top     = (e.clientY - 10) + "px";
    });
    dot.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
    dot.addEventListener("click", () => { tooltip.style.display = "none"; openQuestionModal(q); });

    grid.appendChild(dot);
  });
}

// ── Live data store (populated after API load) ─────
let liveData = null;

// ── Animate bars on load ───────────────────────────
window.addEventListener("load", async () => {
  let data = [];
  try {
    data = await loadResults();
    liveData = data;
  } catch (e) {
    data = [];
  }

  loadPastResultsList();

  renderGrid(data);

  requestAnimationFrame(() => {
    document.querySelectorAll(".skill-bar[data-pct]").forEach(bar => {
      bar.style.width = bar.dataset.pct + "%";
    });
  });
});

// ── Question Modal Functions ───────────────────────

let currentQuestion = null;

function openQuestionModal(question) {
  currentQuestion = question;
  const modal = document.getElementById('question-modal');

  // Set question info
  document.getElementById('modal-question-num').textContent = `Question ${question.num}`;
  document.getElementById('modal-question-topic').textContent = question.topic;
  document.getElementById('modal-question-module').textContent = question.module;
  const timeEl = document.getElementById('modal-question-time');
  if (timeEl) timeEl.textContent = question.time_taken ? '⏱ ' + formatTime(question.time_taken) : '';

  // Set passage if available
  const passageDiv = document.getElementById('modal-passage');
  if (question.passage) {
    passageDiv.innerHTML = `<div class="passage-container"><strong>Passage:</strong><p>${question.passage}</p></div>`;
    passageDiv.style.display = 'block';
  } else {
    passageDiv.style.display = 'none';
  }

  document.getElementById('modal-question-text').textContent = question.question;

  // Explanation — shown as soon as the pop-up opens
  document.getElementById('modal-explanation-text').textContent =
    question.explanation || 'Explanation coming soon.';

  // Show user's previous answer
  const userAnswerDiv = document.getElementById('modal-user-answer');
  if (question.userAnswer) {
    userAnswerDiv.innerHTML = `<div class="answer-badge answer-badge-user">${question.userAnswer}</div>`;
  } else {
    userAnswerDiv.innerHTML = `<div class="answer-badge answer-badge-skipped">Skipped</div>`;
  }

  // Build clickable answer choices
  const reanswerDiv = document.getElementById('modal-reanswer-options');
  reanswerDiv.innerHTML = '';
  let answered = false;

  question.options.forEach(option => {
    const btn = document.createElement('div');
    btn.className = 'reanswer-option';
    btn.innerHTML = `<span>${option}</span>`;

    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;

      const isCorrect = option === question.correctAnswer;

      // Highlight all options: green for correct, red for wrong pick
      reanswerDiv.querySelectorAll('.reanswer-option').forEach(el => {
        const elText = el.querySelector('span').textContent;
        if (elText === question.correctAnswer) {
          el.classList.add('reanswer-correct');
        } else if (elText === option && !isCorrect) {
          el.classList.add('reanswer-wrong');
        }
        el.style.cursor = 'default';
      });
    });

    reanswerDiv.appendChild(btn);
  });

  // Show modal
  modal.classList.remove('hidden');
}

function closeQuestionModal() {
  const modal = document.getElementById('question-modal');
  modal.classList.add('hidden');
  currentQuestion = null;
}
