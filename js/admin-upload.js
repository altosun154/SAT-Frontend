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

// Show a message under the upload form. kind: 'success' | 'error' | 'info'.
function setUploadResult(message, kind) {
  const result = document.getElementById('uploadResult');
  result.textContent = message;
  result.className = 'upload-result upload-' + (kind === 'error' ? 'error' : kind === 'info' ? 'info' : 'success');
}

// Uploading creates a draft (nothing is published yet) and opens it for review —
// see admin-test-drafts.js.
async function uploadTest(e) {
  e.preventDefault();

  const fileInput = document.getElementById('uploadTestFile');
  const file = fileInput.files[0];
  if (!file) {
    setUploadResult('Please select a .pdf or .docx file.', 'error');
    return;
  }

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (ext !== '.pdf' && ext !== '.docx') {
    setUploadResult('Please select a .pdf or .docx file.', 'error');
    return;
  }

  const btn = document.getElementById('uploadTestBtn');
  btn.disabled = true;
  btn.textContent = 'Reading file…';
  setUploadResult('Reading the questions and answer key — this can take up to a minute for a full test.', 'info');

  try {
    const formData = new FormData();
    formData.append('file', file);
    const created = await draftFetch('/admin/test-drafts', { method: 'POST', body: formData });

    const count = (created.questions || []).length;
    setUploadResult(`Draft created with ${count} question${count !== 1 ? 's' : ''}. Review it below, then publish when it looks right — students can’t see it until then.`, 'success');

    fileInput.value = '';
    document.getElementById('uploadFileName').textContent = 'No file selected';

    showDraftEditor(created);
    await loadDrafts();
  } catch (err) {
    setUploadResult(err.message || 'Upload failed. Please check the file and try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload & Review';
  }
}
