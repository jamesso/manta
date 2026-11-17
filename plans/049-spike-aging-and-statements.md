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

- [ ] Result contains the five parts
- [ ] No application file is modified
- [ ] README row 049 is `DONE`

## STOP conditions

- You add a component or a helper. Revert it.
- The spec adds two currencies into one total. Rewrite that paragraph.
- `getDueDate` returns a string you did not read. Read it and quote the unit (epoch ms versus `YYYY-MM-DD`) before writing bucket math.

## Maintenance notes

A build plan should live beside `summarizeClients` and should reuse `getBalanceDue`. A statement PDF must not go through the sales-invoice numbering counter.
