# Plan 027: Settings writes stay on the main window, and renderers cannot move the trust anchor

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- main/settings-ipc.js main/main-window-sender.js preload/index.js app.js preview/reducers/index.jsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

PDF, email, and e-invoice IPC accept a sender only when `isMainWindowMainFrame` is true. That helper treats the stored `mainWindowID` as the trusted window. `settings:set` has no sender check, and the hidden preview window loads the same preload as the main window. A compromised preview renderer can set `mainWindowID` to itself and then pass every later check. Preview PDF still needs to read `invoice`, `profile`, and `general`. This plan blocks untrusted writes and blocks renderer writes of the two window ids, and it leaves those three reads working.

## Current state

`main/settings-ipc.js` (CommonJS, loaded by `require('./main/settings-ipc')` in `app.js:38`):

```js
ipcMain.on('settings:get', (event, key) => {
  event.returnValue = store.get(key);
});
ipcMain.on('settings:has', (event, key) => {
  event.returnValue = store.has(key);
});
ipcMain.on('settings:set', (event, key, value) => {
  store.set(key, value);
  event.returnValue = true;
});
```

`main/main-window-sender.js` (ESM) returns true only when `event.senderFrame === event.sender.mainFrame` and `win.id === appConfig.get('mainWindowID')`.

`preload/index.js:78-81` exposes `settings.get` / `has` / `set` through `sendSync` to every renderer. `helpers/windows.js` gives the main window and the preview window the same preload (`SECURE_WEB_PREFERENCES`).

`preview/reducers/index.jsx:7-9` reads settings at load:

```js
const invoiceSettings = appConfig.get('invoice');
const profileSettings = appConfig.get('profile');
const generalSettings = appConfig.get('general');
```

The same file reads `profile`, `invoice`, and `general` again inside `INVOICE_UPDATE` and `PREVIEW_COORDINATED_UPDATE`. Do not remove those reads.

IPC tests use Vitest mocks. Copy the shape of `main/__tests__/save-pdf.spec.js`: mock `electron` and `../settings` before importing the module, capture the handler from `ipcMain.on`, and pass a fake event.

Repo rules for this work:

- Package manager is npm. Node is 24 (`.nvmrc`). Test command is `npm test` (`vitest run`). Lint is `npx eslint <files>`.
- Stay on the current branch. Do not create a branch or a worktree. Do not commit unless the operator asks. Commit subjects are short and imperative, with no Co-authored-by trailer and no AI attribution.
- Do not point a run at `~/Library/Application Support/Manta`. Unpackaged runs use `Manta-dev`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused test | `npm test -- main/__tests__/settings-ipc.spec.js` | exit 0 |
| Lint | `npx eslint main/settings-ipc.js main/__tests__/settings-ipc.spec.js` | exit 0 |

## Scope

**In scope**:

- `main/settings-ipc.js`
- `main/__tests__/settings-ipc.spec.js` (create)
- `app.js` only if the existing `require('./main/settings-ipc')` must stay and the file's module format forces a one-line load change. Prefer keeping that `require`.

**Out of scope**:

- `preload/index.js` channel list. These three channels are not in the `CHANNELS` set. They go through `contextBridge` directly. Do not add them to `CHANNELS`.
- `main/logo.js`, backup, quit, and theme handlers. Those are plans 028 and 029.
- Any change to which settings keys the preview reducer reads.
- Production CSP and `electron.vite.config.mjs`.

## Git workflow

- Stay on the current branch. Do not create a branch, switch branches, or add a git worktree.
- Do not commit unless the operator asks. Example subject if they ask: `Reject untrusted settings writes`.
- Do not push. Do not add a Co-authored-by trailer or any AI attribution.

## Steps

### Step 1: Add the handler test before changing behavior

Create `main/__tests__/settings-ipc.spec.js`. Mock `electron` (`ipcMain.on`, `BrowserWindow.fromWebContents`) and `../settings` (`get`, `set`, `has`) before the import. Import `../settings-ipc.js` from `beforeAll` so the handlers register.

Use two events:

- Main event: `sender.mainFrame` and `senderFrame` are the same object, and `fromWebContents` returns `{ id: 1, isDestroyed: () => false }`. Store `mainWindowID` is 1 and `previewWindowID` is 2.
- Preview event: same frame check, window id 2.
- Sub-frame event: `senderFrame` is a different object from `sender.mainFrame`, window id 1.

Assert these cases:

1. Main `settings:set` of `general.theme` calls `store.set` and sets `event.returnValue` to `true`.
2. Preview `settings:set` of `general.theme` does not call `store.set` and sets `event.returnValue` to `false`.
3. Main `settings:set` of `mainWindowID` does not call `store.set` and sets `event.returnValue` to `false`. Same for `previewWindowID`.
4. Sub-frame `settings:set` does not call `store.set`.
5. Preview `settings:get` of `profile` returns the store value.
6. Sub-frame `settings:get` sets `event.returnValue` to `undefined` and does not call `store.get`.
7. Preview `settings:has` of `invoice` returns the store result. Sub-frame `settings:has` sets `event.returnValue` to `false` and does not call `store.has`.

The new test fails until step 2. That failure is expected. Do not weaken the assertions.

**Verify**: `npm test -- main/__tests__/settings-ipc.spec.js` → fails on the new cases, and the failure text names `settings:set` or `returnValue`. If the file fails to import, STOP and report the error.

### Step 2: Enforce the checks

Rewrite `main/settings-ipc.js` so that:

- `settings:get` and `settings:has` run only for the main frame of the main window or the main frame of the preview window. Compare `BrowserWindow.fromWebContents(event.sender).id` with `store.get('mainWindowID')` and `store.get('previewWindowID')`. Require `event.senderFrame === event.sender.mainFrame`. On reject, set `returnValue` to `undefined` for get and `false` for has. Do not throw. `sendSync` surfaces throws in the renderer.
- `settings:set` runs only when `isMainWindowMainFrame(event)` is true, from `./main-window-sender.js`. Also reject keys `mainWindowID` and `previewWindowID` from every renderer, including the main window. On reject, set `returnValue` to `false` and do not call `store.set`.
- Allowed sets still call `store.set(key, value)` and set `returnValue` to `true`.

`main/save-pdf.js` is ESM and is loaded with `require` from `app.js`. Matching that pattern is allowed. If a CJS `require` of `main-window-sender.js` fails under Vitest, inline the same main-frame check in `settings-ipc.js` instead of importing it. Do not copy a weaker check.

Keep `app.js` loading this file at startup, before windows call `sendSync`.

**Verify**: `npm test -- main/__tests__/settings-ipc.spec.js` → exit 0.

### Step 3: Lint the touched files

**Verify**: `npx eslint main/settings-ipc.js main/__tests__/settings-ipc.spec.js` → exit 0.

## Test plan

- The new file covers the seven cases in step 1. Model the mocks on `main/__tests__/save-pdf.spec.js`.
- Do not add a component test or a snapshot.

## Done criteria

- [ ] `npm test -- main/__tests__/settings-ipc.spec.js` exits 0
- [ ] `npx eslint main/settings-ipc.js main/__tests__/settings-ipc.spec.js` exits 0
- [ ] Preview can still read `invoice`, `profile`, and `general` (case 5)
- [ ] A renderer cannot `settings:set` `mainWindowID` or `previewWindowID` (case 3)
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` status row for 027 is `DONE`

## STOP conditions

- The excerpts above do not match the live file.
- Preview code reads a settings key other than `invoice`, `profile`, or `general`, and this plan would block that read. Report the key. Do not allow every key from every window as a workaround.
- The main window sets `mainWindowID` from the renderer on purpose. Report the call site. Do not allow that write.
- A step's verification fails twice after a real fix attempt.
- The fix needs a preload or CSP change.

## Maintenance notes

Plans 028 and 029 add the same main-frame rule to other handlers. They must not weaken this store rule. A future preview feature that needs a new settings section must be added deliberately. Reviewers should check that `returnValue` is always set, because `sendSync` waits on it.
