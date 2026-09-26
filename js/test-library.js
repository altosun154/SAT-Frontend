// ── Practice Test Library ──────────────────────────────────────
// Lists the tests an admin has unlocked for the logged-in student.
// Backend: GET /tests/unlocked → [{ id, title, description }, ...]

var LIBRARY_EMPTY_ICON =
  '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

function libraryEscape(str) {
  var d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function renderLibraryMessage(msg) {
  document.getElementById('libraryList').innerHTML =
    '<div class="assigned-empty">' + LIBRARY_EMPTY_ICON + '<p>' + libraryEscape(msg) + '</p></div>';
}

function renderLibrary(tests) {
  if (!tests.length) {
    renderLibraryMessage('No practice tests unlocked yet — ask your instructor.');
    return;
  }
  document.getElementById('libraryList').innerHTML = '<div class="past-test-list">' +
    tests.map(function(t) {
      return '<div class="past-test-item">' +
        '<div class="past-test-item-left">' +
          '<div class="past-test-item-label">' + libraryEscape(t.title || t.name || 'Practice Test') + '</div>' +
          (t.description ? '<div class="past-test-item-meta">' + libraryEscape(t.description) + '</div>' : '') +
        '</div>' +
        '<a href="practice-tests.html?test_id=' + encodeURIComponent(t.id) + '" class="past-review-btn">Start Test</a>' +
      '</div>';
    }).join('') +
  '</div>';
}

document.addEventListener('DOMContentLoaded', function() {
  fetch(API_BASE + '/tests/unlocked', { headers: { 'Authorization': 'Bearer ' + getToken() } })
    .then(function(res) {
      if (!res.ok) throw new Error('API returned ' + res.status);
      return res.json();
    })
    .then(function(tests) { renderLibrary(Array.isArray(tests) ? tests : []); })
    .catch(function() {
      renderLibraryMessage('Could not load your practice tests. Please refresh and try again.');
    });
});
