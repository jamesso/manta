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

- [ ] `saveDoc`, `updateDoc`, and `deleteDoc` do not call `getAllDocs`
- [ ] Each user-action path that updates Redux calls `getAllDocs` at most once after the writes for that action
- [ ] `recurringRunner` does not call `getAllDocs` once per created draft
- [ ] The test commands in the table exit 0
- [ ] `adapter: 'idb'` is unchanged
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` row 038 is `DONE`

## STOP conditions

- A reducer receives a single document and replaces the whole list with it. Stop and fix the caller to pass `getAllDocs()`. If you cannot find the caller, STOP. Do not change the reducer to accept both shapes.
- `err.docs` is required by a caller outside the in-scope list. Add that caller or STOP.
- The only way to keep tests green is to call `getAllDocs` inside `saveDoc` again. STOP. The plan has not landed.
- User data would be opened with an adapter other than `idb`. STOP.

## Maintenance notes

A new `saveDoc` caller must not assume an array return. It should write, then `getAllDocs` once if the screen shows a list. Plan 034 should already have removed the per-tombstone `saveDoc` loop. If that loop is back, do not reintroduce it here.
