(function () {
  if (typeof scryfallLog !== 'undefined') scryfallLog.log('Content script loaded', 'info');

  const STORAGE_KEY = 'scryfallSavedQueries';
  const FOLDERS_KEY = 'scryfallFolders';
  const SCRYFALL_SEARCH_URL = 'https://scryfall.com/search?q=';

  const syncStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null;

  function getQueries() {
    return new Promise((resolve) => {
      if (!syncStorage) {
        resolve([]);
        return;
      }
      syncStorage.get([STORAGE_KEY], (data) => {
        const list = data[STORAGE_KEY];
        resolve(Array.isArray(list) ? list : []);
      });
    });
  }

  function getFolders() {
    return new Promise((resolve) => {
      if (!syncStorage) {
        resolve([]);
        return;
      }
      syncStorage.get([FOLDERS_KEY], (data) => {
        const list = data[FOLDERS_KEY];
        resolve(Array.isArray(list) ? list : []);
      });
    });
  }

  function findSearchInput() {
    const byName = document.querySelector('input[name="q"]');
    if (byName) return byName;
    const byType = document.querySelector('input[type="search"]');
    if (byType) return byType;
    const forms = document.querySelectorAll('form[action*="search"], form[action*="/search"]');
    for (const form of forms) {
      const input = form.querySelector('input[type="text"]');
      if (input) return input;
    }
    const search = document.querySelector('input[placeholder*="earch" i], input[placeholder*="ind" i]');
    if (search) return search;
    return null;
  }

  function getShortcutToken(value) {
    if (!value || value[0] !== '?') return null;
    const rest = value.slice(1);
    const space = rest.indexOf(' ');
    const token = space === -1 ? rest : rest.slice(0, space);
    return token.trim().toLowerCase() || null;
  }

  /** Length of the first ?shortcut token in value (e.g. "?abzC" -> 5). */
  function getShortcutPrefixLength(value) {
    if (!value || value[0] !== '?') return 0;
    const rest = value.slice(1);
    const space = rest.indexOf(' ');
    const tokenLen = space === -1 ? rest.length : space;
    return 1 + tokenLen;
  }

  /** Map: lowercase shortcut -> query string. Used for lookup and nested expansion. */
  function buildShortcutMap(queries) {
    const map = new Map();
    for (const q of queries) {
      const s = (q.shortcut || '').trim().toLowerCase();
      if (s) map.set(s, (q.query || '').trim());
    }
    return map;
  }

  /** Expand every ?shortcut in text recursively. Longest shortcut wins when overlapping. Max 10 iterations. */
  function expandNested(text, shortcutMap) {
    if (!shortcutMap.size) return text;
    const shortcutsByLength = [...shortcutMap.keys()].sort((a, b) => b.length - a.length);
    const maxIter = 10;
    let result = text;
    for (let iter = 0; iter < maxIter; iter++) {
      let replaced = false;
      for (let i = 0; i < result.length; i++) {
        if (result[i] !== '?') continue;
        const after = result.slice(i + 1);
        for (const short of shortcutsByLength) {
          const sub = after.slice(0, short.length);
          if (sub.toLowerCase() !== short) continue;
          const next = after[short.length];
          if (next !== undefined && next !== ' ') continue;
          const expansion = shortcutMap.get(short);
          if (!expansion) continue;
          result = result.slice(0, i) + expansion + after.slice(short.length);
          replaced = true;
          break;
        }
        if (replaced) break;
      }
      if (!replaced) break;
    }
    return result;
  }

  function attachToInput(input) {
    if (input.dataset.scryfallShortcutsAttached) return;
    input.dataset.scryfallShortcutsAttached = 'true';

    input.addEventListener('keydown', async function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const value = (input.value || '').trimStart();
      const token = getShortcutToken(value);
      if (!token) return;

      const queries = await getQueries();
      const shortcutMap = buildShortcutMap(queries);
      if (!shortcutMap.has(token)) return;

      const prefixLen = getShortcutPrefixLength(value);
      if (prefixLen <= 0) return;

      e.preventDefault();

      const after = value.slice(prefixLen);
      const space = e.key === ' ' && !after.startsWith(' ') ? ' ' : '';
      const expanded = shortcutMap.get(token) + space + after;
      const newValue = expandNested(expanded, shortcutMap);

      input.value = newValue;

      if (e.key === 'Enter') {
        const form = input.form;
        if (form) {
          form.submit();
        } else {
          const url = 'https://scryfall.com/search?q=' + encodeURIComponent(newValue.trim());
          window.location.href = url;
        }
      }
    });
  }

  function init() {
    const input = findSearchInput();
    if (input) attachToInput(input);
  }

  function isHomepage() {
    const path = window.location.pathname || '/';
    return path === '/' || path === '';
  }

  // function isSearchPage() {
  //   const path = window.location.pathname || '';
  //   return path === '/search' || path.startsWith('/search/');
  // }

  function injectHomepageDropdownStyles() {
    if (document.getElementById('scryfall-ext-styles')) return;
    const style = document.createElement('style');
    style.id = 'scryfall-ext-styles';
    style.textContent = `
      .scryfall-ext-wrap { display: inline-block; position: relative; margin: 0 0 0 6px; }
      .scryfall-ext-trigger { margin: 0 !important; color: #58a6ff !important; background: #161b22 !important; border: 1px solid #30363d !important; border-radius: 8px !important; padding: 6px 12px !important; text-decoration: none !important; font-size: 13px !important; font-weight: 500 !important; font-family: inherit !important; cursor: pointer !important; transition: color 0.15s, background 0.15s, border-color 0.15s !important; }
      .scryfall-ext-trigger:hover { color: #79b8ff !important; background: #21262d !important; border-color: #58a6ff !important; }
      .scryfall-ext-trigger-icon { width: 16px; height: 16px; vertical-align: middle; margin-right: 4px; }
      .scryfall-ext-panel { position: absolute; left: 0; top: 100%; margin-top: 4px; min-width: 220px; max-height: 320px; overflow-y: auto; background: #161b22; border: 1px solid #30363d; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 9999; padding: 6px 0; }
      .scryfall-ext-row { display: flex; align-items: center; gap: 8px; padding: 4px 12px; }
      .scryfall-ext-row:hover { background: #21262d; }
      .scryfall-ext-row-icon { flex-shrink: 0; width: 16px; text-align: center; color: #8b949e; font-size: 12px; }
      .scryfall-ext-row-icon::before { content: "\\1F50D"; }
      .scryfall-ext-row a { flex: 1; min-width: 0; padding: 4px 0; color: #e6edf3; text-decoration: none; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .scryfall-ext-row a:hover { color: #58a6ff; }
      .scryfall-ext-paste { flex-shrink: 0; padding: 4px 8px; font-size: 11px; font-weight: 500; color: #58a6ff; background: transparent; border: 1px solid #30363d; border-radius: 6px; cursor: pointer; }
      .scryfall-ext-paste:hover { background: #21262d; border-color: #58a6ff; color: #79b8ff; }
      .scryfall-ext-group { margin: 0; }
      .scryfall-ext-group-header { display: flex; align-items: center; gap: 4px; padding: 4px 12px 2px; font-size: 11px; color: #8b949e; font-weight: 600; cursor: pointer; user-select: none; }
      .scryfall-ext-group-header:hover { color: #e6edf3; }
      .scryfall-ext-group-header::before { content: "\\25B6"; font-size: 10px; }
      .scryfall-ext-group:not(.scryfall-ext-group--collapsed) .scryfall-ext-group-header::before { content: "\\25BC"; }
      .scryfall-ext-group-body { }
      .scryfall-ext-group--collapsed .scryfall-ext-group-body { display: none; }
      .scryfall-ext-empty { padding: 12px; color: #8b949e; font-size: 13px; }
    `;
    document.head.appendChild(style);
  }

  function renderDropdownPanel(panel, queries, folders, onClose) {
    const byFolder = new Map();
    byFolder.set('', []);
    folders.forEach((f) => byFolder.set(f.id, []));
    queries.forEach((q) => {
      const fid = (q.folderId || '').trim();
      if (!byFolder.has(fid)) byFolder.set(fid, []);
      byFolder.get(fid).push(q);
    });
    const shortcutMap = buildShortcutMap(queries);
    panel.innerHTML = '';
    if (queries.length === 0) {
      panel.innerHTML = '<div class="scryfall-ext-empty">No saved queries. Use the extension to add some.</div>';
      return;
    }
    function makeRow(q) {
      const rawQuery = (q.query || '').trim();
      const expandedQuery = expandNested(rawQuery, shortcutMap);
      const row = document.createElement('div');
      row.className = 'scryfall-ext-row';
      const icon = document.createElement('span');
      icon.className = 'scryfall-ext-row-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.title = 'Query';
      const a = document.createElement('a');
      a.href = SCRYFALL_SEARCH_URL + encodeURIComponent(expandedQuery);
      a.textContent = q.name || 'Unnamed';
      a.title = expandedQuery;
      const pasteBtn = document.createElement('button');
      pasteBtn.type = 'button';
      pasteBtn.className = 'scryfall-ext-paste';
      pasteBtn.textContent = 'Paste';
      pasteBtn.title = 'Paste into search bar';
      pasteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const input = findSearchInput();
        if (input) {
          input.value = expandedQuery;
          input.focus();
        }
        if (onClose) onClose();
      });
      row.appendChild(icon);
      row.appendChild(a);
      row.appendChild(pasteBtn);
      return row;
    }

    function addCollapsibleGroup(title, list, startCollapsed) {
      const section = document.createElement('div');
      section.className = 'scryfall-ext-group' + (startCollapsed !== false ? ' scryfall-ext-group--collapsed' : '');
      const header = document.createElement('div');
      header.className = 'scryfall-ext-group-header';
      header.setAttribute('role', 'button');
      header.setAttribute('aria-expanded', startCollapsed === false);
      header.textContent = title;
      header.addEventListener('click', function () {
        section.classList.toggle('scryfall-ext-group--collapsed');
        header.setAttribute('aria-expanded', !section.classList.contains('scryfall-ext-group--collapsed'));
      });
      const body = document.createElement('div');
      body.className = 'scryfall-ext-group-body';
      list.forEach((q) => body.appendChild(makeRow(q)));
      section.appendChild(header);
      section.appendChild(body);
      panel.appendChild(section);
    }

    const uncategorized = byFolder.get('') || [];
    uncategorized.forEach((q) => panel.appendChild(makeRow(q)));
    folders.forEach((folder) => {
      const list = byFolder.get(folder.id) || [];
      if (list.length === 0) return;
      addCollapsibleGroup(folder.name, list, true);
    });
  }

  // function findSearchPageAdvancedLink() {
  //   const searchInput = findSearchInput();
  //   const root = searchInput ? searchInput.closest('header') || searchInput.closest('main') || document.body : document.body;
  //   const links = root.querySelectorAll('a[href*="/advanced"]');
  //   for (const a of links) {
  //     const rect = a.getBoundingClientRect();
  //     if (rect.width > 0 && rect.height > 0) return a;
  //   }
  //   return links[0] || null;
  // }

  function createDropdownWrap() {
    injectHomepageDropdownStyles();
    const wrap = document.createElement('span');
    wrap.className = 'scryfall-ext-wrap';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = '';
    const iconImg = document.createElement('img');
    iconImg.src = chrome.runtime.getURL('icons/icon16.png');
    iconImg.alt = '';
    iconImg.className = 'scryfall-ext-trigger-icon';
    trigger.appendChild(iconImg);
    trigger.appendChild(document.createTextNode('Saved queries'));
    trigger.classList.add('scryfall-ext-trigger');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('div');
    panel.className = 'scryfall-ext-panel';
    panel.hidden = true;
    wrap.appendChild(trigger);
    wrap.appendChild(panel);

    function open() {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      Promise.all([getQueries(), getFolders()]).then(([queries, folders]) => {
        renderDropdownPanel(panel, queries, folders, close);
      });
    }
    function close() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
    function toggle(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (panel.hidden) open();
      else close();
    }
    trigger.addEventListener('click', (e) => toggle(e), true);
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) close();
    });
    panel.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') close();
    });
    return wrap;
  }

  function injectSavedQueriesDropdown(container) {
    if (!container || container.dataset.scryfallExtInjected) return;
    container.dataset.scryfallExtInjected = 'true';
    container.appendChild(createDropdownWrap());
  }

  function setupHomepageDropdown() {
    if (!isHomepage()) return;
    const linksEl = document.querySelector('.homepage-links');
    if (linksEl) injectSavedQueriesDropdown(linksEl);
  }

  // function setupSearchPageDropdown() {
  //   if (!isSearchPage()) return;
  //   if (document.getElementById('scryfall-ext-search-dropdown')) return;
  //   const advancedLink = findSearchPageAdvancedLink();
  //   if (!advancedLink) return;
  //   const wrap = createDropdownWrap();
  //   wrap.id = 'scryfall-ext-search-dropdown';
  //   advancedLink.parentNode.insertBefore(wrap, advancedLink.nextSibling);
  // }

  function initDropdowns() {
    if (document.readyState === 'loading') return;
    setupHomepageDropdown();
    // setupSearchPageDropdown();
    // if (isSearchPage()) {
    //   setTimeout(setupSearchPageDropdown, 500);
    //   setTimeout(setupSearchPageDropdown, 1500);
    // }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    document.addEventListener('DOMContentLoaded', initDropdowns);
  } else {
    init();
    initDropdowns();
  }

  function observeForSearch() {
    if (!document.body) return;
    let debounceTimer = null;
    const DEBOUNCE_MS = 200;
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const input = findSearchInput();
        if (input) attachToInput(input);
        setupHomepageDropdown();
        // setupSearchPageDropdown();
        const inputDone = !!findSearchInput()?.dataset?.scryfallShortcutsAttached;
        const linksEl = document.querySelector('.homepage-links');
        const homeDone = !isHomepage() || !!(linksEl && linksEl.dataset.scryfallExtInjected);
        if (inputDone && homeDone) observer.disconnect();
      }, DEBOUNCE_MS);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) observeForSearch();
  else document.addEventListener('DOMContentLoaded', observeForSearch);
})();
