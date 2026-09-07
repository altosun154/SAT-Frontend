// Data (SUBJECT_MAP, ALL_SUBJECTS, CATEGORY_NAMES) loaded from
// js/data/topic-question-banks.js

function switchSubject(subject) {
  document.querySelectorAll('.subject-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.subject === subject);
  });
  var subjectParam = subject === 'math' ? 'Math' : 'Reading and Writing';

  _allListQuestions = [];
  document.getElementById('qplList').innerHTML = '<p style="color:#888;font-size:.9rem;padding:16px 0;">Loading questions…</p>';
  document.getElementById('qplCount').textContent = '';

  fetchPracticeQuestions({ subject: subjectParam }).then(function(data) {
    _allListQuestions = data.map(mapAPIQuizQuestion);
    var skills = [...new Set(data.map(function(q) { return q.skill || ''; }).filter(Boolean))];
    var topicSel = document.getElementById('qplTopicFilter');
    topicSel.innerHTML = '<option value="">All</option>' +
      skills.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
    applyQPLFilters();
  }).catch(function() {
    document.getElementById('qplList').innerHTML = '<p style="color:#888;font-size:.9rem;padding:16px 0;">Could not load questions.</p>';
  });
}

// ── Quick Practice Quiz ─────────────────────────────────────
var qpQuestions   = [];
var qpIndex       = 0;
var qpSelected    = null;
var qpAnswered    = {};
var qpRetryFn     = null;   // remembers how to restart the last session
var qplMode       = false;  // true when practicing from the category list
var qplFromInline = false;  // true when opened from inline list (not modal)


function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function getMixedPool(count) {
  return [];
}

// ── API fetching ─────────────────────────────────────────────

function fetchPracticeQuestions(params) {
  var qs = 'practice=true';
  if (params && params.subject) qs += '&subject=' + encodeURIComponent(params.subject);
  if (params && params.difficulty) qs += '&difficulty=' + encodeURIComponent(params.difficulty);
  return fetch(API_BASE + '/questions?' + qs)
    .then(function(r) {
      if (!r.ok) throw new Error('Failed');
      return r.json();
    });
}

function mapAPIQuizQuestion(q, i) {
  var answerMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  var answerIndex = (q.correct_answer)
    ? (answerMap[q.correct_answer.toUpperCase()] !== undefined ? answerMap[q.correct_answer.toUpperCase()] : 0)
    : 0;
  return {
    id:          q.id || (i + 1),
    text:        q.text,
    passage:     q.passage || '',
    image_url:   q.image_url || null,
    subject:     q.subject || '',
    skill:       q.skill || '',
    choices:     [q.choice_a, q.choice_b, q.choice_c, q.choice_d],
    answer:      answerIndex,
    difficulty:  (q.difficulty || 'medium').toLowerCase(),
    explanation: q.explanation || null,
  };
}


// ── Completion tracking ──────────────────────────────────────
var tqAnswered = JSON.parse(localStorage.getItem('tqAnswered') || '{}');

function saveTQAnswered() {
  localStorage.setItem('tqAnswered', JSON.stringify(tqAnswered));
}

function getQStatus(id) {
  var r = tqAnswered[id];
  if (!r || !r.attempts) return 'unattempted';
  return r.correct > 0 ? 'correct' : 'incorrect';
}

function fetchQuestionsForSubjects(subjects) {
  return Promise.all(subjects.map(function(s) {
    return fetch(API_BASE + '/questions?subject=' + encodeURIComponent(s))
      .then(function(r) { return r.json(); })
      .catch(function() { return []; });
  })).then(function(arrays) {
    return [].concat.apply([], arrays);
  });
}

function showQPLoading() {
  document.getElementById('qpmProgressText').textContent = 'Loading…';
  document.getElementById('qpmProgressFill').style.width = '0%';
  document.getElementById('qpmDiff').textContent = '';
  document.getElementById('qpmDiff').className = 'qpm-diff-badge';
  document.getElementById('qpmPassage').style.display = 'none';
  document.getElementById('qpmQuestion').textContent = '';
  document.getElementById('qpmChoices').innerHTML =
    '<p style="color:#888;text-align:center;padding:20px;">Loading questions…</p>';
  document.getElementById('qpmFeedback').className = 'qpm-feedback hidden';
  document.getElementById('qpmCheckBtn').classList.add('hidden');
  document.getElementById('qpmNextBtn').classList.add('hidden');
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

function renderQuizQuestion() {
  var q     = qpQuestions[qpIndex];
  var total = qpQuestions.length;

  document.getElementById('qpmProgressText').textContent = 'Question ' + (qpIndex + 1) + ' of ' + total;
  document.getElementById('qpmProgressFill').style.width = (qpIndex / total * 100) + '%';

  var diffEl = document.getElementById('qpmDiff');
  diffEl.textContent = q.difficulty;
  diffEl.className   = 'qpm-diff-badge ' + q.difficulty;

  var passageEl = document.getElementById('qpmPassage');
  if (q.passage) {
    passageEl.textContent   = q.passage;
    passageEl.style.display = '';
  } else {
    passageEl.style.display = 'none';
  }

  var imgEl = document.getElementById('qpmImage');
  if (imgEl) {
    if (q.image_url) { imgEl.src = q.image_url; imgEl.style.display = 'block'; }
    else { imgEl.style.display = 'none'; }
  }

  document.getElementById('qpmQuestion').innerHTML = renderQuestionText(q.text || '');

  var choicesEl  = document.getElementById('qpmChoices');
  choicesEl.innerHTML = '';
  var letters    = ['A', 'B', 'C', 'D'];
  var prevAnswer = qpAnswered[qpIndex];

  q.choices.forEach(function(choice, i) {
    var btn = document.createElement('button');
    btn.className = 'qpm-choice-btn';
    if (prevAnswer !== undefined) {
      btn.disabled = true;
      if (i === q.answer)        btn.classList.add('correct-ans');
      else if (i === prevAnswer) btn.classList.add('wrong-ans');
    }
    btn.innerHTML = '<span class="qpm-choice-letter">' + letters[i] + '</span> ' + escapeHTML(choice);
    btn.addEventListener('click', function() { selectQPChoice(i); });
    choicesEl.appendChild(btn);
  });

  var feedbackEl = document.getElementById('qpmFeedback');
  if (prevAnswer !== undefined) {
    var wasCorrect       = prevAnswer === q.answer;
    feedbackEl.className = 'qpm-feedback ' + (wasCorrect ? 'correct-fb' : 'incorrect-fb');
    feedbackEl.innerHTML =
      '<span>' + (wasCorrect ? '✓ Correct!' : '✗ Incorrect — the answer is ' + letters[q.answer] + '.') + '</span>' +
      (q.explanation ? '<div class="qpm-explanation">' + escapeHTML(q.explanation) + '</div>' : '');
  } else {
    feedbackEl.className = 'qpm-feedback hidden';
    feedbackEl.innerHTML = '';
  }

  var checkBtn = document.getElementById('qpmCheckBtn');
  var nextBtn  = document.getElementById('qpmNextBtn');
  qpSelected   = null;

  if (prevAnswer !== undefined) {
    checkBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
    nextBtn.textContent = qpIndex < total - 1 ? 'Next →' : 'See Results';
  } else {
    checkBtn.disabled = true;
    checkBtn.classList.remove('hidden');
    nextBtn.classList.add('hidden');
  }

  document.getElementById('qpmBody').scrollTop = 0;
}

function selectQPChoice(i) {
  if (qpAnswered[qpIndex] !== undefined) return;
  qpSelected = i;
  document.querySelectorAll('#qpmChoices .qpm-choice-btn').forEach(function(btn, idx) {
    btn.classList.toggle('selected', idx === i);
  });
  document.getElementById('qpmCheckBtn').disabled = false;
}

function checkQPAnswer() {
  if (qpSelected === null) return;
  var q        = qpQuestions[qpIndex];
  var correct  = qpSelected === q.answer;
  var letters  = ['A', 'B', 'C', 'D'];
  var feedbackEl = document.getElementById('qpmFeedback');
  var checkBtn   = document.getElementById('qpmCheckBtn');
  var nextBtn    = document.getElementById('qpmNextBtn');

  if (qplMode) {
    if (correct) {
      qpAnswered[qpIndex] = qpSelected;
      document.querySelectorAll('#qpmChoices .qpm-choice-btn').forEach(function(btn, idx) {
        btn.disabled = true;
        btn.classList.remove('selected');
        if (idx === q.answer) btn.classList.add('correct-ans');
      });
      feedbackEl.className = 'qpm-feedback correct-fb';
      feedbackEl.innerHTML = '<span>✓ Correct!</span>' +
        (q.explanation ? '<div class="qpm-explanation">' + escapeHTML(q.explanation) + '</div>' : '');
      var _dn = new Date(); var _today = _dn.getFullYear() + '-' + String(_dn.getMonth()+1).padStart(2,'0') + '-' + String(_dn.getDate()).padStart(2,'0');
      var _activity = JSON.parse(localStorage.getItem('satprep_activity') || '[]');
      var _entry = _activity.find(function(a) { return a.date === _today && a.type === 'practice'; });
      if (_entry) {
        _entry.questions = (_entry.questions || 0) + 1;
      } else {
        _activity.push({ date: _today, label: 'Practice Problems', type: 'practice', questions: 1 });
      }
      localStorage.setItem('satprep_activity', JSON.stringify(_activity));
      checkBtn.classList.add('hidden');
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = 'Continue';
    } else {
      document.querySelectorAll('#qpmChoices .qpm-choice-btn').forEach(function(btn, idx) {
        if (idx === qpSelected) btn.classList.add('wrong-ans');
      });
      feedbackEl.className   = 'qpm-feedback incorrect-fb';
      feedbackEl.textContent = '✗ Incorrect — try again!';
      setTimeout(function() {
        document.querySelectorAll('#qpmChoices .qpm-choice-btn').forEach(function(btn) {
          btn.classList.remove('selected', 'wrong-ans');
        });
        feedbackEl.className   = 'qpm-feedback hidden';
        feedbackEl.textContent = '';
        qpSelected = null;
        checkBtn.disabled = true;
        checkBtn.classList.remove('hidden');
      }, 1000);
    }
    return;
  }

  qpAnswered[qpIndex] = qpSelected;

  // Save completion to localStorage
  if (q.id) {
    if (!tqAnswered[q.id]) tqAnswered[q.id] = { attempts: 0, correct: 0 };
    tqAnswered[q.id].attempts++;
    if (correct) tqAnswered[q.id].correct++;
    saveTQAnswered();
  }

  document.querySelectorAll('#qpmChoices .qpm-choice-btn').forEach(function(btn, idx) {
    btn.disabled = true;
    btn.classList.remove('selected');
    if (idx === q.answer)                    btn.classList.add('correct-ans');
    else if (!correct && idx === qpSelected) btn.classList.add('wrong-ans');
  });
  feedbackEl.className = 'qpm-feedback ' + (correct ? 'correct-fb' : 'incorrect-fb');
  feedbackEl.innerHTML =
    '<span>' + (correct ? '✓ Correct!' : '✗ Incorrect — the answer is ' + letters[q.answer] + '.') + '</span>' +
    (q.explanation ? '<div class="qpm-explanation">' + escapeHTML(q.explanation) + '</div>' : '');
  checkBtn.classList.add('hidden');
  nextBtn.classList.remove('hidden');
  nextBtn.textContent = qpIndex < qpQuestions.length - 1 ? 'Next →' : 'See Results';
}

function nextQPQuestion() {
  if (qplMode) {
    document.getElementById('qpModalOverlay').classList.add('hidden');
    if (!qplFromInline) {
      document.getElementById('qpListOverlay').classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      applyQPLFilters();
    }
    return;
  }
  if (qpIndex < qpQuestions.length - 1) {
    qpIndex++;
    renderQuizQuestion();
  } else {
    showQPResults();
  }
}

function showQPResults() {
  var correct = 0;
  qpQuestions.forEach(function(q, i) {
    if (qpAnswered[i] === q.answer) correct++;
  });
  var total = qpQuestions.length;
  var pct   = Math.round(correct / total * 100);

  var actLabel = document.getElementById('qpmTitle').textContent || 'Topic Practice';
  var activity = JSON.parse(localStorage.getItem('satprep_activity') || '[]');
  activity.push({
    date: (function(){ var _d=new Date(); return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0'); })(),
    label: actLabel,
    type: 'practice',
    questions: total
  });
  localStorage.setItem('satprep_activity', JSON.stringify(activity));
  var msg   = pct >= 80 ? 'Great work! Keep it up.'
            : pct >= 60 ? 'Good effort — keep practicing!'
            : 'Keep at it — practice makes perfect!';

  document.getElementById('qpmProgressText').textContent = 'Complete!';
  document.getElementById('qpmProgressFill').style.width = '100%';
  document.getElementById('qpmDiff').textContent = '';
  document.getElementById('qpmDiff').className   = 'qpm-diff-badge';

  document.getElementById('qpmBody').innerHTML =
    '<div class="qpm-results">' +
      '<div class="qpm-results-score">' + correct + '<span> / ' + total + '</span></div>' +
      '<div class="qpm-results-pct">' + pct + '% correct</div>' +
      '<div class="qpm-results-msg">' + msg + '</div>' +
      '<button class="qp-start-btn qpm-retry-btn" onclick="retryQP()">Try Again</button>' +
    '</div>';

  document.getElementById('qpmFeedback').className = 'qpm-feedback hidden';
  document.getElementById('qpmCheckBtn').classList.add('hidden');
  document.getElementById('qpmNextBtn').classList.add('hidden');
}

function retryQP() {
  if (qpRetryFn) qpRetryFn();
}

function getQPCount() {
  var val = document.getElementById('qpCount').valueAsNumber;
  return (!isNaN(val) && val >= 1) ? Math.floor(val) : 10;
}

// ── Category List Modal ──────────────────────────────────────
function openCategoryList(categoryKey) {
  document.getElementById('qplTitle').textContent = categoryKey;
  document.getElementById('qplCount').textContent = '';
  document.getElementById('qplBody').innerHTML = '<p class="qpl-loading">Loading questions…</p>';
  document.getElementById('qpListOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  fetchPracticeQuestions({}).then(function(data) {
    renderQuestionList(data.map(mapAPIQuizQuestion));
  }).catch(function() {
    renderQuestionList([]);
  });
}

var _allListQuestions = [];

function renderQuestionList(questions) {
  _allListQuestions = questions;
  var body = document.getElementById('qplBody');

  // Build filter bar
  var topics = [...new Set(questions.map(function(q) { return q.subject || ''; }).filter(Boolean))];
  var filterHTML =
    '<div class="qpl-filters">' +
      '<select id="qplDiffFilter" onchange="applyQPLFilters()">' +
        '<option value="">All Difficulties</option>' +
        '<option value="easy">Easy</option>' +
        '<option value="medium">Medium</option>' +
        '<option value="hard">Hard</option>' +
      '</select>' +
      (topics.length > 1
        ? '<select id="qplTopicFilter" onchange="applyQPLFilters()">' +
            '<option value="">All Topics</option>' +
            topics.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('') +
          '</select>'
        : '') +
    '</div>' +
    '<div id="qplList"></div>';

  body.innerHTML = filterHTML;
  applyQPLFilters();
}

function toggleFilterMenu() {
  document.getElementById('qplFilterMenu').classList.toggle('hidden');
}

function applyQPLFilters() {
  var search = (document.getElementById('topic-search') ? document.getElementById('topic-search').value.trim().toLowerCase() : '');
  var diff   = document.getElementById('qplDiffFilter')   ? document.getElementById('qplDiffFilter').value   : '';
  var topic  = document.getElementById('qplTopicFilter')  ? document.getElementById('qplTopicFilter').value  : '';
  var status = document.getElementById('qplStatusFilter') ? document.getElementById('qplStatusFilter').value : '';

  var filtered = _allListQuestions.filter(function(q) {
    if (search && q.text.toLowerCase().indexOf(search) === -1)                    return false;
    if (diff   && (q.difficulty || 'medium') !== diff)                            return false;
    if (topic  && (q.skill || '') !== topic)                                      return false;
    if (status && getQStatus(q.id) !== status)                                    return false;
    return true;
  });

  var list  = document.getElementById('qplList');
  var count = document.getElementById('qplCount');
  count.textContent = filtered.length + ' question' + (filtered.length !== 1 ? 's' : '');

  // Completion counter
  var compEl = document.getElementById('qplCompletionCount');
  if (compEl) {
    var total     = _allListQuestions.length;
    var attempted = _allListQuestions.filter(function(q) { return tqAnswered[q.id] && tqAnswered[q.id].attempts > 0; }).length;
    var correctCt = _allListQuestions.filter(function(q) { return tqAnswered[q.id] && tqAnswered[q.id].correct > 0; }).length;
    compEl.textContent = attempted + ' / ' + total + ' attempted · ' + correctCt + ' correct';
  }

  if (!filtered.length) {
    list.innerHTML = '<p class="qpl-empty">No questions match your filters.</p>';
    return;
  }
  list.innerHTML = '';
  filtered.forEach(function(q, i) {
    var d       = q.difficulty || 'medium';
    var preview = q.text.length > 95 ? q.text.slice(0, 95) + '…' : q.text;
    var row = document.createElement('div');
    row.className = 'qpl-item';
    row.innerHTML =
      '<div class="qpl-num">' + (i + 1) + '</div>' +
      '<div class="qpl-text">' + escapeHTML(preview) + '</div>' +
      '<span class="qpl-topic">' + escapeHTML(q.skill || q.subject || '') + '</span>' +
      '<span class="qpl-diff ' + d + '">' + d.charAt(0).toUpperCase() + d.slice(1) + '</span>' +
      '<span class="qpl-arrow">›</span>';
    row.addEventListener('click', function() { openQuestionFromList(q); });
    list.appendChild(row);
  });
}

function openQuestionFromList(q) {
  document.getElementById('qpListOverlay').classList.add('hidden');
  qplMode       = true;
  qplFromInline = true;
  qpRetryFn  = null;
  qpQuestions = [q];
  qpIndex    = 0;
  qpSelected = null;
  qpAnswered = {};
  document.getElementById('qpmTitle').textContent = document.getElementById('qplTitle').textContent;
  document.getElementById('qpmBody').innerHTML =
    '<p class="qpm-passage" id="qpmPassage"></p>' +
    '<p class="qpm-question" id="qpmQuestion"></p>' +
    '<div class="qpm-choices" id="qpmChoices"></div>';
  document.getElementById('qpmCheckBtn').classList.remove('hidden');
  document.getElementById('qpModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderQuizQuestion();
}

function startCategoryQuiz(categoryKey) {
  var title = CATEGORY_NAMES[categoryKey] || categoryKey;
  qplFromInline = false;
  qpRetryFn = function() { startCategoryQuiz(categoryKey); };
  document.getElementById('qpmTitle').textContent = title;
  document.getElementById('qpModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  document.getElementById('qpmBody').innerHTML =
    '<p class="qpm-passage" id="qpmPassage"></p>' +
    '<p class="qpm-question" id="qpmQuestion"></p>' +
    '<div class="qpm-choices" id="qpmChoices"></div>';
  document.getElementById('qpmCheckBtn').classList.remove('hidden');
  showQPLoading();

  fetchPracticeQuestions({}).then(function(data) {
    var shuffled = shuffleArray(data.map(mapAPIQuizQuestion));
    qpQuestions = shuffled;
    qpIndex = 0; qpSelected = null; qpAnswered = {};
    renderQuizQuestion();
  }).catch(function() {
    document.getElementById('qpmBody').innerHTML = '<p style="text-align:center;padding:40px;color:#888">Could not load questions. Please try again.</p>';
  });
}

function startQuiz(count, title) {
  qplMode   = false;
  qpRetryFn = function() { startQuiz(count, title); };
  document.getElementById('qpmTitle').textContent = title || 'Quick Practice';
  document.getElementById('qpModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Restore body structure in case the results screen replaced it
  document.getElementById('qpmBody').innerHTML =
    '<p class="qpm-passage" id="qpmPassage"></p>' +
    '<p class="qpm-question" id="qpmQuestion"></p>' +
    '<div class="qpm-choices" id="qpmChoices"></div>';
  document.getElementById('qpmCheckBtn').classList.remove('hidden');

  showQPLoading();

  fetchPracticeQuestions({}).then(function(data) {
    var shuffled = shuffleArray(data.map(mapAPIQuizQuestion));
    qpQuestions = (count && count < shuffled.length) ? shuffled.slice(0, count) : shuffled;
    qpIndex = 0; qpSelected = null; qpAnswered = {};
    if (!qpQuestions.length) {
      document.getElementById('qpmBody').innerHTML = '<p style="text-align:center;padding:40px;color:#888">No practice questions available yet.</p>';
      return;
    }
    renderQuizQuestion();
  }).catch(function() {
    document.getElementById('qpmBody').innerHTML = '<p style="text-align:center;padding:40px;color:#888">Could not load questions. Please try again.</p>';
  });
}


document.addEventListener('DOMContentLoaded', function() {
  var countInput = document.getElementById('qpCount');
  var startBtn   = document.getElementById('qpStartBtn');
  var overlay    = document.getElementById('qpModalOverlay');

  function updateStartState() {
    var valid = !isNaN(countInput.valueAsNumber) && countInput.valueAsNumber >= 1;
    startBtn.style.opacity = valid ? '1' : '0.45';
  }

  function closeQuizModal() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  startBtn.addEventListener('click', function() { startQuiz(getQPCount(), 'Quick Practice'); });

  document.querySelectorAll('[data-qp-category]').forEach(function(btn) {
    btn.addEventListener('click', function() { openCategoryList(this.dataset.qpCategory); });
  });

  var listOverlay = document.getElementById('qpListOverlay');
  document.getElementById('qpListClose').addEventListener('click', function() {
    listOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  });
  listOverlay.addEventListener('click', function(e) {
    if (e.target === listOverlay) { listOverlay.classList.add('hidden'); document.body.style.overflow = ''; }
  });

document.getElementById('qpModalClose').addEventListener('click', closeQuizModal);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeQuizModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeQuizModal();
  });

  document.getElementById('qpmCheckBtn').addEventListener('click', checkQPAnswer);
  document.getElementById('qpmNextBtn').addEventListener('click',  nextQPQuestion);

  countInput.addEventListener('input',  updateStartState);
  countInput.addEventListener('change', updateStartState);

  document.querySelectorAll('.qp-preset').forEach(function(btn) {
    btn.addEventListener('click', function() {
      countInput.value = this.dataset.count;
      updateStartState();
    });
  });

  updateStartState();

  // Load math questions on page load (default tab)
  switchSubject('math');
});
