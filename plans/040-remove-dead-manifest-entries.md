# Plan 040: Remove manifest entries for stacks that are not installed

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

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/039-electron-45-3-3.md if that plan is not done, because both edit `package.json`. If 039 is already `DONE`, this plan still applies.
- **Category**: migration
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

`package.json` still has an `overrides.enzyme` block and `allowScripts` entries for `core-js@2.6.12`, `ejs@2.7.4`, and `styled-components@3.4.10`. Those packages are not in the lockfile. The app uses `styled-components` 6. A direct `date-fns` dependency has no import in the repo. `react-day-picker` and Base UI still depend on `date-fns` themselves. The direct dependency adds a second copy to the manifest and does not change calendar behavior. Removing the dead entries makes the next install review about packages the app actually runs.

## Current state

`package.json` dependencies include `"date-fns": "^4.4.0"`. A search of `*.js`, `*.jsx`, and `*.mjs` finds no `from 'date-fns'` and no `require('date-fns')`.

`package.json` ends with:

```js
"overrides": {
  "enzyme": { "cheerio": "1.0.0-rc.12" }
},
"allowScripts": {
  "core-js@2.6.12": true,
  "ejs@2.7.4": true,
  "fsevents@2.3.3": true,
  "styled-components@3.4.10": true
}
```

Keep the `fsevents@2.3.3` allowScripts entry. It is a real optional native install hook. Confirm with `npm ls fsevents` before deleting anything else. If `fsevents` is absent, keep the entry anyway. Deleting it is not part of this plan.

`npm ls enzyme`, `npm ls styled-components`, and `npm ls date-fns` are the checks. `styled-components` should show 6.x only. `date-fns` should show only transitive copies after the edit.

Moment stays. Settings store Moment format tokens such as `MM/DD/YYYY`. Do not remove `moment`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Direct imports | `rg -n "from 'date-fns'|require\\('date-fns'\\)" --glob '!node_modules/**' --glob '!plans/**'` | no matches |
| Enzyme absent | `npm ls enzyme` | empty or `ELSPROBLEMS` that says it is not installed. No installed enzyme. |
| Tests | `npm test` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `package.json`
- `package-lock.json` via `npm uninstall date-fns` and a lockfile refresh. Do not hand-edit the lockfile.

**Out of scope**:

- Removing `moment` or `lodash`
- Upgrading `react-day-picker`
- `is-svg` (plan 028)
- Electron version (plan 039)
- The `fsevents` allowScripts line

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Drop unused date-fns and dead install overrides`.
- Do not push. No AI attribution.

## Steps

### Step 1: Confirm the packages are unused

**Verify**: the `rg` command prints nothing. `npm ls enzyme` does not show an installed version. `rg -n "styled-components@3" package-lock.json` prints nothing. If enzyme is installed, STOP. If a source file imports `date-fns`, STOP.

### Step 2: Edit the manifest

Delete the `overrides` key if `enzyme` is its only override. Delete the three stale `allowScripts` keys and keep `fsevents@2.3.3`. Run `npm uninstall date-fns`.

**Verify**: `node -e "const p=require('./package.json'); if(p.dependencies['date-fns']) process.exit(1); if(p.overrides) process.exit(1); const a=p.allowScripts||{}; if(a['core-js@2.6.12']||a['ejs@2.7.4']||a['styled-components@3.4.10']) process.exit(1); if(!a['fsevents@2.3.3']) process.exit(1)"` → exit 0.

### Step 3: Install is consistent, tests pass

**Verify**: `npm ls date-fns` shows no dependency of the root package named `date-fns` (transitive nodes under `react-day-picker` may remain). `npm test` exits 0. `npm run build` exits 0.

## Test plan

- No new tests. `npm test` and `npm run build` are the gate.
- A calendar UI test is out of scope. `react-day-picker` still brings its own `date-fns`.

## Done criteria

- [ ] Root `package.json` has no `date-fns` dependency, no `overrides.enzyme`, and no allowScripts for core-js 2, ejs 2, or styled-components 3
- [ ] `fsevents@2.3.3` allowScripts remains
- [ ] `moment` remains
- [ ] `npm test` and `npm run build` exit 0
- [ ] `plans/README.md` row 040 is `DONE`

## STOP conditions

- A source file imports `date-fns`.
- `npm uninstall date-fns` removes `react-day-picker` or `moment`. Restore the manifest from git and STOP.
- `npm test` fails in a date test. STOP. Do not reintroduce the direct dependency until you know which import needed it.
- Enzyme appears in `npm ls` after you thought it was gone. STOP.

## Maintenance notes

Do not add `date-fns` back for one `format()` call. The calendar stack already has it transitively. Application date labels use Moment because stored formats are Moment tokens.
