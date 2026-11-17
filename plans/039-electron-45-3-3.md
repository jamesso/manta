# Plan 039: Run Manta on Electron 45.3.3

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- package.json package-lock.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: DONE
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. Plan 040 also edits `package.json`. Run 039 first.
- **Category**: migration
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

The app is on Electron 45, which is still a supported stable line. Support for 45 ends on 2027-04-27 ([Electron schedule](https://releases.electronjs.org/schedule)). The lockfile is `45.2.1`. The stable patch on 2026-11-16 is `45.3.3` ([releases](https://releases.electronjs.org/release?channel=stable)). This plan moves the lockfile to the current 45.x patch. It is not an upgrade to Electron 46.

## Current state

`package.json` devDependency `electron` is `^45.2.1`. `package-lock.json` resolves `electron` to `45.2.1`. `engines.node` is `>=24`.

Confirm the patch with `npm view electron@45 version` before you install. If that command prints a version newer than `45.3.3` and it is still `45.x`, install that version instead. If it prints `46` or higher, you used the wrong dist-tag. Use `electron@45` explicitly.

Do not change `productName`, the `file://` production load, or `SECURE_WEB_PREFERENCES`.

Tests: `npm test`. A full e2e run is `npm run test:e2e` (it builds first). Run unit tests for this plan. Do not run e2e unless `npm test` passes and you are checking the Electron binary loads. If e2e is too heavy, `npm test` plus `npm run build` is the gate. Say in the README status note that e2e was not run.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Latest 45 | `npm view electron@45 version` | a `45.x` version, at least `45.3.3` |
| Install | `npm install electron@45` | exit 0, lockfile resolves that version |
| Unit tests | `npm test` | exit 0 |
| Build | `npm run build` | exit 0, writes `out/` |

## Scope

**In scope**:

- `package.json` (`electron` version only)
- `package-lock.json` (the electron update `npm install` writes)

**Out of scope**:

- Electron 46
- Other dependency bumps (plans 028 and 040)
- `electron-builder` and `electron-vite` majors
- Application source

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Update Electron to 45.3.3`.
- Do not push. No AI attribution.

## Steps

### Step 1: Read the version

**Verify**: `npm view electron@45 version` prints `45.3.3` or a later `45.*`. If it prints something else, STOP and report the string.

### Step 2: Install that exact 45 line

Run `npm install electron@45`. Do not use `npm audit fix`. Do not change `overrides` in this plan.

**Verify**: `node -p "require('./node_modules/electron/package.json').version"` prints the version from step 1. `rg -n "\"electron\":" package-lock.json | head` shows that version. The `package.json` range may stay `^45.2.1` if the lockfile resolved forward. Prefer setting the range to `^45.3.3` (or `^` plus the version you installed) so a later install does not go back to 45.2.1. It must not allow 46. `^45.3.3` does not allow 46.

### Step 3: Test and build

**Verify**: `npm test` exits 0. `npm run build` exits 0.

## Test plan

- No new tests. The unit suite and the build are the gate.
- Do not add a test that only checks `process.versions.electron`.

## Done criteria

- [x] Installed Electron is the `45.x` version from step 1 and is at least `45.3.3`
- [x] The range does not allow major 46
- [x] `npm test` exits 0
- [x] `npm run build` exits 0
- [x] No source file outside `package.json` and `package-lock.json` is modified
- [ ] `plans/README.md` row 039 is `DONE`

## STOP conditions

- `npm view electron@45 version` is not 45.x.
- `npm install` wants to change `electron` to 46. STOP and rerun with an explicit `45.3.3` (or the 45.x you viewed). If that still resolves to 46, STOP.
- `npm test` fails after the bump and the failure is not an obvious test timeout you can rerun once. STOP and report the first failing test name. Do not edit that test to match a new Electron quirk in this plan.
- `npm run build` fails on a native module. STOP.

## Maintenance notes

Electron 46 becomes stable around 2027-01-05 and Electron 45 support ends 2027-04-27, per the schedule cited above. A major bump is a separate plan. Re-check the schedule when that plan is written. This paragraph is not permission to start that bump.

Installed Electron `45.3.3` on 2026-11-16. Release: https://releases.electronjs.org/release/v45.3.3. The stable channel lists the same version: https://releases.electronjs.org/release?channel=stable. `npm view electron dist-tags` reports `latest` and `45-x-y` as `45.3.3`. `npm view electron versions` shows the 45.3 line as `45.3.0`, `45.3.1`, `45.3.2`, `45.3.3`. Electron 46 is `46.0.0-alpha.11` only. The range is `^45.3.3` (`>=45.3.3 <46.0.0`).

Drift check `git diff --stat 10f3f0e..HEAD -- package.json package-lock.json` exited 0 with no output.

| Command | Exit | Result |
|---|---|---|
| `npm view electron@45 version` | 0 | Every match is 45.x. Newest is `45.3.3`. |
| `npm install electron@45` | 0 | `package.json` and `package-lock.json` resolve `electron` to `45.3.3`. No other dependency changed. |
| `node node_modules/electron/install.js` | 0 | Binary `v45.3.3`. The npm package has no postinstall, so `npm install` does not download the binary. |
| `npm test` | 0 | 1268 passed, 2 skipped, 2 todo. 4 test files skipped. |
| `npm run build` | 0 | Wrote `out/`. |

`npm run test:e2e` was not run. `plans/README.md` was not edited. The operator maintains that index, so row 039 stays `TODO` there.
