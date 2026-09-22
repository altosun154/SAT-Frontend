// ── Upload Test ───────────────────────────────────────────────

function onUploadFileChange() {
  const file = document.getElementById('uploadTestFile').files[0];
  const label = document.getElementById('uploadFileName');
  const result = document.getElementById('uploadResult');
  label.textContent = file ? file.name : 'No file selected';
  result.className = 'upload-result hidden';
}

function resetUploadForm() {
  document.getElementById('uploadTestFile').value = '';
  document.getElementById('uploadFileName').textContent = 'No file selected';
  document.getElementById('uploadResult').className = 'upload-result hidden';
}

async function uploadTest(e) {
  e.preventDefault();

  const fileInput = document.getElementById('uploadTestFile');
  const file = fileInput.files[0];
  const result = document.getElementById('uploadResult');

  if (!file) {
    showToast('Please select a .pdf or .docx file.', true);
    return;
  }

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (ext !== '.pdf' && ext !== '.docx') {
    result.textContent = 'Please select a .pdf or .docx file.';
    result.className = 'upload-result upload-error';
    return;
  }

  const btn = document.getElementById('uploadTestBtn');
  btn.disabled = true;
  btn.textContent = 'Uploading…';
  result.className = 'upload-result hidden';

  try {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);

    // Note: no Content-Type header here — the browser sets multipart/form-data
    // with the correct boundary automatically when the body is a FormData.
    const res = await fetch(API_BASE + '/admin/upload-test', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      let errMsg = `Server returned ${res.status}.`;
      try { const body = await res.json(); errMsg = body.error || body.message || errMsg; } catch {}
      throw new Error(errMsg);
    }

    const payload = await res.json();
    const testName = payload.test_name || file.name.replace(/\.(pdf|docx)$/i, '');
    const count    = payload.questions_added;
    const countStr = count != null ? ` — ${count} question${count !== 1 ? 's' : ''} added` : '';

    result.textContent = `"${testName}" uploaded successfully${countStr}.`;
    result.className = 'upload-result upload-success';

    fileInput.value = '';
    document.getElementById('uploadFileName').textContent = 'No file selected';

    await loadTests();
    populateAssignDropdowns();
  } catch (err) {
    result.textContent = err.message || 'Upload failed. Please check the file and try again.';
    result.className = 'upload-result upload-error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload Test';
  }
}
