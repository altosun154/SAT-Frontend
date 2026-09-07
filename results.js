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
  const userId = sessionStorage.getItem('authUserId') || 1;
  const params = new URLSearchParams(window.location.search);
  const testId = params.get('test_id') || localStorage.getItem('lastTestId') || 1;
  const sessionId = params.get('session_id') || null;
  const sessionParam = sessionId ? '&session_id=' + encodeURIComponent(sessionId) : '';

  let correct = [], incorrect = [], skipped = [], summary = null;

  // Try API first
  try {
    [summary, correct, incorrect, skipped] = await Promise.all([
      fetch(`${BASE}/results?user_id=${userId}&test_id=${testId}${sessionParam}`, { headers: { 'Authorization': 'Bearer ' + getToken() } }).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/results/correct?user_id=${userId}&test_id=${testId}${sessionParam}`, { headers: { 'Authorization': 'Bearer ' + getToken() } }).then(r => r.json()).catch(() => []),
      fetch(`${BASE}/results/incorrect?user_id=${userId}&test_id=${testId}${sessionParam}`, { headers: { 'Authorization': 'Bearer ' + getToken() } }).then(r => r.json()).catch(() => []),
      fetch(`${BASE}/results/skipped?user_id=${userId}&test_id=${testId}${sessionParam}`, { headers: { 'Authorization': 'Bearer ' + getToken() } }).then(r => r.json()).catch(() => []),
    ]);
  } catch (e) {}

  // Fall back to localStorage if API returned nothing
  if (!correct.length && !incorrect.length && !skipped.length) {
    const stored = localStorage.getItem('satResults');
    if (stored) {
      const parsed = JSON.parse(stored);
      correct   = parsed.correct   || [];
      incorrect = parsed.incorrect || [];
      skipped   = parsed.skipped   || [];
    }
  }

  // Update summary stats from actual question arrays
  const totalQ = correct.length + incorrect.length + skipped.length;
  if (document.getElementById('stat-correct'))   document.getElementById('stat-correct').textContent   = correct.length;
  if (document.getElementById('stat-incorrect')) document.getElementById('stat-incorrect').textContent = incorrect.length;
  if (document.getElementById('stat-skipped'))   document.getElementById('stat-skipped').textContent   = skipped.length;
  if (document.getElementById('stat-accuracy'))  document.getElementById('stat-accuracy').textContent  =
    totalQ > 0 ? Math.round((correct.length / totalQ) * 100) + '%' : '—';

  // ── Section cards ─────────────────────────────────
  function isMath(q) { return (q.subject || '').toLowerCase().includes('math'); }
  function isRW(q)   { return !isMath(q); }

  const rwC = correct.filter(isRW).length,   rwI = incorrect.filter(isRW).length,   rwS = skipped.filter(isRW).length;
  const mC  = correct.filter(isMath).length, mI  = incorrect.filter(isMath).length, mS  = skipped.filter(isMath).length;
  const rwTotal = rwC + rwI + rwS, mTotal = mC + mI + mS;

  function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function setBar(id, pct) { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; }

  set('rw-correct',   rwC);
  set('rw-incorrect', rwI);
  set('rw-skipped',   rwS);
  set('rw-accuracy',  rwTotal > 0 ? Math.round((rwC / rwTotal) * 100) + '%' : '—');
  set('math-correct',   mC);
  set('math-incorrect', mI);
  set('math-skipped',   mS);
  set('math-accuracy',  mTotal > 0 ? Math.round((mC / mTotal) * 100) + '%' : '—');

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
      time_taken:    q.time_taken || null
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

  // Update summary stat boxes
  const c = all.filter(q => q.status === 'correct').length;
  const w = all.filter(q => q.status === 'incorrect').length;
  const s = all.filter(q => q.status === 'skipped').length;
  document.getElementById('correct-btn').querySelector('.stat-val').textContent   = c;
  document.getElementById('incorrect-btn').querySelector('.stat-val').textContent = w;
  document.getElementById('skipped-btn').querySelector('.stat-val').textContent   = s;
  const total = c + w + s;
  if (total > 0) {
    const el = document.getElementById('stat-accuracy');
    if (el) el.textContent = Math.round((c / total) * 100) + '%';
  }

  const timed = all.filter(q => q.time_taken > 0);
  if (timed.length) {
    const avgSec = Math.round(timed.reduce((s, q) => s + q.time_taken, 0) / timed.length);
    const el = document.getElementById('stat-avg-time');
    if (el) el.textContent = formatTime(avgSec);
  }

  return all;
}

// Mock/fallback data (skills, modules, questionData) loaded from js/data/results-mock.js

// ── Render Skills ──────────────────────────────────

function colorClass(pct) {
  if (pct >= 80) return "high";
  if (pct >= 60) return "mid";
  return "low";
}

const skillList = document.getElementById("skillList");
let currentSection = "";

skills.forEach(skill => {
  if (skill.section !== currentSection) {
    currentSection = skill.section;
    const label = document.createElement("div");
    label.style.cssText = "font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#999;margin:8px 0 4px;";
    label.textContent = currentSection;
    skillList.appendChild(label);
  }

  const row = document.createElement("div");
  row.className = "skill-row";
  row.innerHTML = `
    <div class="skill-name">${skill.name}</div>
    <div class="skill-bar-wrap">
      <div class="skill-bar ${colorClass(skill.pct)}" style="width:0%"
           data-pct="${skill.pct}"></div>
    </div>
    <div class="skill-pct">${skill.pct}%</div>
  `;
  skillList.appendChild(row);
});


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
  const source = liveData || questionData;
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
  const source = liveData || questionData;
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
  const source = liveData || questionData;
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
  // Try to load real results from API
  let data;
  try {
    data = await loadResults();
    if (!data.length) throw new Error('empty');
    liveData = data;
  } catch(e) {
    // Fall back to mock data
    data = questionData;
  }

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
