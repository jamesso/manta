# Plan 049: Spike aging buckets and a client statement

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/helpers/clients.js app/helpers/dashboard.js app/helpers/invoice.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **State**: DONE
- **Priority**: P3
- **Effort**: S for the spike. A later build is about M.
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Plan 017 deferred an aging report and per-client revenue. The dashboard now has outstanding and overdue totals. The client sheet lists invoices and can start a new invoice. It does not produce a statement. The data for 30/60/90 buckets is already on each invoice through `getDueDate`, `getBalanceDue`, and `getDisplayStatus`. This spike specifies the report. It does not add the screen.

## Current state

`app/helpers/clients.js` `summarizeClients(contacts, allSalesDocs, now)` builds per contact `invoiceCount`, `outstanding` keyed by currency, and an invoice list. It uses `groupCreditNotesByInvoice` and `onlyInvoices`. Outstanding is split by currency. A statement must not add euros to dollars.

`app/helpers/dashboard.js` `getMonthlyPaid(invoices, now, months = 6, fallbackCurrency)` uses a six-month window. Plan 017 line 461 also deferred a chart period picker. You may note that as a separate small follow-up. Do not design the chart in this spike.

`getBalanceDue(invoice, creditNotes)` and `getDueDate` live in `app/helpers/invoice.js`. Use those names in the spec. Do not invent a second balance function.

`partial` is a display status, not a stored status. Aging should use balance due, not the word `partial`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Helpers exist | `rg -n "export function summarizeClients|function getMonthlyPaid|function getBalanceDue" app/helpers` | all three match |

## Scope

**In scope**:

- This plan file, Result section
- Reading the helpers above

**Out of scope**:

- New components, PDF templates, and CSV files
- Changing dashboard math
- Multi-currency conversion

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks.
- Do not push. No AI attribution.

## Steps

### Step 1: Confirm the helpers

**Verify**: the `rg` command matches. If `summarizeClients` no longer returns per-currency outstanding, STOP and quote the return value.

### Step 2: Write the spec in Result

Include:

1. Bucket rules in local days, using `getDueDate` and a balance from `getBalanceDue` with linked credit notes. Propose current, 1–30, 31–60, 61–90, and 90+ past due. Not yet due is current. State that a missing due date is its own bucket, not 90+.
2. One table per currency. No FX sum.
3. Statement contents for one contact: their outstanding documents, bucket, and a total per currency. Reuse the invoice PDF only if you can say which template function already renders one invoice. Otherwise the statement is a new export and the build plan must say so. Do not start that export here.
4. What is excluded: estimates, draft invoices, tombstones, and void credit notes. Read `onlyInvoices` and the credit-note status helper before you exclude credit notes that reduce the balance. Credit notes that affect `getBalanceDue` must stay in the balance even if they are not rows.
5. A suggested pure function name, `agingByCurrency(contacts, salesDocs, now)`, next to `summarizeClients`, and the test cases a build plan should add. Do not add the function in this spike.

**Verify**: Result contains those five parts. `git status` shows no application source change.

## Test plan

- None in this spike.
- The Result must list the test cases so a build plan can copy them. Minimum: not-yet-due, 45 days past due, missing due date, two currencies, and a credit note that reduces the balance.

## Done criteria

- [x] Result contains the five parts
- [x] No application file is modified
- [ ] README row 049 is `DONE`

## STOP conditions

- You add a component or a helper. Revert it.
- The spec adds two currencies into one total. Rewrite that paragraph.
- `getDueDate` returns a string you did not read. Read it and quote the unit (epoch ms versus `YYYY-MM-DD`) before writing bucket math.

## Result

Drift: plan 044 moved some invoice helpers out of `app/helpers/invoice.js`. `summarizeClients` and `getMonthlyPaid` did not change. `getBalanceDue` is still defined in `app/helpers/invoice.js`. `getDueDate` is still exported from that file. Its body is in `helpers/invoiceTotals.js`. The return value is unchanged. `summarizeClients` still returns `outstanding` as an object keyed by currency code. This is not a mismatch, so the spike continues.

`getDueDate` returns epoch milliseconds or `null`. A custom date uses `moment(dueDate.selectedDate).valueOf()`. A term date uses `calTermDate`, which returns `Date#getTime()`. It does not return a `YYYY-MM-DD` string.

The helper search matched `summarizeClients`, `getMonthlyPaid`, and `getBalanceDue`.

1. Bucket rules. Call `getDueDate(invoice)`. Call `getBalanceDue(invoice, linkedCreditNotes)` with the notes from `groupCreditNotesByInvoice`. Put a document in a bucket only when that balance is greater than 0. Count local calendar days with `moment(due).startOf('day')` and `moment(now).startOf('day')`, the same day boundary `getDisplayStatus` uses. Let `past` be today minus the due day.
   - `getDueDate` is `null`: bucket `missing`. Do not use `90+`.
   - `past` is 0 or less, including due today: `current`. Not yet due is current.
   - `past` 1–30: `1-30`.
   - `past` 31–60: `31-60`.
   - `past` 61–90: `61-90`.
   - `past` 91 or more: `90+`.
   The bucket uses the balance and the due date. It does not use the display word `partial`. A partial invoice is included because its balance is greater than 0.

2. One table per currency code. Use the same key as `summarizeClients`: `invoice.currency?.code ?? 'USD'`. Do not add one currency to another. There is no FX sum.

3. A statement for one contact lists that contact's open invoices, the bucket for each, and a total per currency. The sales-invoice preview renders one invoice. It has no function that renders a statement. The statement is a new export. The build plan must say that. This spike does not start that export.

4. Exclusions. `onlyInvoices` keeps documents whose `docType` is `invoice` (a missing `docType` means invoice) and drops `recurringTombstone`. Estimates are not in that list. Drop draft invoices as well. `summarizeClients` adds outstanding only for display status `pending`, `partial`, or `overdue`, so the aging rows use that same open set. That drops draft, paid, cancelled, and refunded invoices. Issued credit notes are not rows. `getBalanceDue` already subtracts issued credit notes that match the invoice id and currency. Those notes stay in the balance. A void credit note is not `issued`, so it does not reduce the balance, and it is not a row. A draft credit note does not reduce the balance either.

5. Add `agingByCurrency(contacts, salesDocs, now)` next to `summarizeClients` in `app/helpers/clients.js`. Do not add it in this spike. It should return, per contact and per currency, the open invoices, their buckets, and the bucket sums. The build plan should add these tests:
   - Not yet due: the amount is `getBalanceDue`, and the bucket is `current`.
   - 45 days past due: the bucket is `31-60`.
   - A missing due date: the bucket is `missing`, not `90+`.
   - Two currencies: two groups, and the totals are not added together.
   - An issued credit note reduces the invoice balance and is not its own row.
   - A draft invoice, an estimate, and a tombstone are absent.
   - A void credit note does not change the balance.

`getMonthlyPaid` still uses a six-month window. A chart period picker remains a separate small follow-up. This spike does not design that chart.

## Maintenance notes

State: DONE. `plans/README.md` was not edited. The operator maintains that index.

A build plan should live beside `summarizeClients` and should reuse `getBalanceDue`. A statement PDF must not go through the sales-invoice numbering counter.
