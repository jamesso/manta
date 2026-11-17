# Plan 034: Deleting a generated recurring draft writes its tombstone in the same operation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/middlewares/InvoicesMW.jsx app/helpers/recurring.js app/helpers/pouchDB.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: DONE

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/030-return-middleware-test-promises.md and plans/032-credit-note-invoice-one-write.md. Both edit `InvoicesMW.jsx`. Run 032 first.
- **Category**: bug
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Deleting a recurring draft removes the invoice, then `saveDoc`s a tombstone one document at a time. The tombstone id is `rec-<profileId>-<periodKey>`, which is also the draft id. The runner treats that id as "this period already happened." If the tombstone `put` fails after `removeDocs`, the list refresh does not run, and the next runner pass can create the draft again. The user already asked to delete it.

## Current state

`app/helpers/recurring.js`:

```js
export function buildRecurringTombstone(profileId, periodKey) {
  return {
    _id: `rec-${profileId}-${periodKey}`,
    docType: 'invoice',
    recurringId: profileId,
    periodKey,
    recurringTombstone: true,
    status: 'draft',
  };
}
```

`InvoicesMW.jsx` delete path (about lines 524–535):

```js
return removeDocs('invoices', deletable).then(async result => {
  for (const doc of result.removed) {
    if (doc.recurringId && doc.periodKey) {
      await saveDoc('invoices', buildRecurringTombstone(doc.recurringId, doc.periodKey));
    }
  }
  const docs = await getAllDocs('invoices');
  return { ...result, docs };
});
```

The outer `.catch` toasts `err.message` and does not dispatch `INVOICE_DELETE`.

`removeDocs` already returns `{ removed, failed, docs }`. `saveDoc` puts, then calls `getAllDocs` (a full reload per tombstone).

PouchDB `put` after `remove` of the same `_id` needs a new document without the old `_rev`, or a `put` that follows the delete rev. `buildRecurringTombstone` has no `_rev`. A put of a new body for an id that was just deleted can 409 unless the delete rev is passed. Read `removeDocs`: it stores the pre-delete doc without `_rev` in `removed`. The live rev after delete is not in that snapshot. Check the current tests. If tombstones already succeed in `recurringRunner.spec.js` or `InvoicesMW.spec.js`, keep that mechanism. Do not invent a second id scheme.

`bulkSaveDocs` exists in `app/helpers/pouchDB.js` and uses `db.bulkDocs`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Middleware tests | `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` | exit 0 |
| Runner tests | `npm test -- app/helpers/__tests__/recurringRunner.spec.js` | exit 0 |
| Lint | `npx eslint app/middlewares/InvoicesMW.jsx app/middlewares/__tests__/InvoicesMW.spec.js` | exit 0 |

## Scope

**In scope**:

- `app/middlewares/InvoicesMW.jsx` (the delete branch only)
- `app/middlewares/__tests__/InvoicesMW.spec.js`
- `app/helpers/pouchDB.js` only if you need one helper to put tombstones without a per-doc `getAllDocs`. Prefer `bulkSaveDocs` if it already returns per-doc errors.

**Out of scope**:

- The recurring runner's create path, except running its tests
- Credit-note issue (plan 032) and payment errors (plan 035)
- Changing the tombstone `_id` format
- Undo of a deleted recurring draft, except not breaking the existing restore branch. Read the `INVOICE_RESTORE` case before editing. It already deletes tombstones before restore. Leave that sequence working.

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Write recurring tombstones with the delete`.
- Do not push. No AI attribution.

## Steps

### Step 1: Test the failure path

Add a middleware test:

- Delete one generated draft (`recurringId` and `periodKey` set, `_id` equal to `rec-${recurringId}-${periodKey}`).
- `removeDocs` succeeds.
- The tombstone write fails (mock `saveDoc` or `bulkSaveDocs` to reject).
- The test expects a warning toast and a following `getAllDocs` / `INVOICE_DELETE` so the list matches the database. It also expects the tombstone write to have been attempted.

Add a success test if one does not exist: after delete, the database contains a doc with that `_id` and `recurringTombstone: true`, and `runRecurringOnce` does not create a second live draft. The runner test file may already cover the second half. Do not duplicate it if it does. The middleware test must show the tombstone is part of the delete result the reducer receives.

**Verify**: `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` → the new failure test fails before the production change. If the success behavior is already tested, do not add a redundant test.

### Step 2: Write tombstones without dropping the list update

Replace the per-doc `saveDoc` loop with one `bulkSaveDocs('invoices', tombstones)` after `removeDocs`. Then call `getAllDocs` once and always return that list to the reducer when `removeDocs` has removed anything.

If a tombstone result has `error`, show the existing warning toast and still dispatch `INVOICE_DELETE` with the fresh list. Do not leave Redux showing documents that `removeDocs` already removed.

If `bulkSaveDocs` cannot put a deleted id without `_rev`, read the rev from the `removeDocs` implementation and pass it only if the current successful tests do that. If you cannot put the tombstone without changing `buildRecurringTombstone`'s id, STOP.

Avoid calling `saveDoc` inside the loop. Each `saveDoc` reloads every invoice.

**Verify**: `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js app/helpers/__tests__/recurringRunner.spec.js` → exit 0.

### Step 3: Lint

**Verify**: `npx eslint app/middlewares/InvoicesMW.jsx app/middlewares/__tests__/InvoicesMW.spec.js` → exit 0.

## Test plan

- Failure: tombstone write fails, list still refreshes, warning is shown.
- Success: tombstone doc is what the runner already treats as "period taken", if that assertion is not already in `recurringRunner.spec.js`.
- Pattern: the delete/undo tests already in `InvoicesMW.spec.js`.

## Done criteria

- [x] Both test commands exit 0
- [x] A failed tombstone write still dispatches the post-delete list
- [x] The delete path does not call `saveDoc` once per removed draft
- [x] Tombstone `_id`s stay `rec-<profileId>-<periodKey>`
- [x] `git status` shows no files outside the in-scope list
- [x] Plan status is `DONE` here; `plans/README.md` left unchanged by operator instruction

## STOP conditions

- Tombstone puts 409 in the existing success test and the only fix is a new id format. STOP. The runner depends on that id.
- `INVOICE_RESTORE` breaks when you change delete. Revert your delete change and STOP with the restore failure text.
- `bulkSaveDocs` is not exported or does not report per-doc errors. You may use one `updateDocs`-style helper in `pouchDB.js`. If that helper's success path still calls `getAllDocs` per document, STOP and report. Do not call it in a loop.

## Maintenance notes

The runner and the delete path share `_id`. A change to `buildRecurringTombstone` must update both. Plan 038 may remove the extra `getAllDocs` inside `saveDoc`. This plan should not depend on that. It should already reload once.


### Execution review — 2026-11-16

- Started with a clean working tree on `plan-034-tombstone`. Merged local
  `main` by fast-forward to `bbc0e94`; retained plans 032, 037, and 040.
- Drift check: `git diff --stat 10f3f0e..HEAD -- app/middlewares/InvoicesMW.jsx app/helpers/recurring.js app/helpers/pouchDB.js`
  — exit 0. Compared live delete and restore code. Delete still used one
  `saveDoc` per removed recurring draft; expected drift accepted under operator override.
- Delete now uses one `bulkSaveDocs` call and its fresh `allDocs` on success.
  A rejected write or per-document error emits the existing warning notification,
  then reads the database and dispatches `INVOICE_DELETE`. No per-draft `saveDoc`.
- Existing bulk helper reports individual errors and already reloads once.
  API behavior checked against [PouchDB API](https://pouchdb.com/api.html).
- Added two failure cases and one real-PouchDB middleware success case using
  fake IndexedDB. The same `rec-<profileId>-<periodKey>` id succeeds after
  removal; the reducer receives the stored tombstone. Existing runner coverage
  proves no duplicate draft is generated. Restore branch unchanged and tests pass.
- Initial `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` — exit 1:
  three new cases failed before the production fix; 69 existing cases passed.
- Final `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` — exit 0,
  72 tests passed.
- `npm test -- app/helpers/__tests__/recurringRunner.spec.js` — exit 0,
  10 tests passed.
- `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js app/helpers/__tests__/recurringRunner.spec.js`
  — exit 0, 82 tests passed.
- `npx eslint app/middlewares/InvoicesMW.jsx app/middlewares/__tests__/InvoicesMW.spec.js`
  — exit 0. `git diff --check` — exit 0.
- Security review: no new external input, authorization path, or secret handling;
  no security issue found in this change. No STOP condition occurred.
- No running local app test needed for this persistence change. No access to
  the prohibited application data directory. No push, PR, branch switch, or worktree.
- Only the middleware, its test file, and this plan are included in the commit.
  `plans/README.md` was not edited; its main-branch change arrived with the merge.
