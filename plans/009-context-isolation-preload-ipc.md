# Plan 009: Isolate every renderer (sandbox + contextIsolation + preload) and remove `@electron/remote`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- app.js main app preview modal tour i18n libs helpers static/sounds electron.vite.config.mjs package.json`
> Plans 001–008 changed most of these paths on purpose. This plan's
> "Current state" quotes HEAD `c530133` and states what plan 002/003 were
> expected to turn each line into. Before each step, run the step's
> inventory `grep` and work from **its live output**, not from the excerpt.
> If the live code uses an Electron/Node access pattern that is not in the
> "Access patterns" table below, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/008-*.md (React 19; avoids editing the same components twice). Technically possible any time after plans/003-*.md.
- **Category**: security
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

After plans 002–003 the app runs on Electron 45 only because every window still has `nodeIntegration: true`, `contextIsolation: false`, `sandbox: false`, and the deprecated `@electron/remote` module. In that mode any HTML or script injected into a renderer (for example through an invoice field, a contact name, or a logo SVG rendered as markup) gets full Node.js access: it can read and write any file and run programs. Electron's security checklist lists these three settings as the first items. This plan moves all privileged work to the main process, gives renderers a small, allow-listed API through a preload script, and turns the three protections on. It also blocks navigation and pop-ups and adds a Content Security Policy.

References: [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security), [Context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [Electron 45 release notes](https://www.electronjs.org/blog/electron-45-0) (sandboxed preloads no longer have the `events`, `timers`, `url` modules or `Buffer`/`setImmediate`/`clearImmediate`), [`webUtils.getPathForFile`](https://www.electronjs.org/docs/latest/api/web-utils) (replaces the removed `File.path`).

## Current state

### Preconditions from earlier plans (verify; STOP if missing)

| Precondition | Check | Expected |
|---|---|---|
| Electron 45 + electron-vite | `npm ls electron electron-vite` | `45.x`, `6.x` |
| Compat flags in one shared constant | `grep -n "COMPAT_WEB_PREFERENCES\|nodeIntegration: true" helpers/windows.js` and `grep -rn "COMPAT_WEB_PREFERENCES" app.js main/` | constant defined in `helpers/windows.js`; used by every window factory (tour, main, preview in `app.js`; modal in `main/modal-window.js`) |
| Renderer `electron` shim | `test -f libs/electron-renderer.js && grep -n "alias" electron.vite.config.mjs` | file exists; renderer config aliases `electron` to it |
| `@electron/remote` set up | `grep -rn "@electron/remote/main" app.js main/` | `initialize()` and `enable(...)` calls |
| Settings in main via electron-store | `test -f main/settings.js && grep -n "electron-store" main/settings.js` | match |
| Modal created in main | `grep -rn "'show-modal'" main/ app.js` | an `ipcMain.on('show-modal', …)` handler |
| React 19 | `npm ls react` | `19.x` |
| Data switch | `grep -rn "MANTA_USER_DATA" app.js main/` | match |

### Access patterns this plan removes

At HEAD these were plain `require(...)`. Plan 002 kept renderer code importing from `'electron'` and aliased `electron` (renderer build only) to the shim `libs/electron-renderer.js`, which reads `window.require('electron')` and `window.require('@electron/remote')` and re-exports `ipcRenderer`, `shell`, `clipboard`, `webFrame`, `webUtils` and `remote`. Some files may still call `window.require(...)` directly (for `fs`, `jimp`, `is-svg`). Find every live use with `grep -rn "from 'electron'\|window.require" app preview modal tour i18n libs helpers`. The table uses `window.require(...)` for the underlying access; the same rows apply to the shim imports. Expected live forms:

| Live pattern (after 002/003) | HEAD form | Replacement in this plan |
|---|---|---|
| `window.require('electron').ipcRenderer` | `require('electron').ipcRenderer` / `import { ipcRenderer as ipc } from 'electron'` | `window.manta.ipc` (same `send` / `on` / `removeAllListeners` shape) |
| `window.require('@electron/remote').getGlobal('mantaSettings')` | `require('electron').remote.require('electron-settings')` | `window.manta.settings` (same `get` / `set` / `has`) |
| `window.require('@electron/remote')` → `Menu`, `BrowserWindow` | `require('electron').remote` | menu built in main; modal reply via IPC |
| `window.require('electron').shell.openExternal(...)` | same with `require` | menu click handled in main |
| `window.require('fs')`, `jimp`, `is-svg` in `app/helpers/image.js` | `require('fs')` etc. | `window.manta.processLogo(path)` → main |
| `File.path` / `webUtils.getPathForFile` in logo drop | `monitor.getItem().files[0].path` | `window.manta.getPathForFile(file)` |
| `process.platform` in renderer | `libs/dragNdrop.js:6` | `window.manta.platform` |
| `path.resolve(__dirname, …)` for assets | `static/sounds/*/index.js`, `tour/components/slides/*.jsx` | `new URL('…', import.meta.url).href` (only if plan 002 did not already convert them) |

### Renderer inventory at HEAD (`grep` output, trimmed)

- IPC users: `app/App.jsx:5`, `app/middlewares/InvoicesMW.jsx:5`, `app/middlewares/SettingsMW.jsx:4`, `app/components/settings/Invoice.jsx:4`, `app/components/settings/_partials/profile/Logo.jsx:13`, `app/components/invoices/Invoice.jsx:7`, `app/components/layout/AppUpdate.jsx:7`, `app/containers/Contacts.jsx:7`, `app/containers/Invoices.jsx:7`, `preview/Viewer.jsx:8`, `preview/containers/SideBar.jsx:4`, `modal/Dialog.jsx:6`, `tour/Tour.jsx:4`, `app/renderers/menu.js:4`.
- Settings users (all via `remote.require('electron-settings')` at HEAD): `app/renderers/menu.js:3`, `app/middlewares/InvoicesMW.jsx:4` (import unused), `app/middlewares/FormMW.jsx:2`, `app/middlewares/SettingsMW.jsx:2`, `app/components/form/Currency.jsx:4` (import unused), `app/helpers/form.js:2`, `app/reducers/FormReducer.jsx:7`, `preview/reducers/index.jsx:5`, `modal/Dialog.jsx:4`, `libs/sounds.js:2`, `i18n/i18n.js:4`.
- Settings methods used anywhere in renderers: `get`, `set`, `has` only (`getAll`, `deleteAll`, `setAll` are main-only in `app.js`).
- **Settings are read synchronously at module load**: `i18n/i18n.js:5` `const defaultLanguage = appConfig.get('general.language');`, `app/reducers/FormReducer.jsx:8` `const invoiceSettings = appConfig.get('invoice');`, `preview/reducers/index.jsx:6-8` (invoice, profile, general), `libs/sounds.js:24,38` (on every sound). An async API would break these.
- `ipc.removeAllListeners(...)` is called with a string or an array: `app/App.jsx:73`, `app/components/settings/Invoice.jsx:44-45`, `Logo.jsx:102`, `AppUpdate.jsx:137`, `Contacts.jsx:46`, `Invoices.jsx:53`, `preview/Viewer.jsx:56`, `modal/Dialog.jsx:136`.
- Listeners use the `(event, ...args)` signature, e.g. `app/App.jsx:36` `ipc.on('menu-change-tab', (event, tabName) => {`.

### Key excerpts (HEAD)

`app/renderers/menu.js:1-9` — the menu is built in the renderer through `remote`:
```js
const { Menu, BrowserWindow } = require('electron').remote;
const appConfig = require('electron').remote.require('electron-settings');
const ipc = require('electron').ipcRenderer;
const isDev = require('electron-is-dev');

// Get mainWindow Object
const mainWindowID = appConfig.get('mainWindowID');
const mainWindow = BrowserWindow.fromId(mainWindowID);
```
and `:192-195`: `click() { require('electron').shell.openExternal('https://manta.life'); }`; `:236-238`: `const menu = Menu.buildFromTemplate(menuTemplate); Menu.setApplicationMenu(menu);`. Menu items send `mainWindow.webContents.send('menu-…')` or `ipc.send('check-for-updates' | 'quit-app' | 'start-tour')`.

`modal/Dialog.jsx:4-7` and `:139-148` — the modal answers the main window directly:
```js
const appConfig = require('electron').remote.require('electron-settings');
const BrowserWindow = require('electron').remote.BrowserWindow;
const ipc = require('electron').ipcRenderer;
const mainWindow = BrowserWindow.fromId(appConfig.get('mainWindowID'));
…
    if (returnChannel !== '') {
      mainWindow.send(returnChannel, parseInt(index), ...rest);
    }
    // Close the windows
    BrowserWindow.getFocusedWindow().close();
```

`app/helpers/image.js:1-41` — logo processing in the renderer:
```js
const Jimp = require('jimp');
const fs = require('fs');
const isSvg = require('is-svg');
…
  Jimp.read(filePath, (err, image) => {
    …
      image
        .resize(500, Jimp.AUTO)
        .quality(100)
        .getBase64(Jimp.MIME_PNG, (err, result) => {
```
(plan 006 may already have replaced `jimp`; check with `grep -n "jimp\|nativeImage\|fs" app/helpers/image.js`.)

`libs/dragNdrop.js:1-11`:
```js
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());

// Linux and Windows draggable window broken, so monkey patch
if (process.platform == 'linux' || process.platform == 'win32') {
```

IPC channels used by renderers at HEAD (send or listen): `change-preview-window-language`, `change-preview-window-profile`, `check-for-updates`, `confirmed-delete-contact`, `confirmed-delete-invoice`, `confirmed-export-directory`, `end-tour`, `file-selected`, `menu-change-tab`, `menu-form-add-item`, `menu-form-clear`, `menu-form-save`, `menu-form-toggle-currency`, `menu-form-toggle-discount`, `menu-form-toggle-dueDate`, `menu-form-toggle-note`, `menu-form-toggle-settings`, `menu-form-toggle-vat`, `no-access-directory`, `open-file-dialog`, `pfd-exported`, `preview-invoice`, `quit-and-install`, `quit-app`, `reveal-file`, `save-configs-to-invoice`, `save-pdf`, `select-export-directory`, `start-tour`, `update-available`, `update-checking`, `update-download-confirmed`, `update-download-progress`, `update-download-started`, `update-downloaded`, `update-error`, `update-modal`, `update-not-available`, `update-preview`, `update-preview-window`, `upgrade-confirmed`. Plan 002 added `show-modal`. This plan adds `modal-response`.

### Design decisions (already made — follow them)

1. **Settings use synchronous IPC** (`ipcRenderer.sendSync`) for `get` / `set` / `has`. Reason: about 30 call sites, several at module load, all low-frequency (user actions). Sync IPC keeps the exact current semantics (always fresh, read-after-write consistent) with a one-line change per file. Rejected: a preload snapshot plus `settings:changed` events — more code and a stale-read risk because main also writes settings (`main/tour.js`, `main/select-export-directory.js`, window-state tracking in `app.js`).
2. **`window.manta.ipc` mirrors the `ipcRenderer` shape** (`send`, `on`, `removeAllListeners`) so each renderer file changes one line. Listeners still get `(event, ...args)`; the preload passes an empty object `{}` as `event` (the real IPC event must not cross the bridge — it exposes `sender`).
3. **Channel allow-list in the preload.** `send`/`on`/`removeAllListeners` throw for channels not in the list.
4. **The preload works in both modes** during the migration: `process.contextIsolated ? contextBridge.exposeInMainWorld('manta', api) : (window.manta = api)`. This lets Steps 3–8 run with the old flags still on, so the app keeps working after every step; Step 9 turns isolation on.
5. **CSP is injected only into built HTML** (Vite `transformIndexHtml` with `apply: 'build'`). The dev server needs inline module scripts and WebSocket HMR, which a strict CSP blocks.

### Conventions

- Main-process modules are CommonJS-style files in `main/` that register `ipcMain` handlers at load and are imported from `app.js` (plan 002 replaced the old `glob` loader with explicit imports — check `grep -n "main/" app.js`). Follow `main/save-pdf.js` as the exemplar for a small handler module.
- Prettier: single quotes, trailing commas `es5`, semicolons.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Tests | `npm test` | all pass |
| Build | `npm run build` | exit 0; `out/preload/index.js` exists after Step 2 |
| Dev run (HMR) | `npm run dev` | windows open, no console errors |
| Built app on data copy | `cp -R "$HOME/Library/Application Support/Manta" "$HOME/manta-profile-009"` (once), then `npm run build && MANTA_USER_DATA="$HOME/manta-profile-009" npx electron .` | windows open over `file://`, DevTools open (unpackaged) |
| Production preview | `MANTA_USER_DATA="$HOME/manta-profile-009" npm start` | same, using `electron-vite preview` |

Never run against `~/Library/Application Support/Manta` itself.

## Scope

**In scope**:
- `preload/index.js` (create)
- `electron.vite.config.mjs` (preload entry, CSP plugin)
- `app.js` and `main/*.js` (window `webPreferences`, remote removal, new handler modules `main/settings-ipc.js`, `main/menu.js`, `main/logo.js`, `main/modal-response` handler, navigation lock)
- Renderer files in the inventory above, `app/helpers/image.js`, `libs/dragNdrop.js`, `libs/sounds.js`, `static/sounds/*/index.js`, `tour/components/slides/*.jsx`
- Delete `app/renderers/menu.js` and its import
- Delete `libs/electron-renderer.js` and remove the `electron` alias from the renderer section of `electron.vite.config.mjs`
- `helpers/windows.js` (created by plan 002): replace `COMPAT_WEB_PREFERENCES` and `enableRemote` with one `SECURE_WEB_PREFERENCES` constant `{ preload: <built preload path>, contextIsolation: true, sandbox: true, nodeIntegration: false }`, used by all 4 window factories
- Vitest setup file (find with `grep -rn "setupFiles" vite*.config.* vitest*.config.* electron.vite.config.mjs`), `__mocks__/electron.js`, and specs that relied on the `electron` mock
- `package.json` / `package-lock.json` (remove `@electron/remote`; remove `jimp` if still present; `is-svg` moves to main use)

**Out of scope**:
- `app/helpers/pouchDB.js` and anything that changes how pages are loaded (`loadFile`, `file://` origin) — user data is bound to the `file://` origin.
- Behavior or text of dialogs, menus, and update flow — only move code, do not redesign.
- `main/updater.js` logic (it already runs in main).
- Packaging, signing, auto-update config (owned by the packaging/CI plan listed in `plans/README.md`).

## Git workflow

- Branch: `upgrade/electron-45` (exists).
- One commit per step. Short imperative subject, no prefix, no AI attribution. Example: `Move application menu to main process`.
- Do NOT push.

## Steps

### Step 1: Settings IPC in main

Create `main/settings-ipc.js` that imports the store from `main/settings.js` and registers:

```js
ipcMain.on('settings:get', (event, key) => { event.returnValue = store.get(key); });
ipcMain.on('settings:has', (event, key) => { event.returnValue = store.has(key); });
ipcMain.on('settings:set', (event, key, value) => { store.set(key, value); event.returnValue = true; });
```

Import it from `app.js` next to the other `main/` modules, before any window is created.

**Verify**: `npm run build` → exit 0; `grep -n "settings-ipc" app.js` → 1 match.

### Step 2: Preload script and build entry

1. Create `preload/index.js`. It may import **only** from `'electron'` (`contextBridge`, `ipcRenderer`, `webUtils`). No Node modules, no `Buffer`, no `setImmediate`, no `events`/`timers`/`url` — sandboxed preloads in Electron 45 do not have them.

```js
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const CHANNELS = new Set([/* every channel from the list in "Current state" + 'show-modal' + 'modal-response' */]);
const check = channel => {
  if (!CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
};

const ipc = {
  send: (channel, ...args) => { check(channel); ipcRenderer.send(channel, ...args); },
  on: (channel, listener) => {
    check(channel);
    ipcRenderer.on(channel, (_event, ...args) => listener({}, ...args));
  },
  removeAllListeners: channels => {
    [].concat(channels).forEach(c => { check(c); ipcRenderer.removeAllListeners(c); });
  },
};

const api = {
  ipc,
  settings: {
    get: key => ipcRenderer.sendSync('settings:get', key),
    has: key => ipcRenderer.sendSync('settings:has', key),
    set: (key, value) => ipcRenderer.sendSync('settings:set', key, value),
  },
  processLogo: filePath => ipcRenderer.invoke('process-logo', filePath),
  getPathForFile: file => webUtils.getPathForFile(file),
  platform: process.platform,
};

if (process.contextIsolated) contextBridge.exposeInMainWorld('manta', api);
else window.manta = api;
```

Fill `CHANNELS` from a fresh inventory, not by hand:
`grep -rhoE "(ipc|ipcRenderer)\.(send|on|once|removeAllListeners)\(\s*'[^']+'" app preview modal tour libs i18n helpers | sed -E "s/.*'([^']+)'.*/\1/" | sort -u` plus the channels in array arguments to `removeAllListeners` and the channels that main sends to renderers (`grep -rhoE "\.send\('[^']+'" main app.js`). Every channel in the result must be in `CHANNELS`.

2. In `electron.vite.config.mjs` add a `preload` section with input `preload/index.js` and CommonJS output (sandboxed preloads cannot load ES modules):

```js
preload: {
  build: {
    rollupOptions: {
      input: { index: resolve(__dirname, 'preload/index.js') },
      output: { format: 'cjs', entryFileNames: '[name].js' },
    },
  },
},
```

(Match how the file already resolves paths for `main`/`renderer`; electron-vite docs: [electron-vite config](https://electron-vite.org/config/).)

3. Add `preload: <absolute path to out/preload/index.js>` to `webPreferences` of all 4 windows (main, preview, tour in `app.js`; modal in the `show-modal` handler). Resolve it the same way the window HTML files are resolved (for example `path.join(__dirname, '../preload/index.js')` if main is CommonJS, or `fileURLToPath(new URL('../preload/index.js', import.meta.url))` if main is ESM). Keep the compat flags for now.

**Verify**: `npm run build` → `ls out/preload/index.js` exists; `head -c 300 out/preload/index.js` shows no `import ` statements; run the built app on the data copy and in each window's console `typeof window.manta.ipc.send` → `'function'`, `window.manta.settings.get('general.language')` → the language code.

### Step 3: Switch renderer IPC to `window.manta.ipc`

For every IPC user in the inventory (re-run `grep -rnE "ipcRenderer|ipc\b" app preview modal tour --include='*.js' --include='*.jsx' | grep -v __tests__`), replace the import/require line with:

```js
const ipc = window.manta.ipc;
```

No other line in those files should change.

**Verify**: `grep -rn "ipcRenderer" app preview modal tour libs i18n helpers | grep -v __tests__` → no output; built app smoke items 1–4 (list in Step 10) pass.

### Step 4: Switch renderer settings to `window.manta.settings`

For every settings user, replace the line that obtains `appConfig` with `const appConfig = window.manta.settings;`. Delete the line entirely in `app/middlewares/InvoicesMW.jsx` and `app/components/form/Currency.jsx` if `appConfig` is not used there (`grep -n "appConfig\." <file>` → no output).

**Verify**: `grep -rn "getGlobal\|mantaSettings\|electron-settings" app preview modal tour libs i18n helpers | grep -v __tests__` → no output; in the built app, Settings tab → change sound to off (mute) → Save → quit → start → still muted.

### Step 5: Move the application menu to main

1. Create `main/menu.js` exporting `buildMenu()`. Port `app/renderers/menu.js` 1:1, with these changes:
   - `mainWindow` = `BrowserWindow.fromId(store.get('mainWindowID'))` (same as `main/tour.js:9-10` does).
   - `ipc.send('check-for-updates')`, `ipc.send('quit-app')`, `ipc.send('start-tour')` → call the same code main runs for those channels. Simplest: `ipcMain.emit('check-for-updates', { sender: mainWindow.webContents })`, or export the handler functions from `main/updater.js` / `main/tour.js` and call them. Do not change their behavior.
   - `require('electron').shell.openExternal('https://manta.life')` → `shell.openExternal('https://manta.life')`.
   - `isDev` → `!app.isPackaged`.
2. Call `buildMenu()` in `app.js` after the windows are created (in the `ready` handler).
3. Delete `app/renderers/menu.js` and remove its import (find with `grep -rn "renderers/menu" app electron.vite.config.mjs`).

**Verify**: built app: Go → Contacts switches tab; Invoice → Save/Clear work; Help → Show Tutorial opens the tour; Help → Learn More opens the browser; on macOS, Manta → Check For Updates shows the "checking" state. `test -f app/renderers/menu.js` → exit 1.

### Step 6: Modal reply through main

1. In `modal/Dialog.jsx` delete the `appConfig`, `BrowserWindow`, and `mainWindow` lines (`:4-7` at HEAD). In `handleClick` replace the `mainWindow.send(...)` and `getFocusedWindow().close()` lines with:
```js
ipc.send('modal-response', returnChannel, parseInt(index), ...rest);
```
2. In main (next to the `show-modal` handler) add:
```js
ipcMain.on('modal-response', (event, returnChannel, index, ...rest) => {
  if (returnChannel) {
    const mainWindow = BrowserWindow.fromId(store.get('mainWindowID'));
    mainWindow.webContents.send(returnChannel, index, ...rest);
  }
  BrowserWindow.fromWebContents(event.sender).close();
});
```
(`returnChannel` is `''` when no answer is needed — the old code checked `!== ''`.)

**Verify**: built app: Invoices tab → delete an invoice → modal appears → **Cancel** closes it, invoice stays; delete again → **Delete** closes it, invoice is removed.

### Step 7: Logo processing in main

1. Create `main/logo.js`:
```js
ipcMain.handle('process-logo', async (_event, filePath) => {
  const data = await fs.promises.readFile(filePath);
  if (isSvg(data.toString('utf8'))) {
    return { dataUrl: 'data:image/svg+xml;base64,' + data.toString('base64') };
  }
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) return { error: 'Unsupported image file' };
  return { dataUrl: image.resize({ width: 500 }).toDataURL() };
});
```
(`is-svg` 6 is ESM and takes a string: `import isSvg from 'is-svg'`. The old code resized to width 500 keeping aspect ratio — `resize({ width })` does the same.)
2. Replace `app/helpers/image.js` `processImg(filePath, callback)` body with a call to `window.manta.processLogo(filePath)`; on `{ error }` call the existing `handleError` (keeps the existing warning dialog and its i18n title). Keep the exported name and callback signature so `Logo.jsx` does not change.
3. In the logo drop handler (`app/components/settings/_partials/profile/Logo.jsx`, rewritten by plan 006 — find `getPathForFile` or `.path`), get the path with `window.manta.getPathForFile(file)`.
4. Remove `jimp` from `package.json` if still listed.

**Verify**: `grep -rn "require('fs')\|jimp\|is-svg" app preview modal tour` → no output. Built app: Settings → Profile → **Select logo** with a PNG → logo shows; with an SVG → logo shows; drag a JPG onto the logo zone → logo shows; select a `.txt` renamed to `.png` → the warning dialog appears.

### Step 8: Remaining renderer Node usage

1. `libs/dragNdrop.js`: `process.platform` → `window.manta.platform`.
2. Assets: if `grep -rn "__dirname\|require('path')" static/sounds tour/components/slides libs` returns matches, convert each `path.resolve(__dirname, '../static/sounds/default/startup.wav')` to an asset import resolved by Vite, e.g. `new URL('./startup.wav', import.meta.url).href` relative to the file that holds the path. Check one sound and one tour image in the built app.
3. Inventory: `grep -rnE "window\.require|require\('electron'\)|from 'electron'|process\.|__dirname|require\('(fs|path|os|url)'\)" app preview modal tour libs i18n helpers static --include='*.js' --include='*.jsx' | grep -v __tests__ | grep -v __mocks__`. Expected: no output. `helpers/center-on-primary-display.js` is main-only after plan 002 — if it is still imported by a renderer file, STOP.

**Verify**: inventory grep → no output; startup sound plays; tour images show.

### Step 9: Turn on isolation and remove `@electron/remote`

1. Set on all 4 windows:
```js
webPreferences: {
  preload: PRELOAD_PATH,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
},
```
2. Remove `require('@electron/remote/main').initialize()`, every `enable(win.webContents)` call, any `global.mantaSettings = …`, and `npm uninstall @electron/remote`.
3. Navigation lock in `app.js` (before `ready`):
```js
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== contents.getURL().split('#')[0]) event.preventDefault();
  });
});
```

**Verify**:
- `grep -rn "window.require\|@electron/remote\|nodeIntegration: true\|contextIsolation: false\|sandbox: false" app preview modal tour i18n libs helpers main app.js preload` → no output
- `npm run build` → exit 0
- Built app: in each window's console `typeof require` → `'undefined'`, `typeof process` → `'undefined'`, `typeof window.manta` → `'object'`.

### Step 10: Content Security Policy for built pages

In `electron.vite.config.mjs`, add this plugin to the `renderer` plugins:

```js
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'";
const cspPlugin = {
  name: 'manta-csp',
  apply: 'build',
  transformIndexHtml: html =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`),
};
```

`'unsafe-inline'` in `style-src` is required: styled-components injects `<style>` tags at runtime. `img-src data:` is required: logos are stored as `data:` URLs.

**Verify**:
- `npm run build && grep -c "Content-Security-Policy" out/renderer/app/index.html out/renderer/preview/index.html out/renderer/modal/index.html out/renderer/tour/index.html` → `1` each (adjust paths to the real `out/renderer` layout).
- Run the built app on the data copy and run the full smoke test below with DevTools open on main and preview windows. The console must show **no** `Refused to …` CSP messages. If a resource from the app's own files is refused, the only allowed fix is adding `file:` to that one directive; anything else → STOP.

Smoke test (built app, data copy):
1. Form: pick contact, add 2 items, **Save** → invoice listed.
2. Invoices: **Preview** → preview window shows the invoice; change template and accent color; **Export PDF** → PDF file opens; notification click reveals the file.
3. Contacts: delete one → confirm modal → removed.
4. Settings: change language to German → Save → labels change in main **and** preview window; change back. Select export directory → choose a folder → path shown.
5. Settings → Profile: select logo (PNG and SVG) → shown in preview.
6. Help → Show Tutorial → go through all slides → **End** → main window returns.
7. Quit and restart → settings, invoices and logo persist.

### Step 11: Tests

1. In the Vitest setup file add a `window.manta` stub:
```js
window.manta = {
  ipc: { send: vi.fn(), on: vi.fn(), removeAllListeners: vi.fn() },
  settings: { get: vi.fn(() => 'someSettings'), set: vi.fn(), has: vi.fn(() => true) },
  processLogo: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,' })),
  getPathForFile: vi.fn(() => '/tmp/file.png'),
  platform: 'darwin',
};
```
(`'someSettings'` matches the old `__mocks__/electron.js` default so existing assertions keep passing.)
2. Update specs that asserted on the `electron` mock (`grep -rln "electron" --include='*.spec.js*' app preview libs`) to assert on `window.manta.ipc.send` / `window.manta.settings.*` instead. Delete `__mocks__/electron.js` only if no spec still imports `electron`.
3. Add `preload/__tests__/index.spec.js`: mock `electron` (`contextBridge.exposeInMainWorld`, `ipcRenderer`), import the preload, and test (a) `send` to an allowed channel calls `ipcRenderer.send`, (b) `send('evil-channel')` throws, (c) `on` passes `{}` as the first listener argument, not the real event, (d) `removeAllListeners(['a','b'])` with allowed channels removes both.

**Verify**: `npm test` → all pass including 4 new preload tests.

## Test plan

- New: `preload/__tests__/index.spec.js` (4 cases above). Pattern: any existing spec using `vi.mock`, e.g. `libs/__tests__/sounds.spec.js`.
- Updated: specs that used the `electron` mock now use the `window.manta` stub.
- Manual: Step 10 smoke test on a data copy with the production build (isolation and CSP are only real in the built app).
- `npm test` → all pass.

## Done criteria

- [ ] `grep -rn "window.require\|@electron/remote\|nodeIntegration: true" app preview modal tour i18n libs helpers main app.js` → no output
- [ ] `grep -rn "contextIsolation: true\|sandbox: true" helpers/windows.js` → both present in `SECURE_WEB_PREFERENCES`; `grep -rn "SECURE_WEB_PREFERENCES" app.js main/` → used by all 4 window factories (tour, main, preview, modal); `grep -rn "COMPAT_WEB_PREFERENCES\|enableRemote" .  --include='*.js' --exclude-dir=node_modules --exclude-dir=out` → no output
- [ ] `test ! -f libs/electron-renderer.js && echo ok` → `ok`; `grep -n "electron-renderer" electron.vite.config.mjs` → no output
- [ ] `npm ls @electron/remote` → empty
- [ ] `out/preload/index.js` exists after `npm run build` and contains no `import ` statements
- [ ] Built HTML files each contain one `Content-Security-Policy` meta tag
- [ ] `npm test` exits 0, including the 4 preload tests
- [ ] Step 10 smoke test passes on a data copy, no CSP violations in the console
- [ ] In every window console: `typeof require === 'undefined'`
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A precondition row fails.
- The live code reaches Electron/Node by a pattern not listed in "Access patterns" (for example `remote.dialog`, `remote.app.getPath`, `clipboard`), or a renderer reads settings keys through a method other than `get`/`set`/`has`.
- The preload build output contains `import` statements or `require()` of anything other than `electron` (sandbox will fail to load it).
- Invoices or contacts disappear in the built app (would mean the origin changed from `file://` — check `location.protocol`).
- `sendSync` settings calls block the UI noticeably (more than ~100 ms per action) — report instead of building a cache.
- CSP violations need more than adding `file:` to a single directive.
- Auto-update IPC (`update-*` channels) stops reaching the main window and the fix needs changes to `main/updater.js` logic.

## Maintenance notes

- Every new IPC channel must be added to `CHANNELS` in `preload/index.js`; a reviewer should reject PRs that widen the API to "any channel" or expose `ipcRenderer` itself.
- Do not add `nodeIntegration`, `sandbox: false` or `contextIsolation: false` back for a single feature — add a main-process handler and a narrow preload function instead.
- Settings use sync IPC by design (see Design decision 1). If settings reads ever enter a hot path (render loop, typing), switch that call site to a cached value, not the whole API.
- The CSP is only in built HTML. Dev mode is not protected; test security behavior with `npm start` or `npx electron .` after `npm run build`.
- Deferred: validating argument shapes in each `ipcMain` handler (for example `save-pdf` builds a file path from `docId`) — worth a follow-up plan; it is defense in depth once renderers are isolated.
