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
  const fullName = sessionStorage.getItem('userFullName') || '';
  const email = sessionStorage.getItem('userEmail') || '';

  document.getElementById('fullName').value = fullName;
  document.getElementById('email').value = email;
}

function saveProfileData(fullName, email) {
  localStorage.setItem('userFullName', fullName);
  localStorage.setItem('userEmail', email);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

document.addEventListener('DOMContentLoaded', function() {
  // applySavedSettings is defined in settings.js, loaded before this file
  applySavedSettings();

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const fullName = document.getElementById('fullName').value.trim();
      const email = document.getElementById('email').value.trim();

      if (!fullName) {
        alert('Please enter your full name.');
        return;
      }
      if (!email || !isValidEmail(email)) {
        alert('Please enter a valid email address.');
        return;
      }

      saveProfileData(fullName, email);
      alert('Profile updated successfully!');
      closeProfileModal();
    });
  }

  const modal = document.getElementById('profile-modal');
  if (modal) {
    window.addEventListener('click', function(event) {
      if (event.target === modal) {
        closeProfileModal();
      }
    });
  }
});
