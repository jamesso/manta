# Plan 043: Delete the unused store enhancer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/store/enhancer.jsx app/store/index.jsx app/index.jsx app/App.jsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: DONE
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

`app/store/enhancer.jsx` loads contacts and invoices at store creation and logs a Pouch error with `console.log`. Nothing imports it. The running app starts from an empty store and loads data in `App.jsx` through the normal actions. The file looks like a second bootstrap. A later edit could wire it back and swallow startup errors.

## Current state

`app/store/enhancer.jsx`:

```js
import { getAllDocs } from '../helpers/pouchDB';

const getInitialState = () =>
  Promise.all([getAllDocs('contacts'), getAllDocs('invoices')])
    .then(values => ({
      contacts: values[0],
      invoices: values[1],
    }))
    .catch(err => console.log(err));

export { getInitialState };
```

`rg -n "store/enhancer|getInitialState" --glob '!plans/**' --glob '!node_modules/**'` at plan time matches this file only. Run that search again before deleting. `app/App.jsx` dispatches `getAllContacts` and `getInvoices` on mount. Leave that path.

No new test. Deleting an unimported module does not need a unit test. `npm test` is optional. Run it only if the search shows a test imported the enhancer. Then delete that import too, if the test only existed to call `getInitialState`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| No importers | `rg -n "store/enhancer|getInitialState" --glob '!plans/**' --glob '!node_modules/**'` | no matches after the delete |
| App still loads data | `rg -n "getAllContacts|getInvoices" app/App.jsx` | both names match |

## Scope

**In scope**:

- `app/store/enhancer.jsx` (delete)
- A test file only if it exists solely to import this enhancer

**Out of scope**:

- `app/store/index.jsx` store setup, unless it imports the enhancer. If it does, STOP. The audit found no import. Wiring has changed.
- `App.jsx` load effects
- Startup error toasts. That is a different change.

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Remove the unused store enhancer`.
- Do not push. No AI attribution.

## Steps

### Step 1: Search

**Verify**: `rg -n "enhancer" app --glob '!plans/**'` lists `app/store/enhancer.jsx` and no importer. If another file imports it, STOP.

### Step 2: Delete the file

Delete `app/store/enhancer.jsx`.

**Verify**: the two commands in the table. `getAllContacts` and `getInvoices` still appear in `app/App.jsx`. `rg` for `getInitialState` prints nothing.

## Test plan

- No new test.
- Skip `npm test` if no spec imported the file. If a spec imported it, run that spec after removing the import.

## Done criteria

- [x] `app/store/enhancer.jsx` is gone
- [x] Nothing in `app/` references `getInitialState` or `store/enhancer`
- [x] `App.jsx` still dispatches the list loads
- [ ] `plans/README.md` row 043 is `DONE` (index left for the operator)

## STOP conditions

- An importer exists. STOP. Do not delete the file and do not switch the store to this loader. The loader swallows errors.
- `App.jsx` no longer loads contacts and invoices. STOP. The app would start empty with no replacement.

## Maintenance notes

Startup data loading belongs in the middleware actions `App.jsx` already dispatches. Do not add a second preload path that catches errors with `console.log`.

Executed 2026-11-16 on `plan-033-041-043`. Drift `git diff --stat 10f3f0e..HEAD -- app/store/enhancer.jsx app/store/index.jsx app/index.jsx app/App.jsx` was empty (exit 0). `app/store/index.jsx` does not import this file. Deleted `app/store/enhancer.jsx`. No spec imported it, so `npm test` was skipped.

- `rg -n "store/enhancer|getInitialState" --glob '!plans/**' --glob '!node_modules/**'` — exit 1, no matches.
- `rg -n "getAllContacts|getInvoices" app/App.jsx` — exit 0, both names match (`getAllContacts` line 58, `getInvoices` line 60).
