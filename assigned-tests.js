// ── Assigned Tests ─────────────────────────────────────────────
function renderAssignedTests(assignments) {
  var active = assignments.filter(function(a) { return a.status !== 'done'; });
  var past   = assignments.filter(function(a) { return a.status === 'done'; });

  var activeEl = document.getElementById('tests-active');
  var pastEl   = document.getElementById('tests-past');

  if (!active.length) {
    activeEl.innerHTML =
      '<div class="assigned-empty">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>' +
        '<p>No active tests assigned.</p>' +
      '</div>';
  } else {
    activeEl.innerHTML = '<div class="past-test-list">' +
      active.map(function(a) {
        var due = a.dueDate ? 'Due ' + new Date(a.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        var statusLabel = a.status === 'overdue' ? '<span style="color:#c0392b;font-weight:600">Overdue</span>' : '<span style="color:#0077c8;font-weight:600">Pending</span>';
        return '<div class="past-test-item">' +
          '<div class="past-test-item-left">' +
            '<div class="past-test-item-label">' + escapeHtml(a.testName || a.name || 'Assigned Test') + '</div>' +
            '<div class="past-test-item-meta">' + (due ? due + ' &nbsp;&middot;&nbsp; ' : '') + statusLabel + '</div>' +
          '</div>' +
          '<a href="practice-tests.html?test_id=' + a.testId + '" class="past-review-btn">Start Test</a>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  if (!past.length) {
    pastEl.innerHTML =
      '<div class="assigned-empty">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>' +
        '<p>No past tests found.</p>' +
      '</div>';
  } else {
    pastEl.innerHTML = '<div class="past-test-list">' +
      past.map(function(a) {
        var score = a.score != null ? a.score + ' pts' : '—';
        return '<div class="past-test-item">' +
          '<div class="past-test-item-left">' +
            '<div class="past-test-item-label">' + escapeHtml(a.testName || a.name || 'Assigned Test') + '</div>' +
            '<div class="past-test-item-meta">Score: ' + score + '</div>' +
          '</div>' +
          '<span class="past-stat past-stat-correct" style="font-size:0.85rem">Completed</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }
}

function getUserIdFromToken() {
  var stored = sessionStorage.getItem('authUserId');
  if (stored && stored !== 'undefined') return stored;
  try {
    var token = getToken();
    if (!token) return null;
    var payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.sub || payload.user_id || payload.id || null;
  } catch (e) {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var userId = getUserIdFromToken();
  if (!userId) return;
  fetch(API_BASE + '/assignments?user_id=' + encodeURIComponent(userId), {
    headers: { 'Authorization': 'Bearer ' + getToken() }
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (Array.isArray(data) && data.length) renderAssignedTests(data);
    })
    .catch(function() {});
});
