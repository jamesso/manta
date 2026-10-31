# Plan 003: Fix main-process Electron APIs and replace electron-settings with electron-store

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- main app.js app/renderers/menu.js app/middlewares app/components/form/Currency.jsx app/helpers/form.js app/reducers/FormReducer.jsx preview/reducers/index.jsx modal/Dialog.jsx libs/sounds.js i18n/i18n.js __mocks__ vitest.config.mjs`
> Plans 001 and 002 changed import lines in these files, `app.js` window setup, and added `main/modal-window.js`. The function bodies quoted below must still match; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-electron45-electron-vite-boot.md
- **Category**: migration
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

After plan 002 the app starts on Electron 45, but four user features still call Electron 1.x APIs that no longer exist or changed shape: **Export PDF** (`printToPDF` callback), **choose export folder** and **select logo** (`dialog.showOpenDialog` callback), and auto-update notifications (`BrowserWindow#send`). These fail silently or crash the main process. The settings library `electron-settings` 3.x (2018) is also unmaintained; `electron-store` is the maintained standard. This plan fixes those calls and swaps the settings library **while reading the same `Settings` file** so no user loses their profile, company details, or preferences.

## Data safety

Settings live in the plain JSON file `<userData>/Settings` (no extension) written by `electron-settings` 3. On this machine its top-level keys are: `general, invoice, lastSessions, mainWindowID, previewWindowID, profile, tour, tourWindowID, userData, version, windowState, winsLastVisibleState` (`version` is `3`; `general` has `checkUpdate, language, lastCheck, muted, previewPDF, sound`; there is no `general.printOptions`). The new store MUST read and write this exact file.

Never run against the real profile `~/Library/Application Support/Manta`. Use a copy:
```sh
rm -rf /tmp/manta-profile && cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile
```
and run with `MANTA_USER_DATA=/tmp/manta-profile` (added by plan 002 in `app.js`). A backup `~/Manta-profile-backup-*` was made in plan 002; do not touch it.

## Current state

Settings usage: 17 importers, methods used: `get` (29×), `set` (15×), `has` (4×), `getAll` (1×), `deleteAll` (1×, chained with `setAll`).

- Main process (`require('electron-settings')`): `app.js:26`, `main/updater.js:4`, `main/save-pdf.js:3`, `main/tour.js:3`, `main/preview-window.js:3`, `main/select-export-directory.js:10`.
- Renderer (after plans 001/002 the form is `import { remote } from 'electron';` + `const appConfig = remote.require('electron-settings');`): `app/renderers/menu.js`, `app/middlewares/InvoicesMW.jsx`, `app/middlewares/FormMW.jsx`, `app/middlewares/SettingsMW.jsx`, `app/components/form/Currency.jsx`, `app/helpers/form.js`, `app/reducers/FormReducer.jsx`, `preview/reducers/index.jsx`, `modal/Dialog.jsx`, `libs/sounds.js`, `i18n/i18n.js`.
- `app.js` `migrateData()` end (lines ~340-350 at `c530133`):
  ```js
  const configs = appConfig.getAll();
  ...
  // Save the final config to DB
  appConfig.deleteAll().setAll(migratedConfigs);
  ```

`main/save-pdf.js:7-42`:
```js
ipcMain.on('save-pdf', (event, docId) => {
  const exportDir = appConfig.get('invoice.exportDir');
  const pdfPath = path.join(exportDir, `${docId}.pdf`);
  const win = BrowserWindow.fromWebContents(event.sender);

  let printOptions;
  if (appConfig.has('general.printOptions')) {
    printOptions = appConfig.get('general.printOptions');
  } else {
    printOptions = {
      landscape: false,
      marginsType: 0,
      printBackground: true,
      printSelectionOnly: false,
    };
  }

  win.webContents.printToPDF(printOptions, (error, data) => {
    if (error) throw error;
    fs.writeFile(pdfPath, data, error => {
      if (error) { throw error; }
      if (appConfig.get('general.previewPDF')) {
        // Open the PDF with default Reader
        shell.openExternal('file://' + pdfPath);
      }
      // Show notification
      win.webContents.send('pfd-exported', {
        title: 'PDF Exported',
        body: 'Click to reveal file.',
        location: pdfPath,
      });
    });
  });
});
```
(`'pfd-exported'` is a typo but it is the channel the renderer listens to — keep it.)

`static/css/preview/print.css:1-2` sets `@page { size: A4; ...`. Old Electron `marginsType` values: `0` = default margins, `1` = no margins, `2` = minimum margins. Current API: `margins: { marginType: 'default' | 'none' | 'printableArea' | 'custom' }`, `pageSize` default `'Letter'`, `preferCSSPageSize` to honour `@page`, `printSelectionOnly` removed, and the method returns a `Promise<Buffer>` (https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions).

`main/select-export-directory.js:12-25`:
```js
ipc.on('select-export-directory', event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  dialog.showOpenDialog(window, { properties: ['openDirectory'] }, path => {
    if (path) {
      fs.access(path[0], fs.constants.W_OK, err => {
        if (err) {
          event.sender.send('no-access-directory', err.message);
        } else {
          appConfig.set('exportDir', path[0]);
          event.sender.send('confirmed-export-directory', path[0]);
        }
      });
    }
  });
});
```
`appConfig.set('exportDir', ...)` writes an unused top-level key: the app reads `invoice.exportDir` (`main/save-pdf.js:8`), and the renderer persists it there — `app/components/settings/Invoice.jsx:36-39` puts the path in state and calls `updateSettings('invoice', this.state)`; `app/middlewares/SettingsMW.jsx` `SETTINGS_SAVE` does `appConfig.set('invoice', action.payload.invoice)`. So the main-side write is dead code; remove it.

`main/select-logo-file.js:5-15`:
```js
ipc.on('open-file-dialog', event => {
  dialog.showOpenDialog(
    {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'svg'] }],
    },
    file => {
      if (file) event.sender.send('file-selected', file[0]);
    }
  );
});
```
Since Electron 6, `showOpenDialog` ignores the callback and returns `Promise<{ canceled, filePaths }>`.

`main/updater.js` — 6 calls `mainWindow.send('update-...', ...)` (lines 35, 41, 48, 60, 66, 71). `BrowserWindow` has no `send` method in current Electron; use `mainWindow.webContents.send`.

`app.js:154-161` — `addDevToolsExtension()` calls `BrowserWindow.addDevToolsExtension(process.env.*_DEV_TOOLS_PATH)`, removed from Electron. Plan 002 removed `dotenv`, so these env vars are never set. Called at `app.js:417` `if (isDev) addDevToolsExtension();`.

Tests: `__mocks__/electron.js` (ESM after plan 001) exports `remote.require` that returns `{ set, get }` for `'electron-settings'`; `vitest.config.mjs` aliases `electron-settings` to `__mocks__/electron-settings.js`; `app/components/form/__tests__/Currency.spec.jsx` does `const appConfig = remote.require('electron-settings');`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Tests | `npm test` | exit 0 |
| Build | `npm run build` | exit 0 |
| Run on profile copy | `MANTA_USER_DATA=/tmp/manta-profile npm start` | app opens with user data |
| Settings keys | `python3 -I -c "import json;print(sorted(json.load(open('/tmp/manta-profile/Settings')).keys()))"` | key list (no values printed) |

## Suggested executor toolkit

- electron-store README (options `name`, `fileExtension`, `cwd`; ESM only; Electron ≥ 30): https://github.com/sindresorhus/electron-store and its base library `conf`: https://github.com/sindresorhus/conf
- `@electron/remote` `getGlobal`: https://www.npmjs.com/package/@electron/remote
- electron-vite dependency handling (if `electron-store` must be bundled): https://electron-vite.org/guide/dependency-handling

## Scope

**In scope**:
- `package.json`, `package-lock.json`
- `main/settings.js` (create), `main/print-options.js` (create), `main/__tests__/print-options.spec.js` (create), `main/save-pdf.js`, `main/select-export-directory.js`, `main/select-logo-file.js`, `main/updater.js`, `main/tour.js`, `main/preview-window.js`, `app.js`
- The 11 renderer files listed above — only the `appConfig` line
- `__mocks__/electron.js`, `__mocks__/electron-settings.js` (delete), `vitest.config.mjs` (remove that alias), `app/components/form/__tests__/Currency.spec.jsx`, any spec that references `electron-settings`
- `electron.vite.config.mjs` only if Step 1's STOP-free fallback is needed

**Out of scope**:
- The settings data shape and the `migrateData()` migrations 1–3 logic — only the storage calls change.
- Renderer IPC channel names (`pfd-exported`, `file-selected`, ...).
- Moving logo processing (`app/helpers/image.js`, Jimp) to the main process — plan 006/009.
- `contextIsolation`, preload, removing `@electron/remote` — plan 009.
- `electron-builder`, updater configuration/feed — plan 011.

## Git workflow

- Branch `upgrade/electron-45`. Commits like `Fix PDF export on Electron 45`, `Use promise dialog API`, `Replace electron-settings with electron-store`. No AI attribution. Do NOT push.

## Steps

### Step 1: Add the settings module

`npm install electron-store@^12.0.0 && npm uninstall electron-settings`

Create `main/settings.js`:
```js
// Single settings store for the app. Reads/writes the same file that
// electron-settings 3 used: <userData>/Settings (JSON, no extension).
const electronStore = require('electron-store');

const Store = electronStore.default || electronStore; // ESM-only package

const settings = new Store({ name: 'Settings', fileExtension: '' });

module.exports = settings;
```

**Verify**: `npm run build` exits 0. If the app later fails with `ERR_REQUIRE_ESM` or `Store is not a constructor`, tell electron-vite to bundle `electron-store` instead of externalizing it (see dependency-handling doc above; option name per that page), rebuild, and note the change.

### Step 2: Switch main-process callers

- `app.js`: replace `const appConfig = require('electron-settings');` with `const appConfig = require('./main/settings');` — it must stay **below** the `MANTA_USER_DATA` / `Manta-dev` `app.setPath('userData', ...)` block added by plan 002, because the store resolves its path at construction. Directly after it add `global.mantaSettings = appConfig;` (renderer access, Step 3).
- `app.js` `migrateData()`: `appConfig.getAll()` → `appConfig.store`; `appConfig.deleteAll().setAll(migratedConfigs);` → `appConfig.clear(); appConfig.set(migratedConfigs);`.
- `main/updater.js`, `main/save-pdf.js`, `main/tour.js`, `main/preview-window.js`, `main/select-export-directory.js`: `require('electron-settings')` → `require('./settings')`.
- `get`, `set(key, value)`, `has` with dot paths (`'invoice.exportDir'`) work unchanged in electron-store.

**Verify**: `grep -rn "electron-settings" app.js main` → no output; `grep -rnE "getAll|deleteAll|setAll" app.js main` → no output.

### Step 3: Switch renderer callers to the main-process instance

In each of the 11 renderer files replace
```js
const appConfig = remote.require('electron-settings');
```
with
```js
const appConfig = remote.getGlobal('mantaSettings');
```
(`remote.getGlobal` returns a proxy to the one store in the main process, the same way `remote.require` returned the main-process `electron-settings` module before.)

**Verify**: `grep -rn "electron-settings" app preview modal tour i18n libs --include='*.js' --include='*.jsx' | grep -vE "__tests__|_tests_|__test__"` → no output.

### Step 4: Update test mocks

- `__mocks__/electron.js`: add to `remote`
  ```js
  getGlobal: vi.fn(name => {
    if (name === 'mantaSettings') {
      return { set: vi.fn(), get: vi.fn(() => 'someSettings'), has: vi.fn(() => false) };
    }
  }),
  ```
  and remove the `'electron-settings'` branch of `remote.require`.
- `git rm __mocks__/electron-settings.js`; remove the `electron-settings` alias from `vitest.config.mjs`.
- `Currency.spec.jsx` (and any other spec found by `grep -rln "electron-settings" --include='*.spec.*' .`): `remote.require('electron-settings')` → `remote.getGlobal('mantaSettings')`.

**Verify**: `npm test` → exit 0 with the same pass/skip counts as before this plan.

Commit: `Replace electron-settings with electron-store`.

### Step 5: Prove the existing Settings file is read (gate)

```sh
rm -rf /tmp/manta-profile && cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile
python3 -I -c "import json;print(sorted(json.load(open('/tmp/manta-profile/Settings')).keys()))" > /tmp/keys-before.txt
npm run build && MANTA_USER_DATA=/tmp/manta-profile npm start
```
In the app: open **Settings** → the company name, logo and language are the user's (not the "Manta Ray / Oceanic Preservation Society" defaults). Quit the app.

**Verify**:
- `python3 -I -c "import json;print(sorted(json.load(open('/tmp/manta-profile/Settings')).keys()))" | diff - /tmp/keys-before.txt` → no output (same keys).
- `ls /tmp/manta-profile | grep -E "^Settings\.|config\.json"` → no output (no new file was created next to `Settings`).

If either check fails: STOP.

### Step 6: Fix PDF export

Create `main/print-options.js` as a pure ES module (no Electron import, so Vitest can test it; the main bundle can `require` it):
```js
// Old marginsType (Electron <= 8) → new margins.marginType
const MARGIN_TYPES = ['default', 'none', 'printableArea'];

export function getPrintOptions(saved) {
  saved = saved || {};
  const marginType =
    (saved.margins && saved.margins.marginType) ||
    MARGIN_TYPES[saved.marginsType] ||
    'default';
  return {
    landscape: Boolean(saved.landscape),
    printBackground: saved.printBackground !== false,
    margins: { marginType },
    preferCSSPageSize: true, // templates set @page { size: A4 }
  };
}
```

Then rewrite the `save-pdf` handler in `main/save-pdf.js` (add `const { getPrintOptions } = require('./print-options');` at the top):
```js
ipcMain.on('save-pdf', async (event, docId) => {
  const exportDir = appConfig.get('invoice.exportDir');
  const pdfPath = path.join(exportDir, `${docId}.pdf`);
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    const data = await win.webContents.printToPDF(
      getPrintOptions(appConfig.get('general.printOptions'))
    );
    await fs.promises.writeFile(pdfPath, data);
    if (appConfig.get('general.previewPDF')) {
      // Open the PDF with the default reader
      await shell.openPath(pdfPath);
    }
    win.webContents.send('pfd-exported', {
      title: 'PDF Exported',
      body: 'Click to reveal file.',
      location: pdfPath,
    });
  } catch (error) {
    console.error('save-pdf failed:', error);
  }
});
```
Keep the `reveal-file` handler unchanged.

**Verify**: `grep -nE "marginsType: 0|printSelectionOnly|openExternal\('file://|printToPDF\([^)]*," main/save-pdf.js` → no output.

### Step 7: Fix the two file dialogs

`main/select-export-directory.js`:
```js
ipc.on('select-export-directory', async event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths.length) return;
  const dir = filePaths[0];
  fs.access(dir, fs.constants.W_OK, err => {
    if (err) {
      event.sender.send('no-access-directory', err.message);
    } else {
      event.sender.send('confirmed-export-directory', dir);
    }
  });
});
```
(The removed `appConfig.set('exportDir', ...)` wrote an unused key; the renderer saves `invoice.exportDir`. Remove the now-unused `appConfig` require from this file.)

`main/select-logo-file.js`:
```js
ipc.on('open-file-dialog', async event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'svg'] }],
  });
  if (!canceled && filePaths.length) event.sender.send('file-selected', filePaths[0]);
});
```
(add `const { BrowserWindow } = require('electron');`).

**Verify**: `grep -rnE "showOpenDialog\([^)]*=>|, (path|file) =>" main` → no output.

### Step 8: Fix updater sends and remove the dead DevTools-extension code

- `main/updater.js`: replace every `mainWindow.send(` with `mainWindow.webContents.send(`.
- `app.js`: delete the `addDevToolsExtension` function and the line `if (isDev) addDevToolsExtension();`. (React/Redux DevTools can be added later with `session.defaultSession.extensions.loadExtension(path)`; not needed now.)

**Verify**: `grep -rnE "Window\.send\(|addDevToolsExtension" app.js main modal` → no output.

Commit: `Fix PDF export and dialogs for Electron 45`.

### Step 9: Smoke test on the profile copy

`npm run build && MANTA_USER_DATA=/tmp/manta-profile npm start`

**Verify** (manual, all must pass):
1. **Settings → Invoice → export folder** button → a folder picker opens; choose a writable folder (e.g. `/tmp/manta-pdf`, create it first) → the field shows the path → **Save**.
2. **Settings → Profile → logo** → file picker opens filtered to jpg/png/svg; pick a PNG → logo preview updates.
3. **Form** → create an invoice → **Save** → **Preview** → **Export PDF** (in the preview sidebar) → `ls /tmp/manta-pdf/*.pdf` shows the file; if "Preview PDF" is on in Settings → General, it opens in the default PDF reader; the "PDF Exported" notification appears; clicking it reveals the file.
4. Open the PDF: page size is A4 (`mdls -name kMDItemPageWidth -name kMDItemPageHeight /tmp/manta-pdf/*.pdf` → about 595 × 842 points) and the template has its background colour.
5. Quit and start again with the same command: the export folder and logo are still set (store persisted).
6. Step 5 key-diff check still prints nothing.

## Test plan

- Create `main/__tests__/print-options.spec.js` for the pure mapping in `main/print-options.js`: `getPrintOptions(undefined)` → `margins.marginType === 'default'`, `preferCSSPageSize === true`, `printBackground === true`, `landscape === false`; `{ marginsType: 1 }` → `'none'`; `{ marginsType: 2 }` → `'printableArea'`; `{ margins: { marginType: 'custom' } }` → `'custom'`. No mocks needed. Pattern: `app/helpers/__tests__/invoice.spec.js` (plain function tests).
- Everything else is covered by the Step 5 gate and Step 9 smoke list.
- **Verify**: `npx vitest run main` → 4 new tests pass; `npm test` → exit 0.

## Done criteria

- [ ] `grep -rn "electron-settings" --include='*.js' --include='*.jsx' --include='*.json' --include='*.mjs' . | grep -v node_modules | grep -v package-lock` → no output
- [ ] `npm ci && npm test && npm run build` exit 0
- [ ] Step 5 gate passed (same keys, no new settings file, user values visible)
- [ ] Step 9 smoke items 1–6 pass
- [ ] `grep -rnE "Window\.send\(|addDevToolsExtension|marginsType: 0|openExternal\('file://" app.js main` → no output
- [ ] `git status` shows only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 5: the app shows default profile values, the key list changes, or a new file such as `Settings.json`/`config.json` appears → the store is not reading the old file. Do not "import" or rewrite the user file; report.
- `electron-store` cannot be loaded in the main process even after bundling it.
- `remote.getGlobal('mantaSettings')` returns `undefined` in a renderer (check that `global.mantaSettings` is set before any window loads).
- The exported PDF is not A4 or loses its background, and `preferCSSPageSize`/`printBackground` do not fix it.
- Any change would need edits outside the in-scope list.

## Maintenance notes

- `main/settings.js` is now the only owner of the settings file. Plan 009 replaces `remote.getGlobal('mantaSettings')` with IPC handlers (`settings:get`, `settings:set`) exposed through the preload; keep the store in the main process.
- The window IDs (`mainWindowID`, `previewWindowID`, `tourWindowID`) stay in settings because `main/*.js` read them at load time; plan 009 can replace them with in-memory references.
- electron-store adds no keys unless `migrations`/`projectVersion` options are used. Do not add those options without a data-migration plan — they write `__internal__` metadata to the user's file.
- `general.printOptions` is not in current user data but the mapping supports both old and new shapes.
- Reviewer focus: Step 5 evidence, the `app.js` order (userData override → store → `global.mantaSettings` → windows), and async error handling in `save-pdf`.
