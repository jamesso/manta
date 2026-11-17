# Plan 046: Find out whether legacy PDF totals are one number or two

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- preview/templates/minimal/components/Main.jsx preview/templates/business/components/Main.jsx app/helpers/invoice.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Invoice-mode PDFs print the stored `invoice.subtotal` and `invoice.grandTotal`, and they print tax and discount from `getInvoiceTotals`. If those stored numbers drift from the rows, the tax line and the total on the same PDF disagree. Line mode already prints `totals.subtotal` and `totals.grandTotal`. E-invoice export already flags a stored-versus-computed mismatch. This plan checks whether a normal save can create that drift. If it cannot, do not change the templates. The stored total may be what old invoices must print.

This is an investigation. A template edit is allowed only when a test shows one render mixing the two sources for a document the app itself saved.

## Current state

`preview/templates/minimal/components/Main.jsx` (business `Main.jsx` has the same split):

```js
formatNumber(
  totals.mode === 'line' ? totals.subtotal : invoice.subtotal,
  fraction,
  separator
)
// tax and discount rows use totals.taxTotal and totals.discount
formatNumber(
  totals.mode === 'line' ? totals.grandTotal : invoice.grandTotal,
  fraction,
  separator
)
```

`getInvoiceTotals` sets `mode` to `'line'` or `'invoice'`. Read that function in `app/helpers/invoice.js` before judging. `getInvoiceTotal` returns `invoice.grandTotal` when it is a finite number.

Do not change line-mode rendering. Do not regenerate PDF baselines (`scripts/pdf-snapshot.mjs`) unless you change a template and the compare script reports a difference. A template change that is not an intentional total fix is a STOP.

There is no browser requirement for this plan. A node unit test that calls `getInvoiceTotals` and compares fields is enough. Do not add a DOM snapshot of the template.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Invoice tests | `npm test -- app/helpers/__tests__/invoice.spec.js app/helpers/__tests__/totals.spec.js` | exit 0 |

Use the totals spec path that exists. `rg -n "getInvoiceTotals" app/helpers/__tests__` will find it. `app/helpers/__tests__/invoice.spec.js` exists.

## Scope

**In scope**:

- Read the two `Main.jsx` files and `getInvoiceTotals`
- A test in an existing totals spec if you change the template
- The two `Main.jsx` files only if the test proves a mixed total on a saved document
- A Result section in this plan file

**Out of scope**:

- Line-mode math
- E-invoice XML
- Styled-component markup, fonts, and colors
- "Always print computed totals" as a cleanup with no failing case

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks.
- Do not push. No AI attribution.
- You may append a Result section to this plan file.

## Steps

### Step 1: Trace a save

Find the function that writes `subtotal` and `grandTotal` on save (`getInvoiceData` in `app/helpers/form.js` is the likely place). Quote whether those fields are assigned from `getInvoiceTotals` in invoice mode.

Answer in the Result section:

- Can invoice mode store a `grandTotal` that is not `getInvoiceTotals(doc).grandTotal` after a normal save? Yes or no, with the assignment line.
- Do the templates read stored subtotal and computed tax in invoice mode? Yes, if the excerpt still matches.

**Verify**: Result section written. No template edit yet.

### Step 2: Branch

If both numbers come from the same `getInvoiceTotals` result on every save, and you cannot construct a saved document the app writes where they disagree, set this plan to `REJECTED` in `plans/README.md`. Reason: stored totals are the saved snapshot, and the template prints that snapshot on purpose. Do not change `Main.jsx`.

If you can show a save path that writes `grandTotal` from one formula and the template's tax line from another, add a unit test that builds that document and expects one grand total. Then change both `Main.jsx` files so invoice mode prints `totals.subtotal` and `totals.grandTotal`, matching line mode. Run the existing totals tests.

A PDF pixel compare is required only if you change `Main.jsx`. The repo uses `node scripts/pdf-snapshot.mjs` and `sh scripts/pdf-compare.sh`. Read `plans/README.md` from the 018 series only if you need the exact command. Do not update baselines for an unrelated pixel diff. If the compare is not identical and the diff is not the total you changed, STOP.

**Verify**: either README row `REJECTED` and no template diff, or the totals test command exits 0 and both `Main.jsx` files use `totals.grandTotal` in invoice mode.

## Test plan

- No test when the result is REJECTED.
- One totals assertion when you change the template. No snapshot of React markup.

## Done criteria

- [ ] The Result section answers both questions in step 1
- [ ] README row 046 is `DONE` or `REJECTED`
- [ ] A template change has a unit test and does not alter line mode
- [ ] No change to e-invoice files

## STOP conditions

- You cannot find where `grandTotal` is written. STOP. Do not switch the template to computed totals on a guess.
- A PDF compare shows differences outside the total line. STOP and revert the template.
- Business and minimal templates do not share the same condition. Report both. Do not fix only one.

## Maintenance notes

If a later plan stores a rounded total that is allowed to differ from the row sum, the template and `getInvoiceTotal` must document which number is the legal total. Today `getInvoiceTotal` prefers the stored `grandTotal`.
