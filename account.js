// Profile Modal Functions

function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  modal.classList.remove('hidden');
  loadProfileData();
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  modal.classList.add('hidden');
}

function loadProfileData() {
  // Load profile data from localStorage
  const fullName = sessionStorage.getItem('userFullName') || '';
  const email = sessionStorage.getItem('userEmail') || '';

  document.getElementById('fullName').value = fullName;
  document.getElementById('email').value = email;
}

function saveProfileData(fullName, email) {
  // Save profile data to localStorage
  localStorage.setItem('userFullName', fullName);
  localStorage.setItem('userEmail', email);
}

// Form submission handler
document.addEventListener('DOMContentLoaded', function() {
  // Apply saved accessibility settings on page load
  applySavedSettings();

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const fullName = document.getElementById('fullName').value.trim();
      const email = document.getElementById('email').value.trim();

      // Validate inputs
      if (!fullName) {
        alert('Please enter your full name.');
        return;
      }
      if (!email || !isValidEmail(email)) {
        alert('Please enter a valid email address.');
        return;
      }

      // Save the profile data
      saveProfileData(fullName, email);

      // Show success message and close modal
      alert('Profile updated successfully!');
      closeProfileModal();
    });
  }

  // Close modal when clicking outside of it
  const modal = document.getElementById('profile-modal');
  if (modal) {
    window.addEventListener('click', function(event) {
      if (event.target === modal) {
        closeProfileModal();
      }
    });
  }
});

// Email validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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
  // Load settings from localStorage
  document.getElementById('emailNotifications').checked = localStorage.getItem('emailNotifications') === 'true';
  document.getElementById('darkMode').checked = localStorage.getItem('darkMode') === 'true';
  document.getElementById('largeText').checked = localStorage.getItem('largeText') === 'true';
  document.getElementById('highContrast').checked = localStorage.getItem('highContrast') === 'true';
  document.getElementById('language').value = localStorage.getItem('language') || 'english';
  document.getElementById('learningPace').value = localStorage.getItem('learningPace') || 'moderate';
  document.getElementById('studyGoal').value = localStorage.getItem('studyGoal') || '5';
  
  // Add instant change listeners to accessibility checkboxes
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
  // Save settings to localStorage
  localStorage.setItem('emailNotifications', settings.emailNotifications);
  localStorage.setItem('darkMode', settings.darkMode);
  localStorage.setItem('largeText', settings.largeText);
  localStorage.setItem('highContrast', settings.highContrast);
  localStorage.setItem('language', settings.language);
  localStorage.setItem('learningPace', settings.learningPace);
  localStorage.setItem('studyGoal', settings.studyGoal);
  
  // Apply dark mode if enabled
  if (settings.darkMode === 'true') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  
  // Apply large text if enabled
  if (settings.largeText === 'true') {
    document.body.classList.add('large-text');
  } else {
    document.body.classList.remove('large-text');
  }
  
  // Apply high contrast if enabled
  if (settings.highContrast === 'true') {
    document.body.classList.add('high-contrast');
  } else {
    document.body.classList.remove('high-contrast');
  }
}

function applySavedSettings() {
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

function applyAccessibilityInstantly(settings) {
  // Apply accessibility classes instantly and save to localStorage
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
  
  // Save the current state to localStorage
  localStorage.setItem('darkMode', settings.darkMode);
  localStorage.setItem('largeText', settings.largeText);
  localStorage.setItem('highContrast', settings.highContrast);
}

// Settings form submission handler
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

      // Save the settings
      saveSettingsData(settings);

      // Show success message and close modal
      alert('Settings saved successfully!');
      closeSettingsModal();
    });
  }

  // Close modal when clicking outside of it
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) {
    window.addEventListener('click', function(event) {
      if (event.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }
});
