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

- **State**: DONE
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

- [x] Result contains the five parts
- [x] `buildInvoicesCsv` is specified as unchanged
- [x] No application file is modified
- [ ] README row 051 is `DONE`

## STOP conditions

- You edit `csv.js`. Revert it.
- The spec adds estimate amounts into the invoice file. Rewrite it.
- `taxBreakdown` does not exist on the totals object. Quote `getInvoiceTotals`'s return and STOP. Do not invent the field.

## Result

Drift: `app/helpers/csv.js` is unchanged since `10f3f0e`.

The search matched `salesDocRows` and `amount_paid`. `salesDocRows` drops tombstones and keeps `isInvoice` or `isCreditNote` only. Estimates stay out of `buildInvoicesCsv`. The premise holds. The invoice header stays `number,client,issued,due,status,currency,subtotal,tax,discount,total,amount_paid,balance_due,docType,creditedInvoice`.

`getInvoiceTotals` returns `mode`, `subtotal`, `discount`, `taxTotal`, `grandTotal`, and `taxBreakdown`. Each `taxBreakdown` entry has `category`, `rate`, `base`, and `amount`. Line mode sets `mode` to `'line'` and one entry per category and rate. Invoice mode sets `mode` to `'invoice'`. When the document has invoice-level tax, `taxBreakdown` has one entry with `key: 'legacy'`, `category` `AE` for reverse charge or `S` otherwise, `rate` equal to `tax.amount`, and `amount` equal to the invoice-level tax. When there is no invoice-level tax, `taxBreakdown` is empty. Do not invent a rate for that case.

1. `buildEstimatesCsv(allSalesDocs, now)` uses the same columns. It lists estimates only. It does not add estimate totals to `buildInvoicesCsv`. Estimates have no payments and no due date. `amount_paid` is `0`. `balance_due` is empty. `due` is empty. `creditedInvoice` is empty. `docType` is `estimate`. Status comes from `getDisplayStatus`, which already handles estimates. Draft estimates stay in this file so the quote list is complete.

2. `buildTaxSummaryCsv(allSalesDocs, from, to)` groups issued invoices and issued credit notes by currency code, `taxBreakdown.category`, and `taxBreakdown.rate`. For `mode === 'line'`, use each `taxBreakdown` entry. For `mode === 'invoice'`, use that same array: the one legacy entry when it exists, and no tax row when it is empty. The amount column is `taxBreakdown.amount`. The rate column is `taxBreakdown.rate`. Do not read a rate from anywhere else.

3. The date filter uses `getIssuedAt`, which is epoch milliseconds. Compare local calendar days. `from` and `to` are inclusive. Do not fall back to `created_at`. A document with no issue date is excluded and counted. The build plan can show that count. Drafts are excluded. Void credit notes are excluded. Estimates are excluded from this file.

4. A credit note reduces the tax total for its currency, category, and rate. Add the negative of `taxBreakdown.amount`. Do not emit the credit note as a positive sale. Two currencies do not share a row. Two rates do not share a row.

5. Tests for the build plan, in `app/helpers/__tests__/csv.spec.js`:
   - An estimate row is absent from the invoice CSV and present in the estimates CSV.
   - Two rates produce two tax rows.
   - A credit note reduces one rate.
   - A draft is absent from the tax CSV.
   - Two currencies do not share a row.

`buildInvoicesCsv` is unchanged. A later build can send the new strings through the existing `csv-export` IPC with the default names `manta-estimates-YYYY-MM-DD.csv` and `manta-tax-YYYY-MM-DD.csv`. This spike does not add those functions.

## Maintenance notes

State: DONE. `plans/README.md` was not edited. The operator maintains that index.

The invoice CSV is a stable export. A new column there breaks spreadsheets people already import. New reports should be new functions and new default file names (`manta-estimates-YYYY-MM-DD.csv`, `manta-tax-YYYY-MM-DD.csv`).
