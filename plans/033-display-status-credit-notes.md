# Plan 033: Status badges pass linked credit notes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/components/dashboard/RecentInvoices.jsx app/components/contacts/ClientDetailSheet.jsx app/components/recurring/RecurringDetailSheet.jsx app/helpers/invoice.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. Plan 032 changes when the stored status updates. This plan only affects the `pending` versus `partial` badge.
- **Category**: bug
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

`getDisplayStatus` uses credit notes only when the stored status is `pending`, some cash is paid, and the balance is still above zero. It then returns `partial`. Three screens call it without credit notes, so they ignore credits and can show `partial` when the balance with credits is zero (the badge should stay `pending`). The invoice list and the dashboard already pass linked notes. This plan makes the three screens do the same. It does not change overdue rules. Overdue is returned before the credit balance is read.

## Current state

`app/helpers/invoice.js`:

```js
function getDisplayStatus(invoice, now = Date.now(), creditNotes = []) {
  const s = getStoredStatus(invoice);
  if (s !== 'pending') return s;
  const due = getDueDate(invoice);
  if (due !== null && due < moment(now).startOf('day').valueOf()) {
    return 'overdue';
  }
  if (getAmountPaid(invoice) > 0 && getBalanceDue(invoice, creditNotes) > 0) {
    return 'partial';
  }
  return 'pending';
}
```

Call sites that omit the third argument:

- `app/components/dashboard/RecentInvoices.jsx:58` — `getDisplayStatus(inv, now)`
- `app/components/contacts/ClientDetailSheet.jsx:137` — `getDisplayStatus(invoice, now)`
- `app/components/recurring/RecurringDetailSheet.jsx:199` — `getDisplayStatus(invoice, now)`

Call sites that already pass notes (do not restyle them): `app/helpers/invoiceList.js`, `app/helpers/dashboard.js`, `app/components/invoices/InvoiceDetailSheet.jsx`, `app/helpers/clients.js`.

`app/helpers/emailDraft.js` `canSendReminder` passes `allSalesDocs` but only compares the result to `'overdue'`. Overdue does not read credit notes. Leave that file alone.

`groupCreditNotesByInvoice` is the helper the invoice list uses. Search for its export and use it. Do not filter credit notes inline in each component if that helper exists.

There is no component-markup test for these badges. Add a helper test if one does not already cover "payments plus a covering credit note stays `pending`". `app/helpers/__tests__/invoice.spec.js` already tests `getDisplayStatus`. Extend that file.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Status tests | `npm test -- app/helpers/__tests__/invoice.spec.js` | exit 0 |
| Lint | `npx eslint app/components/dashboard/RecentInvoices.jsx app/components/contacts/ClientDetailSheet.jsx app/components/recurring/RecurringDetailSheet.jsx app/helpers/__tests__/invoice.spec.js` | exit 0 |

## Scope

**In scope**:

- The three components listed above
- `app/helpers/__tests__/invoice.spec.js` if the covering-credit case is missing

**Out of scope**:

- `getDisplayStatus` overdue ordering
- `InvoicesMW.jsx`
- Email reminder eligibility
- New badge components or CSS

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Pass credit notes into status badges`.
- Do not push. No AI attribution.

## Steps

### Step 1: Lock the helper behavior

In `invoice.spec.js`, add this case if it is not there: a `pending` invoice with `getAmountPaid > 0`, a due date in the future, and one issued credit note that makes `getBalanceDue` zero. `getDisplayStatus(invoice, now, [creditNote])` is `pending`. `getDisplayStatus(invoice, now)` is `partial`.

Use field names from a neighboring test (`payments`, `grandTotal`, credit note `creditedInvoiceId` and `status`). Read `getBalanceDue` before choosing amounts.

**Verify**: `npm test -- app/helpers/__tests__/invoice.spec.js` → exit 0.

### Step 2: Pass linked notes

In each of the three components, get the sales documents the screen already has, or select them the way a sibling component does. Call `groupCreditNotesByInvoice` once per render, not once per row inside a new loop over all docs per row. Pass `linked` into `getDisplayStatus(invoice, now, linked)`.

If a component does not have the credit notes in its props and there is no existing selector, use the same `useSelector` the invoice list uses. Read `app/containers/Invoices.jsx` for that selector. Do not fetch from PouchDB in the component.

**Verify**: `npx eslint` on the three components exits 0. `rg -n "getDisplayStatus\\([^\\n]+\\)" app/components/dashboard/RecentInvoices.jsx app/components/contacts/ClientDetailSheet.jsx app/components/recurring/RecurringDetailSheet.jsx` shows a third argument on each call.

### Step 3: Re-run the helper test

**Verify**: `npm test -- app/helpers/__tests__/invoice.spec.js` → exit 0.

## Test plan

- One helper case, described in step 1. Do not add a DOM test for the three components.
- Pattern: existing `getDisplayStatus` tests in `invoice.spec.js`.

## Done criteria

- [ ] `invoice.spec.js` exits 0 and includes the covering-credit case
- [ ] Each of the three call sites passes linked credit notes
- [ ] `emailDraft.js` is unchanged
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` row 033 is `DONE`

## STOP conditions

- `getDisplayStatus` uses credit notes for overdue or for a stored status other than `pending`. Report that. Do not change the helper.
- A component has no access to sales docs and wiring it requires a new reducer. STOP.
- The new helper case fails because `getBalanceDue` ignores the fixture's credit notes. Fix the fixture. If the fixture matches `creditNotes.spec.js` and the balance is still wrong, STOP.

## Maintenance notes

Any new list of invoices that shows `partial` must pass linked credit notes. Stored status `paid` does not consult this argument.
