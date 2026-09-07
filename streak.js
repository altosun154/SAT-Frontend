// ── Streak & Activity ─────────────────────────────────────────
function getActivity() {
  try {
    return JSON.parse(localStorage.getItem('satprep_activity') || '[]');
  } catch (e) {
    return [];
  }
}

function calcStreak(activity) {
  if (!activity.length) return 0;
  const _now = new Date();
  const today = _now.getFullYear() + '-' + String(_now.getMonth()+1).padStart(2,'0') + '-' + String(_now.getDate()).padStart(2,'0');
  const _yest = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() - 1);
  const yesterday = _yest.getFullYear() + '-' + String(_yest.getMonth()+1).padStart(2,'0') + '-' + String(_yest.getDate()).padStart(2,'0');
  const days = [...new Set(activity.map(a => a.date))].filter(d => d <= today).sort().reverse();
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 0;
  let cursor = new Date(days[0]);
  for (const day of days) {
    const d = new Date(day);
    const diff = Math.round((cursor - d) / 86400000);
    if (diff > 1) break;
    streak++;
    cursor = d;
  }
  return streak;
}

function formatRelativeDate(dateStr) {
  const _now = new Date();
  const today = _now.getFullYear() + '-' + String(_now.getMonth()+1).padStart(2,'0') + '-' + String(_now.getDate()).padStart(2,'0');
  const _yest = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() - 1);
  const yesterday = _yest.getFullYear() + '-' + String(_yest.getMonth()+1).padStart(2,'0') + '-' + String(_yest.getDate()).padStart(2,'0');
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STREAK_MESSAGES = [
  "Keep it up — consistency is the key to a higher score!",
  "You're on a roll! Every session counts.",
  "Great work staying consistent. Keep pushing!",
  "One day at a time — you're building real momentum.",
  "Showing up every day is half the battle. Well done!"
];

function applyStreak(streak) {
  document.getElementById('streakCount').textContent = streak;
  if (streak > 0) {
    const msg = STREAK_MESSAGES[Math.min(streak - 1, STREAK_MESSAGES.length - 1)];
    document.getElementById('streakMessage').textContent = streak + '-day streak — ' + msg;
  }
}

function renderMotivation() {
  const activity = getActivity();
  const total = activity.filter(a => a.type === 'practice').reduce((s, a) => s + (a.questions || 0), 0);
  const sessions = activity.filter(a => a.type === 'test').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statSessions').textContent = sessions;

  const userId = sessionStorage.getItem('authUserId');
  const token = sessionStorage.getItem('authToken');
  if (userId && token) {
    const _d = new Date();
    const today = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-' + String(_d.getDate()).padStart(2,'0');
    fetch(API_BASE + '/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ user_id: userId, date: today, type: 'login' })
    })
    .catch(function() {})
    .then(function() {
      return fetch(API_BASE + '/activity?user_id=' + encodeURIComponent(userId));
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      const dates = (data.activity_dates || []).map(function(d) { return { date: d }; });
      applyStreak(calcStreak(dates));
    })
    .catch(function() {
      applyStreak(calcStreak(activity));
    });
  } else {
    applyStreak(calcStreak(activity));
  }

  const list = document.getElementById('activityList');
  const recent = [...activity].reverse().slice(0, 5);
  if (!recent.length) return;

  list.innerHTML = '';
  recent.forEach(function(a) {
    const li = document.createElement('li');
    li.className = 'activity-item';

    const dot = document.createElement('span');
    dot.className = 'activity-dot';

    const text = document.createElement('span');
    text.className = 'activity-item-text';
    text.textContent = a.label + (a.questions ? ' — ' + a.questions + ' questions' : '');

    const date = document.createElement('span');
    date.className = 'activity-item-date';
    date.textContent = formatRelativeDate(a.date);

    li.appendChild(dot);
    li.appendChild(text);
    li.appendChild(date);
    list.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', renderMotivation);
