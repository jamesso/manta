# Plan 031: Characterization tests for estimate numbers, credit-note numbers, backup overwrite, and credit settlement

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/helpers/numbering.js app/helpers/backup.js app/helpers/backupFlow.js app/helpers/payments.js app/helpers/creditNoteSettlement.js app/helpers/recurringRunner.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none. Plans 032 and 038 should run after this plan.
- **Category**: tests
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Invoice numbers have tests. Estimate (`EST-`) and credit-note (`CN-`) counters do not. Backup import tests use `mode: 'skip'` only, so an overwrite that drops `_rev` would not fail CI. `reconcilePaymentStatus` is imported in the payments spec and never called. `settleCreditedInvoiceInDb` has no direct test. Later plans change credit writes and Pouch reloads. These tests describe today's behavior first. Do not change production code in this plan unless a new test proves a bug. If that happens, STOP.

## Current state

`app/helpers/numbering.js`:

```js
export function numberingKeyFor(docType) {
  if (docType === 'estimate') return 'estimateNumbering';
  if (docType === 'creditNote') return 'creditNoteNumbering';
  return 'numbering';
}
```

`DEFAULT_ESTIMATE_NUMBERING` uses prefix `EST-`. `DEFAULT_CREDIT_NOTE_NUMBERING` uses prefix `CN-`. `app/helpers/__tests__/numbering.spec.js` has describes for `normalizeNumbering`, `formatInvoiceNumber`, `advanceNumbering`, `assignNumberIfMissing`, and `reconcileNumberingWithPersistedInvoices`. It has no `estimateNumbering` string. `reconcileNumberingWithPersistedInvoices` skips estimate and credit-note docs. Assert that. Do not change that rule.

`app/helpers/backup.js`:

```js
export function planMerge(incomingDocs, existingDocs, mode) {
  // existing id + mode overwrite → toWrite item keeps existing._rev
  // existing id + other mode → counts.skipped, not toWrite
  // unknown id → counts.added, no _rev copy
}
```

`app/helpers/backupFlow.js` `runImport(backup, { mode, includeSettings }, { ipc, settingsStore, applySettings })` calls `planMerge` with `mode`. `app/helpers/__tests__/backupFlow.spec.js` calls `runImport` with `mode: 'skip'` only. It mocks `../pouchDB`.

`app/helpers/payments.js` `reconcilePaymentStatus(doc, now, creditNotes = [])` uses `resolveStatusAfterCredit` when linked credit notes exist. Otherwise it moves `pending`/`paid` from the balance.

`app/helpers/creditNoteSettlement.js` `settleCreditedInvoiceInDb(invoiceId)` loads all invoices, and calls `updateDocs` only when `resolveStatusAfterCredit` returns a different object.

`app/helpers/recurringRunner.js` `saveInvoiceDraft` saves one draft per period. Weekly and yearly schedules are tested in `app/helpers/__tests__/recurringSchedule.spec.js`, not through `runRecurringOnce`. Add one weekly `runRecurringOnce` test in `app/helpers/__tests__/recurringRunner.spec.js` using the memory database that file already uses. Read that spec before writing. Do not add a yearly test if the weekly one needs a new harness. One non-monthly interval is enough.

Commands: `npm test -- <file>`. No TypeScript.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Numbering | `npm test -- app/helpers/__tests__/numbering.spec.js` | exit 0 |
| Backup | `npm test -- app/helpers/__tests__/backup.spec.js app/helpers/__tests__/backupFlow.spec.js` | exit 0 |
| Payments and settlement | `npm test -- app/helpers/__tests__/payments.spec.js app/helpers/__tests__/creditNoteSettlement.spec.js` | exit 0 |
| Recurring runner | `npm test -- app/helpers/__tests__/recurringRunner.spec.js` | exit 0 |

## Scope

**In scope** (tests only):

- `app/helpers/__tests__/numbering.spec.js`
- `app/helpers/__tests__/backup.spec.js` or `backupFlow.spec.js` (overwrite case)
- `app/helpers/__tests__/payments.spec.js`
- `app/helpers/__tests__/creditNoteSettlement.spec.js` (create)
- `app/helpers/__tests__/recurringRunner.spec.js` (one weekly case)

**Out of scope**:

- Production helpers. If a test fails on current code, STOP.
- `main/backup.js` IPC tests. Plan 029 covers sender checks. This plan covers merge and import mode.
- DOM tests, snapshots, and e2e.

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Test estimate numbers and backup overwrite`.
- Do not push. No AI attribution.

## Steps

### Step 1: Numbering

Add tests:

- `numberingKeyFor('estimate')` is `estimateNumbering`. `numberingKeyFor('creditNote')` is `creditNoteNumbering`. `numberingKeyFor('invoice')` and `numberingKeyFor(undefined)` are `numbering`.
- `defaultNumberingFor('estimate')` has prefix `EST-`. Credit notes use `CN-`.
- `assignNumberIfMissing` on an estimate without a number uses the estimate counter, and does not read `invoice.numbering` as the prefix. Read `assignNumberIfMissing` and pass the settings object it already accepts. If it only accepts the invoice numbering object, test `numberingKeyFor` plus `formatInvoiceNumber` with `DEFAULT_ESTIMATE_NUMBERING` instead. Do not change `assignNumberIfMissing`.
- `reconcileNumberingWithPersistedInvoices` ignores an estimate whose number is above the invoice counter. Read the function first and assert the current return value.

**Verify**: `npm test -- app/helpers/__tests__/numbering.spec.js` → exit 0.

### Step 2: Backup overwrite keeps `_rev`

Add a `planMerge` test:

- Existing `{ _id: 'a', _rev: '1-abc', name: 'old' }` and incoming `{ _id: 'a', name: 'new' }` with mode `overwrite` writes `{ _id: 'a', name: 'new', _rev: '1-abc' }` and `counts.overwritten === 1`.
- The same pair with mode `skip` writes nothing and `counts.skipped === 1`.
- Incoming `{ _id: 'b', name: 'new' }` with mode `overwrite` is `counts.added === 1` and the written doc has no `_rev`.

Add one `runImport` test with `mode: 'overwrite'` using the existing pouch mock. Assert `bulkSaveDocs` receives the existing `_rev` on the overlapping id. Follow the mock style in `backupFlow.spec.js`.

**Verify**: `npm test -- app/helpers/__tests__/backup.spec.js app/helpers/__tests__/backupFlow.spec.js` → exit 0.

### Step 3: Payment reconcile and credit settlement

In `payments.spec.js`, call `reconcilePaymentStatus` (it is already imported):

- `pending` invoice, payments that cover the total, no credit notes → status `paid`.
- `paid` invoice whose payments do not cover the total → status `pending`.
- `pending` invoice with an issued credit note that covers the balance → the status `resolveStatusAfterCredit` already returns. Read that helper's tests in `creditNotes.spec.js` and reuse a fixture shape. Do not re-test the credit math table.

Create `creditNoteSettlement.spec.js`. Mock `./pouchDB` `getAllDocs` and `updateDocs`. Cases:

- No matching invoice: `updateDocs` is not called, and the function returns the loaded list.
- Invoice whose resolved status differs: `updateDocs` is called with that one invoice, then `getAllDocs` runs again.
- Resolved document is the same object: `updateDocs` is not called.

**Verify**: `npm test -- app/helpers/__tests__/payments.spec.js app/helpers/__tests__/creditNoteSettlement.spec.js` → exit 0.

### Step 4: One weekly runner case

Read `recurringRunner.spec.js` and copy its in-memory db. Add one test: a weekly profile whose next date is due creates one draft, the draft `_id` contains the profile id and the period key, and a second `runRecurringOnce` does not create another draft for that period.

**Verify**: `npm test -- app/helpers/__tests__/recurringRunner.spec.js` → exit 0.

## Test plan

- Cases listed in the steps. No markup tests.
- Patterns: the spec file you are editing, and `backupFlow.spec.js` for mocks.

## Done criteria

- [ ] All four test commands exit 0
- [ ] `rg -n "estimateNumbering" app/helpers/__tests__/numbering.spec.js` prints a match
- [ ] `rg -n "overwrite" app/helpers/__tests__/backupFlow.spec.js` prints a match
- [ ] `rg -n "reconcilePaymentStatus\\(" app/helpers/__tests__/payments.spec.js` shows a call, not only an import
- [ ] No production file is modified
- [ ] `plans/README.md` row 031 is `DONE`

## STOP conditions

- A new test fails on unchanged production code. Report the assertion and the actual value. Do not "fix" the helper in this plan.
- `assignNumberIfMissing` or `runRecurringOnce` has a different signature than the tests can call without a new harness. Shrink the case as step 1 and step 4 allow. If even the smaller case cannot run, STOP.
- You need to change `planMerge` to make the overwrite test pass. STOP.

## Maintenance notes

Plan 032 (credit-note write) and plan 038 (Pouch reload) assume these tests exist. If they fail after those plans, the behavior change is in those plans, not here.
