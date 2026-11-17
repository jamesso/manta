# Plan 037: A restore conflict is a failed restore

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/helpers/pouchDB.js app/helpers/__tests__/pouchDB.spec.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none. Plan 038 also edits `pouchDB.js`. Run this plan first.
- **Category**: bug
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Undo calls `restoreDocs` with the snapshots taken before delete. `put` of an id that now has a tombstone or a newer revision returns HTTP 409. The loop `continue`s and does not add that id to `failed`. If every conflict is skipped and `failed` stays empty, the function returns the full list and the caller treats the undo as a success. The document is still missing.

## Current state

`app/helpers/pouchDB.js` `restoreDocs`:

```js
for (const doc of docs) {
  const { _rev, ...clean } = doc;
  try {
    await db.put(clean);
    restored.push(doc._id);
  } catch (err) {
    if (err.status === 409) {
      continue;
    }
    failed.push({ id: doc._id, status: err.status, message: err.message });
  }
}
const allDocs = await getAllDocs(dbName);
if (failed.length) {
  throw Object.assign(new Error('partial-restore'), {
    restored,
    failed,
    docs: allDocs,
  });
}
return allDocs;
```

The recurring restore path in `InvoicesMW.jsx` deletes a tombstone before `restoreDocs`. Leave that caller as it is. This plan only changes the 409 branch so a conflict that still happens is visible.

`app/helpers/__tests__/pouchDB.spec.js` uses `fake-indexeddb` in at least some cases. Read the restore test, if any, before adding one. Prefer the existing harness. If the spec mocks PouchDB, follow that mock.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Pouch tests | `npm test -- app/helpers/__tests__/pouchDB.spec.js` | exit 0 |
| Invoice middleware tests | `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` | exit 0 |
| Lint | `npx eslint app/helpers/pouchDB.js app/helpers/__tests__/pouchDB.spec.js` | exit 0 |

## Scope

**In scope**:

- `app/helpers/pouchDB.js` (`restoreDocs` 409 branch only)
- `app/helpers/__tests__/pouchDB.spec.js`
- `app/middlewares/__tests__/InvoicesMW.spec.js` only if an existing assertion expected a silent 409. Update that assertion to expect `partial-restore`. Do not change production middleware.

**Out of scope**:

- Removing `getAllDocs` from `saveDoc` (plan 038)
- Changing tombstone ids
- The InvoicesMW restore sequence in production code

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Report invoice restore conflicts`.
- Do not push. No AI attribution.

## Steps

### Step 1: Test a 409

Add a test that puts a document, deletes it, puts a different body at the same `_id` (a tombstone body is fine: `{ _id, recurringTombstone: true }`), then `restoreDocs` with the original snapshot.

Expect `restoreDocs` to reject with message `partial-restore`, `failed` containing that id and `status: 409`, and `restored` not containing that id.

If the harness cannot produce a 409, mock `db.put` to reject `{ status: 409, message: 'conflict' }` for that id only. Assert the same `failed` entry.

**Verify**: `npm test -- app/helpers/__tests__/pouchDB.spec.js` → the new test fails because 409 is ignored.

### Step 2: Record the conflict

In the `catch`, push 409 into `failed` with `status: 409` and `message: err.message`. Remove the `continue` that skips `failed`. Keep the throw when `failed.length` is not zero.

**Verify**: `npm test -- app/helpers/__tests__/pouchDB.spec.js app/middlewares/__tests__/InvoicesMW.spec.js` → exit 0.

### Step 3: Lint

**Verify**: `npx eslint app/helpers/pouchDB.js app/helpers/__tests__/pouchDB.spec.js` → exit 0.

## Test plan

- One conflict case, as in step 1.
- Existing pouch tests still pass, including a restore that `put`s a deleted id with no successor.
- Pattern: `pouchDB.spec.js`.

## Done criteria

- [ ] Both test commands exit 0
- [ ] A 409 is in `failed` and the function throws `partial-restore`
- [ ] A clean restore still resolves to the document list
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` row 037 is `DONE`

## STOP conditions

- The 409 test cannot be built and a mock would not pass through `restoreDocs`'s `db.put`. STOP.
- InvoicesMW undo of a normal invoice starts failing with `partial-restore` on a clean database. Revert and STOP. Do not swallow 409 again.
- A verification fails twice after a real fix attempt.

## Maintenance notes

Callers of `restoreDocs` must handle `partial-restore`. The undo toast should not say the invoice came back when `failed` is non-empty. If the middleware catch already shows `err.message`, the string `partial-restore` is what the user sees. A clearer undo string is out of scope.
