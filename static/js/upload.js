const plusBtn = document.getElementById('plus-btn');
const fileInput = document.getElementById('file-upload');
const alertContainer = document.getElementById('alert-container');
plusBtn.addEventListener('click', () => {
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) {
    showAlert('error', 'fa-circle-xmark', 'No file selected. Please try again.');
    return;
  }
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const maxSize = 10 * 1024 * 1024;
  if (!allowedTypes.includes(file.type)) {
    showAlert('error', 'fa-circle-xmark', `File type not supported: <strong>${file.name}</strong>`);
    return;
  }

  if (file.size > maxSize) {
    showAlert('error', 'fa-circle-xmark', `File too large. Max size is <strong>10MB</strong>.`);
    return;
  }
  showAlert('success', 'fa-circle-check', `File uploaded successfully: <strong>${file.name}</strong>`);
});
function showAlert(type, icon, message) {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span class="alert-message">${message}</span>
    <button class="alert-close" aria-label="Close">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  alert.querySelector('.alert-close').addEventListener('click', () => {
    dismissAlert(alert);
  });
  alertContainer.appendChild(alert);
  setTimeout(() => {
    dismissAlert(alert);
  }, 4000);
}
function dismissAlert(alert) {
  alert.style.animation = 'slideOut 0.3s ease forwards';
  setTimeout(() => {
    alert.remove();
  }, 300);
}