# Scryfall Saved Queries – Chrome Extension

Save and manage Scryfall search queries so you can run them with one click.

## Features

- **Folders** – Organize queries in folders. Create folders with “+ Folder”, assign a folder when adding or editing a query. Click a folder header to collapse/expand it; rename or delete folders with ✎ and ✕.
- **Create** – Add a new saved query with a name, optional **folder**, optional **shortcut**, and Scryfall query string.
- **Read** – See all saved queries grouped by folder; click a query to open it on Scryfall in a new tab.
- **Update** – Change the name, folder, or shortcut with the edit (✎) button.
- **Delete** – Remove a query with the delete (✕) button. Deleting a folder moves its queries to “No folder”.
- **Shortcuts on Scryfall** – On scryfall.com, type `?` plus your shortcut in the search box (e.g. `?commander`), then press **Space** or **Enter** to expand it into the full saved query. Shortcuts can **nest**: a shortcut’s query can contain another `?shortcut`, and all are expanded in one go (e.g. `?c` → `is:commander f:edh game:paper`, and `?abzC` → `?c ci=abzan` → `is:commander f:edh game:paper ci=abzan`).
- **Saved queries on the homepage** – On the [Scryfall homepage](https://scryfall.com/), a **Saved queries** dropdown appears in the same row as “Advanced Search”, “Syntax Guide”, etc. Click it to pick a saved query and jump to that search.

Data is stored in Chrome’s sync storage, so it follows your Chrome account across devices.

## Install (unpacked)

1. Open Chrome or Brave and go to `chrome://extensions` (or `brave://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this folder (`scryfall-saved-queries`).
4. If the browser shows “This extension cannot read and change site information…”, click the extension card and ensure **Allow access to scryfall.com** (or similar) is enabled, or **remove** the extension and **Load unpacked** again so the host permission is requested at install time.
5. Use the extension icon in the toolbar to open the popup.

## Usage

- **Add folder:** Click “+ Folder”, enter a name, then **Create**.
- **Add query:** Click “+ Query”, enter a name, choose a folder (or “No folder”), an optional shortcut, and the Scryfall query, then **Save**.
- **Run query:** Click the query row to open that search on Scryfall in a new tab.
- **Folders:** Queries are grouped by folder. Click a folder header to collapse or expand it. Use ✎ and ✕ on the folder to rename or delete it (deleting a folder moves its queries to “No folder”).
- **Shortcut on Scryfall:** On any Scryfall page, type `?` plus your shortcut in the search box (e.g. `?commander`), then press **Space** or **Enter** to replace it with the full query (Enter also runs the search).
- **Edit query:** Click ✎ on a query to change name, folder, or shortcut, then **Save** or Enter. **Cancel** or Escape discards changes.
- **Delete:** Click ✕ on a query or folder to remove it.up- **Manage:** Click **Manage** in the popup footer to open a full-page editor in a new tab. There you can see all folders and queries in a table, edit or delete any query inline, rename or delete folders, and use Export.

## Debugging

Load the extension **unpacked** (see Install above) so you can use DevTools.

- **Popup (toolbar icon):**
  - Open the popup, then **right‑click inside the popup** → **Inspect**. DevTools opens for the popup. Use the **Console** tab for `console.log` / errors and the **Sources** tab to set breakpoints in `popup.js`.
  - If the popup closes when you click away, open the popup again and use the extension’s **Inspect** link: go to `chrome://extensions`, find “Scryfall Saved Queries”, and click **Inspect views: popup.html** (or the link under the extension card) while the popup is open.

- **Manage page:**
  - The manage page opens in a normal tab. Press **F12** (or right‑click → **Inspect**) on that tab. Console and Sources work as on any webpage; scripts are `manage.html` / `manage.js`.

- **Content script (scryfall.com):**
  - Open a Scryfall page (e.g. [scryfall.com](https://scryfall.com)), then open DevTools (**F12**) on that tab. In **Sources**, look for your extension under **Content scripts** or by extension ID; `content.js` will be there. Set breakpoints or add `console.log` in `content.js` and you’ll see output in this page’s Console.

- **Extension errors:**
  - On `chrome://extensions`, turn on **Developer mode** and check for an **Errors** button on the extension card. Click it to see install/runtime errors.

- **In-extension log:**
  - Click **Log** in the popup footer or on the Manage page to open a log viewer in a new tab. The extension records recent actions (e.g. popup opened, export started/done, content script loaded) in a rotating buffer (last 150 entries). Use **Refresh** to update the view and **Clear log** to reset.

## Package for deploy

To build a zip for the Chrome Web Store, Brave, or distribution:

```bash
./pack.sh
```

This creates **scryfall-saved-queries.zip** in the project folder containing only the extension files (manifest, popup, manage, content script, icons). Upload that zip to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) for publishing, or share the zip so others can unzip and use **Load unpacked** with the extracted folder.

Query syntax is the same as on [Scryfall](https://scryfall.com/) (e.g. `c:blue`, `t:creature`, `f:commander`). See [Scryfall’s syntax guide](https://scryfall.com/docs/syntax) for details.
