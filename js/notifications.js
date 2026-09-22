// ── Notification System ───────────────────────────────────────

var NOTIF_KEY  = 'satprep_notifications';
var PREF_QUIZ  = 'notif_pref_quiz';
var PREF_WEEKLY = 'notif_pref_weekly';

function loadNotifications() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); }
  catch (e) { return []; }
}

function saveNotifications(list) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list));
}

function addNotification(type, title, body) {
  var list  = loadNotifications();
  var _n = new Date(); var today = _n.getFullYear() + '-' + String(_n.getMonth()+1).padStart(2,'0') + '-' + String(_n.getDate()).padStart(2,'0');
  var exists = list.some(function(n) { return n.type === type && n.date === today; });
  if (exists) return;
  list.push({ id: Date.now(), type: type, title: title, body: body, date: today, read: false });
  saveNotifications(list);
}

function maybeGenerateNotifications() {
  if (localStorage.getItem(PREF_QUIZ) !== 'false') {
    try {
      var activity = JSON.parse(localStorage.getItem('satprep_activity') || '[]');
      if (activity.length > 0) {
        var lastDate = activity[activity.length - 1].date;
        var daysSince = Math.floor((Date.now() - new Date(lastDate + 'T00:00:00')) / 86400000);
        if (daysSince >= 2) {
          addNotification('quiz_reminder', 'Time to practice!',
            "You haven't practiced in " + daysSince + ' days. Jump in to keep your streak going.');
        }
      } else {
        addNotification('quiz_reminder', 'Start your first session',
          "You haven't practiced yet. Try a practice session to get started!");
      }
    } catch (e) {}
  }

  if (localStorage.getItem(PREF_WEEKLY) !== 'false') {
    var list = loadNotifications();
    var weeklyItems = list.filter(function(n) { return n.type === 'weekly_report'; });
    var lastWeekly  = weeklyItems[weeklyItems.length - 1];
    var daysSinceLast = lastWeekly
      ? Math.floor((Date.now() - new Date(lastWeekly.date + 'T00:00:00')) / 86400000)
      : 999;
    if (daysSinceLast >= 7) {
      addNotification('weekly_report', 'Weekly Progress Report',
        'Your weekly summary is ready. Visit the Results page to review your performance.');
    }
  }
}

function formatNotifDate(dateStr) {
  var _n2 = new Date(); var today = _n2.getFullYear() + '-' + String(_n2.getMonth()+1).padStart(2,'0') + '-' + String(_n2.getDate()).padStart(2,'0');
  var _y2 = new Date(_n2.getFullYear(), _n2.getMonth(), _n2.getDate() - 1); var yesterday = _y2.getFullYear() + '-' + String(_y2.getMonth()+1).padStart(2,'0') + '-' + String(_y2.getDate()).padStart(2,'0');
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  var d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function markNotifRead(id) {
  var list = loadNotifications();
  var n = list.find(function(n) { return n.id === id; });
  if (n) { n.read = true; saveNotifications(list); renderNotifPane(); }
}

function markAllRead() {
  var list = loadNotifications();
  list.forEach(function(n) { n.read = true; });
  saveNotifications(list);
  renderNotifPane();
}

function renderNotifPane() {
  var list   = loadNotifications();
  var unread = list.filter(function(n) { return !n.read; }).length;

  var badge = document.getElementById('notifBadge');
  if (badge) {
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  var notifList = document.getElementById('notifList');
  if (!notifList) return;

  if (!list.length) {
    notifList.innerHTML = '<li class="notif-empty">You\'re all caught up!</li>';
    return;
  }

  notifList.innerHTML = '';
  list.slice().reverse().forEach(function(n) {
    var li = document.createElement('li');
    li.className = 'notif-item' + (n.read ? '' : ' notif-unread');

    var head  = document.createElement('div');
    head.className = 'notif-item-head';

    var title = document.createElement('span');
    title.className = 'notif-item-title';
    title.textContent = n.title;

    var date = document.createElement('span');
    date.className = 'notif-item-date';
    date.textContent = formatNotifDate(n.date);

    head.appendChild(title);
    head.appendChild(date);

    var body = document.createElement('p');
    body.className = 'notif-item-body';
    body.textContent = n.body;

    li.appendChild(head);
    li.appendChild(body);
    li.addEventListener('click', function() { markNotifRead(n.id); });

    notifList.appendChild(li);
  });
}

function loadPrefs() {
  var quizEl   = document.getElementById('prefQuizReminders');
  var weeklyEl = document.getElementById('prefWeeklyReports');
  if (quizEl)   quizEl.checked   = localStorage.getItem(PREF_QUIZ)   !== 'false';
  if (weeklyEl) weeklyEl.checked = localStorage.getItem(PREF_WEEKLY) !== 'false';
}

function requestBrowserPermission(cb) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(cb);
  } else {
    if (cb) cb(Notification.permission);
  }
}

function fireBrowserNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: body });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Request browser permission on first load since alerts are on by default
  requestBrowserPermission(function() {});
  maybeGenerateNotifications();
  renderNotifPane();
  loadPrefs();

  // Toggle pane on bell click
  var bellBtn = document.getElementById('notifBell');
  var pane    = document.getElementById('notifPane');
  if (bellBtn && pane) {
    bellBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      pane.classList.toggle('hidden');
    });
    document.addEventListener('click', function(e) {
      var wrap = document.getElementById('notifWrap');
      if (wrap && !wrap.contains(e.target)) {
        pane.classList.add('hidden');
      }
    });
  }

  // Mark all read
  var markAllBtn = document.getElementById('notifMarkAll');
  if (markAllBtn) markAllBtn.addEventListener('click', markAllRead);

  // Quiz reminder pref toggle
  var quizEl = document.getElementById('prefQuizReminders');
  if (quizEl) {
    quizEl.addEventListener('change', function() {
      localStorage.setItem(PREF_QUIZ, this.checked);
      if (this.checked) {
        requestBrowserPermission(function(perm) {
          if (perm === 'granted') fireBrowserNotif('Quiz Reminders On', "We'll remind you when it's time to practice.");
        });
        maybeGenerateNotifications();
      }
      renderNotifPane();
    });
  }

  // Weekly report pref toggle
  var weeklyEl = document.getElementById('prefWeeklyReports');
  if (weeklyEl) {
    weeklyEl.addEventListener('change', function() {
      localStorage.setItem(PREF_WEEKLY, this.checked);
      if (this.checked) {
        requestBrowserPermission(function() {});
        maybeGenerateNotifications();
      }
      renderNotifPane();
    });
  }
});
