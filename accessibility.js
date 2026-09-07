// Accessibility Settings - Applied on every page load
function applyAccessibilitySettings() {
  // Apply saved accessibility settings on page load
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
  
  if (localStorage.getItem('largeText') === 'true') {
    document.body.classList.add('large-text');
  }
  
  if (localStorage.getItem('highContrast') === 'true') {
    document.body.classList.add('high-contrast');
  }
}

// Apply settings immediately on page load
document.addEventListener('DOMContentLoaded', applyAccessibilitySettings);
// Also apply before DOM is fully loaded in case of any delays
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyAccessibilitySettings);
} else {
  applyAccessibilitySettings();
}
