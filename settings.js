// Settings Modal Functions

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  modal.classList.remove('hidden');
  loadSettingsData();
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  modal.classList.add('hidden');
}

function loadSettingsData() {
  document.getElementById('emailNotifications').checked = localStorage.getItem('emailNotifications') === 'true';
  document.getElementById('darkMode').checked = localStorage.getItem('darkMode') === 'true';
  document.getElementById('largeText').checked = localStorage.getItem('largeText') === 'true';
  document.getElementById('highContrast').checked = localStorage.getItem('highContrast') === 'true';
  document.getElementById('language').value = localStorage.getItem('language') || 'english';
  document.getElementById('learningPace').value = localStorage.getItem('learningPace') || 'moderate';
  document.getElementById('studyGoal').value = localStorage.getItem('studyGoal') || '5';

  document.getElementById('darkMode').addEventListener('change', function() {
    applyAccessibilityInstantly({
      darkMode: this.checked,
      largeText: document.getElementById('largeText').checked,
      highContrast: document.getElementById('highContrast').checked
    });
  });

  document.getElementById('largeText').addEventListener('change', function() {
    applyAccessibilityInstantly({
      darkMode: document.getElementById('darkMode').checked,
      largeText: this.checked,
      highContrast: document.getElementById('highContrast').checked
    });
  });

  document.getElementById('highContrast').addEventListener('change', function() {
    applyAccessibilityInstantly({
      darkMode: document.getElementById('darkMode').checked,
      largeText: document.getElementById('largeText').checked,
      highContrast: this.checked
    });
  });
}

function saveSettingsData(settings) {
  localStorage.setItem('emailNotifications', settings.emailNotifications);
  localStorage.setItem('darkMode', settings.darkMode);
  localStorage.setItem('largeText', settings.largeText);
  localStorage.setItem('highContrast', settings.highContrast);
  localStorage.setItem('language', settings.language);
  localStorage.setItem('learningPace', settings.learningPace);
  localStorage.setItem('studyGoal', settings.studyGoal);

  if (settings.darkMode === 'true') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  if (settings.largeText === 'true') {
    document.body.classList.add('large-text');
  } else {
    document.body.classList.remove('large-text');
  }

  if (settings.highContrast === 'true') {
    document.body.classList.add('high-contrast');
  } else {
    document.body.classList.remove('high-contrast');
  }
}

function applySavedSettings() {
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

function applyAccessibilityInstantly(settings) {
  if (settings.darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }

  if (settings.largeText) {
    document.body.classList.add('large-text');
  } else {
    document.body.classList.remove('large-text');
  }

  if (settings.highContrast) {
    document.body.classList.add('high-contrast');
  } else {
    document.body.classList.remove('high-contrast');
  }

  localStorage.setItem('darkMode', settings.darkMode);
  localStorage.setItem('largeText', settings.largeText);
  localStorage.setItem('highContrast', settings.highContrast);
}

document.addEventListener('DOMContentLoaded', function() {
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const studyGoal = document.getElementById('studyGoal').value.trim();
      if (!studyGoal || parseInt(studyGoal) < 1) {
        alert('Please enter a valid weekly study goal.');
        return;
      }

      const settings = {
        emailNotifications: String(document.getElementById('emailNotifications').checked),
        darkMode: String(document.getElementById('darkMode').checked),
        largeText: String(document.getElementById('largeText').checked),
        highContrast: String(document.getElementById('highContrast').checked),
        language: document.getElementById('language').value,
        learningPace: document.getElementById('learningPace').value,
        studyGoal: studyGoal
      };

      saveSettingsData(settings);
      alert('Settings saved successfully!');
      closeSettingsModal();
    });
  }

  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) {
    window.addEventListener('click', function(event) {
      if (event.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }
});
