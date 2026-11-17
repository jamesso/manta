# Plan 035: Payment failures say the write failed, not that the invoice is missing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/middlewares/InvoicesMW.jsx app/helpers/pouchDB.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/034-recurring-delete-tombstone.md. That plan also edits `InvoicesMW.jsx`.
- **Category**: bug
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

`queuedInvoiceWrite` loads the invoice and then writes a payment or status change. The inner `updateDocs` catch already returns `error: 'writeFailed'`. The outer catch turns every other rejection into `error: 'notFound'`. A missing document and a database error look the same, so the UI tells the user to look for an invoice that is still there. The user retries a write that never had a chance to succeed.

## Current state

`app/middlewares/InvoicesMW.jsx` (about lines 272–322):

```js
function queuedInvoiceWrite(invoiceId, mutate) {
  return runPaymentQueued(invoiceId, () =>
    Promise.all([getSingleDoc('invoices', invoiceId), getAllDocs('invoices')])
      .then(([doc, allDocs]) => {
        if (!doc) {
          return { id: invoiceId, ok: false, committed: false, error: 'notFound' };
        }
        // mutate, then updateDocs ...
        // updateDocs catch returns error: 'writeFailed'
      })
      .catch(() => ({
        id: invoiceId,
        ok: false,
        committed: false,
        error: 'notFound',
      }))
  );
}
```

`getSingleDoc` rejects when PouchDB `get` fails, including a missing id (`err.status === 404`). It does not resolve `null` today. The `if (!doc)` branch is therefore not the 404 path. The outer catch is the 404 path and the database-error path.

`paymentErrorMessage` maps `error` through `invoices:payments:errors:<key>`. Check `i18n/en/invoices.json` for `notFound` and `writeFailed` before adding a key. Add `loadFailed` only in `i18n/en/invoices.json` if that file already has a `payments.errors` object. Other locales fall back to English.

Do not change `mutate` results that already return `error: 'notFound'` for a missing in-memory doc.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Middleware tests | `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` | exit 0 |
| Lint | `npx eslint app/middlewares/InvoicesMW.jsx app/middlewares/__tests__/InvoicesMW.spec.js` | exit 0 |

## Scope

**In scope**:

- `app/middlewares/InvoicesMW.jsx` (`queuedInvoiceWrite` only)
- `app/middlewares/__tests__/InvoicesMW.spec.js`
- `i18n/en/invoices.json` only if a new error key has no English string

**Out of scope**:

- Credit-note writes, recurring deletes, and the unsaved-changes dialog
- `getSingleDoc` itself. Leave its reject-on-404 behavior.
- Translating the new string into other locales

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Distinguish missing invoices from payment write failures`.
- Do not push. No AI attribution.

## Steps

### Step 1: Add two tests

Find the payment describe in `InvoicesMW.spec.js`. Add:

1. `getSingleDoc` rejects with `{ status: 404 }`. The queued result is `error: 'notFound'` and `committed: false`.
2. `getAllDocs` rejects with `{ status: 500, message: 'disk' }`, or `getSingleDoc` rejects with `{ status: 500 }`. The result is `error: 'loadFailed'`, not `notFound`.
3. If a test already covers `updateDocs` rejection, keep it expecting `writeFailed`. If none exists, add one: `updateDocs` rejects and the result is `writeFailed`.

**Verify**: `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` → the new 500 case fails. The 404 case passes on current code. If the 404 case fails, STOP. The status field is not `404`.

### Step 2: Split the catch

In the outer `.catch(err => ...)`:

- If `err.status === 404`, return `error: 'notFound'`.
- Otherwise return `error: 'loadFailed'`. Include `message: err.message` on the result object if the toast path can show it without a new channel. Read the caller that switches on `result.error`. If it only translates known keys, add `loadFailed` next to `writeFailed` in `i18n/en/invoices.json` under the existing payments errors object. Do not put the raw `err.message` in the toast if the caller only uses the i18n key.

Do not map `writeFailed` in this outer catch. That path already returns inside the `updateDocs` catch.

**Verify**: `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` → exit 0.

### Step 3: Lint

**Verify**: `npx eslint app/middlewares/InvoicesMW.jsx app/middlewares/__tests__/InvoicesMW.spec.js` → exit 0.

## Test plan

- 404 → `notFound`
- non-404 read rejection → `loadFailed`
- `updateDocs` rejection → `writeFailed` (existing or new)
- Pattern: the payment tests already in `InvoicesMW.spec.js`

## Done criteria

- [ ] The middleware test command exits 0
- [ ] A 500 from `getSingleDoc` or `getAllDocs` is not `notFound`
- [ ] A 404 is still `notFound`
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` row 035 is `DONE`

## STOP conditions

- PouchDB does not set `status` on a missing doc in this code path. Report the error object from the test. Do not guess another property.
- The toast maps unknown keys to raw English from the key name and there is no `payments.errors` object to extend. STOP and report the call site.
- A verification fails twice after a real fix attempt.

## Maintenance notes

New errors thrown inside `mutate` before it returns `{ ok: false }` hit this catch. `mutate` should keep returning result objects for validation failures (`overpayment` and similar). Those must not become `loadFailed`.
