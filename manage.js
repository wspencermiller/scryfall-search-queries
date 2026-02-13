const SCRYFALL_SEARCH_URL = 'https://scryfall.com/search?q=';
const STORAGE_KEY = 'scryfallSavedQueries';
const FOLDERS_KEY = 'scryfallFolders';
const EXPORT_VERSION = 1;

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
    chrome.storage.sync.get([STORAGE_KEY], (data) => {
      resolve(Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : []);
    });
  });
}
function setQueries(queries) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: queries }, resolve);
  });
}
function getFolders() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([FOLDERS_KEY], (data) => {
      resolve(Array.isArray(data[FOLDERS_KEY]) ? data[FOLDERS_KEY] : []);
    });
  });
}
function setFolders(folders) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [FOLDERS_KEY]: folders }, resolve);
  });
}

function folderNameById(folders, id) {
  if (!id) return '—';
  const f = folders.find((x) => x.id === id);
  return f ? f.name : '—';
}

const formFolder = $('#form-folder');
const formQuery = $('#form-query');
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
  folders.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    if (f.id === selectedId) opt.selected = true;
    inputFolder.appendChild(opt);
  });
}

function renderFolderItem(folder, folders, queries) {
  const li = document.createElement('li');
  li.className = 'folder-item';
  li.dataset.folderId = folder.id;
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
  if (!confirm('Delete this folder? Queries in it will move to "No folder".')) return;
  const [folders, queries] = await Promise.all([getFolders(), getQueries()]);
  const nextFolders = folders.filter((f) => f.id !== id);
  const nextQueries = queries.map((q) => (q.folderId === id ? { ...q, folderId: '' } : q));
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
    folders.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      if ((query.folderId || '') === f.id) opt.selected = true;
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
    folders.forEach((f) => folderList.appendChild(renderFolderItem(f, folders, queries)));
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
  folders.push({ id: generateFolderId(), name });
  await setFolders(folders);
  formFolder.reset();
  showForm(formFolder, false);
  render();
});

$('#btn-new-folder').addEventListener('click', () => {
  showForm(formQuery, false);
  showForm(formFolder, true);
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
  const [queries, folders] = await Promise.all([getQueries(), getFolders()]);
  const data = { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), folders, queries };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scryfall-queries-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
  return { id: f.id && typeof f.id === 'string' ? f.id : generateFolderId(), name: typeof f.name === 'string' ? f.name.trim() : 'Unnamed folder' };
}

async function doImport(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!isValidExportShape(data)) {
          reject(new Error('Invalid file format.'));
          return;
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
        resolve();
      } catch (err) {
        reject(err instanceof SyntaxError ? new Error('Invalid JSON.') : err);
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file, 'UTF-8');
  });
}

$('#btn-export').addEventListener('click', () => doExport());
$('#btn-import').addEventListener('click', () => {
  $('#input-import-file').value = '';
  $('#input-import-file').click();
});
$('#input-import-file').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  doImport(file).catch((err) => alert('Import failed: ' + (err?.message || String(err))));
});

render();
