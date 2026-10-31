# Plan 011: Ship 64-bit macOS (universal), Windows and Linux builds from GitHub Actions, with Playwright e2e smoke tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- electron-builder.yml dev-app-update.yml .travis.yml test/ README.md`
> These files should be unchanged by plans 001–010. If any of them changed,
> compare with the "Current state" excerpts below; on a mismatch, STOP.
> `main/updater.js` and `package.json` are expected to have changed in
> earlier plans — read their live content instead of the excerpts.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/009-*.md (and transitively 001–008). plans/010-*.md is optional: if 010 is DONE, CI also runs lint.
- **Category**: migration
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

The release setup cannot produce a working app for current computers. `electron-builder.yml` builds 32-bit Windows (`ia32`) targets that Electron 45 no longer ships, there is no Apple Silicon build (Macs run the app through Rosetta 2, which Apple is phasing out), there is no code signing or notarization (Gatekeeper blocks unsigned downloads), CI runs on Travis with Node 8 and Xcode 9 (both gone), and the e2e tests use Spectron, which is archived and does not work with Electron 14+. Auto-update and publishing point to the upstream repo `hql287/Manta`. After this plan: one universal macOS build (Intel + Apple Silicon, macOS 13+), Windows x64 + arm64 installers, Linux x64 + arm64 packages, a GitHub Actions CI that tests, builds and packages on all three OSes, a tag-driven release workflow, and Playwright smoke tests that run against a throw-away user-data folder.

## Required operator input — get this BEFORE Step 1

**PUBLISH_OWNER / PUBLISH_REPO**: the GitHub owner and repository that releases and auto-updates must use (for example `jamesso/manta`). Today both `electron-builder.yml` and `dev-app-update.yml` say `owner: hql287`, `repo: Manta`, and the local git `origin` is `https://github.com/hql287/Manta.git` too, so the repo cannot tell you the answer. **If the operator did not give you PUBLISH_OWNER and PUBLISH_REPO, STOP and ask.** Never guess and never keep `hql287/Manta`.

Signing secrets are optional for this plan (see STOP conditions). Without them you still finish every step; builds are unsigned and you say so in your report.

## Current state

### Preconditions from plans 001–009 (verify; STOP if any check fails)

| Precondition | Check command | Expected |
|---|---|---|
| npm lockfile | `test -f package-lock.json && echo ok` | `ok` |
| Node 24 | `cat .nvmrc` | starts with `24` |
| Vitest | `node -p "require('./package.json').scripts.test"` | `vitest run` |
| electron-vite build | `npm run build && ls out` | exit 0; `main preload renderer` |
| Main entry | `node -p "require('./package.json').main"` | `out/main/index.js` |
| Electron 45 | `node -p "require('electron/package.json').version"` | `45.x.y` |
| No @electron/remote | `grep -rn "@electron/remote" --include='*.js' --include='*.jsx' --include='*.mjs' . --exclude-dir=node_modules --exclude-dir=out` | no output |
| User-data override | `grep -rn "MANTA_USER_DATA" --include='*.js' --include='*.mjs' . --exclude-dir=node_modules --exclude-dir=out` | at least one hit in main-process code that calls `app.setPath('userData', …)` |

### Files at `c530133`

`electron-builder.yml` (whole file):

```yaml
appId: com.electron.manta
copyright: Hung Q. Le
productName: Manta
publish:
  - provider: github
    owner: hql287
    repo: Manta
directories:
  output: dist/
mac:
  category: public.app-category.business
  target:
    - zip
    - dmg
win:
  target:
    - target: nsis
      arch:
        - x64
        - ia32
    - target: portable
      arch:
        - x64
        - ia32
linux:
  category: Office
  target:
    - deb
    - AppImage
```

`dev-app-update.yml` (whole file — electron-updater reads it only in development):

```yaml
provider: github
owner: hql287
repo: Manta
```

`.travis.yml` (excerpt): `language: node_js`, `node_js: - "8"`, `osx_image: xcode9.0`, `script: - yarn lint - yarn test`, plus a git-lfs download for `v2.3.1`.

`test/helper.js` (whole file) — Spectron launcher pointing at a packaged mac build:

```js
const path = require('path');
const { Application } = require('spectron');
const appPath = path.join(__dirname, '../dist/mac/Manta.app/Contents/MacOS/Manta');
...
    startTimeout: 10000,
```

`test/spec.js` (mocha + chai, 199 lines) — what it checks, which the new e2e tests must keep:
- 3 windows exist after start.
- Tour window: title `Tour`, size 700×600, centred on the primary display, not minimized, **not resizable**, **not movable**, devtools closed.
- Main window: title `Manta`, not minimized, resizable, movable, devtools closed.
- Preview window: title `Previewer`, not minimized, resizable, movable, devtools closed, not visible.
- It does NOT test any invoice flow, so the new tests do not add one.

Window titles come from the HTML `<title>` tags: `tour/index.html:6` `<title>Tour</title>`, `app/index.html:6` `<title>Manta</title>`, `preview/index.html:6` `<title>Previewer</title>`, `modal/index.html:6` `<title>Dialog</title>` (paths at `c530133`; plan 002 may have moved them — find them with `grep -rn "<title>" --include=index.html . --exclude-dir=node_modules --exclude-dir=out`).

First-start behaviour (`main/tour.js` at `c530133`, function `showWindow`): with a fresh settings file `tour.isActive` and `tour.hasBeenTaken` are both false, so `startTour()` runs: it hides the other windows and shows + focuses the tour window. A fresh user-data folder therefore starts with **tour visible, main and preview hidden**.

`main/updater.js` at `c530133` (excerpts; plans 003/008 may have edited it — read the live file):

```js
const { autoUpdater } = require('electron-updater');
...
autoUpdater.autoDownload = false;
...
function checkForUpdate() {
  // Only check for update in Production
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
}
```

`README.md` lines 88–103 ("Supported Platforms"):

```
#### Supported Platforms
Following platforms are supported by Electron:

**macOS**
The minimum version supported is macOS 10.9.

**Windows**
Windows 7 and later are supported

**Linux:**

- Ubuntu 12.04 and later
- Fedora 21
- Debian 8
```

`README.md` lines 152–163 ("Development"): tells users to run `yarn install`, `yarn dev` (webpack-dev-server) and `yarn start`, and says Linux needs `sudo apt install -y icnsutils graphicsmagick`.

`package.json` version is `1.1.4`; artifact names include it. Do not change the version in this plan.

### Facts checked on 2026-10-31 (do not re-derive)

- Electron 45 ships only 64-bit builds (x64, arm64); 32-bit Windows (`ia32`) and Linux `armv7l` were dropped ([Electron 45 blog](https://www.electronjs.org/blog/electron-45-0)). Electron 44+ requires macOS 13 (Ventura) or newer.
- electron-builder: universal mac via `mac.target[].arch: universal`; output app at `dist/mac-universal/Manta.app`. `minimumSystemVersion` sets `LSMinimumSystemVersion`; do not set it lower than Electron's own minimum. Squirrel.Mac auto-update needs both `dmg` and `zip` targets. ([mac docs](https://www.electron.build/docs/mac))
- Notarization ([electron.build notarization](https://www.electron.build/docs/notarization)): `mac.notarize` is boolean. Unset = notarize when credentials exist, otherwise skip with a warning; `true` = fail if credentials are missing. API-key auth env vars: `APPLE_API_KEY` (path to the `.p8` file, or its content base64-encoded on one line), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`. Apple-ID alternative: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Signing cert: `CSC_LINK` + `CSC_KEY_PASSWORD` (Windows: `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD`). `hardenedRuntime` defaults to true for normal mac builds. Note: those docs are for v27 (next), where some signing keys moved under `mac.sign`; in v26 they are directly under `mac` — Step 3 verifies this against the installed schema.
- Playwright Electron support: `_electron.launch({ args, env })` from `@playwright/test`; `electronApp.evaluate(fn)` runs `fn` in the main process with the `electron` module as its first argument; launch hangs if the `nodeCliInspect` fuse is disabled ([Playwright Electron API](https://playwright.dev/docs/api/class-electron)).
- GitHub-hosted runners: `macos-latest` is arm64; `windows-latest`; `ubuntu-latest` is Ubuntu 24.04 ([runner-images](https://github.com/actions/runner-images)). Latest action majors: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`.
- Latest npm versions: `electron-builder` 26.18.0, `electron-updater` 6.8.11, `@playwright/test` 1.64.1.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` / `npm ci` | exit 0 |
| Unit tests | `npm test` | exit 0 |
| Build | `npm run build` | exit 0, `out/` created |
| Package mac (local) | `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --publish never` | exit 0, `dist/Manta-1.1.4-universal.dmg` and `dist/Manta-1.1.4-universal-mac.zip` (names may differ slightly — check `ls dist`) |
| Check universal | `lipo -archs dist/mac-universal/Manta.app/Contents/MacOS/Manta` | `x86_64 arm64` |
| e2e | `npm run test:e2e` | all pass |
| Lint (if 010 DONE) | `npm run lint` | exit 0 |
| Workflow lint | `npx --yes actionlint` (fallback check in Step 6 if it cannot run) | exit 0, no output |

## Scope

**In scope** (the only files you should modify/create/delete):
- `package.json`, `package-lock.json`
- `electron-builder.yml`, `dev-app-update.yml`
- `main/updater.js` (or the file that now holds the autoUpdater code — find it with `grep -rln "electron-updater" --include='*.js' --include='*.mjs' . --exclude-dir=node_modules --exclude-dir=out`) — only the changes in Step 4
- `e2e/app.e2e.mjs` (create), `playwright.config.mjs` (create)
- `test/helper.js`, `test/spec.js` (delete), `test/` folder (delete when empty)
- `.travis.yml` (delete)
- `.github/workflows/ci.yml`, `.github/workflows/release.yml` (create)
- `.gitignore` (add Playwright output folders)
- `README.md` — only the "Downloads", "Supported Platforms" and "Development" sections

**Out of scope** (do NOT touch):
- `appId: com.electron.manta` and `productName: Manta` — `productName` decides the user-data folder (`~/Library/Application Support/Manta` on macOS, `%APPDATA%\Manta` on Windows) where every user's invoices (IndexedDB) and settings live; `appId` is the macOS bundle identity that auto-update and Keychain rely on. Changing either strands existing user data.
- `package.json` `"version"` — releasing a version is the operator's decision.
- Any application/renderer source code other than the updater file.
- `.github/FUNDING.yml`, `.github/*.md` templates.
- Any secret value. Workflows reference secrets by name only (`${{ secrets.NAME }}`). Never write a certificate, password, or key into a file.
- Electron fuses (`electronFuses`) — leave them at defaults; disabling `nodeCliInspect` breaks Playwright.

## Git workflow

- Branch: `upgrade/electron-45` (shared by plans 001–011; do not create a new branch).
- Commit messages: short imperative subject, no prefix, no AI attribution. Repo examples: `Updated domain & email address`, `Fix typo in form.json (#314)`.
- Suggested commits: `Upgrade electron-builder and electron-updater`, `Build 64-bit universal mac, Windows and Linux targets`, `Point releases and updates to <PUBLISH_OWNER>/<PUBLISH_REPO>`, `Replace Spectron e2e tests with Playwright`, `Replace Travis with GitHub Actions CI and release workflows`, `Update README platform support and dev commands`.
- Do NOT push, do NOT create tags, do NOT run the release workflow.

## Steps

### Step 1: Confirm preconditions and operator input

Run every check in the "Preconditions" table. Confirm you have PUBLISH_OWNER and PUBLISH_REPO.

**Verify**: all checks give the expected output; `echo "$PUBLISH_OWNER/$PUBLISH_REPO"` (or the values the operator gave) is not `hql287/Manta` and not empty.

### Step 2: Upgrade electron-builder and electron-updater

1. `npm ls electron-builder electron-updater` — note current versions (an earlier plan may already have upgraded them).
2. `npm install --save-dev electron-builder@^26.18.0` and `npm install --save electron-updater@^6.8.11` (`electron-updater` is a runtime dependency; it must stay in `dependencies`).

**Verify**: `npx electron-builder --version` → `26.18.x` (or newer 26.x); `node -p "require('electron-updater/package.json').version"` → `6.8.x`; `node -p "!!require('./package.json').dependencies['electron-updater']"` → `true`.

### Step 3: Rewrite `electron-builder.yml`

1. Check key positions in the installed v26 schema (v27 moved some keys under `mac.sign`):
   `grep -o '"hardenedRuntime"\|"minimumSystemVersion"\|"notarize"\|"mergeASARs"' node_modules/app-builder-lib/scheme.json | sort | uniq -c`
   → all four names appear. Then `node -e "const s=require('app-builder-lib/scheme.json');const m=s.definitions.MacConfiguration.properties;console.log(['hardenedRuntime','minimumSystemVersion','notarize'].map(k=>k+':'+(k in m)).join(' '))"`
   → `hardenedRuntime:true minimumSystemVersion:true notarize:true`. If any is `false`, the key lives elsewhere in this version: STOP and report the schema location.
2. Find which files the packaged app needs at runtime besides `out/`:
   - `grep -rhoE "static/[A-Za-z0-9_./-]+" out/main out/preload out/renderer | sort -u`
   - If this prints paths (for example `static/imgs/default_logo.svg`, `static/css/...`, `static/sounds/...`) and those files are NOT inside `out/` (`ls out/renderer` to check), add `static/**/*` to `files` below. If it prints nothing, leave it out.
3. Replace `electron-builder.yml` with (fill in PUBLISH_OWNER / PUBLISH_REPO; add `- static/**/*` under `files` only if step 2 said so):

```yaml
appId: com.electron.manta
copyright: Hung Q. Le
productName: Manta
publish:
  - provider: github
    owner: PUBLISH_OWNER
    repo: PUBLISH_REPO
directories:
  output: dist/
  buildResources: build
files:
  - out/**/*
  - package.json
mac:
  category: public.app-category.business
  minimumSystemVersion: '13.0'
  hardenedRuntime: true
  target:
    - target: dmg
      arch: universal
    - target: zip
      arch: universal
win:
  target:
    - target: nsis
      arch:
        - x64
        - arm64
    - target: portable
      arch:
        - x64
        - arm64
linux:
  category: Office
  target:
    - target: deb
      arch:
        - x64
        - arm64
    - target: AppImage
      arch:
        - x64
        - arm64
```

Notes for the executor:
- `notarize` is deliberately **not** set here: unset means "notarize when Apple credentials exist, otherwise skip with a warning", so local and CI builds without secrets still work. `release.yml` (Step 7) turns it on with `-c.mac.notarize=true`.
- `build/icon.icns` and `build/icon.ico` already exist and are picked up from `buildResources: build`.
- Do not add `asar: false`, `electronFuses`, or `afterSign` hooks.

**Verify**: `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --publish never` (on a Mac) → exit 0; then
- `ls dist/*.dmg dist/*.zip` → one universal `.dmg` and one universal `.zip`
- `lipo -archs dist/mac-universal/Manta.app/Contents/MacOS/Manta` → `x86_64 arm64`
- `/usr/libexec/PlistBuddy -c "Print :LSMinimumSystemVersion" dist/mac-universal/Manta.app/Contents/Info.plist` → `13.0`
- `npx --yes @electron/asar list dist/mac-universal/Manta.app/Contents/Resources/app.asar | grep -c "^/out/main/index.js$"` → `1`
- `/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" dist/mac-universal/Manta.app/Contents/Info.plist` → `com.electron.manta`
- Launch the packaged app against a throw-away profile (never your real data): `MANTA_USER_DATA="$(mktemp -d)" dist/mac-universal/Manta.app/Contents/MacOS/Manta` → the tour window opens; quit with Cmd+Q. No error dialog.

If you are not on a Mac, run `npx electron-builder --linux --publish never` instead and verify `ls dist/*.AppImage dist/*.deb` shows x64 and arm64 files; the mac checks then run in CI (Step 6).

### Step 4: Point update config at the new repo and check the updater against electron-updater 6

1. Replace `dev-app-update.yml` with:

```yaml
provider: github
owner: PUBLISH_OWNER
repo: PUBLISH_REPO
```

2. Open the live updater file (see Scope for how to find it). Check, and change only what is listed:
   - `autoUpdater.autoDownload = false;` — keep.
   - The dev check must use `app.isPackaged` (not `electron-is-dev`). If `isDev`/`electron-is-dev` is still used here, replace with `if (app.isPackaged)` / `if (!app.isPackaged)` with the same meaning ("only check in production").
   - `autoUpdater.checkForUpdates()` returns a Promise in v6. If its result is not handled, change to `autoUpdater.checkForUpdates().catch(() => {});` — errors are already delivered to the `'error'` event handler, so swallowing the rejection only avoids an unhandled-rejection log.
   - `autoUpdater.downloadUpdate()` — same: add `.catch(() => {})` if unhandled.
   - `autoUpdater.quitAndInstall(false)` (in the `quit-and-install` IPC handler, `app.js` at `c530133`) — v6 signature is `quitAndInstall(isSilent?, isForceRunAfter?)`; keep the call as it is.
   - Event names used (`checking-for-update`, `update-available`, `update-not-available`, `error`, `download-progress`, `update-downloaded`) all exist in v6 — no change.
   - Do not change any IPC channel name sent to the renderer.

**Verify**: `grep -n "electron-is-dev" <updater file>` → no output; `grep -n "checkForUpdates()" <updater file>` → the line ends with `.catch(() => {});` (or the promise is awaited inside a try/catch); `npm run build` → exit 0; `npm test` → exit 0.

### Step 5: Replace Spectron with Playwright e2e smoke tests

1. `npm uninstall spectron mocha chai` (some may already be gone — check `npm ls spectron mocha chai` first) and `npm install --save-dev @playwright/test@^1.64.1`. No browser download is needed: Electron tests use the Electron binary from `node_modules`.
2. `git rm test/helper.js test/spec.js` (the folder is then empty and disappears).
3. If the Vitest config (find with `ls vitest.config.* 2>/dev/null; grep -n "test:" electron.vite.config.* vite.config.* 2>/dev/null`) has an `exclude` entry for `test/` added by plan 001, remove that entry only.
4. In `package.json` scripts set `"test:e2e": "npm run build && playwright test"`. Remove any old mocha-based e2e script.
5. Add to `.gitignore`: `/playwright-report` and `/test-results`.
6. Create `playwright.config.mjs`:

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.mjs',
  timeout: 60_000,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
});
```

   The `.e2e.mjs` suffix keeps Vitest's default `*.spec.*` / `*.test.*` include pattern from picking these files up.

7. Create `e2e/app.e2e.mjs`. It ports the checks from `test/spec.js` (see Current state). Required shape:

```js
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let app;
let userData;

test.beforeAll(async () => {
  // Fresh, throw-away profile: never touch a real Manta user-data folder.
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-e2e-'));
  app = await electron.launch({
    args: [
      'out/main/index.js',
      // Ubuntu 24.04 CI blocks Chromium's user-namespace sandbox; test-only flag.
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
    env: { ...process.env, MANTA_USER_DATA: userData, NODE_ENV: 'production' },
  });
  // Wait until the three app windows exist.
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(3);
});

test.afterAll(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

async function windowInfo() {
  // Wait for every page title to load before reading.
  return app.evaluate(({ BrowserWindow, screen }) => {
    const display = screen.getPrimaryDisplay().workArea;
    return BrowserWindow.getAllWindows().map(w => ({
      title: w.getTitle(),
      visible: w.isVisible(),
      minimized: w.isMinimized(),
      resizable: w.isResizable(),
      movable: w.isMovable(),
      devTools: w.webContents.isDevToolsOpened(),
      bounds: w.getBounds(),
      display,
    }));
  });
}
```

   Then write these tests (each `test(...)` uses `await expect.poll(...)` or reads `windowInfo()` after the titles are loaded; find a window with `infos.find(w => w.title === 'Tour')`):
   - `creates the Tour, Manta and Previewer windows` — titles include `Tour`, `Manta`, `Previewer`.
   - `fresh profile shows the tour window` — Tour: `visible === true`, `resizable === false`, `movable === false`, `minimized === false`, `devTools === false`, `bounds.width === 700`, `bounds.height === 600`. Main (`Manta`) and Previewer: `visible === false`.
   - `main window is resizable and movable` — Manta: `resizable`, `movable` true, `devTools` false.
   - `preview window is resizable and movable` — Previewer: `resizable`, `movable` true, `devTools` false.
   - `main window renders without page errors` — find the page with a plain loop (do not use `Array.find` with an async callback): `let page; for (const p of app.windows()) if ((await p.title()) === 'Manta') page = p;`. Assert `await page.locator('#root > *').count()` is greater than 0 (React rendered something). For errors: in `beforeAll`, right after `electron.launch`, declare `const errors = []` at module level, attach `p.on('pageerror', e => errors.push(e.message))` to every page in `app.windows()` and to new ones with `app.on('window', p => p.on('pageerror', …))`. Errors thrown before the listener attaches are missed — that is acceptable for a smoke test. Assert `errors` is empty.
   - Do NOT port the "centred on primary display" pixel check as an exact equality: `getPrimaryDisplay().bounds` vs `workArea` differs per OS (menu bar, taskbar). If you add it, allow ±50 px.

   If the live code titles differ from `Tour` / `Manta` / `Previewer` (check the `<title>` tags), use the live titles and mention it in your report.

**Verify**: `npm run test:e2e` → 5 passed (on macOS locally). `npm test` → still passes and does not run `e2e/` (`npx vitest list 2>/dev/null | grep -c e2e` → `0`). `ls test 2>/dev/null` → no such directory. `npm ls spectron mocha chai` → empty.

### Step 6: Replace Travis with GitHub Actions CI

1. `git rm .travis.yml`. The git-lfs step it ran is not needed: `git lfs ls-files` → check; if it lists files, STOP (see STOP conditions); if empty, nothing else to do.
2. Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

permissions:
  contents: read

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    env:
      CSC_IDENTITY_AUTO_DISCOVERY: 'false'
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run lint            # remove this line if plan 010 is not DONE
      - run: npm run format:check    # remove this line if plan 010 is not DONE
      - run: npm test
      - run: npm run build
      - name: e2e (Linux needs a virtual display)
        if: runner.os == 'Linux'
        run: xvfb-run --auto-servernum npx playwright test
      - name: e2e
        if: runner.os != 'Linux'
        run: npx playwright test
      - name: Package (unsigned smoke build)
        run: npx electron-builder --publish never
      - uses: actions/upload-artifact@v7
        with:
          name: dist-${{ matrix.os }}
          path: |
            dist/*.dmg
            dist/*.zip
            dist/*.exe
            dist/*.AppImage
            dist/*.deb
          if-no-files-found: error
          retention-days: 7
```

   `npx electron-builder` without a platform flag builds for the runner's OS using the targets from `electron-builder.yml`. `ubuntu-latest` already has `xvfb-run`.

**Verify**: `npx --yes actionlint .github/workflows/ci.yml` → no output, exit 0. If actionlint cannot run, use `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); if(/\t/.test(y)) throw 'tabs'; console.log('ok')"` → `ok` and re-read the file to confirm indentation matches the block above.

### Step 7: Tag-driven release workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Publish macOS (signed + notarized)
        if: runner.os == 'macOS'
        run: npx electron-builder --mac --publish always -c.mac.notarize=true
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
          APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
      - name: Publish Windows
        if: runner.os == 'Windows'
        run: npx electron-builder --win --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
      - name: Publish Linux
        if: runner.os == 'Linux'
        run: npx electron-builder --linux --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Secret meanings (for the operator; values never go in the repo): `MAC_CSC_LINK` — base64 of the "Developer ID Application" `.p12`; `MAC_CSC_KEY_PASSWORD` — its password; `APPLE_API_KEY` — App Store Connect API `.p8` key, base64 on one line (`base64 < AuthKey_XXXX.p8 | tr -d '\n'`); `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` — from App Store Connect; `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` — Windows code-signing cert (optional; without it Windows SmartScreen warns users).

electron-builder publishes to a **draft** GitHub release for the `package.json` version; the operator publishes the draft by hand.

**Verify**: `npx --yes actionlint .github/workflows/release.yml` → exit 0 (or the fallback check from Step 6). `grep -nE "(BEGIN|PRIVATE KEY|password:|-----)" .github/workflows/*.yml` → no output (no secret material in files).

### Step 8: Update README platform support and dev commands

Edit only these parts of `README.md`:

1. **Downloads** table (lines ~80–86): replace the three `hql287/Manta/releases/download/v1.1.4/...` links and the "More Download Options" link with a single line pointing at `https://github.com/PUBLISH_OWNER/PUBLISH_REPO/releases/latest`. Do not invent file names.
2. **Supported Platforms** (lines 88–103): replace with:

```markdown
#### Supported Platforms

- **macOS** 13 (Ventura) or later — one universal download for Apple Silicon and Intel Macs (no Rosetta needed).
- **Windows** 10 or 11, 64-bit (x64 or Arm64). 32-bit Windows is no longer supported.
- **Linux** 64-bit (x64 or arm64) distributions supported by current Chromium — see [Chrome system requirements](https://support.google.com/chrome/a/answer/7100626). Packages: `.deb` and `AppImage`.

These limits come from Electron 45 (see the [Electron 45 release notes](https://www.electronjs.org/blog/electron-45-0) and [breaking changes](https://www.electronjs.org/docs/latest/breaking-changes)).
```

   Keep the existing paragraph about `--disable-hardware-acceleration` below it unchanged.
3. **Development** (lines ~152–163): replace the `yarn` bullets with: `npm ci` to install, `npm run dev` to start the app with hot reload, `npm test` for unit tests, `npm run test:e2e` for end-to-end tests, `npx electron-builder --publish never` to build installers into `dist/`. Mention Node version: "Use the Node version in `.nvmrc`."
4. The `icns2png` / `graphicsmagick` Linux note: remove it **only if** the Linux CI job (Step 6) packages successfully without those packages; until CI has run, keep it and say in your report that it is pending CI confirmation.

**Verify**: `grep -n "10.9\|Windows 7\|Ubuntu 12.04\|yarn" README.md` → no output; `grep -n "hql287/Manta/releases" README.md` → no output.

## Test plan

- New: `e2e/app.e2e.mjs` — 5 Playwright tests ported from `test/spec.js` (window creation, titles, tour-window properties on a fresh profile, main/preview properties, main renders without page errors). Pattern: the `_electron.launch` / `electronApp.evaluate` examples at https://playwright.dev/docs/api/class-electron.
- Each test run uses a new temp `MANTA_USER_DATA` folder and deletes it after; the real user-data folder is never opened.
- Existing: `npm test` (Vitest) must still pass and must not pick up `e2e/`.
- Packaging is verified by the commands in Step 3 locally and by the `Package` step in CI on all three OSes.

## Done criteria

ALL must hold:

- [ ] `grep -n "ia32\|hql287" electron-builder.yml dev-app-update.yml` → no output
- [ ] `grep -n "appId: com.electron.manta\|productName: Manta" electron-builder.yml | wc -l` → `2`
- [ ] On macOS: `lipo -archs dist/mac-universal/Manta.app/Contents/MacOS/Manta` → `x86_64 arm64`, and `LSMinimumSystemVersion` → `13.0`
- [ ] `npm test` exits 0; `npm run test:e2e` → 5 passed
- [ ] `npm ls spectron mocha chai` → none installed; `test ! -d test && test ! -f .travis.yml && echo ok` → `ok`
- [ ] `.github/workflows/ci.yml` and `.github/workflows/release.yml` exist and pass actionlint (or the fallback check)
- [ ] `grep -rn "secrets\." .github/workflows/*.yml` shows only `${{ secrets.NAME }}` references; no secret values anywhere in the repo
- [ ] `node -p "require('./package.json').version"` → `1.1.4` (unchanged)
- [ ] README has no `10.9`, `Windows 7`, `Ubuntu 12.04`, `yarn` or `hql287/Manta/releases`
- [ ] `git status` clean; only Scope files changed since the plan started
- [ ] Report states: signed or unsigned build, whether notarization was exercised (it is not, locally), the `static/**` decision from Step 3.2, and the icns2png note status
- [ ] `plans/README.md` status row for 011 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The operator did not provide PUBLISH_OWNER / PUBLISH_REPO.
- Any precondition from plans 001–009 fails (especially `MANTA_USER_DATA` not implemented — without it the e2e tests would run against a real profile).
- The universal merge fails (`electron-builder` error mentioning `lipo`, "both x64 and arm64", or a `.node` file). That means a native module exists; report the file name — do not switch to separate per-arch mac builds without approval.
- The schema check in Step 3.1 shows a key in a different place than this plan expects.
- The packaged app fails to start, or starts and shows an empty window, while `npm start` (dev preview) works — report the console output; it usually means `files` misses a runtime folder.
- `git lfs ls-files` lists files (the Travis config pulled LFS objects; CI would then need `lfs: true` on checkout — ask first).
- Signing: no signing credentials are available. This is **not** a reason to stop the plan — finish with unsigned builds and say so — but never commit, print, or invent certificate or key values, and never add `identity: null` or `notarize: false` to the committed config to make the release workflow pass.
- e2e tests fail because a window is not created or a title differs, and the cause is in application code (out of scope) — report instead of changing app code.

## Maintenance notes

- `minimumSystemVersion: '13.0'` must move up when a future Electron raises its macOS floor (check each Electron major's breaking-changes page: https://www.electronjs.org/docs/latest/breaking-changes).
- electron-builder v27 moves mac signing keys (`hardenedRuntime`, `entitlements`, `identity`) under `mac.sign`; when upgrading to v27, re-run the schema check from Step 3.1.
- Windows `nsis` with both `x64` and `arm64` produces one installer that contains both architectures (larger download). If size becomes a problem, split into per-arch targets.
- Without a Windows code-signing certificate, users see SmartScreen warnings; auto-update still works. Azure Trusted Signing is a cheaper alternative to a `.pfx` cert — a follow-up, not part of this plan.
- Reviewers: check that `appId`/`productName` are unchanged, that no secret values exist in workflows, that `release.yml` runs only on `v*` tags, and that e2e uses a temp `MANTA_USER_DATA`.
- Deferred: auto-update end-to-end test (needs a published release), Microsoft Store / Mac App Store targets, Linux `rpm`/Flatpak.
