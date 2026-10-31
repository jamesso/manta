# Plan 002: Boot Manta on Electron 45 with electron-vite (compatibility mode)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- app.js main helpers libs static/sounds app preview modal tour i18n package.json webpack.config.js webpack.parts.js .babelrc .gitignore`
> Plan 001 is expected to have changed `package.json`, import lines in `app/`, `preview/`, `modal/`, `i18n/`, and `helpers/notify.js`. Any other change to an in-scope file is drift: compare the excerpts below with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/001-npm-node24-vitest-baseline.md
- **Category**: migration
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

Manta runs on Electron 1.8 (Chromium 59, Node 8, 2018): no security fixes since 2018, no Apple Silicon build, and it is built with webpack 4 + Babel 6, which do not run on Node 24. Electron 45.2.0 (Chromium 156, Node 24.22) supports macOS 13+, Windows 10+, and 64-bit x64/arm64 only. This plan moves the app to Electron 45 and electron-vite 6 (Vite 8) **with the fewest possible code changes**: Node integration stays on and `@electron/remote` replaces the removed built-in `remote` module. The goal is: the app starts, all windows render, and existing users still see their invoices. Security hardening (preload + `contextBridge`) is plan 009; Electron API fixes for PDF export and file dialogs are plan 003.

## Data safety (read first)

The user's invoices and contacts live in PouchDB → IndexedDB inside the Electron profile `~/Library/Application Support/Manta` (Windows `%APPDATA%\Manta`, Linux `~/.config/Manta`). On this machine the database folder is `IndexedDB/file__0.indexeddb.leveldb`. `file__0` is the **origin**: data is only visible to pages loaded from `file://`. Two hard rules:

1. Production windows MUST load with `loadFile(...)` (a `file://` URL). Never use a custom protocol or `http://` in production, or every user "loses" all invoices.
2. Never run a development or test build against the real profile. This plan adds a `MANTA_USER_DATA` override and a separate `Manta-dev` profile for dev runs. Before Step 1, make a backup: `cp -R "$HOME/Library/Application Support/Manta" "$HOME/Manta-profile-backup-$(date +%Y%m%d)"`. Never delete or write to the backup.

## Current state

Files and roles:

- `app.js` — Electron main entry (`package.json` `"main": "app.js"`). Creates tour, main and preview windows, migrates settings, then `loadMainProcessFiles()`.
- `main/*.js` — 6 main-process side-effect modules (`preview-window.js`, `save-pdf.js`, `select-export-directory.js`, `select-logo-file.js`, `tour.js`, `updater.js`). Each reads window IDs from settings **at module load**, so they must load after the windows exist. Example `main/preview-window.js:3-7`:
  ```js
  const appConfig = require('electron-settings');
  const previewWindowID = appConfig.get('previewWindowID');
  const previewWindow = BrowserWindow.fromId(previewWindowID);
  ```
- `app/index.html`, `preview/index.html`, `modal/index.html`, `tour/index.html` — each loads its bundle through Node in an inline script:
  ```html
  <script>
    {
      const scripts = [];
      const isDev = require('electron-is-dev');
      if (isDev) {
        scripts.push('http://localhost:3000/main.dev.js');
      } else {
        scripts.push('../prod/main.prod.js');
      }
      document.write(scripts.map(script => '<script defer src="' + script + '"><\/script>').join(''));
    }
  </script>
  ```
  `tour/index.html` also links `../static/css/modal.css`, which does not exist (`ls static/css` has no `modal.css`).
- `webpack.config.js` — entries: `tour: ['react-hot-loader/patch', './tour/index.jsx']`, `main: ['react-hot-loader/patch', './app/renderers/startup.js', './app/renderers/dialog.js', './app/renderers/menu.js', './app/index.jsx']`, `preview: [... './preview/index.jsx']`, `modal: [... './modal/index.jsx']`; `target: 'electron-renderer'`; `node: { __dirname: false }` (so renderer `__dirname` = the HTML file's folder).
- `.babelrc` — Babel 6 presets `es2015`, `react`; plugins `react-hot-loader/babel`, class properties, object rest spread, `styled-components`.

`app.js` excerpts:
```js
// app.js:6-9, 25-27
const path = require('path');
const glob = require('glob');
const isDev = require('electron-is-dev');
const omit = require('lodash').omit;
...
const appConfig = require('electron-settings');
require('dotenv').config();

// app.js:84-92 (createMainWindow; tour and preview windows are the same shape)
mainWindow = new BrowserWindow({
  x: ..., y: ..., width: ..., height: ...,
  minWidth: 600, minHeight: 400,
  backgroundColor: '#2e2c29', show: false, title: 'Main Window',
});
...
mainWindow.loadURL(url.format({
  pathname: path.join(__dirname, './app/index.html'),
  protocol: 'file:', slashes: true,
}));

// app.js:164-165
const logoPath = path.resolve(__dirname, './static/imgs/default_logo.svg');
const logoData = fs.readFileSync(logoPath);

// app.js:360-363
function loadMainProcessFiles() {
  const files = glob.sync(path.join(__dirname, 'main/*.js'));
  files.forEach(file => require(file));
}

// app.js:410-420
app.on('ready', () => {
  createTourWindow(); createMainWindow(); createPreviewWindow();
  setInitialValues(); migrateData();
  if (isDev) addDevToolsExtension();
  addEventListeners(); loadMainProcessFiles();
  const { showWindow } = require('./main/tour');
  showWindow('startup');
});
```

Renderer code that cannot work in Electron 45 / Vite as is:

- `app/renderers/dialog.js` — creates the modal `BrowserWindow` **from the renderer** with `require('electron').remote`, `path.resolve(__dirname, '../modal/index.html')`, and `helpers/center-on-primary-display.js` (uses `electron.screen`, which is main-process only now). Ends with `module.exports = showModalWindow;`. It plays `sounds.play('DIALOG')` on `ready-to-show` and sends `'update-modal'` with `(dialogOptions, returnChannel, ...rest)` on `did-finish-load`.
- `modal/Dialog.jsx:145-148` — `mainWindow.send(returnChannel, parseInt(index), ...rest);` then `BrowserWindow.getFocusedWindow().close();`. `BrowserWindow#send` does not exist in current Electron (only `webContents.send`).
- `app/renderers/menu.js:2-5` — `const { Menu, BrowserWindow } = require('electron').remote;`, `const isDev = require('electron-is-dev');`; line 194 `require('electron').shell.openExternal('https://manta.life');`.
- `app/renderers/startup.js:2` — `require('../../libs/dragNdrop.js');`
- `libs/sounds.js` — `const appConfig = require('electron').remote.require('electron-settings');`, `require('../static/sounds/cs/index.js')`, `module.exports = { preload, play };`.
- `static/sounds/default/index.js` and `static/sounds/cs/index.js` — `module.exports = { STARTUP: { url: path.resolve(__dirname, '../static/sounds/default/startup.wav'), volume: ... }, ... }` (8 sounds each: STARTUP, DIALOG, SUCCESS, WARNING, ADD, REMOVE, RELOAD, TAP; files `startup.wav dialog.wav success.wav warning.wav add.wav remove.wav reload.wav tap.wav`).
- `tour/components/slides/{Welcome,Create,Preview,Save,Success}.jsx` — `import path from 'path';` and `imgSrc={path.resolve(__dirname, './imgs/Welcome.svg')}` (images are in `tour/imgs/`).
- `app/helpers/image.js` — after plan 001: `import Jimp from 'jimp'; import fs from 'fs'; import isSvg from 'is-svg';` (Node-only modules).
- `app/index.jsx`, `preview/index.jsx`, `tour/index.jsx` — wrap the tree in `<AppContainer>` from `react-hot-loader` and end with `module.hot && module.hot.accept();`. `modal/index.jsx`, `preview/index.jsx`, `tour/index.jsx` start with `require('../libs/dragNdrop.js');`.
- `app/store/index.jsx:3` `import isDev from 'electron-is-dev';` and lines 37-42 a `module.hot.accept('../reducers', ...)` block.
- `i18n/i18n.js` — after plan 001 `import isDev from 'electron-is-dev';` used as `debug: isDev`.
- After plan 001, renderer files import Electron as `import { ipcRenderer as ipc } from 'electron';` / `import { remote } from 'electron';`. Vite would bundle the npm `electron` package (which only exports the binary path) — this plan aliases `electron` to a small shim.

Source references: Electron 45 release notes https://www.electronjs.org/blog/electron-45-0; breaking changes (remote removed in 14, `nodeIntegration`/`contextIsolation`/`sandbox` defaults) https://electronjs.org/docs/latest/breaking-changes; `@electron/remote` setup (`initialize()` + `enable(webContents)`) https://www.npmjs.com/package/@electron/remote; electron-vite multi-page input https://electron-vite.org/guide/isolated-build and config reference https://electron-vite.org/config/.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Clean install | `npm ci` | exit 0 (no `ELECTRON_SKIP_BINARY_DOWNLOAD` needed after Step 2) |
| Unit tests | `npm test` | exit 0 |
| Build | `npm run build` | exit 0; creates `out/main/index.js` and `out/renderer/**/index.html` |
| Dev run (dev profile) | `npm run dev` | 3 windows created; no red errors in terminal |
| Built app on a profile copy | `MANTA_USER_DATA=/tmp/manta-profile npm start` | app opens with the user's invoices |

## Scope

**In scope**:
- `package.json`, `package-lock.json`, `.gitignore`, `electron.vite.config.mjs` (create)
- Delete: `webpack.config.js`, `webpack.parts.js`, `.babelrc`
- `app.js`, `main/modal-window.js` (create), `helpers/windows.js` (create)
- `libs/electron-renderer.js` (create), `libs/sounds.js`, `static/sounds/default/index.js`, `static/sounds/cs/index.js`
- `app/index.html`, `preview/index.html`, `modal/index.html`, `tour/index.html`
- `app/index.jsx`, `preview/index.jsx`, `modal/index.jsx`, `tour/index.jsx`, `app/store/index.jsx`, `i18n/i18n.js`
- `app/renderers/dialog.js`, `app/renderers/menu.js`, `app/renderers/startup.js`, `modal/Dialog.jsx`, `app/helpers/image.js`
- `tour/components/slides/{Welcome,Create,Preview,Save,Success}.jsx`
- `libs/__mocks__/sounds.js`, `app/renderers/__mocks__/dialog.js`, `vitest.setup.js` (only if tests need it)

**Out of scope** (do NOT touch):
- `main/save-pdf.js`, `main/select-export-directory.js`, `main/select-logo-file.js`, `main/updater.js` bodies — plan 003 fixes their Electron API calls. Exception: none.
- `electron-settings` usage — keep it; plan 003 replaces it with `electron-store`.
- `electron-builder.yml`, `dev-app-update.yml`, `dist:*`/`release:*` scripts, `.travis.yml` — plan 011. `npm run dist*` may not work after this plan; that is expected.
- React, Redux, styled-components, i18next and all UI libraries stay on their current versions (plans 004–008).
- Do not set `contextIsolation: true` or add a preload (plan 009).

## Git workflow

- Branch `upgrade/electron-45` (already created by plan 001). Commit per step group; subjects like `Replace webpack with electron-vite`, `Upgrade Electron to 45`, `Move modal window creation to main process`. No AI attribution. Do NOT push.

## Steps

### Step 1: Prepare a profile copy for testing

```sh
rm -rf /tmp/manta-profile
cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile
```
(If the real profile does not exist, create a profile in Step 10 by running the built app once with `MANTA_USER_DATA=/tmp/manta-profile` and adding one invoice.)

**Verify**: `ls /tmp/manta-profile/IndexedDB` → contains `file__0.indexeddb.leveldb`; `ls "$HOME"/Manta-profile-backup-*` → backup exists.

### Step 2: Replace build dependencies

```sh
npm uninstall webpack webpack-cli webpack-dev-server webpack-merge webpack-node-externals \
  webpack-bundle-analyzer clean-webpack-plugin compression-webpack-plugin \
  duplicate-package-checker-webpack-plugin babel-minify-webpack-plugin babel-core babel-loader \
  babel-plugin-styled-components babel-plugin-transform-class-properties \
  babel-plugin-transform-object-rest-spread babel-preset-es2015 babel-preset-react \
  react-hot-loader devtron dotenv glob electron-is-dev
npm install --save-dev electron@^45.2.0 electron-vite@^6.0.0 @vitejs/plugin-react@^6.1.2
npm install @electron/remote@^2.1.3 lodash@^4.18.1 electron-updater@^6.8.11
git rm webpack.config.js webpack.parts.js .babelrc
```
`lodash` is used by `app.js` and renderer code but was never declared. `electron-updater` 2.x targets Electron 1.x and is loaded by `main/updater.js` at startup, so it must move now; its API used here (`autoDownload`, `checkForUpdates`, `downloadUpdate`, `quitAndInstall`, events) is unchanged in 6.x.

Add `/out` to `.gitignore`.

**Verify**: `npx electron --version` → `v45.x.x`; `npm ls electron-vite vite @vitejs/plugin-react @electron/remote --depth=0` exits 0; `grep -cE "webpack|babel-|react-hot-loader|devtron|dotenv|\"glob\"|electron-is-dev" package.json` → `0`.

### Step 3: Add `electron.vite.config.mjs`

```js
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = p => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: root('./app.js') } },
    },
  },
  renderer: {
    root: root('.'),
    plugins: [react()],
    resolve: {
      // Renderer code imports 'electron'; with nodeIntegration on we
      // read it from window.require instead of bundling the npm package.
      alias: [{ find: /^electron$/, replacement: root('./libs/electron-renderer.js') }],
    },
    build: {
      rollupOptions: {
        input: {
          app: root('./app/index.html'),
          preview: root('./preview/index.html'),
          modal: root('./modal/index.html'),
          tour: root('./tour/index.html'),
        },
      },
    },
  },
});
```
Check the option names against https://electron-vite.org/config/ for electron-vite 6 (`main`, `preload`, `renderer`, `build.rollupOptions.input`). If electron-vite 6 renamed `rollupOptions` (Vite 8 uses Rolldown; it may accept `rolldownOptions`), use the documented name. electron-vite externalizes `dependencies` from the main bundle; confirm in Step 11.

Update `package.json`: `"main": "out/main/index.js"`; scripts `"dev": "electron-vite dev"`, `"build": "electron-vite build"`, `"start": "electron-vite preview"`. Leave `dist:*`/`release:*` scripts untouched.

**Verify**: `node -e "const p=require('./package.json');console.log(p.main,p.scripts.dev,p.scripts.build,p.scripts.start)"` → `out/main/index.js electron-vite dev electron-vite build electron-vite preview`.

### Step 4: Add the renderer `electron` shim

Create `libs/electron-renderer.js`:
```js
// Renderer access to Electron while nodeIntegration is on.
// electron.vite.config.mjs aliases 'electron' to this file.
// Removed in plan 009 (preload + contextBridge).
const electron = window.require('electron');
const remote = window.require('@electron/remote');

export const { ipcRenderer, shell, clipboard, webFrame, webUtils } = electron;
export { remote };
export default { ...electron, remote };
```
Tests are not affected: `vitest.config.mjs` aliases `electron` to `__mocks__/electron.js`.

**Verify**: `test -f libs/electron-renderer.js && echo ok` → `ok`.

### Step 5: Main process — windows, profile guard, remote, page loading

Create `helpers/windows.js` (main process only):
```js
const path = require('path');
const { app } = require('electron');
const remoteMain = require('@electron/remote/main');

// Compatibility settings until plan 009 adds a preload script.
const COMPAT_WEB_PREFERENCES = {
  nodeIntegration: true,
  contextIsolation: false,
  sandbox: false,
};

function enableRemote(win) {
  remoteMain.enable(win.webContents);
}

// Production MUST stay on file:// — PouchDB data is stored per origin.
function loadPage(win, name) {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    return win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${name}/index.html`);
  }
  return win.loadFile(path.join(__dirname, `../renderer/${name}/index.html`));
}

module.exports = { COMPAT_WEB_PREFERENCES, enableRemote, loadPage };
```
`__dirname` here is `out/main` after bundling.

Edit `app.js`:
1. Delete `const glob = require('glob');`, `const isDev = require('electron-is-dev');`, `require('dotenv').config();`. Add after the Electron imports:
   ```js
   const remoteMain = require('@electron/remote/main');
   const { COMPAT_WEB_PREFERENCES, enableRemote, loadPage } = require('./helpers/windows');
   const isDev = !app.isPackaged;

   // Never let dev/test runs touch the real user profile.
   if (process.env.MANTA_USER_DATA) {
     app.setPath('userData', process.env.MANTA_USER_DATA);
   } else if (!app.isPackaged) {
     app.setPath('userData', path.join(app.getPath('appData'), 'Manta-dev'));
   }
   remoteMain.initialize();
   ```
   This must run before `require('electron-settings')` and before `app.on('ready')` (electron-settings reads `userData` lazily, but keep the order anyway).
2. In `createTourWindow`, `createMainWindow`, `createPreviewWindow`: add `webPreferences: COMPAT_WEB_PREFERENCES,` to the options; after `new BrowserWindow(...)` call `enableRemote(<win>);`; replace each `loadURL(url.format({...}))` with `loadPage(tourWindow, 'tour')`, `loadPage(mainWindow, 'app')`, `loadPage(previewWindow, 'preview')`. Remove the now-unused `url` require.
3. `setInitialValues`: `const logoPath = path.join(app.getAppPath(), 'static/imgs/default_logo.svg');` (`app.getAppPath()` is the folder with `package.json`; plan 011 must package `static/`).
4. Replace `loadMainProcessFiles` body with explicit requires, kept **inside the function** so the modules run after the windows exist:
   ```js
   function loadMainProcessFiles() {
     require('./main/modal-window');
     require('./main/preview-window');
     require('./main/save-pdf');
     require('./main/select-export-directory');
     require('./main/select-logo-file');
     require('./main/tour');
     require('./main/updater');
   }
   ```
5. Leave `addDevToolsExtension` as is (with `dotenv` gone the env vars are unset, so it does nothing; plan 003 deletes it).

**Verify**: `grep -nE "glob|dotenv|electron-is-dev|url\.format" app.js` → no output; `grep -c "enableRemote(" app.js` → `3`; `grep -c "COMPAT_WEB_PREFERENCES" app.js` → `4` (1 import + 3 windows).

### Step 6: Move modal window creation to the main process

Create `main/modal-window.js`:
```js
const { BrowserWindow, ipcMain } = require('electron');
const centerOnPrimaryDisplay = require('../helpers/center-on-primary-display');
const { COMPAT_WEB_PREFERENCES, enableRemote, loadPage } = require('../helpers/windows');

ipcMain.on('show-modal', (event, dialogOptions, returnChannel = '', ...rest) => {
  const width = 450;
  const height = 220;
  const winPOS = centerOnPrimaryDisplay(width, height);
  const modalWin = new BrowserWindow({
    x: winPOS.x, y: winPOS.y, width, height,
    backgroundColor: '#282828', frame: false, show: false,
    webPreferences: COMPAT_WEB_PREFERENCES,
  });
  enableRemote(modalWin);
  loadPage(modalWin, 'modal');
  modalWin.webContents.on('did-finish-load', () => {
    modalWin.webContents.send('update-modal', dialogOptions, returnChannel, ...rest);
  });
  modalWin.on('ready-to-show', () => {
    modalWin.show();
    modalWin.focus();
  });
});
```
Note: `centerOnPrimaryDisplay` returns fractional x/y; if Electron throws on non-integers, wrap with `Math.round`.

Replace all of `app/renderers/dialog.js` with:
```js
import { ipcRenderer } from 'electron';
import sounds from '../../libs/sounds';

function showModalWindow(dialogOptions, returnChannel = '', ...rest) {
  ipcRenderer.send('show-modal', dialogOptions, returnChannel, ...rest);
  sounds.play('DIALOG');
}

export default showModalWindow;
```
(The sound now plays when the request is sent instead of on `ready-to-show`; acceptable.)

In `modal/Dialog.jsx` `handleClick`: `mainWindow.send(...)` → `mainWindow.webContents.send(...)`, and `BrowserWindow.getFocusedWindow().close();` → `remote.getCurrentWindow().close();` (`remote` is already imported there after plan 001).

`app/renderers/__mocks__/dialog.js` stays `export default vi.fn();`.

**Verify**: `grep -rn "remote\|__dirname\|require(" app/renderers/dialog.js` → no output; `grep -n "mainWindow.send\|getFocusedWindow" modal/Dialog.jsx` → no output.

### Step 7: Convert remaining renderer CommonJS and `__dirname` uses

1. `static/sounds/default/index.js` and `static/sounds/cs/index.js`: replace `path`/`__dirname` with Vite asset imports, e.g.
   ```js
   import startup from './startup.wav';
   import dialog from './dialog.wav';
   // ... success, warning, add, remove, reload, tap
   const VOLUME = 0.5; // keep each file's existing value (cs uses 0.25)
   export default {
     STARTUP: { url: startup, volume: VOLUME * 2 },
     // keep every key and volume expression exactly as before
   };
   ```
2. `libs/sounds.js`: `import { remote } from 'electron'; const appConfig = remote.require('electron-settings');`, `import cs_sounds from '../static/sounds/cs/index.js'; import default_sounds from '../static/sounds/default/index.js';`, and `export default { preload, play };` instead of `module.exports`.
3. Tour slides (5 files): delete `import path from 'path';`, add e.g. `import welcomeImg from '../../imgs/Welcome.svg';` and use `imgSrc={welcomeImg}`. Map: Welcome→Welcome.svg, Create→Create.svg, Preview→Preview.svg, Save→Save.svg, Success→Success.svg. Check each file's existing `./imgs/<Name>.svg` and keep the same image.
4. `app/renderers/menu.js`: replace lines 2-5 with
   ```js
   import { remote, ipcRenderer as ipc, shell } from 'electron';
   const { Menu, BrowserWindow } = remote;
   const appConfig = remote.require('electron-settings');
   const isDev = import.meta.env.DEV;
   ```
   and line 194 `require('electron').shell.openExternal(...)` → `shell.openExternal('https://manta.life');`.
5. `app/renderers/startup.js`: `require('../../libs/dragNdrop.js');` → `import '../../libs/dragNdrop.js';`.
6. `app/helpers/image.js`: delete the `jimp`, `fs`, `is-svg` imports and load them lazily inside the functions that use them (so tests and Vite never bundle them):
   ```js
   const nodeRequire = name => window.require(name);
   function detectSVG(filePath) {
     const data = nodeRequire('fs').readFileSync(filePath);
     return nodeRequire('is-svg')(data);
   }
   // svg2Base64: nodeRequire('fs'); processImg: const Jimp = nodeRequire('jimp');
   ```
7. `i18n/i18n.js`: remove `import isDev from 'electron-is-dev';`, use `debug: import.meta.env.DEV`.
8. `app/store/index.jsx`: remove the `electron-is-dev` import, use `const isDev = import.meta.env.DEV;`, delete the `if (module.hot) { ... }` block.

**Verify**:
`grep -rnE "\brequire\(" app preview modal tour i18n libs static/sounds --include='*.js' --include='*.jsx' | grep -vE "__tests__|_tests_|__test__|__mocks__|window\.require|remote\.require"` → no output.
`grep -rn "__dirname\|electron-is-dev\|react-hot-loader\|module\.hot" app preview modal tour i18n libs static/sounds --include='*.js' --include='*.jsx'` → no output.

### Step 8: Entry files and HTML

1. `app/index.jsx`: delete the `AppContainer` import and wrapper and the `module.hot` line; add at the top `import './renderers/startup.js';` and `import './renderers/menu.js';` (they were separate webpack entry items before `./app/index.jsx`).
2. `preview/index.jsx`, `tour/index.jsx`: same `AppContainer`/`module.hot` removal; `require('../libs/dragNdrop.js');` → `import '../libs/dragNdrop.js';`. `modal/index.jsx`: only the `dragNdrop` change.
3. In each of the 4 `index.html` files, replace the whole inline `<script>{ ... document.write ... }</script>` block with `<script type="module" src="./index.jsx"></script>`. Keep all `<link rel="stylesheet">` tags except `../static/css/modal.css` in `tour/index.html` (file does not exist — delete that link).

**Verify**: `grep -rn "document.write\|electron-is-dev" */index.html` → no output; `grep -c 'type="module"' app/index.html preview/index.html modal/index.html tour/index.html` → `1` each.

### Step 9: Build

`npm run build`

Known fixes, apply only if the error appears:
- `global is not defined` (from `pouchdb-browser` 6) → add `define: { global: 'globalThis' }` to the `renderer` config.
- `Module "events" has been externalized for browser compatibility` → `npm install events` (browser polyfill), rebuild.
- `Could not resolve "../static/css/..."` → the linked file is missing; compare with `ls static/css`, report which.

**Verify**: exit 0; `find out/renderer -name index.html | sort` → 4 files whose folders are `app`, `modal`, `preview`, `tour` (if the folder layout differs, update `loadPage` to the real paths and note it); `grep -c "require(\"electron-updater\")\|require('electron-updater')" out/main/index.js` → ≥ 1 (dependency externalized, not inlined).

### Step 10: Run on the dev profile

`npm run dev`. The dev server uses an `http://localhost` origin and the `Manta-dev` profile, so the app starts with no invoices — that is expected.

**Verify** (manual): tour window or main window appears; DevTools console of the main window has no uncaught errors; menu bar shows Invoice/Go/Edit/Window/Help (+ app menu on macOS). Quit with Cmd/Ctrl+Q.

### Step 11: Run the built app on the copied profile

`npm run build && MANTA_USER_DATA=/tmp/manta-profile npm start`

**Verify** (manual smoke, all must pass):
1. Main window opens; the **Invoices** tab lists the same invoices the user had (compare count with what the user reports, or open `/tmp/manta-profile` in the old app before).
2. **Contacts** tab lists saved contacts.
3. **Settings** tab shows the saved company name/logo (proves `electron-settings` reads the profile).
4. **Form** tab → fill one item → **Save** → invoice appears in Invoices.
5. **Form** → **Preview** → preview window opens with the invoice and a template.
6. **Invoices** → an invoice → **Delete** → the confirm modal opens; **Cancel** closes only the modal; **Delete** removes the invoice (proves `show-modal` and `webContents.send`).
7. Help → **Show Tutorial** opens the tour; finishing it restores the main window.
8. `ls "$HOME/Library/Application Support/Manta-dev"` exists and the real profile's modification time did not change: `stat -f %Sm "$HOME/Library/Application Support/Manta/Settings"` (same as before Step 10).

Known broken until plan 003 (do not fix here): Export PDF, choosing the export folder, selecting a logo file, auto-update events.

### Step 12: Tests

`npm test`

If a spec fails because a module it imports now uses `import.meta.env`, `window.require`, or a `.wav`/`.svg` import, fix the test setup (`vitest.setup.js` / mocks) — not the app code.

**Verify**: exit 0, same pass/skip counts as at the end of plan 001.

Commit after Steps 2–4 (`Replace webpack with electron-vite`), 5–6 (`Upgrade Electron to 45 in compatibility mode`), 7–8 (`Load renderer assets through Vite`), and after fixes.

## Test plan

- No new unit tests (behaviour is unchanged; plans 009/011 add process-level tests).
- Regression proof = Step 11 smoke list on a copy of real data + `npm test` green.

## Done criteria

- [ ] `npx electron --version` → `v45.*`
- [ ] `npm ci && npm test && npm run build` all exit 0
- [ ] `grep -rnE "webpack|react-hot-loader|electron-is-dev|dotenv" package.json app.js app preview modal tour i18n libs --include='*.js' --include='*.jsx' --include='*.json'` → no output
- [ ] `ls webpack.config.js webpack.parts.js .babelrc 2>/dev/null` → nothing
- [ ] Step 7 grep checks print nothing
- [ ] `grep -n "loadFile" helpers/windows.js` → 1 match; `grep -rn "registerFileProtocol\|protocol.handle" app.js main helpers` → no output
- [ ] Step 11 smoke items 1–8 pass on `/tmp/manta-profile`
- [ ] Real profile untouched (Step 11 item 8)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 11: the Invoices or Contacts list is empty on the copied profile while the profile has data. Do NOT try other origins or migrations; report (data-loss risk).
- electron-vite cannot build 4 HTML entries from 4 folders, or names output folders so that `loadFile` cannot find them after one adjustment.
- `@electron/remote` throws `"@electron/remote is disabled for this WebContents"` after `enable()` was added for that window.
- Any `main/*.js` module runs before the windows exist (symptom: `Cannot read properties of null` on `previewWindow`/`mainWindow`/`tourWindow` at startup). This means the bundler hoisted the requires in `loadMainProcessFiles`; report instead of restructuring `main/`.
- `electron-settings` 3 fails to load or read in Electron 45 (symptom: Settings tab empty on the copied profile). Report; plan 003 replaces it, and may need to run first.
- Fixing the build needs changes in an out-of-scope file.

## Maintenance notes

- Compatibility mode is a known security debt: every window has Node integration and loads `http://localhost` in dev. Plan 009 removes `COMPAT_WEB_PREFERENCES`, `libs/electron-renderer.js`, `@electron/remote`, and all `window.require`.
- `loadPage` + `file://` in production is a data contract: any future change of how pages load must keep the IndexedDB origin `file__0` or ship a data migration.
- `MANTA_USER_DATA` is also the hook for Playwright tests in plan 011.
- `static/` is read at runtime by the main process (`app.getAppPath()/static/imgs/default_logo.svg`); plan 011 must include it in the packaged `files`.
- Reviewer focus: `helpers/windows.js`, the `app.js` profile guard ordering, the modal IPC flow, and the Step 11 evidence.
