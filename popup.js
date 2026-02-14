const SCRYFALL_SEARCH_URL = 'https://scryfall.com/search?q=';
const STORAGE_KEY = 'scryfallSavedQueries';
const FOLDERS_KEY = 'scryfallFolders';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const formAdd = $('#form-add');
const formFolder = $('#form-folder');
const inputName = $('#input-name');
const inputShortcut = $('#input-shortcut');
const inputQuery = $('#input-query');
const inputFolder = $('#input-folder');
const inputFolderParent = $('#input-folder-parent');
const inputFolderName = $('#input-folder-name');
const btnAdd = $('#btn-add');
const btnCancelAdd = $('#btn-cancel-add');
const btnAddFolder = $('#btn-add-folder');
const btnCancelFolder = $('#btn-cancel-folder');
const btnManage = $('#btn-manage');
const btnExport = $('#btn-export');
const btnImport = $('#btn-import');
const formImport = $('#form-import');
const inputImportPaste = $('#input-import-paste');
const btnCancelImport = $('#btn-cancel-import');
const btnLog = $('#btn-log');
const queryList = $('#query-list');
const emptyState = $('#empty-state');

const EXPORT_VERSION = 1;

const syncStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null;

function generateId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateFolderId() {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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

function setQueries(queries) {
  return new Promise((resolve) => {
    if (!syncStorage) {
      resolve();
      return;
    }
    syncStorage.set({ [STORAGE_KEY]: queries }, resolve);
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

function setFolders(folders) {
  return new Promise((resolve) => {
    if (!syncStorage) {
      resolve();
      return;
    }
    syncStorage.set({ [FOLDERS_KEY]: folders }, resolve);
  });
}

function scryfallUrl(query) {
  return SCRYFALL_SEARCH_URL + encodeURIComponent(query.trim());
}

function showEmptyState(show) {
  emptyState.classList.toggle('hidden', !show);
}

function showAddForm(show) {
  formAdd.classList.toggle('hidden', !show);
  if (show) {
    formImport.classList.add('hidden');
    inputName.value = '';
    inputShortcut.value = '';
    inputQuery.value = '';
    populateFolderSelect('');
    inputName.focus();
  }
}

async function showFolderForm(show) {
  formFolder.classList.toggle('hidden', !show);
  if (show) {
    formImport.classList.add('hidden');
    inputFolderParent.innerHTML = '<option value="">No folder (top level)</option>';
    const folders = await getFolders();
    foldersWithDepth(folders).forEach(({ folder, depth }) => {
      const opt = document.createElement('option');
      opt.value = folder.id;
      opt.textContent = (depth > 0 ? '\u2003'.repeat(depth) + '\u2514 ' : '') + folder.name;
      inputFolderParent.appendChild(opt);
    });
    inputFolderName.value = '';
    inputFolderName.focus();
  }
}

/** Build list of folders in tree order with depth (0 = root). At each level, leaf folders (no children) come before parent folders. */
function foldersWithDepth(folders) {
  const idToFolder = new Map();
  folders.forEach((f) => idToFolder.set(f.id, { ...f, parentId: (f.parentId || '').trim() }));
  const hasChildren = (folderId) => folders.some((f) => (f.parentId || '').trim() === folderId);
  const result = [];
  function add(folder, depth) {
    result.push({ folder, depth });
    const children = folders.filter((f) => (f.parentId || '').trim() === folder.id);
    children.sort((a, b) => Number(hasChildren(a.id)) - Number(hasChildren(b.id)));
    children.forEach((c) => add(c, depth + 1));
  }
  const roots = folders.filter((f) => !(f.parentId || '').trim());
  roots.sort((a, b) => Number(hasChildren(a.id)) - Number(hasChildren(b.id)));
  roots.forEach((f) => add(f, 0));
  const orphans = folders.filter((f) => (f.parentId || '').trim() && !idToFolder.get((f.parentId || '').trim()));
  orphans.sort((a, b) => Number(hasChildren(a.id)) - Number(hasChildren(b.id)));
  orphans.forEach((f) => add(f, 0));
  return result;
}

async function populateFolderSelect(selectedId) {
  const folders = await getFolders();
  inputFolder.innerHTML = '<option value="">No folder</option>';
  foldersWithDepth(folders).forEach(({ folder, depth }) => {
    const opt = document.createElement('option');
    opt.value = folder.id;
    opt.textContent = (depth > 0 ? '\u2003'.repeat(depth) + '\u2514 ' : '') + folder.name;
    if (folder.id === selectedId) opt.selected = true;
    inputFolder.appendChild(opt);
  });
}

function renderQueryItem(query) {
  const li = document.createElement('li');
  li.className = 'query-item';
  li.dataset.id = query.id;

  const link = document.createElement('a');
  link.href = scryfallUrl(query.query);
  link.target = '_blank';
  link.rel = 'noopener';
  link.className = 'query-link';

  const label = document.createElement('span');
  label.className = 'query-label';
  label.textContent = query.name;
  const shortcut = (query.shortcut || '').trim();
  if (shortcut) {
    const shortcutSpan = document.createElement('span');
    shortcutSpan.className = 'query-shortcut';
    shortcutSpan.textContent = ` ?${shortcut}`;
    label.appendChild(shortcutSpan);
  }

  const text = document.createElement('span');
  text.className = 'query-text';
  text.textContent = query.query;

  link.append(label, text);

  const actions = document.createElement('div');
  actions.className = 'query-actions';

  const btnRename = document.createElement('button');
  btnRename.type = 'button';
  btnRename.className = 'btn btn-icon';
  btnRename.title = 'Edit';
  btnRename.textContent = '✎';
  btnRename.setAttribute('aria-label', 'Edit query');

  actions.append(btnRename);
  li.append(link, actions);

  btnRename.addEventListener('click', (e) => {
    e.preventDefault();
    startRename(li, query);
  });

  return li;
}

function startRename(li, query) {
  li.classList.add('editing');
  const link = li.querySelector('.query-link');
  const actions = li.querySelector('.query-actions');

  const inputName = document.createElement('input');
  inputName.type = 'text';
  inputName.className = 'rename-input';
  inputName.value = query.name;
  inputName.maxLength = 80;
  inputName.placeholder = 'Name';
  inputName.setAttribute('aria-label', 'Query name');

  const inputShortcut = document.createElement('input');
  inputShortcut.type = 'text';
  inputShortcut.className = 'rename-input';
  inputShortcut.value = query.shortcut || '';
  inputShortcut.maxLength = 40;
  inputShortcut.placeholder = 'Shortcut (e.g. commander for ?commander)';
  inputShortcut.setAttribute('aria-label', 'Shortcut');

  const selectFolder = document.createElement('select');
  selectFolder.className = 'rename-input';
  selectFolder.setAttribute('aria-label', 'Folder');
  getFolders().then((folders) => {
    selectFolder.innerHTML = '<option value="">No folder</option>';
    foldersWithDepth(folders).forEach(({ folder, depth }) => {
      const opt = document.createElement('option');
      opt.value = folder.id;
      opt.textContent = (depth > 0 ? '\u2003'.repeat(depth) + '\u2514 ' : '') + folder.name;
      if ((query.folderId || '') === folder.id) opt.selected = true;
      selectFolder.appendChild(opt);
    });
  });

  const textareaQuery = document.createElement('textarea');
  textareaQuery.className = 'rename-input rename-input--query';
  textareaQuery.rows = 3;
  textareaQuery.placeholder = 'Scryfall query';
  textareaQuery.setAttribute('aria-label', 'Query');
  textareaQuery.value = query.query || '';

  const btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'btn btn-primary';
  btnSave.textContent = 'Save';

  const btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'btn btn-ghost';
  btnCancel.textContent = 'Cancel';

  link.after(inputName, inputShortcut, selectFolder, textareaQuery);
  actions.innerHTML = '';
  actions.append(btnSave, btnCancel);
  inputName.focus();
  inputName.select();

  function saveHandler() {
    const newName = inputName.value.trim();
    const newQuery = textareaQuery.value.trim();
    if (newName && newQuery) {
      const shortcut = inputShortcut.value.trim().toLowerCase().replace(/\s+/g, '');
      const folderId = (selectFolder.value || '').trim();
      updateQuery(query.id, { name: newName, shortcut, folderId, query: newQuery });
    }
  }

  function cancelHandler() {
    refreshList();
  }

  function keyHandler(e) {
    if (e.key === 'Enter' && e.target !== textareaQuery) saveHandler();
    if (e.key === 'Escape') cancelHandler();
  }

  btnSave.addEventListener('click', saveHandler);
  btnCancel.addEventListener('click', cancelHandler);
  inputName.addEventListener('keydown', keyHandler);
  inputShortcut.addEventListener('keydown', keyHandler);
  selectFolder.addEventListener('keydown', keyHandler);
  textareaQuery.addEventListener('keydown', keyHandler);
}

async function updateQuery(id, patch) {
  const queries = await getQueries();
  const index = queries.findIndex((q) => q.id === id);
  if (index === -1) return;
  queries[index] = { ...queries[index], ...patch };
  await setQueries(queries);
  refreshList();
}

function renderFolderHeader(folder, queriesInFolder, collapsed) {
  const section = document.createElement('li');
  section.className = 'folder-section' + (collapsed ? ' folder-section--collapsed' : '');
  section.dataset.folderId = folder.id;

  const header = document.createElement('div');
  header.className = 'folder-header';
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', !collapsed);
  header.tabIndex = 0;

  const label = document.createElement('span');
  label.className = 'folder-name';
  label.textContent = folder.name;

  const count = document.createElement('span');
  count.className = 'folder-count';
  count.textContent = `(${queriesInFolder.length})`;

  const actions = document.createElement('div');
  actions.className = 'folder-actions';
  const btnRename = document.createElement('button');
  btnRename.type = 'button';
  btnRename.className = 'btn btn-icon';
  btnRename.title = 'Rename folder';
  btnRename.textContent = '✎';
  btnRename.setAttribute('aria-label', 'Rename folder');
  actions.append(btnRename);

  header.append(label, count, actions);

  header.addEventListener('click', (e) => {
    if (e.target.closest('.folder-actions')) return;
    section.classList.toggle('folder-section--collapsed');
    header.setAttribute('aria-expanded', !section.classList.contains('folder-section--collapsed'));
  });
  header.addEventListener('keydown', (e) => {
    if (e.target.closest('.folder-actions')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      section.classList.toggle('folder-section--collapsed');
      header.setAttribute('aria-expanded', !section.classList.contains('folder-section--collapsed'));
    }
  });

  btnRename.addEventListener('click', (e) => {
    e.stopPropagation();
    startRenameFolder(section, folder);
  });

  section.appendChild(header);
  return section;
}

function startRenameFolder(sectionEl, folder) {
  const header = sectionEl.querySelector('.folder-header');
  const label = sectionEl.querySelector('.folder-name');
  const actions = sectionEl.querySelector('.folder-actions');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'folder-rename-input';
  input.value = folder.name;
  input.maxLength = 60;
  label.replaceWith(input);
  actions.style.visibility = 'hidden';
  input.focus();
  input.select();

  function commit() {
    const name = input.value.trim();
    if (name) updateFolder(folder.id, { name });
    refreshList();
  }

  function keyHandler(e) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') refreshList();
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', keyHandler);
}

async function updateFolder(id, patch) {
  const folders = await getFolders();
  const index = folders.findIndex((f) => f.id === id);
  if (index === -1) return;
  folders[index] = { ...folders[index], ...patch };
  await setFolders(folders);
  refreshList();
}

function refreshList() {
  Promise.all([getQueries(), getFolders()]).then(([queries, folders]) => {
    queryList.innerHTML = '';
    showEmptyState(queries.length === 0);

    const byFolder = new Map();
    byFolder.set('', []);
    folders.forEach((f) => byFolder.set(f.id, []));
    queries.forEach((q) => {
      const fid = (q.folderId || '').trim();
      if (!byFolder.has(fid)) byFolder.set(fid, []);
      byFolder.get(fid).push(q);
    });

    const uncategorized = byFolder.get('');
    if (uncategorized.length > 0) {
      const section = document.createElement('li');
      section.className = 'folder-section folder-section--collapsed';
      section.dataset.folderId = '';
      const header = document.createElement('div');
      header.className = 'folder-header folder-header--uncategorized';
      header.innerHTML = '<span class="folder-name">No folder</span>';
      header.setAttribute('aria-expanded', 'false');
      header.setAttribute('role', 'button');
      header.tabIndex = 0;
      header.addEventListener('click', () => {
        section.classList.toggle('folder-section--collapsed');
        header.setAttribute('aria-expanded', !section.classList.contains('folder-section--collapsed'));
      });
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          section.classList.toggle('folder-section--collapsed');
          header.setAttribute('aria-expanded', !section.classList.contains('folder-section--collapsed'));
        }
      });
      section.appendChild(header);
      const ul = document.createElement('ul');
      ul.className = 'folder-queries';
      uncategorized.forEach((q) => ul.appendChild(renderQueryItem(q)));
      section.appendChild(ul);
      queryList.appendChild(section);
    }

    function renderFolderNode(folder, depth) {
      const listInFolder = byFolder.get(folder.id) || [];
      const section = renderFolderHeader(folder, listInFolder, true);
      if (depth > 0) section.classList.add('folder-section--nested');
      section.style.setProperty('--folder-depth', String(depth));
      const inner = document.createElement('div');
      inner.className = 'folder-section-inner';
      let childFolders = folders.filter((f) => (f.parentId || '').trim() === folder.id);
      childFolders = childFolders.sort((a, b) => Number(folders.some((f) => (f.parentId || '').trim() === a.id)) - Number(folders.some((f) => (f.parentId || '').trim() === b.id)));
      if (childFolders.length > 0) {
        const ulChildren = document.createElement('ul');
        ulChildren.className = 'folder-children';
        childFolders.forEach((child) => ulChildren.appendChild(renderFolderNode(child, depth + 1)));
        inner.appendChild(ulChildren);
      }
      const ul = document.createElement('ul');
      ul.className = 'folder-queries';
      listInFolder.forEach((q) => ul.appendChild(renderQueryItem(q)));
      inner.appendChild(ul);
      section.appendChild(inner);
      return section;
    }
    const hasChildrenInTree = (folderId) => folders.some((f) => (f.parentId || '').trim() === folderId);
    let rootFolders = folders.filter((f) => !(f.parentId || '').trim());
    rootFolders = rootFolders.sort((a, b) => Number(hasChildrenInTree(a.id)) - Number(hasChildrenInTree(b.id)));
    rootFolders.forEach((folder) => queryList.appendChild(renderFolderNode(folder, 0)));
  });
}

formAdd.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = inputName.value.trim();
  const shortcut = inputShortcut.value.trim().toLowerCase().replace(/\s+/g, '');
  const query = inputQuery.value.trim();
  const folderId = (inputFolder.value || '').trim();
  if (!name || !query) return;
  const queries = await getQueries();
  queries.push({ id: generateId(), name, shortcut: shortcut || '', query, folderId: folderId || '' });
  await setQueries(queries);
  showAddForm(false);
  refreshList();
});

btnAdd.addEventListener('click', () => {
  showFolderForm(false);
  showAddForm(true);
});
btnCancelAdd.addEventListener('click', () => showAddForm(false));

btnAddFolder.addEventListener('click', () => {
  showAddForm(false);
  showFolderForm(true);
});
btnCancelFolder.addEventListener('click', () => showFolderForm(false));

formFolder.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = inputFolderName.value.trim();
  if (!name) return;
  const parentId = (inputFolderParent.value || '').trim();
  const folders = await getFolders();
  folders.push({ id: generateFolderId(), name, parentId: parentId || '' });
  await setFolders(folders);
  showFolderForm(false);
  refreshList();
});

async function doExport() {
  scryfallLog.log('Export started', 'info');
  try {
    const [queries, folders] = await Promise.all([getQueries(), getFolders()]);
    const data = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      folders,
      queries,
    };
    const json = JSON.stringify(data, null, 2);
    await new Promise((resolve) => {
      chrome.storage.local.set({ scryfallExportPreview: json }, resolve);
    });
    window.open(chrome.runtime.getURL('export.html'), '_blank');
    scryfallLog.log('Export done', 'info');
  } catch (err) {
    scryfallLog.logError('Export failed', err);
  }
}

function isValidExportShape(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.queries) &&
    Array.isArray(data.folders)
  );
}

function normalizeQuery(q) {
  return {
    id: q.id && typeof q.id === 'string' ? q.id : generateId(),
    name: typeof q.name === 'string' ? q.name.trim() : 'Unnamed',
    shortcut: typeof q.shortcut === 'string' ? q.shortcut.trim().toLowerCase().replace(/\s+/g, '') : '',
    query: typeof q.query === 'string' ? q.query.trim() : '',
    folderId: typeof q.folderId === 'string' ? q.folderId.trim() : '',
  };
}

function normalizeFolder(f) {
  return {
    id: f.id && typeof f.id === 'string' ? f.id : generateFolderId(),
    name: typeof f.name === 'string' ? f.name.trim() : 'Unnamed folder',
    parentId: typeof f.parentId === 'string' ? f.parentId.trim() : '',
  };
}

function showImportForm(show) {
  formImport.classList.toggle('hidden', !show);
  if (show) {
    inputImportPaste.value = '';
    inputImportPaste.focus();
  }
}

async function doImportFromJson(jsonText) {
  const data = JSON.parse(jsonText);
  if (!isValidExportShape(data)) {
    throw new Error('Invalid format: expected "queries" and "folders" arrays.');
  }
  const folderIds = new Set((data.folders || []).map((f) => normalizeFolder(f).id));
  const folders = (data.folders || []).map(normalizeFolder);
  const queries = (data.queries || []).map((q) => {
    const n = normalizeQuery(q);
    if (n.folderId && !folderIds.has(n.folderId)) n.folderId = '';
    return n;
  });
  await Promise.all([setFolders(folders), setQueries(queries)]);
  refreshList();
}

btnManage.addEventListener('click', () => {
  window.open(chrome.runtime.getURL('manage.html'), '_blank');
});

btnExport.addEventListener('click', () => doExport());

btnImport.addEventListener('click', () => {
  showFolderForm(false);
  showAddForm(false);
  showImportForm(true);
});

btnCancelImport.addEventListener('click', () => showImportForm(false));

formImport.addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = inputImportPaste.value.trim();
  if (!raw) return;
  try {
    await doImportFromJson(raw);
    showImportForm(false);
    if (typeof scryfallLog !== 'undefined') scryfallLog.log('Import done', 'info');
  } catch (err) {
    alert('Import failed: ' + (err?.message || String(err)));
    if (typeof scryfallLog !== 'undefined') scryfallLog.logError('Import failed', err);
  }
});

btnLog.addEventListener('click', () => {
  window.open(chrome.runtime.getURL('log.html'), '_blank');
});

scryfallLog.log('Popup opened', 'info');
refreshList();
