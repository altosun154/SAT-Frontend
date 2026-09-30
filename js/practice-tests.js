/* ============================================================
   practice-tests.js
   Fallback data: js/data/practice-test-fallback.js (FALLBACK_MODULES)
   Calculator:   js/calculator.js
   ============================================================ */

// ── API endpoint ─────────────────────────────────────────────
// test_id comes from the URL (e.g. practice-tests.html?test_id=7, as linked from
// assigned-tests.js); falls back to 1 (the default seeded test) when absent so
// existing links straight into practice-tests.html keep working.
const TEST_ID = parseInt(new URLSearchParams(window.location.search).get('test_id'), 10) || 1;
const PT_API_BASE = 'https://digital-sat-testing-analytics-platform.onrender.com';  // (API_BASE is already declared in auth.js)
// variant=none -> Module 1s (and Module 2s of non-adaptive tests). An adaptive test's
// Module 2 is requested from POST /tests/<id>/module2 once the student finishes Module 1.
const API_URL = PT_API_BASE + '/tests/' + TEST_ID + '/questions?variant=none';
const LETTERS = ['A', 'B', 'C', 'D'];

// The value to send for one answer: a letter for multiple choice, the typed text for
// free-response math, or null when unanswered.
function answerValue(mi, qi) {
  var v = answers[mi][qi];
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return LETTERS[v];
  v = String(v).trim();
  return v === '' ? null : v;
}

// Only run KaTeX on text that actually contains LaTeX, so prices like "$2 ... $5" aren't mangled.
function markMath(el, text) {
  var hasLatex = /\\[a-zA-Z]|\$\$|\$[^$]*[\\^_{}][^$]*\$/.test(text || '');
  el.classList.toggle('no-math', !hasLatex);
}

// ── State ───────────────────────────────────────────────────
var MODULES           = [];
var currentModule     = 0;
var currentQ          = 0;
var answers           = [];
var flagged           = [];
var questionTimes     = [];
var questionStartTime = null;
var timerInterval     = null;
var timeLeft          = 0;
var testSessionId     = null;
var testStartTime     = null;

function initState(modules) {
  MODULES = modules;
  answers = [];
  flagged = [];
  questionTimes = [];
  testStartTime = Date.now();
  testSessionId = 'sess_' + testStartTime;
  MODULES.forEach(function(mod) {
    answers.push(mod.questions.map(function() { return null; }));
    flagged.push(mod.questions.map(function() { return false; }));
    questionTimes.push(mod.questions.map(function() { return 0; }));
  });
}

function recordTime() {
  if (questionStartTime !== null) {
    questionTimes[currentModule][currentQ] += Math.round((Date.now() - questionStartTime) / 1000);
    questionStartTime = null;
  }
}

function startQuestionTimer() {
  questionStartTime = Date.now();
}

// ── Timer ───────────────────────────────────────────────────
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(function() {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert('Time is up! Moving to the next section.');
      nextModule();
    }
  }, 1000);
}

function updateTimer() {
  var m = Math.floor(timeLeft / 60);
  var s = timeLeft % 60;
  var display = '⏱ ' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  var el = document.getElementById('timer');
  el.textContent = display;
  el.style.background = timeLeft <= 300 ? '#c0392b' : '#152a8c';
}

// ── Render ──────────────────────────────────────────────────
function render() {
  var mod = MODULES[currentModule];
  var q   = mod.questions[currentQ];
  var mi  = currentModule;

  document.getElementById('section-title').textContent = mod.title;
  document.getElementById('question-meta').innerHTML =
    'Question ' + (currentQ + 1) + ' of ' + mod.questions.length +
    ' &nbsp;·&nbsp; ' + mod.title;
  document.getElementById('question-counter').textContent =
    (currentQ + 1) + ' / ' + mod.questions.length;
  var qTextEl = document.getElementById('question-text');
  qTextEl.textContent = q.text;
  markMath(qTextEl, q.text);

  // Passage — show for Reading & Writing modules
  var passageEl   = document.getElementById('question-passage');
  var passageBody = document.getElementById('passage-body');
  var isRW = mod.title.indexOf('Reading and Writing') !== -1;
  if (isRW) {
    passageEl.style.display = 'block';
    if (q.passage) {
      passageBody.textContent = q.passage;
      passageBody.className   = 'passage-body';
      markMath(passageBody, q.passage);
    } else {
      passageBody.innerHTML = '<span class="passage-empty">No passage for this question.</span>';
    }
  } else {
    passageEl.style.display = 'none';
  }

  // Image/graph — show if question has one. A Reading & Writing table/graph is
  // part of the passage, so it goes in the passage panel; Math figures go
  // under the question.
  var imgEl = document.getElementById('question-image');
  if (imgEl) {
    if (q.image_url) {
      imgEl.src = q.image_url;
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
    }
    var textEl = document.getElementById('question-text');
    if (isRW) {
      passageEl.appendChild(imgEl);
    } else {
      textEl.parentNode.insertBefore(imgEl, textEl.nextSibling);
    }
  }

  // Flag button
  var flagBtn = document.getElementById('flag-btn');
  flagBtn.textContent = flagged[mi][currentQ] ? '🚩 Flagged' : '🚩 Flag Question';
  flagBtn.style.background = flagged[mi][currentQ] ? '#6c63ff' : '';
  flagBtn.style.color      = flagged[mi][currentQ] ? '#fff' : '#6c63ff';

  // Calculator button visibility
  updateCalcButtonVisibility();

  // Choices (or a text box for free-response math questions)
  var list    = document.getElementById('choices-list');
  var letters = LETTERS;
  list.innerHTML = '';
  if (q.type === 'free_response') {
    var li = document.createElement('li');
    li.className = 'fr-answer no-math';
    var label = document.createElement('label');
    label.textContent = 'Your answer';
    label.setAttribute('for', 'fr-input');
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'fr-input';
    input.autocomplete = 'off';
    input.maxLength = 10;
    input.placeholder = 'e.g. 12, 3/4 or .75';
    input.value = answers[mi][currentQ] !== null ? answers[mi][currentQ] : '';
    input.addEventListener('input', function() {
      answers[mi][currentQ] = input.value.trim() === '' ? null : input.value;
      renderGrid();
    });
    var hint = document.createElement('div');
    hint.className = 'fr-hint';
    hint.textContent = 'Type your answer. Fractions (3/4) and decimals (.75) both work.';
    li.appendChild(label);
    li.appendChild(input);
    li.appendChild(hint);
    list.appendChild(li);
  } else {
    q.choices.forEach(function(choice, ci) {
      var li = document.createElement('li');
      if (answers[mi][currentQ] === ci) li.classList.add('selected');
      li.innerHTML = '<span class="choice-letter">' + letters[ci] + '</span> ' + choice;
      markMath(li, choice);
      li.addEventListener('click', function() { selectAnswer(ci); });
      list.appendChild(li);
    });
  }

  // Prev button
  document.getElementById('btn-prev').disabled = (currentQ === 0);

  // Next button label
  document.getElementById('btn-next').textContent =
    currentQ === mod.questions.length - 1 ? 'Next →' : 'Next →';

  // Grid
  renderGrid();

  // Render LaTeX math in question text and choices
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.getElementById('test-layout'), {
      // No single-$ delimiter: question text uses $ for money ("$3,200 plus $380")
      delimiters: [
        { left: '$$', right: '$$', display: true  },
        { left: '\\(', right: '\\)', display: false }
      ],
      ignoredClasses: ['no-math'],
      throwOnError: false
    });
  }
}

function renderGrid() {
  var mod  = MODULES[currentModule];
  var mi   = currentModule;
  var grid = document.getElementById('grid');
  grid.innerHTML = '';
  mod.questions.forEach(function(_, i) {
    var el = document.createElement('div');
    el.className = 'q-num';
    if (answers[mi][i] !== null) el.classList.add('answered');
    if (flagged[mi][i])          el.classList.add('flagged');
    if (i === currentQ)          el.classList.add('current');
    el.textContent = i + 1;
    el.addEventListener('click', function() { goTo(i); });
    grid.appendChild(el);
  });
}

// ── Actions ─────────────────────────────────────────────────
// A question with no answer choices is a student-produced response (grid-in).
function isGridIn(q) {
  return q.choices.every(function(c) { return !c; });
}

// Stored answer → what gets submitted: a letter for A–D, the typed text for grid-in.
function answerValue(ans) {
  if (ans === null) return null;
  return typeof ans === 'string' ? ans : ['A','B','C','D'][ans];
}

function selectAnswer(ci) {
  answers[currentModule][currentQ] = ci;
  render();
}

function goTo(i) {
  recordTime();
  currentQ = i;
  startQuestionTimer();
  render();
}

function nextModule() {
  clearInterval(timerInterval);
  recordTime();
  hideCalc(); // close calculator when moving between sections

  var mod      = MODULES[currentModule];
  var isFinal  = (currentModule === MODULES.length - 1);
  var payload  = {
    test_id:    TEST_ID,
    user_id:    parseInt(sessionStorage.getItem('authUserId'), 10) || 1,
    session_id: testSessionId,
    module:     mod.title,
    final:      isFinal,
    answers:    mod.questions.map(function(q, i) {
      return {
        question_id:     q.id,
        selected_answer: answerValue(currentModule, i),
        flagged:         flagged[currentModule][i]
      };
    })
  };

  fetch('https://digital-sat-testing-analytics-platform.onrender.com/submit', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  }).catch(function() {
    console.warn('Could not submit answers to server.');
  });

  var allResults = { correct: [], incorrect: [], skipped: [], modules: [] };
  MODULES.forEach(function(mod, mi) {
    var modLabel = mod.title;
    allResults.modules.push(modLabel);
    mod.questions.forEach(function(q, qi) {
      var selected = answerValue(mi, qi);
      var correct  = q.answer !== null ? ['A','B','C','D'][q.answer] : null;
      var entry = {
        question_id:     q.id || (mi * 100 + qi + 1),
        text:            q.text,
        passage:         q.passage || null,
        choice_a:        q.choices[0],
        choice_b:        q.choices[1],
        choice_c:        q.choices[2],
        choice_d:        q.choices[3],
        subject:         modLabel,
        correct_answer:  correct,
        selected_answer: selected,
        time_taken:      questionTimes[mi][qi] || null
      };
      if (selected === null) {
        allResults.skipped.push(entry);
      } else if (selected === correct) {
        allResults.correct.push(entry);
      } else {
        allResults.incorrect.push(entry);
      }
    });
  });
  localStorage.setItem('satResults', JSON.stringify(allResults));

  if (currentModule + 1 < MODULES.length) {
    var advance = function() {
      if (currentModule + 1 < MODULES.length) {
        currentModule++;
        showSectionTitle();
      } else {
        nextModule();   // the pending Module 2 turned out to be empty; finish the test
      }
    };
    if (MODULES[currentModule + 1].pending) {
      loadAdaptiveModule(currentModule, advance);
    } else {
      advance();
    }
  } else {
    var activity = JSON.parse(localStorage.getItem('satprep_activity') || '[]');
    activity.push({
      date: (function(){ var _d=new Date(); return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0'); })(),
      label: 'Full Practice Test',
      type: 'test',
      questions: allResults.correct.length + allResults.incorrect.length + allResults.skipped.length
    });
    localStorage.setItem('satprep_activity', JSON.stringify(activity));

    var pastTests = JSON.parse(localStorage.getItem('satprep_past_tests') || '[]');
    pastTests.push({
      id:          testSessionId,
      date:        (function(){ var _d=new Date(); return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0'); })(),
      completedAt: new Date().toISOString(),
      label:       'Full Practice Test',
      test_id:     TEST_ID,
      correct:     allResults.correct,
      incorrect:   allResults.incorrect,
      skipped:     allResults.skipped,
      modules:     allResults.modules
    });
    localStorage.setItem('satprep_past_tests', JSON.stringify(pastTests));
    localStorage.setItem('lastTestId', TEST_ID);

    var elapsedSec = testStartTime ? Math.round((Date.now() - testStartTime) / 1000) : null;
    localStorage.setItem('satResultsMeta', JSON.stringify({
      completedAt: new Date().toISOString(),
      elapsedSec:  elapsedSec
    }));

    var sessionParam = testSessionId ? '&session_id=' + encodeURIComponent(testSessionId) : '';
    window.location.href = 'results.html?test_id=' + TEST_ID + sessionParam;
  }
}

// ── Transform API response into modules ─────────────────────
function transformQuestions(questions) {
  var moduleOrder = [
    'Section 1, Module 1: Reading and Writing',
    'Section 1, Module 2: Reading and Writing',
    'Section 2, Module 1: Math',
    'Section 2, Module 2: Math'
  ];

  var groups = {};
  moduleOrder.forEach(function(key) { groups[key] = []; });

  questions.forEach(function(q) {
    if (groups[q.subject] !== undefined) {
      groups[q.subject].push(mapQuestion(q));
    }
  });

  var timings = {
    'Section 1, Module 1: Reading and Writing': 32 * 60,
    'Section 1, Module 2: Reading and Writing': 32 * 60,
    'Section 2, Module 1: Math':                35 * 60,
    'Section 2, Module 2: Math':                35 * 60
  };

  // An adaptive test sends only its Module 1s here. Add an empty "pending" Module 2 after
  // each Module 1; it is filled in by loadAdaptiveModule() once that Module 1 is submitted.
  var module2Of = {
    'Section 1, Module 1: Reading and Writing': ['Section 1, Module 2: Reading and Writing', 'reading_writing'],
    'Section 2, Module 1: Math':                ['Section 2, Module 2: Math', 'math']
  };
  var modules = [];
  moduleOrder.forEach(function(key) {
    if (groups[key].length > 0) {
      modules.push({ title: key, totalTime: timings[key], questions: groups[key] });
      var m2 = module2Of[key];
      if (m2 && groups[m2[0]].length === 0) {
        modules.push({ title: m2[0], totalTime: timings[m2[0]], questions: [], pending: true, section: m2[1] });
      }
    }
  });
  return modules;
}

function mapQuestion(q) {
  var choices = [q.choice_a, q.choice_b, q.choice_c, q.choice_d];
  var hasChoices = choices.some(function(c) { return c && String(c).trim() !== ''; });
  return {
    id:         q.id,
    text:       q.text,
    passage:    q.passage || '',
    image_url:  q.image_url || null,
    choices:    choices,
    type:       (q.question_type === 'free_response' || !hasChoices) ? 'free_response' : 'mcq',
    answer:     null,
    difficulty: q.difficulty
  };
}

// Ask the backend which Module 2 this student gets (Lower or Higher), based on the
// Module 1 they just finished, and slot its questions into the pending module.
function loadAdaptiveModule(m1Index, done) {
  var target = MODULES[m1Index + 1];
  document.getElementById('section-title').textContent = 'Loading the next module...';
  fetch(PT_API_BASE + '/tests/' + TEST_ID + '/module2', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      section: target.section,
      answers: MODULES[m1Index].questions.map(function(q, i) {
        return { question_id: q.id, selected_answer: answerValue(m1Index, i) };
      })
    })
  })
    .then(function(res) {
      if (!res.ok) throw new Error('API returned ' + res.status);
      return res.json();
    })
    .then(function(data) {
      var qs = (data.questions || []).map(mapQuestion);
      if (qs.length === 0) {
        MODULES.splice(m1Index + 1, 1);          // no Module 2 for this test
        answers.splice(m1Index + 1, 1);
        flagged.splice(m1Index + 1, 1);
        questionTimes.splice(m1Index + 1, 1);
      } else {
        target.questions = qs;
        target.pending   = false;
        target.variant   = data.module2_variant;
        answers[m1Index + 1]       = qs.map(function() { return null; });
        flagged[m1Index + 1]       = qs.map(function() { return false; });
        questionTimes[m1Index + 1] = qs.map(function() { return 0; });
      }
      done();
    })
    .catch(function() {
      alert('Could not load the next module. Check your connection, then press OK to try again.');
      loadAdaptiveModule(m1Index, done);
    });
}

// ── Boot ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  if (!TEST_ID) return; // redirecting to the library

  // Nav buttons
  document.getElementById('btn-prev').addEventListener('click', function() {
    if (currentQ > 0) { recordTime(); currentQ--; startQuestionTimer(); render(); }
  });
  document.getElementById('btn-next').addEventListener('click', function() {
    var mod = MODULES[currentModule];
    if (currentQ < mod.questions.length - 1) { recordTime(); currentQ++; startQuestionTimer(); render(); }
  });
  document.getElementById('flag-btn').addEventListener('click', function() {
    flagged[currentModule][currentQ] = !flagged[currentModule][currentQ];
    render();
  });
  document.getElementById('submit-btn').addEventListener('click', function() {
    if (confirm('Submit this section and move on?')) nextModule();
  });

  // Calculator setup
  initDesmos();
  makeDraggable();
  document.getElementById('calc-btn').addEventListener('click', toggleCalc);
  document.getElementById('calc-close').addEventListener('click', function() { hideCalc(); });

  // Fetch questions
  fetch(API_URL, { headers: { 'Authorization': 'Bearer ' + getToken() } })
    .then(function(res) {
      if (res.status === 403) throw new Error('locked');
      if (!res.ok) throw new Error('API returned ' + res.status);
      return res.json();
    })
    .then(function(data) {
      initState(transformQuestions(data));
      startTest();
    })
    .catch(function(err) {
      var titleEl = document.getElementById('section-title');
      if (err.message === 'locked') {
        titleEl.innerHTML = 'This test is locked. Ask your instructor to unlock or assign it to you. ' +
          '<a href="test-library.html" style="color:inherit;text-decoration:underline">Back to the Practice Test Library</a>';
      } else {
        titleEl.textContent = 'Could not load test. Please check your connection and refresh.';
      }
    });
});

function startTest() {
  showSectionTitle();
}

var SECTION_DESCS = {
  'Section 1, Module 1: Reading and Writing': 'Read each passage carefully and answer the questions that follow.',
  'Section 1, Module 2: Reading and Writing': 'Choose the best word or phrase to complete each sentence correctly.',
  'Section 2, Module 1: Math':                'No calculator allowed. Show your understanding of core math concepts.',
  'Section 2, Module 2: Math':                'A calculator is permitted for this section.'
};

function showSectionTitle() {
  var mod        = MODULES[currentModule];
  var totalMods  = MODULES.length;
  var screen     = document.getElementById('section-title-screen');
  var testLayout = document.getElementById('test-layout');
  var testHeader = document.getElementById('test-header');

  document.getElementById('title-tag').textContent       = 'Section ' + (currentModule + 1) + ' of ' + totalMods;
  document.getElementById('title-name').textContent      = mod.title;
  document.getElementById('title-questions').textContent = mod.questions.length;
  document.getElementById('title-time').textContent      = Math.floor(mod.totalTime / 60);
  document.getElementById('title-desc').textContent      = SECTION_DESCS[mod.title] || '';

  screen.style.display     = 'flex';
  testLayout.style.display = 'none';
  testHeader.style.display = 'none';

  document.getElementById('begin-btn').onclick = function() {
    screen.style.display     = 'none';
    testLayout.style.display = 'flex';
    testHeader.style.display = 'flex';
    currentQ = 0;
    timeLeft = mod.totalTime;
    render();
    startQuestionTimer();
    startTimer();
  };
}
