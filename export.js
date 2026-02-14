/**
 * Export preview page – reads JSON from chrome.storage.local (set by popup/manage) and displays it.
 * No inline script for CSP.
 */
(function () {
  const PREVIEW_KEY = 'scryfallExportPreview';
  const preEl = document.getElementById('export-json');
  const btnCopy = document.getElementById('btn-copy');

  var storage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null;

  function show(text) {
    if (preEl) preEl.textContent = text || '(no data)';
  }

  function setupCopy() {
    if (!btnCopy) return;
    btnCopy.addEventListener('click', function () {
      navigator.clipboard.writeText(preEl ? preEl.textContent : '').then(function () {
        btnCopy.textContent = 'Copied!';
      }).catch(function () {
        btnCopy.textContent = 'Copy failed';
      });
    });
  }

  if (!storage) {
    show('(Storage not available)');
    setupCopy();
    return;
  }

  storage.get(PREVIEW_KEY, function (data) {
    const json = data && data[PREVIEW_KEY];
    show(typeof json === 'string' ? json : (json ? JSON.stringify(json, null, 2) : '(no export data)'));
    storage.remove(PREVIEW_KEY);
    setupCopy();
  });
})();
