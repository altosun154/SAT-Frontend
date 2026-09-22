function setToggle(btn, showId, hideId) {
  const siblings = btn.parentElement.querySelectorAll('.toggle-btn');
  siblings.forEach(b => b.classList.remove('toggle-active'));
  btn.classList.add('toggle-active');

  document.getElementById(showId).classList.remove('hidden');
  document.getElementById(hideId).classList.add('hidden');
}

// ── Score Goal (per subject) ──────────────────────────────────
var activeSubject = 'math';

function getGoalData(subject) {
  return {
    target: parseInt(localStorage.getItem('satprep_goal_target_' + subject) || '0', 10) || null,
    current: parseInt(localStorage.getItem('satprep_best_score_' + subject) || '0', 10) || null
  };
}

function scoreToPercent(score) {
  return Math.min(100, Math.max(0, ((score - 200) / 600) * 100));
}

function totalToPercent(score) {
  return Math.min(100, Math.max(0, ((score - 400) / 1200) * 100));
}

function renderTotal() {
  var math = getGoalData('math');
  var rw = getGoalData('rw');

  var totalCurrent = (math.current || 0) + (rw.current || 0);
  var totalTarget = (math.target || 0) + (rw.target || 0);
  var hasCurrent = math.current !== null || rw.current !== null;
  var hasTarget = math.target !== null || rw.target !== null;

  var currentEl = document.getElementById('totalCurrentScore');
  var targetEl  = document.getElementById('totalTargetScore');
  var fillEl    = document.getElementById('totalBarFill');
  var markerEl  = document.getElementById('totalBarMarker');
  var gapEl     = document.getElementById('totalGapText');

  currentEl.textContent = hasCurrent ? totalCurrent : '—';
  targetEl.textContent  = hasTarget ? totalTarget : '—';

  if (hasCurrent) {
    fillEl.style.width = totalToPercent(totalCurrent) + '%';
  } else {
    fillEl.style.width = '0%';
  }

  if (hasTarget) {
    markerEl.style.left = totalToPercent(totalTarget) + '%';
    markerEl.classList.remove('hidden');
  } else {
    markerEl.classList.add('hidden');
  }

  if (hasCurrent && hasTarget) {
    var gap = totalTarget - totalCurrent;
    if (gap <= 0) {
      gapEl.textContent = 'Overall goal reached! Great work.';
      gapEl.classList.add('goal-reached');
    } else {
      gapEl.textContent = gap + ' points to go overall.';
      gapEl.classList.remove('goal-reached');
    }
  } else if (!hasTarget) {
    gapEl.textContent = 'Set subject targets to see your total goal.';
    gapEl.classList.remove('goal-reached');
  } else {
    gapEl.textContent = 'Complete practice tests to see your total score.';
    gapEl.classList.remove('goal-reached');
  }
}

function renderGoal() {
  var subject = activeSubject;
  var data = getGoalData(subject);
  var target = data.target;
  var current = data.current;

  var currentEl = document.getElementById('currentScore');
  var targetEl  = document.getElementById('targetScore');
  var fillEl    = document.getElementById('goalBarFill');
  var markerEl  = document.getElementById('goalBarMarker');
  var gapEl     = document.getElementById('goalGapText');

  currentEl.textContent = current !== null ? current : '—';
  targetEl.textContent  = target  !== null ? target  : '—';

  if (current !== null) {
    fillEl.style.width = scoreToPercent(current) + '%';
  } else {
    fillEl.style.width = '0%';
  }

  if (target !== null) {
    markerEl.style.left = scoreToPercent(target) + '%';
    markerEl.classList.remove('hidden');
  } else {
    markerEl.classList.add('hidden');
  }

  if (current !== null && target !== null) {
    var gap = target - current;
    if (gap <= 0) {
      gapEl.textContent = 'Goal reached! Great work.';
      gapEl.classList.add('goal-reached');
    } else {
      gapEl.textContent = gap + ' points to go — keep practicing!';
      gapEl.classList.remove('goal-reached');
    }
  } else if (target === null) {
    gapEl.textContent = 'Set a target to track your progress.';
    gapEl.classList.remove('goal-reached');
  } else {
    gapEl.textContent = 'Complete a practice test to see your current score.';
    gapEl.classList.remove('goal-reached');
  }

  renderTotal();
}

function switchSubject(subject) {
  activeSubject = subject;
  var tabs = document.querySelectorAll('.goal-subject-tab');
  tabs.forEach(function(tab) {
    tab.classList.toggle('goal-subject-tab-active', tab.dataset.subject === subject);
  });
  // Close edit row when switching
  document.getElementById('goalEditRow').classList.add('hidden');
  document.getElementById('goalEditBtn').textContent = 'Edit';
  renderGoal();
}

function editGoal() {
  var row = document.getElementById('goalEditRow');
  var btn = document.getElementById('goalEditBtn');
  var isOpen = !row.classList.contains('hidden');
  if (isOpen) {
    row.classList.add('hidden');
    btn.textContent = 'Edit';
  } else {
    var current = localStorage.getItem('satprep_goal_target_' + activeSubject) || '';
    document.getElementById('goalInput').value = current;
    row.classList.remove('hidden');
    btn.textContent = 'Cancel';
    document.getElementById('goalInput').focus();
  }
}

function saveGoal() {
  var val = parseInt(document.getElementById('goalInput').value, 10);
  if (!val || val < 200 || val > 800) {
    document.getElementById('goalInput').style.borderColor = '#c0392b';
    return;
  }
  document.getElementById('goalInput').style.borderColor = '';
  localStorage.setItem('satprep_goal_target_' + activeSubject, val);
  document.getElementById('goalEditRow').classList.add('hidden');
  document.getElementById('goalEditBtn').textContent = 'Edit';
  renderGoal();
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('goalEditBtn').addEventListener('click', editGoal);
  document.getElementById('goalSaveBtn').addEventListener('click', saveGoal);
  document.getElementById('goalInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') saveGoal();
    if (e.key === 'Escape') editGoal();
  });
  document.querySelectorAll('.goal-subject-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      switchSubject(tab.dataset.subject);
    });
  });
  renderGoal();
});
