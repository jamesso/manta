# Plan 032: An issued or voided credit note and its invoice commit together

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/middlewares/InvoicesMW.jsx app/helpers/creditNoteSettlement.js app/helpers/pouchDB.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/030-return-middleware-test-promises.md and plans/031-numbering-backup-settlement-tests.md
- **Category**: bug
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Issuing a credit note writes `status: 'issued'` first. Voiding writes `status: 'void'` first. The linked invoice is updated in a second `updateDocs` inside `handleSyncCreditedInvoice`. If that second write fails, the user sees the toast `invoices:creditNotes:errors:updateFailed`, and the note stays issued or void while the invoice keeps its old status. Balances and badges then disagree. PouchDB cannot wrap two documents in a real transaction. This plan still puts both documents in one `updateDocs` call and, on a partial failure, restores the note to the status it had before the call.

## Current state

`app/middlewares/InvoicesMW.jsx` issue path (about lines 1388–1396):

```js
await updateDocs('invoices', [{ ...cn, status: 'issued' }]);
const afterNote = await getAllDocs('invoices');
publishInvoiceDocs(next, afterNote);
syncEditMode(dispatch, getState, afterNote, id);
try {
  await handleSyncCreditedInvoice(cn.creditedInvoiceId, ctx);
} catch {
  /* note stays issued in store */
}
```

The void path (about lines 1444–1454) does the same with `status: 'void'` and `voidedAt`.

`handleSyncCreditedInvoice` (lines 150–178) loads all invoices, computes `resolveStatusAfterCredit`, and on `updateDocs` failure toasts `updateFailed` and rethrows.

`updateDocs` in `app/helpers/pouchDB.js` puts documents one by one. If one `put` fails it throws `Error('partial-update')` with `succeeded`, `failed`, and `docs`.

`app/helpers/creditNoteSettlement.js` `settleCreditedInvoiceInDb` is the form-save path (`FormMW.jsx` imports it). It still updates the invoice alone, because the note was already saved. Do not change FormMW in this plan. Do not change `resolveStatusAfterCredit`.

`publishInvoiceDocs` and `syncEditMode` are local functions in `InvoicesMW.jsx`. Keep using them after a successful pair write.

Tests live in `app/middlewares/__tests__/InvoicesMW.spec.js`. Search for `CREDIT_NOTE` before adding a case. Follow the existing mock of `updateDocs` / `getAllDocs`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Middleware tests | `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` | exit 0 |
| Settlement tests | `npm test -- app/helpers/__tests__/creditNoteSettlement.spec.js` | exit 0 |
| Lint | `npx eslint app/middlewares/InvoicesMW.jsx app/middlewares/__tests__/InvoicesMW.spec.js` | exit 0 |

## Scope

**In scope**:

- `app/middlewares/InvoicesMW.jsx` (credit issue and void only)
- `app/middlewares/__tests__/InvoicesMW.spec.js`

**Out of scope**:

- `resolveStatusAfterCredit` and credit total math
- `FormMW.jsx` and `settleCreditedInvoiceInDb`, except reading them so you do not fork a second status algorithm
- Status badges (plan 033)
- Recurring deletes (plan 034)
- Payment error codes (plan 035)

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Commit credit notes with the linked invoice`.
- Do not push. No AI attribution.
- Do not run against the real Manta profile.

## Steps

### Step 1: Add a failing middleware test

Add two tests, or one table with two rows, around the existing credit-note describe:

1. Issue: `updateDocs` is called once with both the note (`status: 'issued'`) and the updated invoice. `getAllDocs` after that call includes both. The success path does not need a second `updateDocs`.
2. Partial failure: the first `updateDocs` throws `partial-update` after the note id is in `succeeded` and the invoice id is in `failed`. The code calls `updateDocs` again with the note's previous status. The toast action or `UI_NOTIFICATION_NEW` uses `invoices:creditNotes:errors:updateFailed`. The published list comes from `getAllDocs` after the restore, not from the pre-failure issued note alone.

Read the existing credit-note tests so the action types match `ACTION_TYPES` (`CREDIT_NOTE_ISSUE` and `CREDIT_NOTE_VOID`, or whatever the file already dispatches). Use those constants. Do not invent a new action type.

**Verify**: `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` → the new tests fail, and older credit-note tests still pass. If older tests fail, STOP. The file may already expect two writes.

### Step 2: One write, then compensate

For issue and for void:

- Load the note and the invoice, and run the same validation the handler already runs (`validateCreditTotal` on issue). Keep those toasts.
- Compute the next invoice with `resolveStatusAfterCredit` as if the note already had the new status. Do this in memory. Do not write the note first.
- Call `updateDocs('invoices', [nextNote, nextInvoice])` once. If the invoice does not change, still write the note alone.
- On success, `publishInvoiceDocs` and `syncEditMode` with a fresh `getAllDocs`.
- On `partial-update`, if the note id succeeded and the invoice id failed, `updateDocs` the original note (the object you had before the status change, including its `_rev` if the failed batch advanced the note's rev — use the rev from the error's `docs` when present). Then toast `updateFailed` and publish the list from `getAllDocs`.
- If the compensating write also fails, toast `updateFailed` and publish `getAllDocs`. Do not loop.

You may delete the inner try/catch that swallows `handleSyncCreditedInvoice` on these two paths if nothing else in those branches calls it. Keep `handleSyncCreditedInvoice` for `CREDIT_NOTE_SYNC_INVOICE` and for the already-issued early return that only syncs.

**Verify**: `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js app/helpers/__tests__/creditNoteSettlement.spec.js` → exit 0.

### Step 3: Lint

**Verify**: `npx eslint app/middlewares/InvoicesMW.jsx app/middlewares/__tests__/InvoicesMW.spec.js` → exit 0.

## Test plan

- The two cases in step 1, plus the existing credit-note tests in `InvoicesMW.spec.js`.
- Do not add DOM tests.

## Done criteria

- [ ] The middleware test command exits 0
- [ ] Issue and void each call `updateDocs` with the note and the invoice together when the invoice changes
- [ ] A partial failure restores the note or, if restore fails, still surfaces `updateFailed` and reloads the list
- [ ] `CREDIT_NOTE_SYNC_INVOICE` still calls `handleSyncCreditedInvoice`
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` row 032 is `DONE`

## STOP conditions

- The issue path no longer uses `updateDocs` then `handleSyncCreditedInvoice`. Report the new sequence. Do not add a third writer.
- `updateDocs` does not throw `partial-update` with `succeeded` and `failed`. STOP and report the shape.
- The compensating write needs a new PouchDB API. STOP. Do not add a dependency.
- Validation toasts for `validateCreditTotal` would have to change to make the happy path pass. STOP.

## Maintenance notes

Form save can still mark `creditSyncFailed` through `settleCreditedInvoiceInDb`. That path is a separate edit of an already stored note. Do not "unify" it here. Reviewers should check that a failed issue does not leave `status: 'issued'` when the invoice put did not happen.
