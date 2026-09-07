// ── Past Practice Tests ────────────────────────────────────────
var pastReviewState = {
  currentTestId: null,
  testId:        null,
  allQuestions:  { correct: [], incorrect: [], skipped: [] },
  reviewTab:     'incorrect',
  currentQ:      0,
  tabAnswered:   {}  // key: 'tab_index' → { selected: 'B', revealed: true, correct_answer: 'C' }
};

var pastTestsCache = [];

function renderPastPractice() {
  var container = document.getElementById('practiceHistory');
  if (!container) return;

  var userId = sessionStorage.getItem('authUserId') || getUserIdFromToken();
  if (!userId) {
    container.innerHTML = '<div class="assigned-empty"><p>Sign in to view past tests.</p></div>';
    return;
  }

  container.innerHTML = '<div class="assigned-empty"><p>Loading...</p></div>';

  fetch(API_BASE + '/results/history?user_id=' + encodeURIComponent(userId), {
    headers: { 'Authorization': 'Bearer ' + getToken() }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    pastTestsCache = Array.isArray(data) ? data : [];
    renderScoreTrend(pastTestsCache);
    renderWeakSkills(pastTestsCache);
    if (!pastTestsCache.length) {
      container.innerHTML =
        '<div class="assigned-empty">' +
          '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
          '<p>No past practice sessions found.</p>' +
        '</div>';
      return;
    }

    var html = '<div class="past-test-list">';
    pastTestsCache.slice().reverse().forEach(function(t, i) {
      var idx      = pastTestsCache.length - 1 - i;
      var total    = (t.correct || 0) + (t.incorrect || 0) + (t.skipped || 0);
      var accuracy = total > 0 ? Math.round((t.correct / total) * 100) : 0;
      var _d = t.completed_at ? new Date(t.completed_at) : null;
      var dateStr  = formatRelativeDate(_d ? _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0') : '');
      html +=
        '<div class="past-test-item">' +
          '<div class="past-test-item-left">' +
            '<div class="past-test-item-label">Full Practice Test</div>' +
            '<div class="past-test-item-meta">' + dateStr + ' &nbsp;&middot;&nbsp; ' + total + ' questions &nbsp;&middot;&nbsp; ' + accuracy + '% accuracy</div>' +
          '</div>' +
          '<div class="past-test-item-stats">' +
            '<span class="past-stat past-stat-correct">&#10003; ' + (t.correct || 0) + '</span>' +
            '<span class="past-stat past-stat-incorrect">&#10007; ' + (t.incorrect || 0) + '</span>' +
            '<span class="past-stat past-stat-skipped">&mdash; ' + (t.skipped || 0) + '</span>' +
          '</div>' +
          '<button class="past-review-btn" onclick="openPastReview(' + idx + ')">Review</button>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  })
  .catch(function() {
    container.innerHTML =
      '<div class="assigned-empty">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
        '<p>Could not load past tests.</p>' +
      '</div>';
  });
}

function renderScoreTrend(history) {
  var card = document.getElementById('trendCard');
  var scored = history.filter(function(t) { return t.total_score != null; }).slice().reverse();
  if (scored.length < 2) { card.style.display = 'none'; return; }
  card.style.display = '';

  var scores = scored.map(function(t) { return t.total_score; });
  var min = Math.min.apply(null, scores);
  var max = Math.max.apply(null, scores);
  var range = max - min;
  var W = 220, H = 60, pad = 8;
  var step = (W - pad * 2) / (scores.length - 1);

  var points = scores.map(function(s, i) {
    var x = pad + i * step;
    var y = range === 0 ? (H / 2) : (H - pad - ((s - min) / range) * (H - pad * 2));
    return x.toFixed(1) + ',' + y.toFixed(1);
  });

  var svg = document.getElementById('trendChart');
  svg.innerHTML =
    '<polyline fill="none" stroke="#60a5fa" stroke-width="2" stroke-linejoin="round" points="' + points.join(' ') + '"/>' +
    points.map(function(pt, i) {
      var parts = pt.split(',');
      return '<circle cx="' + parts[0] + '" cy="' + parts[1] + '" r="3" fill="' + (i === scores.length - 1 ? '#fff' : '#60a5fa') + '" stroke="#60a5fa" stroke-width="1.5"/>';
    }).join('');

  var first  = scores[0];
  var latest = scores[scores.length - 1];
  var delta  = latest - first;
  var deltaEl = document.getElementById('trendDelta');
  deltaEl.textContent = (delta >= 0 ? '+' : '') + delta + ' pts overall';
  deltaEl.className = 'trend-delta ' + (delta >= 0 ? 'trend-up' : 'trend-down');

  var labels = document.getElementById('trendLabels');
  var labelStep = Math.ceil(scored.length / 6);
  labels.innerHTML = scored.map(function(t, i) {
    if (i % labelStep !== 0 && i !== scored.length - 1) return '<span></span>';
    return '<span>' + (t.completed_at || '').slice(5, 10) + '</span>';
  }).join('');
}

function renderWeakSkills(history) {
  var card = document.getElementById('weakCard');
  if (!history.length) { card.style.display = 'none'; return; }

  var totals = {};
  history.forEach(function(t) {
    var breakdown = t.skill_breakdown || {};
    Object.keys(breakdown).forEach(function(skill) {
      if (!totals[skill]) totals[skill] = { incorrect: 0, total: 0 };
      var b = breakdown[skill];
      totals[skill].incorrect += b.incorrect || 0;
      totals[skill].total += (b.correct || 0) + (b.incorrect || 0) + (b.skipped || 0);
    });
  });

  var skills = Object.keys(totals).filter(function(s) { return totals[s].total >= 5; });
  skills.sort(function(a, b) {
    return (totals[b].incorrect / totals[b].total) - (totals[a].incorrect / totals[a].total);
  });
  var top = skills.slice(0, 5);
  if (!top.length) { card.style.display = 'none'; return; }
  card.style.display = '';

  document.getElementById('weakList').innerHTML = top.map(function(skill) {
    var t = totals[skill];
    var pct = Math.round((t.incorrect / t.total) * 100);
    return '<li class="weak-item">' +
      '<span class="weak-skill" title="' + skill + '">' + skill + '</span>' +
      '<div class="weak-bar-track"><div class="weak-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="weak-pct">' + pct + '% missed</span>' +
    '</li>';
  }).join('');
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openPastReview(idx) {
  var test = pastTestsCache[idx];
  if (!test) return;

  var userId    = sessionStorage.getItem('authUserId') || 1;
  var dbTestId  = test.test_id || 1;
  var sessionId = test.session_id || null;
  var total     = (test.correct || 0) + (test.incorrect || 0) + (test.skipped || 0);
  var accuracy  = total > 0 ? Math.round((test.correct / total) * 100) : 0;

  pastReviewState.currentTestId = idx;
  pastReviewState.testId        = dbTestId;
  pastReviewState.currentQ      = 0;
  pastReviewState.tabAnswered   = {};
  pastReviewState.allQuestions  = { correct: [], incorrect: [], skipped: [] };
  pastReviewState.reviewTab     = test.incorrect > 0 ? 'incorrect'
                                : test.skipped   > 0 ? 'skipped'
                                : 'correct';

  document.getElementById('prTitle').textContent     = 'Full Practice Test';
  var _pd = test.completed_at ? new Date(test.completed_at) : null;
  document.getElementById('prDate').textContent      = formatRelativeDate(_pd ? _pd.getFullYear() + '-' + String(_pd.getMonth()+1).padStart(2,'0') + '-' + String(_pd.getDate()).padStart(2,'0') : '');
  document.getElementById('prCorrect').textContent   = test.correct   || 0;
  document.getElementById('prIncorrect').textContent = test.incorrect || 0;
  document.getElementById('prSkipped').textContent   = test.skipped   || 0;
  document.getElementById('prAccuracy').textContent  = accuracy + '%';

  document.getElementById('pastReviewModal').classList.add('is-open');
  document.body.style.overflow = 'hidden';

  var quizSection  = document.getElementById('prQuizSection');
  var sessionParam = sessionId ? '&session_id=' + encodeURIComponent(sessionId) : '';

  Promise.all([
    fetch(API_BASE + '/results/correct?user_id='   + userId + '&test_id=' + dbTestId + sessionParam).then(function(r) { return r.json(); }).catch(function() { return []; }),
    fetch(API_BASE + '/results/incorrect?user_id=' + userId + '&test_id=' + dbTestId + sessionParam).then(function(r) { return r.json(); }).catch(function() { return []; }),
    fetch(API_BASE + '/results/skipped?user_id='   + userId + '&test_id=' + dbTestId + sessionParam).then(function(r) { return r.json(); }).catch(function() { return []; })
  ]).then(function(results) {
    var correct   = Array.isArray(results[0]) ? results[0] : [];
    var incorrect = Array.isArray(results[1]) ? results[1] : [];
    var skipped   = Array.isArray(results[2]) ? results[2] : [];

    if (!correct.length && !incorrect.length && !skipped.length) {
      try {
        var stored = JSON.parse(localStorage.getItem('satResults') || '{}');
        correct   = stored.correct   || [];
        incorrect = stored.incorrect || [];
        skipped   = stored.skipped   || [];
      } catch (e) {}
    }

    pastReviewState.allQuestions = {
      correct:   correct,
      incorrect: incorrect,
      skipped:   skipped
    };
    showReviewQuiz(quizSection);
  });
}

function showReviewQuiz(quizSection) {
  var aq    = pastReviewState.allQuestions;
  var total = aq.correct.length + aq.incorrect.length + aq.skipped.length;
  if (total === 0) {
    quizSection.style.display = 'none';
    return;
  }
  quizSection.style.display = '';
  switchReviewTab(pastReviewState.reviewTab);
}

function closePastReview() {
  document.getElementById('pastReviewModal').classList.remove('is-open');
  document.body.style.overflow = '';
}

function switchReviewTab(tab) {
  pastReviewState.reviewTab = tab;
  pastReviewState.currentQ  = 0;
  ['correct', 'incorrect', 'skipped'].forEach(function(t) {
    var btn = document.getElementById('prTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('past-overview-stat-active', t === tab);
  });
  renderReviewQuestion();
}

function renderReviewQuestion() {
  var tab = pastReviewState.reviewTab;
  var qs  = pastReviewState.allQuestions[tab] || [];
  var qi  = pastReviewState.currentQ;
  var q   = qs[qi];

  var progressWrap = document.querySelector('.pr-quiz-progress-wrap');
  var questionCard = document.querySelector('.pr-question-card');
  var footer       = document.querySelector('.pr-footer');

  if (!q) {
    if (progressWrap) progressWrap.style.display = 'none';
    if (questionCard) questionCard.style.display = 'none';
    if (footer)       footer.style.display       = 'none';
    return;
  }

  if (progressWrap) progressWrap.style.display = '';
  if (questionCard) questionCard.style.display = '';
  if (footer)       footer.style.display       = '';

  var pct = Math.round(((qi + 1) / qs.length) * 100);
  document.getElementById('prProgress').textContent    = (qi + 1) + ' / ' + qs.length;
  document.getElementById('prProgressBar').style.width = pct + '%';

  document.getElementById('prSubject').textContent = q.subject || '';

  var passageEl = document.getElementById('prPassage');
  if (q.passage) {
    passageEl.textContent   = q.passage;
    passageEl.style.display = '';
  } else {
    passageEl.style.display = 'none';
  }

  document.getElementById('prQuestionText').textContent = q.text;

  var stateKey    = tab + '_' + qi;
  var answerState = pastReviewState.tabAnswered[stateKey];
  var selected    = answerState ? answerState.selected : null;
  var revealed    = answerState ? answerState.revealed : false;
  var correctAnswer = (answerState && answerState.correct_answer) || q.correct_answer || null;

  if (tab === 'correct') {
    revealed = true;
    selected = q.selected_answer || null;
  }

  var options   = [
    { letter: 'A', text: q.choice_a },
    { letter: 'B', text: q.choice_b },
    { letter: 'C', text: q.choice_c },
    { letter: 'D', text: q.choice_d }
  ];
  var choicesEl = document.getElementById('prChoices');
  choicesEl.innerHTML = '';
  options.forEach(function(opt) {
    if (!opt.text) return;
    var btn = document.createElement('button');
    btn.className = 'pr-choice';

    if (revealed) {
      if (correctAnswer && opt.letter === correctAnswer) {
        btn.classList.add('pr-choice-correct');
      } else if (correctAnswer && opt.letter === selected && selected !== correctAnswer) {
        btn.classList.add('pr-choice-wrong');
      }
      btn.disabled = true;
    } else {
      if (opt.letter === selected) btn.classList.add('pr-choice-selected');
      btn.onclick = (function(letter) {
        return function() { selectReviewAnswer(letter); };
      }(opt.letter));
    }

    var letterSpan = document.createElement('span');
    letterSpan.className   = 'pr-choice-letter';
    letterSpan.textContent = opt.letter;

    var textSpan = document.createElement('span');
    textSpan.className   = 'pr-choice-text';
    textSpan.textContent = opt.text;

    btn.appendChild(letterSpan);
    btn.appendChild(textSpan);
    choicesEl.appendChild(btn);
  });

  var feedbackEl = document.getElementById('prFeedback');
  if (revealed && tab !== 'correct') {
    if (!correctAnswer) {
      feedbackEl.textContent = 'Answer recorded.';
      feedbackEl.className   = 'pr-feedback';
    } else if (selected === correctAnswer) {
      feedbackEl.textContent = '✓ Correct!';
      feedbackEl.className   = 'pr-feedback pr-feedback-correct';
    } else {
      feedbackEl.textContent = '✗ Incorrect — the correct answer is ' + correctAnswer;
      feedbackEl.className   = 'pr-feedback pr-feedback-incorrect';
    }
  } else {
    feedbackEl.className = 'pr-feedback hidden';
  }

  var checkBtn = document.getElementById('prCheckBtn');
  var nextBtn  = document.getElementById('prNext');
  var prevBtn  = document.getElementById('prPrev');

  if (tab === 'correct' || revealed) {
    checkBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
  } else {
    checkBtn.classList.remove('hidden');
    checkBtn.disabled = (selected === null);
    nextBtn.classList.add('hidden');
  }

  prevBtn.disabled = (qi === 0);
  nextBtn.disabled = (qi === qs.length - 1);
}

function selectReviewAnswer(letter) {
  var tab      = pastReviewState.reviewTab;
  var qi       = pastReviewState.currentQ;
  var stateKey = tab + '_' + qi;
  var existing = pastReviewState.tabAnswered[stateKey];
  if (existing && existing.revealed) return;
  pastReviewState.tabAnswered[stateKey] = { selected: letter, revealed: false };
  renderReviewQuestion();
}

function checkReviewAnswer() {
  var tab      = pastReviewState.reviewTab;
  var qi       = pastReviewState.currentQ;
  var stateKey = tab + '_' + qi;
  var state    = pastReviewState.tabAnswered[stateKey];
  if (!state) return;

  var q = (pastReviewState.allQuestions[tab] || [])[qi];

  if (q && q.correct_answer) {
    pastReviewState.tabAnswered[stateKey].revealed       = true;
    pastReviewState.tabAnswered[stateKey].correct_answer = q.correct_answer;
    renderReviewQuestion();
    return;
  }

  var userId   = sessionStorage.getItem('authUserId') || 1;
  var checkBtn = document.getElementById('prCheckBtn');
  checkBtn.disabled = true;

  fetch(API_BASE + '/results/review-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id:         Number(userId),
      test_id:         pastReviewState.testId,
      question_id:     q.question_id || q.id,
      selected_answer: state.selected
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    pastReviewState.tabAnswered[stateKey].revealed       = true;
    pastReviewState.tabAnswered[stateKey].correct_answer = data.correct_answer || null;
    renderReviewQuestion();
  })
  .catch(function() {
    pastReviewState.tabAnswered[stateKey].revealed = true;
    renderReviewQuestion();
  });
}

function reviewPrev() {
  if (pastReviewState.currentQ > 0) {
    pastReviewState.currentQ--;
    renderReviewQuestion();
  }
}

function reviewNext() {
  var tab = pastReviewState.reviewTab;
  var max = (pastReviewState.allQuestions[tab] || []).length - 1;
  if (pastReviewState.currentQ < max) {
    pastReviewState.currentQ++;
    renderReviewQuestion();
  }
}

document.addEventListener('DOMContentLoaded', renderPastPractice);
