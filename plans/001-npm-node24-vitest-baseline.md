# Plan 001: Install with npm on Node 24 and run the unit tests on Vitest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- package.json yarn.lock jest.config.js jest.setup.js jest.shim.js __mocks__ app preview modal tour i18n libs helpers static/sounds`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (first plan of the Electron 45 migration series)
- **Category**: tests
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

Manta (an Electron + React invoicing app last updated in 2018) cannot be installed or tested on a current machine: Yarn is not installed, the pinned `electron@^1.8.3` has no Apple Silicon (darwin-arm64) binary so its postinstall download fails, and Jest 22 / Babel 6 predate Node 24. Plans 002–011 replace almost every dependency and must prove they did not break behaviour. This plan gives them a working safety net first: npm + Node 24 + Vitest running the existing 48 spec files, with the application code changed only mechanically (CommonJS `require` → ES `import`) so that test results describe today's behaviour.

## Current state

Toolchain facts (verified at `c530133`):

- `package.json` — scripts `"test": "jest"`, `"test:e2e": "mocha"`, `"test:watch": "jest --watch"`; devDependencies include `jest ^22.4.2`, `babel-jest ^22.4.1`, `jest-styled-components ^5.0.0`, `enzyme ^3.3.0`, `enzyme-adapter-react-16 ^1.1.1`, `react-test-renderer ^16.2.0`, `mocha ^5.0.5`, `chai ^4.1.2`, `pre-commit ^1.2.2`; dependencies include `spectron ^3.8.0` and `electron` (dev) `^1.8.3`. There is a top-level `"pre-commit": ["lint-staged"]` key.
- `yarn.lock` exists; there is no `package-lock.json`. Yarn is not installed on the target machine; Node is v24.22.1, npm 11.19.1.
- `jest.config.js`:
  ```js
  module.exports = {
    bail: true,
    collectCoverage: true,
    setupFiles: ['./jest.shim.js', './jest.setup.js'],
    testPathIgnorePatterns: [ '<rootDir>/test/' ]
  };
  ```
- `jest.setup.js` configures Enzyme with `enzyme-adapter-react-16`; `jest.shim.js` defines `global.requestAnimationFrame = callback => { setTimeout(callback, 0); };`.
- `test/helper.js`, `test/spec.js` — Spectron end-to-end tests against `dist/mac/Manta.app` (Electron 1.8 build). They cannot run on this machine. Plan 011 replaces them with Playwright.

Test files (48): `**/__tests__/*.spec.js(x)`, `app/components/shared/_tests_/*.spec.js`, `preview/{actions,reducers}/__test__/index.spec.js`. 17 snapshot files live in `__snapshots__/` folders.

These 7 `.js` spec files contain JSX (Vite only parses JSX in `.jsx` files by default):
`app/containers/__tests__/Invoices.spec.js`, `app/components/shared/_tests_/Message.spec.js`, `app/components/layout/__tests__/AppNav.spec.js`, `app/components/shared/_tests_/Layout.spec.js`, `app/components/shared/_tests_/Section.spec.js`, `app/components/shared/_tests_/Button.spec.js`, `app/components/shared/_tests_/SplitButton.spec.js`.

How mocking works today (Jest-specific behaviour that Vitest does NOT copy):

- Root `__mocks__/` (`electron.js`, `electron-settings.js`, `pouchdb-browser.js`, `uuid/v4.js`) is applied **automatically** by Jest to node_modules. Vitest does not do this. Example, `__mocks__/electron.js`:
  ```js
  module.exports = {
    app: jest.fn(),
    ipcRenderer: { send: jest.fn(), on: jest.fn() },
    remote: {
      require: jest.fn(name => {
        if (name === 'electron-settings') {
          return { set: jest.fn(), get: jest.fn(() => 'someSettings') };
        }
      }),
    },
  };
  ```
- Adjacent mocks: `libs/__mocks__/sounds.js`, `app/renderers/__mocks__/dialog.js` (`module.exports = jest.fn();`), `app/helpers/__mocks__/{form,invoice,pouchDB}.js`. Tests call `jest.mock('../../helpers/pouchDB')` etc. (10 `jest.mock` calls, 94 `jest.fn`, 21 `jest.spyOn`, 1 `jest.genMockFunction`).
- `vi.mock` in Vitest only intercepts ES `import`, **not** `require()`. Application code mixes both, e.g.:
  - `app/middlewares/SettingsMW.jsx:2-4`
    ```js
    const appConfig = require('electron').remote.require('electron-settings');
    import sounds from '../../libs/sounds';
    const ipc = require('electron').ipcRenderer;
    ```
  - `app/helpers/form.js:1-2`
    ```js
    const openDialog = require('../renderers/dialog');
    const appConfig = require('electron').remote.require('electron-settings');
    ```
  - `app/helpers/pouchDB.js:2` `const PouchDB = require('pouchdb-browser');`
- Two Jest factory mocks return a component directly (Vitest needs `{ default: ... }`), `app/containers/__tests__/Invoices.spec.js:37-43`:
  ```js
  jest.mock('../../components/invoices/Invoice', () => () => (
    <div className="invoice" />
  ));
  ```
- `app/components/shared/_tests_/Message.spec.js:5` imports `'jest-styled-components'` and uses `toHaveStyleRule`. No other spec imports it.
- CommonJS modules that tests load indirectly: `app/renderers/dialog.js` (`module.exports = showModalWindow;`, uses `require('electron').remote`, `path`, `url`), `libs/sounds.js` (`module.exports = { preload, play }`, requires `static/sounds/*/index.js` which use `__dirname`), `helpers/notify.js` (`module.exports = { Notify };`, imported with `import { Notify }` by `app/components/layout/AppUpdate.jsx:6` and `preview/Viewer.jsx:5`).

Complete list of application `require(...)` lines to convert in this plan (all are renderer code; `app/renderers/*.js`, `libs/sounds.js`, `helpers/center-on-primary-display.js`, `main/`, `app.js`, and `*/index.jsx` entry files are deliberately excluded — plan 002 handles them):

| File:line | Current |
|---|---|
| `app/App.jsx:5` | `const ipc = require('electron').ipcRenderer;` |
| `app/middlewares/SettingsMW.jsx:2,4` | `remote.require('electron-settings')`, `ipcRenderer` |
| `app/middlewares/InvoicesMW.jsx:4,5` | same pattern |
| `app/middlewares/FormMW.jsx:2` | `remote.require('electron-settings')` |
| `app/components/settings/Invoice.jsx:4,7` | `ipcRenderer`; `require('../../renderers/dialog.js')` |
| `app/components/form/Currency.jsx:4` | `remote.require('electron-settings')` |
| `app/components/invoices/Invoice.jsx:7` | `ipcRenderer` |
| `app/components/layout/AppUpdate.jsx:7` | `ipcRenderer` (no semicolon) |
| `app/components/shared/ErrorBoundary.jsx:3` | `require('../../renderers/dialog')` |
| `app/containers/Invoices.jsx:6,7` | dialog; `ipcRenderer` |
| `app/containers/Contacts.jsx:6,7` | dialog; `ipcRenderer` |
| `app/helpers/pouchDB.js:2` | `require('pouchdb-browser')` |
| `app/helpers/image.js:1-4` | `jimp`, `fs`, `is-svg`, dialog |
| `app/helpers/form.js:1,2` | dialog; `remote.require('electron-settings')` |
| `app/reducers/FormReducer.jsx:7` | `remote.require('electron-settings')` |
| `preview/Viewer.jsx:8` | `ipcRenderer` |
| `preview/containers/SideBar.jsx:4` | `ipcRenderer` |
| `preview/reducers/index.jsx:5` | `remote.require('electron-settings')` |
| `modal/Dialog.jsx:4-6` | `remote.require('electron-settings')`, `remote.BrowserWindow`, `ipcRenderer` |
| `i18n/i18n.js:4,6,7` | `remote.require('electron-settings')`, `electron-is-dev`, `moment` |

Repo conventions: 2-space indent, single quotes, semicolons, trailing commas `es5` (Prettier block in `package.json`). Named-import style already used elsewhere: `tour/Tour.jsx:4` `import { ipcRenderer as ipc } from 'electron';` — match it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (this plan only) | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install` | exit 0 |
| Clean install | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` | exit 0 |
| Tests | `npm test` | all files pass (exit 0) |
| One file | `npx vitest run app/helpers/__tests__/form.spec.js` | pass |
| Update snapshots (Step 7 only) | `npx vitest run -u` | exit 0 |

`ELECTRON_SKIP_BINARY_DOWNLOAD=1` is needed until plan 002 replaces Electron 1.8 (no darwin-arm64 binary exists for it). Do not run `npm run build`, `npm start`, `npm run dev` or `npm run lint` in this plan: the old webpack 4 / ESLint 4 toolchain is replaced by plans 002 and 010.

## Suggested executor toolkit

- Vitest mocking docs: https://vitest.dev/guide/mocking and https://vitest.dev/api/vi#vi-mock (factory must return an object with `default`; `__mocks__` folder next to the mocked file is used when no factory is given; `vi.mock` does not affect `require()`).
- Vitest migration from Jest: https://vitest.dev/guide/migration#jest

## Scope

**In scope** (the only files you should modify/create/delete):
- `package.json`, `package-lock.json` (create), `yarn.lock` (delete), `.nvmrc` (create), `.npmrc` (create)
- `vitest.config.mjs` (create), `vitest.setup.js` (create), `jest.config.js`, `jest.setup.js`, `jest.shim.js` (delete)
- Every spec file and every `__snapshots__/*.snap` file
- Every file under `__mocks__/`, `libs/__mocks__/`, `app/renderers/__mocks__/`, `app/helpers/__mocks__/`
- The application files listed in the table above, plus `helpers/notify.js` — **only** import/require/export lines

**Out of scope** (do NOT touch):
- `app.js`, `main/**`, `app/renderers/*.js`, `libs/sounds.js`, `libs/dragNdrop.js`, `helpers/center-on-primary-display.js`, `static/**`, all `*/index.jsx` and `*/index.html` entry files — plan 002 rewrites them for the new build tool.
- `webpack.config.js`, `webpack.parts.js`, `.babelrc`, `.eslintrc.yml`, `.travis.yml`, `electron-builder.yml`, `test/` — plans 002, 010, 011.
- Any behaviour change in application code. If a test fails because the app is wrong, do not fix the app (see Step 8).

## Git workflow

- Branch: `upgrade/electron-45` (create it from `master` if it does not exist; all migration plans commit to it).
- One commit per step group, short imperative subject like the repo log (`Update Images (#401)`, `Create FUNDING.yml`). Examples: `Switch from Yarn to npm`, `Migrate tests from Jest to Vitest`. No AI attribution lines.
- Do NOT push.

## Data safety

This plan never starts the app. Still, never run any later build against the real profile at `~/Library/Application Support/Manta` (Windows `%APPDATA%\Manta`, Linux `~/.config/Manta`); it holds the user's invoices.

## Steps

### Step 1: Create the branch and pin Node

`git switch -c upgrade/electron-45` (or `git switch upgrade/electron-45` if it exists). Create `.nvmrc` containing the single line `24`. In `package.json` add `"engines": { "node": ">=24" }` after `"main"`.

**Verify**: `cat .nvmrc` → `24`; `node -e "console.log(require('./package.json').engines.node)"` → `>=24`.

### Step 2: Remove packages that cannot install or run here

Edit `package.json` by hand (do not install yet):
- Remove `spectron` (dependencies), `mocha`, `chai`, `pre-commit` (devDependencies), the `"test:e2e"` script, and the top-level `"pre-commit": [...]` key. Reason: Spectron is archived and downloads a chromedriver for Electron 1.8 that does not exist for arm64; `pre-commit` would install a git hook that runs ESLint 4. Plans 010 (husky) and 011 (Playwright) replace them. Leave the `test/` folder in place for plan 011.
- Remove `jest`, `babel-jest`.
- Add devDependencies: `"vitest": "^5.0.5"`, `"jsdom": "<latest>"` (look up with `npm view jsdom version`), `"vite": "^8.3.5"`.
- Change scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

Create `.npmrc` with one line: `legacy-peer-deps=true` (the 2018 packages declare peer ranges such as React 15 that npm 7+ rejects; plan 006 removes this line once peers are clean).

**Verify**: `node -e "const p=require('./package.json');console.log(['spectron','mocha','chai','pre-commit','jest','babel-jest'].filter(n=>(p.dependencies||{})[n]||(p.devDependencies||{})[n]).length, p.scripts.test)"` → `0 vitest run`

### Step 3: Switch from Yarn to npm

`git rm yarn.lock`, then `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`.

**Verify**: `test -f package-lock.json && echo ok` → `ok`; `npm ls react enzyme-adapter-react-16 vitest --depth=0` shows `react@16.x`, `enzyme-adapter-react-16@1.x`, `vitest@5.x` and exits 0.

Commit: `Switch from Yarn to npm`.

### Step 4: Add the Vitest config and setup file

Create `vitest.config.mjs`:

```js
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = p => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Jest used the root __mocks__ folder for these node_modules
    // automatically. Vitest does not, so alias them.
    alias: [
      { find: /^electron$/, replacement: root('./__mocks__/electron.js') },
      { find: /^electron-settings$/, replacement: root('./__mocks__/electron-settings.js') },
      { find: /^pouchdb-browser$/, replacement: root('./__mocks__/pouchdb-browser.js') },
      { find: /^uuid\/v4$/, replacement: root('./__mocks__/uuid/v4.js') },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: ['**/*.spec.{js,jsx}'],
    exclude: ['node_modules/**', 'test/**', 'dist/**', 'prod/**', 'out/**'],
  },
});
```

Create `vitest.setup.js` (content of `jest.shim.js` + `jest.setup.js` + two global mocks):

```js
import { vi } from 'vitest';
import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

// Was jest.shim.js
global.requestAnimationFrame = callback => {
  setTimeout(callback, 0);
};

// Was jest.setup.js
Enzyme.configure({ adapter: new Adapter() });

// These two CommonJS modules touch Electron/Node at import time.
// Replace them with their __mocks__ versions in every test file.
vi.mock('./app/renderers/dialog.js');
vi.mock('./libs/sounds.js');
```

Delete `jest.config.js`, `jest.setup.js`, `jest.shim.js` with `git rm`. Coverage collection (`collectCoverage: true`) is intentionally dropped; it can be re-added later with `@vitest/coverage-v8`.

**Verify**: `ls jest.* 2>/dev/null | wc -l` → `0`; `test -f vitest.config.mjs && test -f vitest.setup.js && echo ok` → `ok`.

### Step 5: Convert test files and mocks from Jest API to Vitest API

1. Rename the 7 `.js` specs that contain JSX to `.jsx` with `git mv` (list in "Current state"). Then run `grep -lE "<[A-Za-z][A-Za-z0-9.]*[ />]" $(git ls-files '*.spec.js')` — if it prints more files that contain JSX, rename those too.
2. Delete all 17 snapshot files: `git rm -r $(git ls-files '*.snap')`. They are regenerated in Step 7 (the old ones contain class names produced by the removed `babel-plugin-styled-components`, so they can never match again).
3. Replace the Jest global with `vi` in every spec and mock file:
   `perl -pi -e 's/\bjest\.genMockFunction\(/vi.fn(/g; s/\bjest\./vi./g' $(git ls-files '*.spec.js' '*.spec.jsx' '__mocks__/*' '*/__mocks__/*' '*/*/__mocks__/*')`
   Then add `import { vi } from 'vitest';` as the first line of every changed file under a `__mocks__` folder (spec files get `vi` from `globals: true`).
4. Convert every `__mocks__` file from CommonJS to ES module syntax, keeping the same mock values:
   - `module.exports = vi.fn(...)` → `export default vi.fn(...)` (`__mocks__/electron-settings.js`, `__mocks__/pouchdb-browser.js`, `__mocks__/uuid/v4.js`, `app/renderers/__mocks__/dialog.js`).
   - `module.exports = { a, b }` → `export { a, b };` for `app/helpers/__mocks__/pouchDB.js`; `export const name = ...` for each key in `app/helpers/__mocks__/form.js` and `app/helpers/__mocks__/invoice.js`.
   - `libs/__mocks__/sounds.js` → `export default { preload: vi.fn(), play: vi.fn() };` (callers use `import sounds from`).
   - `__mocks__/electron.js` → named exports **and** a default export of the same objects:
     ```js
     import { vi } from 'vitest';
     export const app = vi.fn();
     export const ipcRenderer = { send: vi.fn(), on: vi.fn() };
     export const remote = { require: vi.fn(name => { /* unchanged body */ }) };
     export default { app, ipcRenderer, remote };
     ```
5. `jest.mock`→`vi.mock` calls with factories that return a component must return a module object. In `app/containers/__tests__/Invoices.spec.jsx`:
   ```js
   vi.mock('../../components/invoices/Invoice', () => ({
     default: () => <div className="invoice" />,
   }));
   vi.mock('../../components/shared/Message', () => ({
     default: () => <div className="message" />,
   }));
   ```
6. In spec files, replace `require(...)` of mocked modules with imports: `app/middlewares/__tests__/SettingsMW.spec.js:7` → `import { ipcRenderer as ipc } from 'electron';`; `app/components/form/__tests__/Currency.spec.jsx:6` → `import { remote } from 'electron';` + `const appConfig = remote.require('electron-settings');`; `app/helpers/__tests__/form.spec.js:23` → `import openDialog from '../../renderers/dialog';`. Then `grep -rn "require(" $(git ls-files '*.spec.js' '*.spec.jsx')` and convert any remaining `require` of a module that the test also mocks.

**Verify**: `grep -rln "jest\." $(git ls-files '*.spec.js' '*.spec.jsx') __mocks__ libs/__mocks__ app/renderers/__mocks__ app/helpers/__mocks__ | grep -v jest-styled` → no output; `grep -rn "module.exports" __mocks__ libs/__mocks__ app/renderers/__mocks__ app/helpers/__mocks__` → no output.

### Step 6: Convert application `require` lines to `import` (mechanical only)

For each line in the "Current state" table, replace the `require` with an `import` at the top of the file. Patterns:

```js
// const ipc = require('electron').ipcRenderer;
import { ipcRenderer as ipc } from 'electron';

// const appConfig = require('electron').remote.require('electron-settings');
import { remote } from 'electron';
const appConfig = remote.require('electron-settings');

// const BrowserWindow = require('electron').remote.BrowserWindow;   (modal/Dialog.jsx)
const BrowserWindow = remote.BrowserWindow;

// const openDialog = require('../renderers/dialog.js');
import openDialog from '../renderers/dialog.js';

// const PouchDB = require('pouchdb-browser');
import PouchDB from 'pouchdb-browser';

// app/helpers/image.js
import Jimp from 'jimp';
import fs from 'fs';
import isSvg from 'is-svg';
import openDialog from '../renderers/dialog';

// i18n/i18n.js
import isDev from 'electron-is-dev';
import moment from 'moment';
```

If a file already has `import ... from 'electron'`, merge into one import statement. Keep the variable names (`ipc`, `appConfig`, `openDialog`) unchanged so no other line changes.

In `helpers/notify.js` replace `module.exports = { Notify };` with `export { Notify };`.

Webpack 4 + Babel 6 (still the build until plan 002) compile both forms identically, so runtime behaviour is unchanged.

**Verify** (mechanical-only diff): 
`git diff -U0 HEAD -- app preview modal tour i18n libs helpers ':!*__tests__*' ':!*_tests_*' ':!*__test__*' ':!*__mocks__*' | grep -E '^[-+][^-+]' | grep -vE "require\(|^\+import |^-import |export |module\.exports|^\+const appConfig = remote\.require|^\+const BrowserWindow = remote\.BrowserWindow|^[-+]\s*$"` → no output.
`grep -rnE "require\('(electron|pouchdb-browser|jimp|fs|is-svg|electron-is-dev|moment)'\)|require\('\.\./(\.\./)?renderers/dialog" app preview modal i18n --include='*.js' --include='*.jsx' | grep -vE "__tests__|_tests_|__test__|__mocks__|app/renderers/"` → no output.

Commit: `Use ES imports in renderer modules`.

### Step 7: Run the suite and create the new snapshots once

Run `npx vitest run -u`. This writes fresh snapshot files from the unchanged application code (the baseline every later plan compares against).

If `Message.spec.jsx` fails inside `jest-styled-components` (version 5 is written for Jest), change its `it(...)` to `it.skip(...)` with the comment `// jest-styled-components 5 does not run on Vitest; re-enabled in plan 005 (styled-components 6 + jest-styled-components 7)` and remove the `jest-styled-components` import from that file and from `package.json`.

If JSX fails with `React is not defined` or a missing `react/jsx-runtime`, run `npm ls react` and confirm it resolved to 16.14.x (which ships the JSX runtime); if it is lower, STOP.

**Verify**: `git status --porcelain | grep '\.snap$' | wc -l` → about 17 new files; `npm test` → exit 0.

### Step 8: Handle tests that still fail

For each remaining failure, decide with the error text:
- Error mentions `jest`, `require`, a mock not applied, `module is not defined`, or an alias → it is migration mechanics: fix it in the test/mock/config files only.
- The assertion fails on application behaviour (wrong value, missing element) and the test, mocks and imports are correct → it is a pre-existing failure. Change it to `it.skip` with `// pre-existing failure at c530133, see plans/001` and list it in your report.

**Verify**: `npm test` → exit 0. `grep -rn "pre-existing failure" --include='*.spec.js*' . | grep -v node_modules | wc -l` → number you report (≤ 5).

Commit: `Migrate tests from Jest to Vitest`.

### Step 9: Prove the install is reproducible

`rm -rf node_modules && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci && npm test`

**Verify**: both commands exit 0.

## Test plan

No new tests. The deliverable is the existing suite running green on Vitest. Record in your report: number of test files, number of tests, number skipped (with names).

## Done criteria

- [ ] `test -f yarn.lock` fails; `package-lock.json`, `.nvmrc` (`24`), `.npmrc` exist
- [ ] `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` exits 0 on Node 24
- [ ] `npm test` exits 0
- [ ] `grep -rn "jest" package.json` prints only `jest-styled-components` or nothing
- [ ] `ls jest.config.js jest.setup.js jest.shim.js 2>/dev/null` prints nothing
- [ ] Step 6 mechanical-diff command prints nothing
- [ ] ≤ 5 tests marked `pre-existing failure`
- [ ] `git status` shows no changes outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

- `npm install` fails for a reason other than peer ranges (for example a native build or a binary download that `ELECTRON_SKIP_BINARY_DOWNLOAD` does not cover). Report the package and error.
- A test can only pass if you change application behaviour (not just an import line).
- More than 5 tests fail for application reasons (the baseline is too weak; report the list).
- `vi.mock` in `vitest.setup.js` does not apply to test files (tests still load the real `app/renderers/dialog.js` or `libs/sounds.js`; you will see errors about `remote` or `__dirname`). Report; do not convert those two files here.
- `npm ls react` resolves below 16.14.

## Maintenance notes

- Plan 002 changes the renderer to load Electron through `window.require`; the Vitest aliases in `vitest.config.mjs` and the root `__mocks__` stay the test seam. Keep test-only mocks out of `electron.vite.config.mjs`.
- `.npmrc` `legacy-peer-deps=true` hides peer conflicts. Plan 006 deletes it after the last React-16-only library is gone (check with `npm install --legacy-peer-deps=false`).
- Snapshot tests are regenerated here only. Later plans must treat snapshot diffs as review items, not run `-u` blindly. Plan 004 replaces Enzyme and `react-test-renderer`.
- Reviewer focus: Step 6 diff must be import/export lines only; skipped tests must each have a reason.
