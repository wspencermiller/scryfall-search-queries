const SCRYFALL_SEARCH_URL = 'https://scryfall.com/search?q=';
const STORAGE_KEY = 'scryfallSavedQueries';
const FOLDERS_KEY = 'scryfallFolders';
const EXPORT_VERSION = 1;

const syncStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null;

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

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
      resolve(Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : []);
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
      resolve(Array.isArray(data[FOLDERS_KEY]) ? data[FOLDERS_KEY] : []);
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

/** Build list of folders in tree order with depth (0 = root). At each level, leaf folders (no children) come before parent folders. */
function foldersWithDepth(folders) {
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
  const withParent = folders.filter((f) => (f.parentId || '').trim());
  const parentIds = new Set(folders.map((f) => f.id));
  const orphans = withParent.filter((f) => !parentIds.has((f.parentId || '').trim()));
  orphans.sort((a, b) => Number(hasChildren(a.id)) - Number(hasChildren(b.id)));
  orphans.forEach((f) => add(f, 0));
  return result;
}

function folderNameById(folders, id) {
  if (!id) return '—';
  const path = [];
  let f = folders.find((x) => x.id === id);
  while (f) {
    path.unshift(f.name);
    f = f.parentId ? folders.find((x) => x.id === f.parentId) : null;
  }
  return path.length ? path.join(' » ') : '—';
}

const formFolder = $('#form-folder');
const formQuery = $('#form-query');
const formImport = $('#form-import');
const inputFolderName = $('#input-folder-name');
const inputName = $('#input-name');
const inputShortcut = $('#input-shortcut');
const inputQuery = $('#input-query');
const inputFolder = $('#input-folder');
const folderList = $('#folder-list');
const queryTbody = $('#query-tbody');
const emptyQueries = $('#empty-queries');

function showForm(el, show) {
  el.classList.toggle('hidden', !show);
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

async function populateFolderParentSelect() {
  const sel = $('#input-folder-parent');
  if (!sel) return;
  sel.innerHTML = '<option value="">No folder (top level)</option>';
  const folders = await getFolders();
  foldersWithDepth(folders).forEach(({ folder, depth }) => {
    const opt = document.createElement('option');
    opt.value = folder.id;
    opt.textContent = (depth > 0 ? '\u2003'.repeat(depth) + '\u2514 ' : '') + folder.name;
    sel.appendChild(opt);
  });
}

function renderFolderItem(folder, folders, queries, depth) {
  depth = depth || 0;
  const li = document.createElement('li');
  li.className = 'folder-item' + (depth > 0 ? ' folder-item--nested' : '');
  li.dataset.folderId = folder.id;
  li.style.setProperty('--folder-depth', String(depth));
  const count = queries.filter((q) => (q.folderId || '') === folder.id).length;
  li.innerHTML = `
    <span class="folder-item-name">${escapeHtml(folder.name)}</span>
    <span class="folder-item-count">${count}</span>
    <button type="button" class="btn btn-icon btn-rename-folder" title="Rename">✎</button>
    <button type="button" class="btn btn-icon btn-delete-folder btn-delete" title="Delete">✕</button>
  `;
  li.querySelector('.btn-rename-folder').addEventListener('click', () => startRenameFolder(folder));
  li.querySelector('.btn-delete-folder').addEventListener('click', () => deleteFolder(folder.id));
  return li;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function startRenameFolder(folder) {
  const name = prompt('Folder name:', folder.name);
  if (name == null || !name.trim()) return;
  const folders = await getFolders();
  const i = folders.findIndex((f) => f.id === folder.id);
  if (i === -1) return;
  folders[i] = { ...folders[i], name: name.trim() };
  await setFolders(folders);
  render();
}

async function deleteFolder(id) {
  if (!confirm('Delete this folder? Its subfolders will move up; queries in it will move to the parent folder (or "No folder").')) return;
  const [folders, queries] = await Promise.all([getFolders(), getQueries()]);
  const folder = folders.find((f) => f.id === id);
  const parentId = folder ? (folder.parentId || '').trim() : '';
  const nextFolders = folders.filter((f) => f.id !== id).map((f) =>
    (f.parentId || '').trim() === id ? { ...f, parentId } : f
  );
  const nextQueries = queries.map((q) => (q.folderId === id ? { ...q, folderId: parentId } : q));
  await Promise.all([setFolders(nextFolders), setQueries(nextQueries)]);
  render();
}

function renderQueryRow(query, folders, editing) {
  const tr = document.createElement('tr');
  tr.className = 'query-row' + (editing ? ' query-row--editing' : '');
  tr.dataset.queryId = query.id;
  const folderName = folderNameById(folders, query.folderId || '');

  if (editing) {
    const select = document.createElement('select');
    select.className = 'edit-select';
    select.innerHTML = '<option value="">No folder</option>';
    foldersWithDepth(folders).forEach(({ folder, depth }) => {
      const opt = document.createElement('option');
      opt.value = folder.id;
      opt.textContent = (depth > 0 ? '\u2003'.repeat(depth) + '\u2514 ' : '') + folder.name;
      if ((query.folderId || '') === folder.id) opt.selected = true;
      select.appendChild(opt);
    });
    tr.innerHTML = `
      <td><input type="text" class="edit-input edit-name" value="${escapeHtml(query.name)}" maxlength="80"></td>
      <td><input type="text" class="edit-input edit-shortcut" value="${escapeHtml(query.shortcut || '')}" maxlength="40"></td>
      <td class="edit-cell-folder"></td>
      <td><input type="text" class="edit-input edit-query" value="${escapeHtml(query.query)}"></td>
      <td class="td-actions">
        <button type="button" class="btn btn-sm btn-primary btn-save-query">Save</button>
        <button type="button" class="btn btn-sm btn-ghost btn-cancel-query">Cancel</button>
      </td>
    `;
    tr.querySelector('.edit-cell-folder').appendChild(select);
    tr.querySelector('.btn-save-query').addEventListener('click', () => saveQueryRow(tr, query.id));
    tr.querySelector('.btn-cancel-query').addEventListener('click', () => render());
    return tr;
  }

  const queryPreview = query.query.length > 50 ? query.query.slice(0, 50) + '…' : query.query;
  tr.innerHTML = `
    <td class="td-name">${escapeHtml(query.name)}</td>
    <td class="td-shortcut">${query.shortcut ? '?' + escapeHtml(query.shortcut) : '—'}</td>
    <td class="td-folder">${escapeHtml(folderName)}</td>
    <td class="td-query" title="${escapeHtml(query.query)}">${escapeHtml(queryPreview)}</td>
    <td class="td-actions">
      <a href="${SCRYFALL_SEARCH_URL + encodeURIComponent(query.query)}" target="_blank" rel="noopener" class="btn btn-sm btn-ghost">Open</a>
      <button type="button" class="btn btn-sm btn-ghost btn-edit-query">Edit</button>
      <button type="button" class="btn btn-sm btn-ghost btn-delete-query btn-delete">Delete</button>
    </td>
  `;
  tr.querySelector('.btn-edit-query').addEventListener('click', () => {
    tr.replaceWith(renderQueryRow(query, folders, true));
  });
  tr.querySelector('.btn-delete-query').addEventListener('click', () => deleteQuery(query.id));
  return tr;
}

async function saveQueryRow(tr, queryId) {
  const name = tr.querySelector('.edit-name').value.trim();
  const shortcut = tr.querySelector('.edit-shortcut').value.trim().toLowerCase().replace(/\s+/g, '');
  const folderId = (tr.querySelector('.edit-cell-folder select').value || '').trim();
  const query = tr.querySelector('.edit-query').value.trim();
  if (!name || !query) return;
  const queries = await getQueries();
  const i = queries.findIndex((q) => q.id === queryId);
  if (i === -1) return;
  queries[i] = { ...queries[i], name, shortcut, folderId, query };
  await setQueries(queries);
  render();
}

async function deleteQuery(id) {
  if (!confirm('Delete this query?')) return;
  const queries = await getQueries().then((q) => q.filter((x) => x.id !== id));
  await setQueries(queries);
  render();
}

async function render() {
  const [queries, folders] = await Promise.all([getQueries(), getFolders()]);

  folderList.innerHTML = '';
  if (folders.length === 0) {
    folderList.innerHTML = '<li class="folder-item folder-item--empty">No folders</li>';
  } else {
    foldersWithDepth(folders).forEach(({ folder, depth }) => folderList.appendChild(renderFolderItem(folder, folders, queries, depth)));
  }

  queryTbody.innerHTML = '';
  emptyQueries.classList.toggle('hidden', queries.length > 0);
  queries.forEach((q) => queryTbody.appendChild(renderQueryRow(q, folders, false)));
}

formFolder.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = inputFolderName.value.trim();
  if (!name) return;
  const folders = await getFolders();
  const parentId = ($('#input-folder-parent').value || '').trim();
  folders.push({ id: generateFolderId(), name, parentId: parentId || '' });
  await setFolders(folders);
  formFolder.reset();
  showForm(formFolder, false);
  render();
});

$('#btn-new-folder').addEventListener('click', () => {
  showForm(formQuery, false);
  showForm(formFolder, true);
  populateFolderParentSelect();
  inputFolderName.value = '';
  inputFolderName.focus();
});
$('#btn-cancel-folder').addEventListener('click', () => showForm(formFolder, false));

formQuery.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = inputName.value.trim();
  const shortcut = inputShortcut.value.trim().toLowerCase().replace(/\s+/g, '');
  const query = inputQuery.value.trim();
  const folderId = (inputFolder.value || '').trim();
  if (!name || !query) return;
  const queries = await getQueries();
  queries.push({ id: generateId(), name, shortcut: shortcut || '', query, folderId: folderId || '' });
  await setQueries(queries);
  formQuery.reset();
  showForm(formQuery, false);
  render();
});

$('#btn-new-query').addEventListener('click', () => {
  showForm(formFolder, false);
  showForm(formQuery, true);
  populateFolderSelect('');
  inputName.value = '';
  inputShortcut.value = '';
  inputQuery.value = '';
  inputName.focus();
});
$('#btn-cancel-query').addEventListener('click', () => showForm(formQuery, false));

async function doExport() {
  scryfallLog.log('Export started (manage)', 'info');
  try {
    const [queries, folders] = await Promise.all([getQueries(), getFolders()]);
    const data = { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), folders, queries };
    const json = JSON.stringify(data, null, 2);
    await new Promise(function (resolve) {
      chrome.storage.local.set({ scryfallExportPreview: json }, resolve);
    });
    window.open(chrome.runtime.getURL('export.html'), '_blank');
    scryfallLog.log('Export done (manage)', 'info');
  } catch (err) {
    scryfallLog.logError('Export failed (manage)', err);
  }
}

function isValidExportShape(data) {
  return data && typeof data === 'object' && Array.isArray(data.queries) && Array.isArray(data.folders);
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
  return { id: f.id && typeof f.id === 'string' ? f.id : generateFolderId(), name: typeof f.name === 'string' ? f.name.trim() : 'Unnamed folder', parentId: typeof f.parentId === 'string' ? f.parentId.trim() : '' };
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
  render();
}

$('#btn-export').addEventListener('click', () => doExport());
$('#btn-import').addEventListener('click', () => {
  showForm(formFolder, false);
  showForm(formQuery, false);
  showForm(formImport, true);
  $('#input-import-paste').value = '';
  $('#input-import-paste').focus();
});
$('#btn-cancel-import').addEventListener('click', () => showForm(formImport, false));
formImport.addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = $('#input-import-paste').value.trim();
  if (!raw) return;
  try {
    await doImportFromJson(raw);
    showForm(formImport, false);
    scryfallLog.log('Import done (manage)', 'info');
  } catch (err) {
    alert('Import failed: ' + (err?.message || String(err)));
    scryfallLog.logError('Import failed (manage)', err);
  }
});
$('#btn-log').addEventListener('click', () => {
  window.open(chrome.runtime.getURL('log.html'), '_blank');
});

function setupCollapsibleSections() {
  function toggleSection(sectionId, titleId) {
    const section = document.getElementById(sectionId);
    const title = document.getElementById(titleId);
    if (!section || !title) return;
    const collapsed = section.classList.toggle('manage-section--collapsed');
    title.setAttribute('aria-expanded', !collapsed);
  }
  ['section-folders', 'section-queries'].forEach((id) => {
    const titleId = id + '-title';
    const title = document.getElementById(titleId);
    if (!title) return;
    title.addEventListener('click', () => toggleSection(id, titleId));
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSection(id, titleId);
      }
    });
  });
}
setupCollapsibleSections();

scryfallLog.log('Manage page opened', 'info');
render();
