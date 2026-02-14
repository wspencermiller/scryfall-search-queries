/**
 * In-extension log: appends messages to a rotating buffer in chrome.storage.local.
 * View the log by opening log.html (e.g. from the "Log" button in the popup).
 */
(function () {
  const STORAGE_KEY = 'scryfallExtLog';
  const MAX_ENTRIES = 150;

  var storage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null;

  async function getData() {
    if (!storage) return { entries: [] };
    const r = await storage.get(STORAGE_KEY);
    return r[STORAGE_KEY] || { entries: [] };
  }

  async function append(entry) {
    if (!storage) return;
    try {
      const data = await getData();
      const entries = (data.entries || []).concat(entry).slice(-MAX_ENTRIES);
      await storage.set({ [STORAGE_KEY]: { entries } });
    } catch (_) {}
  }

  function log(msg, level, ctx) {
    level = level || 'info';
    append({
      t: new Date().toISOString(),
      level,
      msg: typeof msg === 'string' ? msg : JSON.stringify(msg),
      ctx: ctx != null ? (typeof ctx === 'object' && ctx.message ? { message: ctx.message } : ctx) : undefined,
    });
  }

  function logError(msg, err) {
    log(msg, 'error', err ? { message: err && err.message, stack: err && err.stack } : null);
  }

  const api = {
    log,
    logError,
    async getEntries() {
      const data = await getData();
      return (data.entries || []).slice();
    },
    async clearLog() {
      if (storage) await storage.set({ [STORAGE_KEY]: { entries: [] } });
    },
  };

  const global = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis;
  global.scryfallLog = api;
})();
