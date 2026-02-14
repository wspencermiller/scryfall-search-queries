/**
 * Log viewer UI – loaded by log.html (no inline script for CSP).
 */
(function () {
  const listEl = document.getElementById('log-list');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnClear = document.getElementById('btn-clear');

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function showError(msg) {
    listEl.innerHTML = '<p class="log-empty" style="color:var(--danger);">' + escapeHtml(msg) + '</p>';
  }

  function render(entries) {
    if (!entries.length) {
      listEl.innerHTML = '<p class="log-empty">No log entries. Use the extension; entries will appear here.</p>';
      return;
    }
    listEl.innerHTML = entries.map(function (e) {
      const ctx = e.ctx && (e.ctx.message || (typeof e.ctx === 'object' ? JSON.stringify(e.ctx) : e.ctx));
      const ctxHtml = ctx ? '<div class="log-ctx">' + escapeHtml(String(ctx)) + '</div>' : '';
      return '<div class="log-entry">' +
        '<span class="log-time">' + escapeHtml(e.t) + '</span>' +
        '<span class="log-level ' + escapeHtml(e.level) + '">' + escapeHtml(e.level) + '</span>' +
        '<span class="log-msg">' + escapeHtml(e.msg) + ctxHtml + '</span>' +
        '</div>';
    }).join('');
  }

  async function load() {
    if (typeof scryfallLog === 'undefined') {
      showError('Log script did not load. Check the extension is installed and reload the log page.');
      return;
    }
    try {
      const entries = await Promise.race([
        scryfallLog.getEntries(),
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error('Storage timed out')); }, 5000); }),
      ]);
      render(entries.reverse());
    } catch (err) {
      showError('Failed to load log: ' + (err && err.message ? err.message : String(err)));
      console.error(err);
    }
  }

  if (btnRefresh) btnRefresh.addEventListener('click', function () { load(); });
  if (btnClear) btnClear.addEventListener('click', async function () {
    if (typeof scryfallLog === 'undefined') return;
    try {
      await scryfallLog.clearLog();
      render([]);
    } catch (err) {
      showError('Failed to clear: ' + (err && err.message ? err.message : String(err)));
    }
  });

  load().catch(function (err) {
    showError('Failed to load log: ' + (err && err.message ? err.message : String(err)));
    console.error(err);
  });
})();
