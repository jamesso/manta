# Plan 029: Backup, dialogs, quit, update, and theme IPC use the main-frame check

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- main/backup.js main/select-export-directory.js main/select-logo-file.js main/updater.js main/theme.js app.js main/menu.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: DONE

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. The helper already exists. Do not wait for plan 027.
- **Category**: security
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

`save-pdf` and `email-invoice` ignore senders that are not the main frame of the main window. Backup IPC checks the window only, so a sub-frame of the main window still passes. Directory dialogs, the logo dialog, quit, quit-and-install, update checks, and `set-theme` check nothing. The preview window loads the same preload, so it can send those channels. This plan applies the existing helper. It does not add a new trust rule.

## Current state

`main/main-window-sender.js` exports `isMainWindowMainFrame(event)`.

`main/backup.js` uses a weaker check:

```js
function trustedSender(event) {
  const mainWindowID = appConfig.get('mainWindowID');
  const mainWindow = BrowserWindow.fromId(mainWindowID);
  if (!mainWindow) return null;
  return BrowserWindow.fromWebContents(event.sender) === mainWindow
    ? mainWindow
    : null;
}
```

That function gates `backup-export`, `backup-import`, `backup-snapshot`, and `csv-export`.

These handlers have no sender check:

- `main/select-export-directory.js` — `ipc.on('select-export-directory', ...)`
- `main/select-logo-file.js` — `ipc.on('open-file-dialog', ...)`
- `app.js:336-349` — `quit-app` and `quit-and-install`
- `main/updater.js:19-27` — `check-for-updates` and `update-download-started`
- `main/theme.js:20-24` — `set-theme` writes `general.theme` and `nativeTheme.themeSource`

`main/menu.js` calls update checks from the main process. Read it before editing `updater.js`. If the menu calls `ipcMain.emit` or `webContents.send` in a way that has no `senderFrame`, do not route that path through the renderer check. Call `checkForUpdate()` directly from the menu instead.

`main/save-pdf.js:16-18` is the pattern to copy:

```js
if (!isMainWindowMainFrame(event)) {
  return { ok: false, error: 'untrusted-sender' };
}
```

For `ipcMain.on` handlers, return without sending a follow-up event. Do not throw.

`main/backup.js` is CommonJS. `main-window-sender.js` is ESM. `app.js` already `require`s ESM files such as `main/save-pdf.js` under electron-vite. If a direct import fails in the backup unit test, duplicate the four-line frame check locally in `backup.js` rather than weakening it. The check must still require `event.senderFrame === event.sender.mainFrame` and `win.id === mainWindowID`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Backup IPC test | `npm test -- main/__tests__/backup-ipc.spec.js` | exit 0 |
| Theme test | `npm test -- main/__tests__/theme.spec.js` | exit 0 |
| Lint | `npx eslint main/backup.js main/select-export-directory.js main/select-logo-file.js main/updater.js main/theme.js app.js main/__tests__/backup-ipc.spec.js` | exit 0 |

## Scope

**In scope**:

- `main/backup.js`
- `main/select-export-directory.js`
- `main/select-logo-file.js`
- `main/updater.js`
- `main/theme.js`
- `app.js` (only the two quit handlers)
- `main/menu.js` only if a main-process menu path would fail the new sender check
- `main/__tests__/backup-ipc.spec.js` (create)
- `main/__tests__/theme.spec.js` if it already exists; extend it. If it does not, create the `set-theme` cases there.

**Out of scope**:

- `main/settings-ipc.js` and `main/logo.js` (plans 027 and 028)
- Backup merge logic in `app/helpers/backup.js`
- `reveal-file` path allowlists
- Changing dialog filters or update feed URLs

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Gate backup and quit IPC on the main frame`.
- Do not push. No AI attribution.

## Steps

### Step 1: Test backup sender checks

Create `main/__tests__/backup-ipc.spec.js`. Mock `electron` (`ipcMain.handle`, `dialog`, `BrowserWindow`, `app`) and `../settings`. Capture the four handlers. Do not show a real dialog.

Cases for `backup-export` and `backup-import`:

1. Main-frame event whose window id equals `mainWindowID` reaches `dialog.showSaveDialog` or `dialog.showOpenDialog`. You may mock the dialog to return `{ canceled: true }` so no file is written.
2. The same window with `senderFrame !== sender.mainFrame` throws `invalid request` or returns before `dialog` is called. Match the existing `throw new Error('invalid request')` in `backup.js`.
3. Preview window id does not call `dialog`.

One handler is enough for the sub-frame case if you loop the same event over all four channels. Each channel must reject the sub-frame.

**Verify**: `npm test -- main/__tests__/backup-ipc.spec.js` → fails until step 2.

### Step 2: Replace `trustedSender`

Implement `trustedSender` with the main-frame rule. Keep returning the `BrowserWindow` so the dialogs stay parented to the main window. A sub-frame or preview window returns `null`, and the handlers keep throwing `invalid request`.

**Verify**: `npm test -- main/__tests__/backup-ipc.spec.js` → exit 0.

### Step 3: Gate the other handlers

Apply `isMainWindowMainFrame` at the start of:

- `select-export-directory`
- `open-file-dialog`
- `quit-app`
- `quit-and-install`
- `check-for-updates`
- `update-download-started`
- `set-theme`

On failure, return. Do not call `dialog`, `app.quit`, `autoUpdater.downloadUpdate`, `autoUpdater.quitAndInstall`, or `store.set`.

Read `main/menu.js`. If a menu item invokes one of these channels without a real IPC event, call the existing main-process function instead. Do not spoof a trusted event.

Add or extend a theme test: an untrusted `set-theme` does not call `store.set`. A trusted `set-theme` of `dark` still stores `general.theme`. Unknown values still normalize through `normalizeTheme` (invalid becomes `system`).

**Verify**: `npm test -- main/__tests__/theme.spec.js main/__tests__/backup-ipc.spec.js` → exit 0.

### Step 4: Lint

**Verify**: the eslint command in the table exits 0.

## Test plan

- Backup: trusted, sub-frame, and preview, as in step 1.
- Theme: trusted write and untrusted ignore.
- Pattern: `main/__tests__/save-pdf.spec.js`.
- No Playwright test in this plan.

## Done criteria

- [x] Both test commands exit 0
- [x] `trustedSender` rejects a sub-frame
- [x] Quit, update, dialogs, and `set-theme` return immediately for an untrusted event
- [x] Menu-driven update checks still call the main-process function without a fake event
- [x] Commit contains only in-scope code/tests and this plan; `.ai/todo.md` stays untracked
- [x] Plan status is `DONE` here; `plans/README.md` is unchanged per operator instructions

## STOP conditions

- A listed handler no longer exists, or it already uses `isMainWindowMainFrame`. Report that and skip that handler. Do not add a second check that changes its error string.
- The menu cannot check for updates without a renderer event, and there is no main-process function to call. STOP and report. Do not invent a trusted event.
- `normalizeTheme` is not the function in `main/theme.js`. STOP.
- A verification fails twice after a real fix attempt.

## Maintenance notes

New `ipcMain` handlers in `main/` should call `isMainWindowMainFrame` unless the preview window is the intended sender (`preview-rendered` is the preview window). Reviewers should reject a new privileged handler that only compares window ids.


### Execution review (2026-11-16)

- Resumed on `plan-029-main-frame` with a clean tracked working tree. No prior
  implementation was present. `git merge main` fast-forwarded to `bbc0e94`
  (exit 0). Plan 032 and 040 changes were retained without modification.
- Drift check before and after the merge:
  `git diff --stat 10f3f0e..HEAD -- main/backup.js main/select-export-directory.js main/select-logo-file.js main/updater.js main/theme.js app.js main/menu.js`
  — exit 0, no in-scope drift. No STOP condition remains.
- Backup now applies the same frame/window check locally. A direct CommonJS
  import of the ESM helper failed in the unit test because its extensionless
  settings import could not resolve. Used the explicitly permitted local check;
  no trust rule or error string was weakened.
- All seven other privileged IPC handlers use `isMainWindowMainFrame` and
  return before side effects for an untrusted sender. Menu update actions call
  exported `checkForUpdate(false)` directly; menu quit actions call `app.quit()`.
  Startup update checks remain silent. No fake trusted events or path allowlist.
- Confirmed current Electron event shape against
  [IpcMainEvent documentation](https://www.electronjs.org/docs/latest/api/structures/ipc-main-event/).
- `npm test -- main/__tests__/backup-ipc.spec.js`:
  initial test harness exit 1 (jsdom URL could not be used with createRequire);
  set this main-process test to the Node environment. Baseline exit 1 with all
  four sub-frame cases failing as expected. Direct ESM-helper import attempt
  exit 1 as described above. Final local-check run exit 0, 8 tests passed.
- `npm test -- main/__tests__/theme.spec.js main/__tests__/backup-ipc.spec.js`
  — exit 0, 17 tests passed.
- `npm test -- main/__tests__/theme.spec.js` — exit 0, 9 tests passed.
- `npx eslint main/backup.js main/select-export-directory.js main/select-logo-file.js main/updater.js main/theme.js app.js main/__tests__/backup-ipc.spec.js`
  — exit 0 before and after formatting.
- `npx eslint main/menu.js main/__tests__/theme.spec.js` — exit 0.
- `npx prettier --write app.js main/backup.js main/menu.js main/select-export-directory.js main/select-logo-file.js main/updater.js main/theme.js main/__tests__/backup-ipc.spec.js main/__tests__/theme.spec.js`
  — exit 0. `git diff --check` — exit 0.
- No live app, real dialogs, production user data, or Playwright tests were used.
  Only the requested backup and theme tests were added or extended. The security
  review found no new issue in these changes. No dependency install was needed.
- `plans/README.md` was not edited. `.ai/todo.md` is not part of the commit.
