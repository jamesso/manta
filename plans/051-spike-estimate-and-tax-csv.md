# Plan 051: Spike an estimates CSV and a tax-by-rate CSV

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/helpers/csv.js`
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

The invoice CSV is the spreadsheet export. It includes invoices and credit notes and drops estimates on purpose, so quote amounts do not look like revenue. The tax column is one number. Per-rate tax already exists on `getInvoiceTotals(...).taxBreakdown` for line-mode documents. Accountants ask for both a quote list and a tax split. This spike defines two extra exports. It does not change the invoice CSV.

## Current state

`app/helpers/csv.js`:

```js
function salesDocRows(allSalesDocs) {
  return allSalesDocs.filter(d => {
    if (d?.recurringTombstone) return false;
    return isInvoice(d) || isCreditNote(d);
  });
}

export function buildInvoicesCsv(allSalesDocs, now) { /* ... */ }
```

The header is `number,client,issued,due,status,currency,subtotal,tax,discount,total,amount_paid,balance_due,docType,creditedInvoice`. One `tax` column.

`buildInvoicesCsv` is what `exportCsv` in `app/helpers/backupFlow.js` sends through `csv-export` IPC. A second export can use that same IPC with a different string and a different default file name. Do not change the invoice header.

Estimates are excluded by decision (plan 022). The spike must keep that exclusion in `buildInvoicesCsv`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Header | `rg -n "salesDocRows|amount_paid" app/helpers/csv.js` | both match |

## Scope

**In scope**:

- This plan file, Result section
- Reading `app/helpers/csv.js` and `getInvoiceTotals` in `app/helpers/invoice.js`

**Out of scope**:

- Editing `csv.js`, settings UI, and IPC
- Adding estimates into `buildInvoicesCsv`
- A tax filing integration

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks.
- Do not push. No AI attribution.

## Steps

### Step 1: Confirm the invoice CSV shape

**Verify**: the `rg` command matches, and `salesDocRows` still excludes estimates. If estimates are already included, STOP. The premise changed.

### Step 2: Write the spec in Result

Include:

1. `buildEstimatesCsv(allSalesDocs, now)` uses the same columns as the invoice CSV where they apply. Estimates have no payments. Those columns stay empty or `0`. State which. Do not put estimate totals in `buildInvoicesCsv`.
2. `buildTaxSummaryCsv(allSalesDocs, from, to)` groups issued invoices and credit notes by currency and by tax rate or category using `taxBreakdown` when `mode === 'line'`. For invoice-mode documents, use the single invoice-level tax the totals helper already returns. Quote the field names you read. Do not invent a rate.
3. Date filter uses the issue date, local, inclusive. Documents with no issue date are excluded and counted in a note the build plan can show. Drafts are excluded.
4. Credit notes reduce the tax total for that rate. Say so. Do not emit them as positive sales.
5. Test cases for the build plan: estimate row absent from the invoice CSV and present in the estimates CSV. Two rates produce two rows. A credit note reduces one rate. A draft is absent. Two currencies do not share a row.

**Verify**: Result contains those five parts. `app/helpers/csv.js` is unchanged (`git diff -- app/helpers/csv.js` is empty).

## Test plan

- None in this spike.
- The Result lists the cases in item 5. The build plan should add them to `app/helpers/__tests__/csv.spec.js` if that file exists, or create it next to `csv.js`.

## Done criteria

- [ ] Result contains the five parts
- [ ] `buildInvoicesCsv` is specified as unchanged
- [ ] No application file is modified
- [ ] README row 051 is `DONE`

## STOP conditions

- You edit `csv.js`. Revert it.
- The spec adds estimate amounts into the invoice file. Rewrite it.
- `taxBreakdown` does not exist on the totals object. Quote `getInvoiceTotals`'s return and STOP. Do not invent the field.

## Maintenance notes

The invoice CSV is a stable export. A new column there breaks spreadsheets people already import. New reports should be new functions and new default file names (`manta-estimates-YYYY-MM-DD.csv`, `manta-tax-YYYY-MM-DD.csv`).
