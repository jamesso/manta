# Plan 038: A Pouch write does not reload every invoice by itself

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/helpers/pouchDB.js app/helpers/recurringRunner.js app/middlewares/FormMW.jsx app/middlewares/InvoicesMW.jsx app/middlewares/ContactsMW.jsx app/middlewares/ItemsMW.jsx app/middlewares/RecurringMW.jsx app/helpers/creditNoteSettlement.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Implementation**: DONE (2026-11-17); browser verification BLOCKED (no Jean Run command).
- **Broad verification**: 92 files passed; locale validation has 8 existing failures at unchanged HEAD.

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/031-numbering-backup-settlement-tests.md, plans/034-recurring-delete-tombstone.md, and plans/037-restore-conflict-is-failure.md
- **Category**: perf
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

`saveDoc`, `updateDoc`, and `deleteDoc` each `put` or `remove` one document and then call `getAllDocs`. `getAllDocs` is `allDocs({ include_docs: true, attachments: true })` with no limit. One Save on an invoice also calls `getAllDocs` again from `FormMW` and from credit settlement. A recurring catch-up that creates several drafts reloads the whole invoices database after each draft. The app keeps the full list in Redux, so the reload is the expensive part, and it grows with the number of saved documents. This plan leaves one list read per user action and removes the extra reads inside each put.

## Current state

`app/helpers/pouchDB.js`:

```js
const getAllDocs = dbName =>
  setDB(dbName).then(db =>
    db.allDocs({ include_docs: true, attachments: true })
  ).then(results => results.rows.map(row => row.doc));

const saveDoc = (dbName, doc) =>
  setDB(dbName).then(db => db.put(doc)).then(() => getAllDocs(dbName));

const updateDoc = (dbName, updatedDoc) =>
  setDB(dbName).then(db => db.put(updatedDoc)).then(() => getAllDocs(dbName));

const deleteDoc = (dbName, doc) =>
  setDB(dbName)
    .then(db => db.get(doc).then(record => db.remove(record)))
    .then(() => getAllDocs(dbName));
```

`updateDocs` and `removeDocs` also call `getAllDocs` before they return. `bulkSaveDocs` does too.

Callers that use the returned array as the next Redux list (non-exhaustive, re-grep before editing):

- `app/middlewares/ContactsMW.jsx` — `saveDoc`, `updateDoc`, `removeDocs`
- `app/middlewares/ItemsMW.jsx` — `saveDoc`, `updateDoc`, `removeDocs`
- `app/middlewares/RecurringMW.jsx` — `saveDoc`, `updateDoc`, `removeDocs`
- `app/middlewares/InvoicesMW.jsx` — many `updateDoc` / `saveDoc` / `updateDocs` / `removeDocs` sites
- `app/middlewares/FormMW.jsx` — `saveDoc` or `updateDoc`, then more `getAllDocs`
- `app/helpers/creditNoteSettlement.js` — `updateDocs` then `getAllDocs` again
- `app/helpers/recurringRunner.js` — `db.saveDoc('invoices', invoice)` once per created draft

`app/helpers/__tests__/pouchDB.spec.js` expects `saveDoc` to resolve to the document array (`const docs = await saveDoc(...)`).

Reducers such as `app/reducers/InvoicesReducer.jsx` replace state with `action.payload` when that payload is the full list. Do not change those reducers to accept a single document. The middleware keeps passing a full list. It must obtain that list from one `getAllDocs` at the end of the user action, not from inside every put.

The app does not write Pouch attachments (backup import rejects `_attachments`). You may drop `attachments: true` from `getAllDocs` only if `pouchDB.spec.js` and a search for `_attachments` show no writer. If any writer exists, keep the flag. Do not spend this plan on that flag if it is unclear. The required change is the extra full reads.

`fake-indexeddb` is the test adapter. Keep `adapter: 'idb'` in production. A wrong adapter hides user databases.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Pouch tests | `npm test -- app/helpers/__tests__/pouchDB.spec.js` | exit 0 |
| Middleware tests | `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js app/middlewares/__tests__/FormMW.spec.js app/middlewares/__tests__/ContactsMW.spec.js` | exit 0 |
| Runner | `npm test -- app/helpers/__tests__/recurringRunner.spec.js` | exit 0 |
| Settlement | `npm test -- app/helpers/__tests__/creditNoteSettlement.spec.js` | exit 0 |
| Lint | `npx eslint app/helpers/pouchDB.js app/helpers/recurringRunner.js app/middlewares/FormMW.jsx app/middlewares/InvoicesMW.jsx app/middlewares/ContactsMW.jsx app/middlewares/ItemsMW.jsx app/middlewares/RecurringMW.jsx app/helpers/creditNoteSettlement.js` | exit 0 |

Run the focused commands after each step. Run this broader set once at the end of step 4. Do not run `npm run test:e2e` unless a focused test cannot see the bug.

## Scope

**In scope**:

- `app/helpers/pouchDB.js`
- `app/helpers/__tests__/pouchDB.spec.js`
- The caller files listed in Current state
- Their unit tests, only where a mock must match the new return value

**Out of scope**:

- Pagination of the invoice table
- A PouchDB `_changes` feed
- Changing reducer state shape
- `attachments: true` unless the search in step 1 is conclusive
- Plans 032–037 behavior (credit pairing, tombstones, error codes, unsaved checks, 409). Re-run those tests. If they fail, fix the reload call, not the business rule.

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Reload each database once per save`.
- Do not push. No AI attribution.
- Do not open the real `~/Library/Application Support/Manta` profile.

## Steps

### Step 1: Count current reads in the helpers

Add a test in `pouchDB.spec.js` that spies on `allDocs` (or wraps the test database). One `saveDoc` of a contact performs one `put` and must not call `allDocs` inside `saveDoc` after this plan. The test may call `getAllDocs` itself afterward and see the new doc.

Write the test against the new contract now:

- `saveDoc` / `updateDoc` resolve to `{ ok: true, id, rev }`, not to an array.
- `deleteDoc` resolves to `{ ok: true, id }`.
- `getAllDocs` still returns an array.

Update existing `pouchDB.spec.js` assertions that treat the `saveDoc` return value as an array. Those call sites in the spec should `getAllDocs` when they need the list.

**Verify**: `npm test -- app/helpers/__tests__/pouchDB.spec.js` → fails on the old array return. If the spy cannot see `allDocs`, assert the return shape only.

### Step 2: Change the helpers

`saveDoc`, `updateDoc`, and `deleteDoc` perform the write and return the rev result. They do not call `getAllDocs`.

`updateDocs`, `removeDocs`, and `bulkSaveDocs` return `{ succeeded, failed }` and do not call `getAllDocs` on the success path. On the failure path, do not attach a full `docs` list unless a caller you are editing in step 3 still reads `err.docs`. Prefer the caller calling `getAllDocs` once in a `catch`.

Keep the `idb` adapter and the migration runner. Do not change migration `allDocs`.

**Verify**: `npm test -- app/helpers/__tests__/pouchDB.spec.js` → exit 0.

### Step 3: Update callers

For each caller from the grep of `saveDoc(`, `updateDoc(`, `deleteDoc(`, `updateDocs(`, `removeDocs(`, and `bulkSaveDocs(`:

- If it dispatched the returned value as the whole list, call `getAllDocs(dbName)` once after the write and dispatch that array.
- If it already called `getAllDocs` immediately after `saveDoc`, delete the extra read that came from `saveDoc`. Leave one read.
- `creditNoteSettlement.js`: `updateDocs` then one `getAllDocs` only when the invoice changed. Remove the extra read inside `updateDocs`.
- `recurringRunner.js`: the run already loads invoices once. `saveInvoiceDraft` must not reload all invoices per draft. Use the `{ ok, id, rev }` result. Keep the 409 handling that the runner tests cover.

Do not merge a single doc into a reducer. Pass the full list from one `getAllDocs`.

**Verify**: the middleware, runner, and settlement commands in the table exit 0.

### Step 4: Lint and a final focused run

**Verify**: the eslint command exits 0, then run the four test commands in the table once more. All exit 0.

## Test plan

- `pouchDB.spec.js` covers the new return shape and a round trip through `getAllDocs`.
- Existing middleware tests prove the list in the action payload still contains the saved document.
- `recurringRunner.spec.js` still creates one draft per due period and does not duplicate a period. If you can assert `allDocs` call count without a fragile spy, do it for the multi-draft case. If the spy is fragile, skip the count and keep the behavior tests.
- No e2e and no snapshot.

## Done criteria

- [x] `saveDoc`, `updateDoc`, and `deleteDoc` do not call `getAllDocs`
- [x] Each user-action path that updates Redux calls `getAllDocs` at most once after the writes for that action
- [x] `recurringRunner` does not call `getAllDocs` once per created draft
- [x] The test commands in the table exit 0
- [x] `adapter: 'idb'` is unchanged
- [x] Changes stay within persistence helpers, their callers/tests/mocks, and this plan; `.ai` stays untracked
- [x] Index maintenance waived by operator: `plans/README.md` is unchanged

## STOP conditions

- A reducer receives a single document and replaces the whole list with it. Stop and fix the caller to pass `getAllDocs()`. If you cannot find the caller, STOP. Do not change the reducer to accept both shapes.
- `err.docs` is required by a caller outside the in-scope list. Add that caller or STOP.
- The only way to keep tests green is to call `getAllDocs` inside `saveDoc` again. STOP. The plan has not landed.
- User data would be opened with an adapter other than `idb`. STOP.

## Maintenance notes

A new `saveDoc` caller must not assume an array return. It should write, then `getAllDocs` once if the screen shows a list. Plan 034 should already have removed the per-tombstone `saveDoc` loop. If that loop is back, do not reintroduce it here.


### Execution review — 2026-11-17

**Drift and limits.** Before edits, the required diff against `10f3f0e`
showed 137 insertions and 38 deletions across `pouchDB.js`, `FormMW.jsx`,
and `InvoicesMW.jsx`. The live code was compared before implementation.
These were the operator-authorized changes from 032/034/035/036/037:
credit-note pair writes and compensation, deterministic batch tombstones,
`loadFailed` versus `notFound`, revision-based dirty checks, and restore
409 failures. They remain in place. No plan 038 STOP condition occurred.
Reducers, credit math, recurring IDs/schedules, `adapter: 'idb'`, migration
reads, and every attachments flag are unchanged. No new library API was
used, so no external API documentation lookup was needed. No real Manta
profile was accessed. Security review found no new external input or
authorization boundary and no security issue added by these changes.

**Mutation contracts.** `saveDoc` and `updateDoc` return the Pouch write
result `{ ok, id, rev }`; `deleteDoc` returns `{ ok, id }`. `updateDocs`
and `bulkSaveDocs` return `{ succeeded, failed }`. `removeDocs` returns
those ID arrays plus `removed` snapshots for Undo. `restoreDocs`
also returns `{ succeeded, failed }`; it still throws `partial-restore`
with `restored` and `failed` on conflicts or other per-document failures.
None of these helpers reloads a list on success or failure.

`updateDocs` still throws `partial-update` with `succeeded` and `failed`.
Its `written` field contains only successful writes, including their new
revisions. It is not a full list. Credit compensation now uses `written`
instead of `err.docs`, so a later list-read failure cannot remove the
revision needed to restore the prior credit note. Callers must explicitly
load their list after writes or partial results. No caller or relevant mock
still consumes `err.docs` or a mutation result as a list.

**Caller review.** A repository-wide search covered all seven write helpers,
imports, injected database objects, and mocks; the original caller list was
not treated as complete. Contacts, items, recurring profiles, and invoice
middlewares load complete arrays before passing list actions to reducers.
Partial restore paths attempt one list load and report a read failure
without retrying it. Invoice repairs refresh after partial writes too.
Payment batches refresh once at finalization; their existing validation
reads, queues, and load/write error codes remain.

Form credit-note saves settle against the successfully written note through
`updateCreditedInvoiceInDb`, then load the invoice list once, including when
settlement fails. The existing settlement wrapper still loads first and
reloads only if it wrote an invoice. Estimate conversion now writes its
source link inside invoice save before the single list load; link failures
warn while preserving the saved invoice. The standalone mark-converted
action remains available. Recurring save/pause defers the Redux profile
refresh to its run, after checkpoint writes; idle and failed runs also
refresh the saved profile once. The runner ignores mutation metadata and
keeps its one initial invoice load, with unchanged 409 handling.
`backupFlow` already used mutation tallies and one final read per database;
its source needed no edit, but its mocks no longer return `allDocs`.

**Regression evidence.** The first Pouch contract run exited 1 with the
three expected array-versus-mutation failures. After implementation, all
focused checks below exited 0. Tests cover the real database mutation
contracts and absence of hidden reads, partial-write revision retention,
restore conflicts, credit compensation, form settlement failure/retry,
conversion link success/failure, persisted tombstones, partial restore
read failure without retry, recurring checkpoint/runner failures, and
multi-draft initial read counts. Existing dirty-check and payment error
tests also passed in the broad run. No snapshots or e2e tests were added.

| Final check | Result | Exit |
| --- | --- | --- |
| `npm ci` | Installed from unchanged lockfile; audit reports 11 moderate issues; dependency updates are outside this plan | 0 |
| `npm test -- app/helpers/__tests__/pouchDB.spec.js` | 18 passed | 0 |
| `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js app/middlewares/__tests__/FormMW.spec.js app/middlewares/__tests__/ContactsMW.spec.js app/middlewares/__tests__/ItemsMW.spec.js app/middlewares/__tests__/RecurringMW.spec.js` | 136 passed | 0 |
| `npm test -- app/helpers/__tests__/recurringRunner.spec.js` | 10 passed | 0 |
| `npm test -- app/helpers/__tests__/creditNoteSettlement.spec.js` | 4 passed | 0 |
| Scoped ESLint, including all changed JS/JSX tests and mocks | No errors or warnings | 0 |
| `git diff --check` | Clean | 0 |
| `npm test` (one broad run) | 92 files passed, 1 failed, 4 skipped; 1326 tests passed, 8 failed, 2 skipped, 2 todo | 1 |
| `npm test -- i18n/__tests__/locales.spec.js -t 'translates every English key in invoices'` | Reproduced the 8 existing locale failures in isolation | 1 |

The broad failures are missing `payments.errors.loadFailed` and
`payments.errors.writeFailed` in de, fr, id, it, sk, ur-PK, vi, and zh-CN.
A comparison of all nine invoice JSON files to `git show HEAD:<path>`
confirmed identical bytes. HEAD English contains both keys; the eight
other HEAD locales contain neither. `git diff --exit-code HEAD -- i18n`
exited 0. No locale edits were made.

**Browser verification blocked.** Jean `get_run_environments` returned no
environment for worktree `dc8f2ade-82dd-4744-a690-86efd47e0c4c`.
`start_run_environment` returned: `No run command configured in jean.json
for this worktree`. No alternate server, guessed port, or browser session
was started. Runtime user-flow verification remains open.

Only this plan file is committed, per operator instruction. Source and test
changes remain in the existing worktree, unstaged; `.ai` is untracked.
No README index edit, push, PR, branch switch, or new worktree was made.
