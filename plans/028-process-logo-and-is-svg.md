# Plan 028: Logo IPC reads only a trusted file, and is-svg is not the vulnerable 3.x release

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- main/logo.js package.json package-lock.json app.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none. Run after 027 if both are in progress. They edit different files.
- **Category**: security
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

`process-logo` reads whatever path the renderer sends and returns the bytes as a data URL. The preview window has the same preload, and the handler does not check the sender. The read then passes the text to `is-svg` 3.0.0, which has a high ReDoS advisory ([GHSA-r8j5-h5cx-65gg](https://github.com/advisories/GHSA-r8j5-h5cx-65gg), [GHSA-7r28-3m3f-r2pr](https://github.com/advisories/GHSA-7r28-3m3f-r2pr)). The user normally reaches this only after the logo file dialog. A compromised renderer can call it with any path. This plan limits the caller and the file, and moves off the vulnerable release.

## Current state

`main/logo.js`:

```js
const isSvg = require('is-svg');

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

`app.js:364` loads it with `require('./main/logo')`. `preload/index.js:83` exposes `processLogo(filePath)`.

`is-svg` 6.1.0 is pure ESM. It exports a default function `isSvg(string, options?)`. It does not accept a Buffer. The `validate` option defaults to `true`. Source: [npm is-svg](https://registry.npmjs.org/is-svg) and the 6.0.0 release notes (pure ESM, string only). Confirm the installed version with `npm view is-svg version` before editing. Do not trust this paragraph if the registry page disagrees.

`main/__tests__/save-pdf.spec.js` shows the IPC test pattern: mock `electron` before import, capture `ipcMain.handle`, build a trusted event whose `senderFrame` is `sender.mainFrame`.

Raster logos still go through `nativeImage`. Do not drop that path.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Registry check | `npm view is-svg version` | a version greater than or equal to `6.1.0` |
| Focused test | `npm test -- main/__tests__/logo.spec.js` | exit 0 |
| Audit, production | `npm audit --omit=dev --json` | no `high` finding whose name is `is-svg` |
| Lint | `npx eslint main/logo.js main/__tests__/logo.spec.js` | exit 0 |

## Scope

**In scope**:

- `main/logo.js`
- `main/__tests__/logo.spec.js` (create)
- `package.json` and `package-lock.json` (the `is-svg` bump only)

**Out of scope**:

- `main/select-logo-file.js` (plan 029)
- Settings IPC (plan 027)
- Logo UI components under `app/components/settings/`
- Replacing `nativeImage` or changing the 500px resize

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Restrict logo reads and upgrade is-svg`.
- Do not push. No Co-authored-by trailer and no AI attribution.
- Do not run against `~/Library/Application Support/Manta`.

## Steps

### Step 1: Confirm the package API

Run `npm view is-svg version` and open the readme for that version. The function must accept a string and return a boolean.

**Verify**: the printed version is `6.1.0` or newer, and the readme shows `isSvg(string)`. If the major is 7 or the export is not a function, STOP and report the API. Do not guess a call shape.

### Step 2: Write the failing tests

Create `main/__tests__/logo.spec.js`. Mock `electron` (`ipcMain.handle`, `nativeImage.createFromPath`, `BrowserWindow.fromWebContents`) and `../settings`. Mock `node:fs/promises` `readFile`. Do not read a real user file.

Cases:

1. Trusted main-frame event and a small SVG string (`<svg xmlns="http://www.w3.org/2000/svg"></svg>`, under 1 MB) returns a `data:image/svg+xml;base64,` URL.
2. Preview-window event (window id matches `previewWindowID`, not `mainWindowID`) returns `{ ok: false, error: 'untrusted-sender' }` and does not call `readFile`.
3. Sub-frame event does not call `readFile`.
4. Trusted event and a file whose mocked `stat` size is greater than 2 MiB returns `{ error: 'too-large' }` and does not call `readFile`.
5. Trusted event and a non-SVG payload whose `nativeImage` is empty returns `{ error: 'Unsupported image file' }`.

`nativeImage.createFromPath` in case 5 returns `{ isEmpty: () => true }`. In a raster success case you do not need a real PNG. One raster success is optional. The empty-image case is required.

**Verify**: `npm test -- main/__tests__/logo.spec.js` → fails because the handler still reads any path. Import failure is a STOP.

### Step 3: Change the handler and the dependency

Install `is-svg@6.1.0` or the newer 6.x you confirmed in step 1: `npm install is-svg@6`.

In `main/logo.js`:

- Reject events that fail `isMainWindowMainFrame` (import it from `./main-window-sender.js`, same as `main/save-pdf.js`). Return `{ ok: false, error: 'untrusted-sender' }`.
- `stat` the path first. If `size` is over `2 * 1024 * 1024`, return `{ error: 'too-large' }` and do not read the file.
- Reject when `stat` says the path is not a file.
- Read the file only after those checks.
- Call `isSvg` with a string, not a Buffer. `main/logo.js` is loaded via `require` from `app.js`, and `is-svg` 6 is ESM. Use `const { default: isSvg } = await import('is-svg')` inside the handler if `require('is-svg')` throws `ERR_REQUIRE_ESM`. Do not stay on 3.x.
- Keep the `nativeImage` branch for non-SVG files.

**Verify**: `npm test -- main/__tests__/logo.spec.js` → exit 0.

### Step 4: Audit and lint

**Verify**: `npm audit --omit=dev --json` does not list `is-svg` at high severity. `npx eslint main/logo.js main/__tests__/logo.spec.js` exits 0.

## Test plan

- The five cases in step 2. No UI test. No snapshot.
- Pattern: `main/__tests__/save-pdf.spec.js`.

## Done criteria

- [ ] `npm test -- main/__tests__/logo.spec.js` exits 0
- [ ] `package.json` depends on `is-svg` 6.x, not 3.x
- [ ] `npm audit --omit=dev` has no high `is-svg` advisory
- [ ] Untrusted callers and files over 2 MiB do not reach `readFile`
- [ ] `git status` shows no files outside the in-scope list, other than the lockfile entries `npm install` must change for `is-svg`
- [ ] `plans/README.md` row 028 is `DONE`

## STOP conditions

- The live handler does not match the excerpt.
- `is-svg` 6 cannot be imported from the Electron main bundle (`npm run build` fails on `main/logo.js`) and there is no dynamic-import workaround that still type-checks as a function call. Report the build error. Do not pin 3.x.
- A step fails twice after a real fix attempt.
- The logo UI needs a response shape other than `{ dataUrl }` or `{ error }`. Keep those two shapes. You may add `ok: false` next to `error` for the untrusted case. If the renderer treats any object without `dataUrl` as failure, that is enough. Do not change renderer files to chase a new shape. If the renderer throws on `{ ok: false }` without `error`, include `error`.

## Maintenance notes

The 2 MiB cap is a local DoS limit, not an image-quality setting. Raising it reopens a large-file read. Plan 029 still needs to gate the file dialog. This plan does not make the dialog safe by itself.
