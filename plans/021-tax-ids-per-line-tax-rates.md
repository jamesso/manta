# Plan 021: Add seller and client tax IDs and per-line tax rates with a tax breakdown

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- app/helpers/invoice.js app/helpers/form.js app/helpers/preview.js app/helpers/csv.js app/helpers/dashboard.js app/helpers/settings.js app/helpers/clients.js app/helpers/backup.js app/reducers/FormReducer.jsx app/middlewares/FormMW.jsx app/actions/form.jsx app/constants/actions.jsx app/components/form/editor app/components/settings/sections app/components/contacts app/components/invoices preview/templates scripts/pdf-snapshot.mjs app.js app/helpers/pouchDB.js i18n/en`
> Plans 012–020 change most of these files on purpose: 014 (`invoice.js` status helpers, invoice detail sheet), 015 (editor, `form.js`, `preview.js`, `FormReducer`, `FormMW`, template headers), 016 (`settings.js`, `clients.js`, `backup.js`, `csv.js`, Settings sections, client dialog), 017 (`dashboard.js`), 018 (`scripts/pdf-snapshot.mjs`, `preview/templates/index.jsx`, `StyledRoot`), 019 (items database, `taxRateId: null`, line-item autocomplete, backup version), 020 (`getAmountPaid`/`getBalanceDue` in `invoice.js`). Compare only the parts this plan depends on (named in "Current state"). These must be unchanged since `3e89104`: `getInvoiceValue` body in `app/helpers/invoice.js`, the `tax` JSX in both `preview/templates/*/components/Main.jsx`, the `Tax ID` lines in `business/components/Header.jsx` and `minimal/components/Footer.jsx`, and the `invoice.tax` default in `app.js`. A difference there is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH (changes invoice totals; legal content on documents)
- **Depends on**: plans/015 (editor), plans/016 (Settings sections, client edit), plans/019 (items `taxRateId`), plans/018 (PDF baseline scripts). Also requires plans/020 (shared money/payment contracts). Transitively 012–014 and 017. Execute in number order.
- **Category**: feature
- **Planned at**: commit `3e89104`, 2026-11-01 (runs after 020)

## Why this matters

Manta has one tax rate per invoice (`invoice.tax = { tin, method, amount }`). The seller tax ID is a field of that tax object, so it prints only when the invoice has tax. Clients have no tax ID. Many EU businesses sell at two or more VAT rates, or sell with reverse charge or exemptions. Those invoices must show the taxable amount and the tax per rate, the buyer's VAT ID for reverse charge, and an exemption reason. Plan 025 (Factur-X/XRechnung) needs UNCL5305 tax categories, a breakdown per category and rate, and seller and buyer tax IDs. This plan adds all of that. Old invoices must keep exactly the same totals and the same PDF.

## Decisions (fixed for this plan)

1. **Tax per line is always on for new invoices.** There is no "Tax per line" setting. The existing "Tax" field toggle (`required_fields.tax`, "Customize fields") shows the tax column. Tax toggle off = no row has a rate = no tax (same as today).
2. **Mode detection**: new documents persist `taxMode: 'line'` and `taxCalc: 1`; `isLineTaxInvoice(doc)` first honors that explicit mode, then falls back to the presence of a finite row `taxRate` for earlier snapshots. In line mode, ignore invoice-level `tax`. The explicit mode is required even when Tax is off or the invoice is empty: absence of row tax must not switch a new document back to the legacy calculation. Otherwise the old code applies. Old docs stay in invoice-level mode for ever, unless the user converts one in the editor ("Switch to tax per line").
3. **Editor mode** (`form.taxMode: 'line' | 'invoice'`): new invoice → `'line'`. Edit or duplicate of a doc → `'invoice'` when the doc has a `tax` object and is not line mode, else `'line'`. Duplicates of old docs keep `'invoice'`, so a copy has the same numbers as its source.
4. **Totals helper** `getInvoiceTotals(invoice)` in `app/helpers/invoice.js` returns `{ mode, lines, subtotal, discount, taxBreakdown, taxTotal, grandTotal }`. Invoice-level mode calls the old `getInvoiceValue` unchanged and maps its values (results are identical, also the legacy quirks). `getInvoiceValue` stays, but only `invoice.js` calls it.
5. **Rounding (line mode only)**: round half away from zero to `currency.fraction` (default 2). Round each line net (`price × quantity`). Sum to `subtotal`. Round the discount. Allocate the discount to rate groups in proportion to group net; put the rounding remainder on the group with the largest net (first in breakdown order on a tie). Round the tax **once per group**: `roundMoney(base × rate / 100)`. This is the app calculation policy. EN 16931 BR-CO-17 requires two-decimal breakdown amounts; arbitrary `currency.fraction` values are not proof of e-invoice compliance. Plan 025 must validate its supported precision and fail with an actionable error for incompatible values, without silently changing the PDF totals. `grandTotal = subtotal − discount + taxTotal`. Prices are net. Gross (tax-inclusive) prices are out of scope.
6. **Breakdown group key** = `category + rate` (EN 16931 BG-23). Order: categories `S, Z, E, AE, K, G, O`, then rate descending. Rows in one group must use the same non-empty exemption reason where required. Conflicting reasons are an inline validation error, not silently replaced by the first row's reason.
7. **Rate rules**: `S` needs `0 < rate ≤ 100`. All other categories need `rate === 0`. `E`, `AE`, `K`, `G`, `O` need a non-empty `exemptionReason` (BR-E-10, BR-AE-10, BR-IC-10, BR-G-10, BR-O-10).
8. **Rates list** `invoice.taxRates = [{ id, name, rate, category, isDefault, exemptionReason, active }]`. Read fallback when the key is missing or empty: `buildDefaultTaxRates(invoice.tax)` → `amount > 0` gives `[{ id: 'standard', name: 'Standard', rate: amount, category: 'S', isDefault: true, exemptionReason: '', active: true }]`; else `[{ id: 'zero', name: 'Zero rate', rate: 0, category: 'Z', isDefault: true, exemptionReason: '', active: true }]` (a 0 % `S` rate is invalid). The ids are fixed, so rows saved before the first Settings write still resolve. No `app.js` change and no migration.
9. **Delete a rate**: a rate used by an item (019 `items` database) cannot be deleted; the UI offers "Mark inactive". The default rate and the last active rate cannot be deleted or made inactive. Invoices are not checked: rows keep snapshots.
10. **Row snapshot**: when a rate is chosen, the row stores `taxRateId`, `taxRate`, `taxCategory`, `taxExemptionReason`. Editing a rate in Settings never changes saved invoices.
11. **Seller tax IDs**: `profile.taxId` and `profile.vatId` (Settings › Business profile). Read fallback `getSellerTaxIds(profile, invoiceSettings)`: `taxId = profile.taxId.trim()`, else `invoice.tax.tin` when it is not empty and not the placeholder `'123-456-789'`, else `''`. On save, the doc gets `seller: { taxId, vatId }` for: a new doc, an edited draft, and an edited line-mode doc without `seller`. Other edits keep `editMode.data.seller` (or no key). Templates: `invoice.seller` present → new lines; absent → the old line `{tax && <p>Tax ID: {tax.tin}</p>}` unchanged.
12. **Client tax ID**: contact field `taxId` (optional, trimmed). The selected contact is copied into `invoice.recipient` on save (today's behavior), so `recipient.taxId` comes with it. Templates print it only when not empty (old docs have none).
13. **Backup**: `BACKUP_VERSION` 2 → 3 (an older app would print line-mode invoices without tax). `parseBackup` keeps accepting versions 1 and 2 unchanged.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current; git status --short` | record the current branch and existing changes; keep both |
| 015 editor | `ls app/components/form/editor/{LineItemRow,LineItems,AdjustmentsCard,TotalsFooter,ClientField}.jsx app/helpers/preview.js` | all listed |
| 015 helpers | `grep -nE "pickInvoiceFields\|updateRowField\|getFormErrors\|populateFromInvoice" app/helpers/form.js app/reducers/FormReducer.jsx` | each name found |
| 016 settings | `ls app/components/settings/sections/{BusinessProfile,InvoiceDefaults}.jsx app/helpers/settings.js` and `grep -n "getSettingsErrors" app/helpers/settings.js` | listed; found |
| 016 clients | `ls app/components/contacts/ClientEditorDialog.jsx && grep -n "buildContact" app/helpers/clients.js` | listed; found |
| 016/019 backup, CSV | `grep -n "BACKUP_VERSION" app/helpers/backup.js; grep -n "buildInvoicesCsv" app/helpers/csv.js` | `BACKUP_VERSION = 2` (after 019); CSV builder found |
| 017 dashboard | `grep -n "amountOf" app/helpers/dashboard.js` | found |
| 018 PDF tools | `ls scripts/pdf-snapshot.mjs scripts/pdf-compare.sh preview/templates/index.jsx` | all listed |
| 019 items | `grep -n "'items'" app/helpers/pouchDB.js; ls app/components/items/ItemEditorDialog.jsx; grep -n "applyItemToRow" app/helpers/form.js` | `items` DB exists; file listed; found |
| 020 payments (required) | `grep -nE "getBalanceDue\|getAmountPaid" app/helpers/invoice.js` | both found; shared `app/helpers/money.js` also exists |
| Legacy totals unchanged | `git diff 3e89104..HEAD -- app/helpers/invoice.js \| grep -n "^-.*calTax\|^-.*calSub\|^-.*calDiscount"` | no output |
| Tests pass | `npm test` | exit 0 |

If a name differs, find the real name with `grep` and use it. If the thing does not exist, STOP.

## Current state

### (a) At `3e89104` (012–020 do not change these parts)

`app/helpers/invoice.js:1-49` — the legacy calculation. Every method:
```js
function calDiscount(data) {
  if (data.discount) {
    if (data.discount.type === 'percentage') { return (calSub(data) * data.discount.amount) / 100; }
    return data.discount.amount;              // any other type = flat amount
  }
}                                             // no discount → undefined
function calTax(data) {                       // tax on (subtotal − discount)
  if (data.tax) { ... return (afterDiscount * data.tax.amount) / 100; }
}                                             // no tax → undefined
// calTotal: grandTotal = sub − discount; if (data.tax.method === 'default') grandTotal += taxAmount;
return { subtotal: calSub(data), discount: calDiscount(data), taxAmount: calTax(data), grandTotal: calTotal() };
```
Methods: `'default'` = tax is computed and added to the total. `'reverse'` = tax is computed and returned as `taxAmount`, but NOT added; templates print "Reverse Charge" instead of the amount. Any other value (for example `undefined`) = tax is computed and NOT added, but templates print the amount (they test `=== 'reverse'`). No rounding anywhere. `calSub` adds `row.subtotal` as is (a `''` subtotal makes a string; bug 6, 015 coerces new saves only).

`app.js:195-203` defaults: `invoice.tax = { tin: '123-456-789', method: 'default', amount: 0 }`. `app.js:262-266` (migration 1) and `app/helpers/pouchDB.js:55-60` (invoice migration 1) write the same placeholder `tin`. `setInitialValues()` (`app.js:220-240`) adds only missing level-2 keys.

`app/helpers/form.js:220-231` `validateTax(isRequired, tax)` fails when `!amount || amount <= 0`. `app/helpers/form.js:72` copies `tax` only when `required_fields.tax`.

`app/helpers/__tests__/invoice.spec.js` fixtures: `data1` (flat 100, tax 10 % default → grandTotal 110), `data2` (10 % discount, tax 5 % reverse → taxAmount 7.2, grandTotal 144), `data3` (no discount, no tax → 300).

Templates: `preview/templates/business/components/Main.jsx:119,199-221` and `minimal/components/Main.jsx:120,165-185` print `{t('form:fields:tax:name')} {tax.amount}%` and either `form:fields:tax:reverse` or `getInvoiceValue(invoice).taxAmount`; discount uses `getInvoiceValue(invoice).discount`; subtotal and total print the stored `invoice.subtotal` / `invoice.grandTotal`. Seller tax ID: `business/components/Header.jsx:77` and `minimal/components/Footer.jsx:39`: `{tax && <p>Tax ID: {tax.tin}</p>}` (hard-coded English). Recipient block prints `company, fullname, email, phone`.

i18n: `i18n/en/form.json:60-65` `fields.tax = { name: "Tax", id: "Tax ID", method: "Method", reverse: "Reverse Charge" }`; `i18n/en/settings.json:13` `fields.taxSettings`; `i18n/en/dialog.json:89-91` `validation.tax`.

### (b) Expected after 012–020 (expectations; Preconditions check them)

- 015 Step 5: `pickInvoiceFields(form, defaultCurrency)` is shared by save and preview; `getInvoiceData(form, { mode, defaultCurrency, now })` stores `subtotal`/`grandTotal` from `getInvoiceValue`; `formToPreviewInvoice` in `app/helpers/preview.js`; `getFormErrors(form, mode)` with paths `rows.<id>.<field>`, `tax`, `discount`.
- 015 Step 6: `populateFromInvoice(state, payload)` used by `INVOICE_EDIT` and `FORM_LOAD_DUPLICATE`; `FormMW` re-runs `getFormErrors` after form actions.
- 015 Step 7/9: `TotalsFooter.jsx` computes `getInvoiceValue(formToPreviewInvoice(...).invoice)`; `LineItemRow.jsx` grid `grid-cols-[1.5rem_1fr_7rem_6rem_7rem_2rem]`; `AdjustmentsCard.jsx` Tax group (TIN, amount %, method Select).
- 014 Step 7: the invoice detail sheet shows subtotal, discount and tax from `getInvoiceValue(invoice)`.
- 016 Step 8: `InvoiceDefaults.jsx` has a Tax group `tax.{tin,amount,method}`; sections save the whole section object with `onSave`. Step 6: `getSettingsErrors('invoice', data)` checks `tax.amount >= 0`. Step 4: `ClientEditorDialog.jsx` (fullname, company, email, phone). Step 9: `buildInvoicesCsv` columns `subtotal,tax,discount,total` from `getInvoiceValue`.
- 017 Step 3: `amountOf(inv)` falls back to `getInvoiceValue(inv).grandTotal`.
- 018 Step 0: `scripts/pdf-snapshot.mjs` (BASE fixture: subtotal 3767.5, 5 % discount, tax 10 % default, `grandTotal: 3937.0375`) and `scripts/pdf-compare.sh` (loops over the **after** folder; a PDF without a baseline is `MISSING`).
- 019 (plan file `plans/019-items-catalog.md`): `items` docs `{ ..., taxRateId: null }` (`buildItem` keeps `taxRateId` on edit); `app/components/items/ItemEditorDialog.jsx`; selector `getItems` in `app/reducers/ItemsReducer.jsx`; `applyItemToRow(row, item)` in `app/helpers/form.js`; `LineItemRow.jsx` `onPick` → `updateItem(applyItemToRow(item, picked))`; `BACKUP_VERSION = 2`. Name clash: 019's `app/actions/items.jsx` also exports `updateItem` (item docs). In this plan, `updateItem(row)` always means the **form** action from `app/actions/form.jsx`.
- 020: `getBalanceDue(invoice)` = grand total − paid.

## Reference facts (recheck versions and APIs at execution)

- UNCL5305 categories: S standard, Z zero rated, E exempt, AE reverse charge, K intra-community supply (EEA), G export outside the EU, O outside the scope of VAT: https://developer.vertexinc.com/einvoicing/docs/en-16931-tax-categories , https://docs.peppol.eu/pracc/catalogue/1.0/codelist/UNCL5305/ , https://econnect.eu/en/docs/knowledge/document-formats/practical/reverse-charge-vat
- E, AE and G breakdowns need an exemption reason (BR-E-10, BR-AE-10, BR-G-10); O should state "not subject to VAT": https://developer.vertexinc.com/einvoicing/docs/en-16931-exempt-from-tax-e , https://developer.vertexinc.com/einvoicing/docs/en-16931-services-outside-scope-of-tax , https://docs.peppol.eu/tdd/sk/tdd-sk/trn-tdd/semantic-model/bt-121/ . For K, check the authoritative BR-IC-10 rule at https://docs.peppol.eu/poacc/billing/3.0/rules/ubl-tc434/BR-IC-10/ rather than treating an unfound secondary source as evidence. Plan 025 still validates the complete category-specific constraints.
- BR-CO-17 requires two decimal places at VAT breakdown level. The current May 2026 rules still say two; do not infer a currency-dependent change. Local app precision is separate from structured-export compliance: https://docs.peppol.eu/poacc/billing/3.0/rules/ubl-tc434/BR-CO-17/ (rechecked 2026-11-01).
- VAT breakdown BG-23 is per category and rate: https://docs.peppol.eu/tdd/sk/tdd-sk/trn-tdd/semantic-model/bg-23/
- `Number.prototype.toFixed` rounds the binary value (`(1.005).toFixed(2)` is `"1.00"`), so `roundMoney` uses exponent strings: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed
- No new npm packages. Confirm installed versions with `npm ls @base-ui/react lucide-react`.

## Execution and verification rules (reviewed 2026-11-01)

- The source baseline is `3e89104`; prerequisite output is an expected contract, not code that exists today. Read the completed prerequisite changes before implementation. Expected changes from those plans are not a drift failure.
- Before a live UI check, call Jean `get_run_environments` and use its running URL and startup command. If none runs, use `start_run_environment`. Do not start a second server by hand. If no Run command is configured, report the missing configuration. Commands below describe the required copy-profile setup; they do not override this rule.
- Never overwrite a prior test profile or copy production data into an existing destination. Use a new empty, task-specific profile directory and set `MANTA_USER_DATA` before launch. Treat `/tmp/manta-profile-copy` below as an example path. Keep test output and PDF baselines outside the production export directory.
- Use the narrow spec for each logic change. Run the full checks once at the end for this cross-cutting feature. Verify UI interactions in the browser or Electron app; unit tests alone do not prove these flows.

## Commands you will need

- One spec: `npx vitest run <path>` · All: `npm test` · Lint: `npm run lint` · E2E: `npm run test:e2e`
- PDF: `npm run build && node scripts/pdf-snapshot.mjs <dir>` then `sh scripts/pdf-compare.sh <baseline> <after> --light-ref`
- Safe manual run: `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy` (Windows `%APPDATA%\Manta`, Linux `~/.config/Manta`), then `MANTA_USER_DATA=/tmp/manta-profile-copy npm start`

## Scope

**In scope**
- Create: `app/helpers/tax.js`, `app/helpers/__tests__/tax.spec.js`, `app/helpers/__tests__/totals.spec.js`, `app/helpers/__tests__/totals-backup.spec.js`, `app/components/form/editor/TaxRateSelect.jsx`, `app/components/settings/sections/TaxRates.jsx`, `app/components/settings/sections/TaxRateDialog.jsx`.
- Change: `app/helpers/invoice.js`, `app/helpers/money.js` (reuse only), `app/helpers/form.js`, `app/helpers/preview.js`, `app/helpers/settings.js`, `app/helpers/clients.js`, `app/helpers/csv.js`, `app/helpers/dashboard.js`, `app/helpers/backup.js`, `app/constants/actions.jsx`, `app/actions/form.jsx`, `app/reducers/FormReducer.jsx`, `app/middlewares/FormMW.jsx`, editor files `LineItemRow.jsx`, `LineItems.jsx`, `AdjustmentsCard.jsx`, `TotalsFooter.jsx`, `ClientField.jsx`, 014 detail sheet, `BusinessProfile.jsx`, `InvoiceDefaults.jsx`, `ClientEditorDialog.jsx`, 019 item dialog, both templates' `Main.jsx`, `business/components/Header.jsx`, `minimal/components/Footer.jsx`, `scripts/pdf-snapshot.mjs`, `i18n/en/{form,settings,preview,contacts}.json`, related specs.

**Out of scope**: gross (tax-inclusive) prices; tax per discount line; withholding taxes; automatic VAT ID validation (VIES — network); conversion of old docs in bulk; changing `invoice.tax` in settings or old docs; e-invoice XML (025); translations other than English.

## Git workflow

Continue on the current branch and preserve existing changes. Do not switch branches, create a worktree, or pull unless the user requests it. Commit after Steps 2, 4, 6, 8 and 10. Short imperative subjects, no prefix, for example `Add per-line tax totals helper`. No `Co-authored-by` or any AI/tool attribution. Do not push.

## Steps

### Step 0: Baselines

1. `npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-021-baseline`.
2. Run `npx vitest run app/helpers/__tests__/invoice.spec.js` and record that it passes.

**Verify**: record the baseline filenames and count (normally 36 after 020), including payment cases. The count must match the current snapshot manifest, not the historical 018 count; the spec passes. Capture the 021 line set separately after it is added.

### Step 1: Pure tax helpers

Create `app/helpers/tax.js` (ES module, no `window` access). Export:
- `TAX_CATEGORIES = ['S','Z','E','AE','K','G','O']`; `EXEMPTION_REQUIRED = ['E','AE','K','G','O']`; `LEGACY_TIN_PLACEHOLDER = '123-456-789'`.
- `DEFAULT_EXEMPTION_REASONS = { E: 'Exempt from VAT', AE: 'Reverse charge', K: 'Intra-community supply', G: 'Export outside the EU', O: 'Not subject to VAT' }` (UI prefill only).
- Import and re-export `roundMoney` from `./money` (020). Do not add a second rounding algorithm or import it from `invoice.js`, which imports tax helpers. Pass the normalized currency fraction on every rounding call, including subtotal, discount, allocation, tax and total; omitting it silently rounds zero- or three-decimal currencies to two.
- `buildDefaultTaxRates(legacyTax)` (Decision 8).
- `getTaxRates(invoiceSettings)` → the stored list when it is a non-empty array, else `buildDefaultTaxRates(invoiceSettings?.tax)`.
- `getActiveTaxRates(rates)`; `getDefaultTaxRate(rates)` → the active `isDefault` rate, else the first active, else `null`.
- `resolveRowTaxRate(taxRateId, rates)` → the rate with that id when it is active, else `getDefaultTaxRate(rates)`.
- `applyTaxRate(row, rate)` → new row with the four snapshot keys (Decision 10). `rate === null` → `clearRowTax(row)`.
- `clearRowTax(row)` → row without `taxRateId`, `taxRate`, `taxCategory`, `taxExemptionReason`.
- `matchLegacyTaxRate(tax, rates)` → for `method === 'reverse'`: the first active `AE` rate; else the first active `S` rate with `rate === Number(tax.amount)`; else `getDefaultTaxRate(rates)`.
- `getTaxRateErrors(rate)` → `{ [field]: i18nKey }` for `name` (trimmed, 1–40 chars, `settings:taxRates:errors:name`), `category` (in list), `rate` (Decision 7: `rateStandard` / `rateZero`), `exemptionReason` (`reasonRequired`, max 200 chars).
- `getTaxRatesErrors(list)` → `{ 'taxRates.<id>.<field>': key }` plus `taxRates`: `duplicateId`, `noDefault` (exactly one active `isDefault`), `empty`.
- `getSellerTaxIds(profile, invoiceSettings)` (Decision 11) → `{ taxId, vatId }`, both trimmed strings.
- `compareTaxGroups(a, b)` (Decision 6 order).

Write `app/helpers/__tests__/tax.spec.js` (cases in "Test plan").

**Verify**: `npx vitest run app/helpers/__tests__/tax.spec.js` → all pass.

### Step 2: `getInvoiceTotals` with golden tests

1. In `app/helpers/invoice.js` keep `getInvoiceValue` byte-for-byte. Add and export:
   - `isLineTaxInvoice(invoice)` (Decision 2).
   - `getInvoiceTotals(invoice)`:
     - Invoice-level mode: `v = getInvoiceValue(invoice)`. Return `{ mode: 'invoice', lines: rows.map(r => ({ net: r.subtotal })), subtotal: v.subtotal, discount: v.discount ?? 0, taxTotal: v.taxAmount ?? 0, grandTotal: v.grandTotal, taxBreakdown }`. `taxBreakdown` = `[]` without `invoice.tax`; else one entry `{ key: 'legacy', category: tax.method === 'reverse' ? 'AE' : 'S', rate: tax.amount, base: v.subtotal - (v.discount ?? 0), amount: v.taxAmount, exemptionReason: '', addedToTotal: tax.method === 'default' }`. Do not round. Do not coerce strings.
     - Line mode: `f = getCurrencyFraction(invoice)` (020). Use the shared `roundMoney(value, f)` for every operation below; no local `roundMoney` implementation. `lines[i].net = roundMoney(Number(row.price) * Number(row.quantity), f)`, or `roundMoney(row.subtotal, f)` when price or quantity is not a finite number. `subtotal = roundMoney(Σ net)`. `discount` = percentage → `roundMoney(subtotal × amount / 100)`; other type → `roundMoney(amount)`; none → `0`. Group rows by `taxCategory ?? 'S'` + `taxRate ?? 0`. Allocate the discount (Decision 5; `subtotal === 0` → all shares 0). `base = roundMoney(net − share)`, `amount = roundMoney(base × rate / 100)`, `addedToTotal: true`. Sort with `compareTaxGroups`. `taxTotal = roundMoney(Σ amount)`; `grandTotal = roundMoney(subtotal − discount + taxTotal)`.
   - `getGrandTotal(invoice)` → `getInvoiceTotals(invoice).grandTotal`.
2. Write `app/helpers/__tests__/totals.spec.js` (golden and rounding cases in "Test plan").
3. Write `app/helpers/__tests__/totals-backup.spec.js`. Use `describe.skipIf(!process.env.MANTA_TOTALS_BACKUP)`. It reads a 016 backup JSON file. For every invoice that is not line mode, it expects `getInvoiceTotals(doc).grandTotal` to be `Object.is`-equal to `getInvoiceValue(doc).grandTotal`, and the same for `subtotal`. It logs (does not fail) the count of docs whose stored `grandTotal` differs.

**Verify**: `npx vitest run app/helpers/__tests__/totals.spec.js app/helpers/__tests__/invoice.spec.js` → all pass. Then export a backup from `/tmp/manta-profile-copy` (Settings › Export & backup) to `/tmp/manta-021-backup.json` and run `MANTA_TOTALS_BACKUP=/tmp/manta-021-backup.json npx vitest run app/helpers/__tests__/totals-backup.spec.js` → pass. Commit.

### Step 3: Switch all callers to the new helper

1. Run `grep -rn "getInvoiceValue" app preview helpers --include='*.js' --include='*.jsx' | grep -v __tests__`.
2. Replace each caller outside `app/helpers/invoice.js`: `form.js` `getInvoiceData` (`subtotal`, `grandTotal` from `getInvoiceTotals`), `preview.js`, `TotalsFooter.jsx`, the 014 detail sheet, `csv.js` (`subtotal`, `tax` = `taxTotal`, `discount`, `total` = `grandTotal`; keep 016's number formatting), `dashboard.js` `amountOf` fallback, 020's `getBalanceDue` if it computes a total. Templates follow in Step 8.
3. Keep 020's `getInvoiceTotal` as the public settlement read helper; it delegates to the new totals only when no valid saved total exists. Editor/save/live-preview calculate from picked form fields, without a stale saved `grandTotal`. Add cross-surface tests that saved line totals, payment balance, CSV, detail sheet data and live preview agree. Run the specs of the changed helpers.

**Verify**: the grep from item 1 shows only `app/helpers/invoice.js` and the two template `Main.jsx` files. `npx vitest run app/helpers` → pass (CSV and dashboard specs unchanged = old docs give the same numbers).

### Step 4: Settings — tax IDs and the rates list

1. `BusinessProfile.jsx`: add two debounced text inputs `taxId` ("Tax ID") and `vatId` ("VAT ID"). Initial value: `getSellerTaxIds(value, invoiceSettings)` for `taxId`, so the old TIN shows. Save the whole profile object. Do not write `invoice.tax.tin`.
2. `InvoiceDefaults.jsx`: remove the Tax group (`tin`, `amount`, `method`). Keep the stored `invoice.tax` value as it is. Render `<TaxRates value={getTaxRates(value)} onChange={list => onSave({ ...value, taxRates: list })} />` in its place.
3. `TaxRates.jsx`: a list (name, `rate %`, category short label, "Default" and "Inactive" badges). Button "Add tax rate" (lucide `Plus`). Row `DropdownMenu` (`aria-label` "Actions for {name}"): Edit, Set as default, Mark inactive / Reactivate, Delete. Default and last-active rates: Delete and Mark inactive disabled. Delete: read items with `useSelector(getItems)` (019; includes archived items); count items with `taxRateId === id`; count > 0 → `AlertDialog` "Used by {count} items. Mark it inactive instead?" with action "Mark inactive"; count 0 → remove. A short line under the list: "Changes apply to new lines. Saved invoices keep their rates." and "Ask your tax advisor which category applies."
4. `TaxRateDialog.jsx` (`Dialog` + `Field`): Name, Category `Select` (each item shows code, label and a one-line explanation, see Step 10 strings), Rate % (`Input type=number step=0.01`; disabled and set to 0 when category ≠ `S`), Exemption reason (`Textarea`; required for `EXEMPTION_REQUIRED`; prefill from `DEFAULT_EXEMPTION_REASONS` when empty and the category changes), Default switch. Submit: `getTaxRateErrors`; errors show inline. New id: `crypto.randomUUID()`, `active: true`. Setting a default clears `isDefault` on the others.
5. `app/helpers/settings.js` `getSettingsErrors('invoice', data)`: when `data.taxRates` exists, merge `getTaxRatesErrors(data.taxRates)`. 016's backup import then skips an invalid `invoice` section on its own.
6. Add cases to `app/helpers/__tests__/settings.spec.js`: invalid rate list → errors; no `taxRates` key → no tax-rate errors.

**Verify**: `npx vitest run app/helpers/__tests__/settings.spec.js` → pass. Manual (copy profile): Business profile shows the old TIN when it is not the placeholder; add `VAT 7%` (S 7), add `Reverse charge` (AE, reason prefilled); delete a rate used by an item → dialog offers "Mark inactive"; `grep -o '"taxRates":\[[^]]*' /tmp/manta-profile-copy/Settings` shows the list. Commit.

### Step 5: Client tax ID

1. `app/helpers/clients.js` `buildContact`: also copy the trimmed `taxId` (empty string when missing). Add a test case in `clients.spec.js` (edit keeps `taxId`; whitespace trimmed).
2. `ClientEditorDialog.jsx`: optional field "Tax / VAT ID" after Company (`autoComplete="off"`, max 40 chars).
3. `ClientField.jsx` inline new-recipient form: the same optional field, stored in `recipient.new.taxId`.
4. Client detail sheet: show the tax ID under the company when not empty.

**Verify**: `npx vitest run app/helpers/__tests__/clients.spec.js` → pass. Manual: edit a client, add a VAT ID, restart → still there.

### Step 6: Items get a tax rate

1. In `app/components/items/ItemEditorDialog.jsx` (019), add a `Select` "Tax rate": first option "Default rate" (value `null`), then the active rates (plus the item's current rate when it is inactive, marked "inactive"). Save `taxRateId`.
2. In `LineItemRow.jsx` `onPick`: when `form.taxMode === 'line'` and `required_fields.tax` is on, dispatch the form `updateItem(applyTaxRate(applyItemToRow(item, picked), resolveRowTaxRate(picked.taxRateId, rates)))` with `rates = getTaxRates(savedInvoiceSettings)`. Otherwise keep 019's call. Do not change `applyItemToRow`.

**Verify**: `npx vitest run app/helpers` → pass. Manual: an item with `VAT 7%` fills a new row with 7 %. Commit.

### Step 7: Editor — per-line mode

1. `app/constants/actions.jsx`: add `FORM_TAX_MODE_SET`. `app/actions/form.jsx`: `setTaxMode = createAction(FORM_TAX_MODE_SET, mode => mode)`.
2. `FormReducer.jsx`: `initialState.taxMode = 'line'`. `populateFromInvoice`: `taxMode` per Decision 3. `FORM_CLEAR` → `'line'`. `FORM_TAX_MODE_SET` stores the mode.
3. `FormMW.jsx` — after these actions pass through, when `taxMode === 'line'` and `required_fields.tax` is on, fill rows that have no `taxRateId`: `rates = getTaxRates(appConfig.get('invoice'))`; for each such row dispatch the form action `updateItem(applyTaxRate(row, getDefaultTaxRate(rates)))`. Actions: `FORM_ITEM_ADD`, `FORM_FIELD_TOGGLE` for `tax`, `FORM_CLEAR`. For `FORM_TAX_MODE_SET` with `'line'`: use `matchLegacyTaxRate(form.tax, rates)` for every row (overwrite).
4. `form.js` `pickInvoiceFields`: persist `taxMode` and `taxCalc: 1` for new/converted line-mode documents; line mode + tax on → keep row tax keys, do not copy `tax`; line mode + tax off → `clearRowTax` on every row, no `tax`; invoice mode → today's behavior, plus `clearRowTax` on every row.
5. `form.js` `getInvoiceData` and `preview.js` `formToPreviewInvoice`: add `seller` per Decision 11 (`getSellerTaxIds(profile, invoiceSettings)`; `getInvoiceData` reads `appConfig.get('profile')` and `appConfig.get('invoice')` through its options so it stays testable: add `profile` and `invoiceSettings` to its options object).
6. `getFormErrors`: line mode + tax on → each non-blank row without a finite `taxRate` → `rows.<id>.taxRate` = `form:errors:taxRateRequired`; `discount` greater than the line-mode subtotal → `discount` = `form:errors:discountTooLarge`. The invoice-level `getTaxErrors` applies only in invoice mode. In line mode validate every non-blank row with the same category/rate/reason rules as a saved tax rate; reject missing category, non-finite net, negative net and conflicting exemption reasons within a group. Reject a negative discount or a discount above the non-negative subtotal; reject an unrepresentable scaled amount. This bounds proportional discount allocation. Keep legacy invoice-level behavior unchanged. Add translated inline errors for each new condition.
7. `TaxRateSelect.jsx`: shadcn `Select`, `aria-label` "Tax rate for item N", items = active rates (+ the row's current rate if inactive or unknown, label from the snapshot `taxRate %`). Value change → form action `updateItem(applyTaxRate(item, rate))`.
8. `LineItems.jsx` / `LineItemRow.jsx`: when `taxMode === 'line'` and tax is on, add a `8rem` column "Tax" after Quantity in the header and row grid, with `TaxRateSelect`, `aria-invalid` + `FieldError` from `errors['rows.<id>.taxRate']`.
9. `AdjustmentsCard.jsx`: show the Tax group only in invoice mode. Add under it an outline button "Switch to tax per line" → `setTaxMode('line')`, and the hint "Totals are recalculated with your tax rates."
10. `TotalsFooter.jsx`: line mode → one line per `taxBreakdown` group: `{label} {rate}% · on {base}` and the amount; invoice mode → the old single tax line.
11. Tests: `form.spec.js` (pickInvoiceFields 3 cases; `seller` rules 4 cases; the 2 new error rules), `FormReducer.spec.js` (`taxMode` for new, old doc with `tax`, old doc without `tax`, line doc, duplicate of old doc), `FormMW.spec.js` (`FORM_ITEM_ADD` in line mode fills the default rate; invoice mode does not; switch maps a reverse doc to the `AE` rate), `preview.spec.js` (line-mode preview has `seller` and numeric totals).

**Verify**: `npx vitest run app/helpers app/reducers/__tests__/FormReducer.spec.js app/middlewares/__tests__/FormMW.spec.js` → pass. `npm run build` → exit 0. Commit after Step 8.

### Step 8: Templates — tax IDs and breakdown

1. In both `Main.jsx`: `const totals = getInvoiceTotals(invoice)`. In the existing discount and tax JSX, replace only `getInvoiceValue(invoice).discount` → `totals.discount` and `getInvoiceValue(invoice).taxAmount` → `totals.taxTotal`. Wrap the existing tax block in `totals.mode === 'invoice' && tax && (...)`. Do not change any other legacy JSX.
2. Line mode only (`totals.mode === 'line'`): subtotal cell prints `totals.subtotal`; discount prints `totals.discount`; then one row per group: label `t('preview:tax:category:<code>', { lng })` + ` {rate}%` and a small `t('preview:tax:on', { lng, amount })` text; value = group amount; total prints `totals.grandTotal`. Row amounts print `totals.lines[i].net`. When `taxBreakdown.length > 1`: business adds a `w10` "Tax" column with the row `taxRate %`; minimal appends ` · {taxRate}%` after the quantity. After the totals, render the exemption notes: one `<p>` per group with a reason: `{category label}: {exemptionReason}`. Use the template's existing small-text style.
3. Seller IDs (`business/components/Header.jsx`, `minimal/components/Footer.jsx`): `invoice.seller ? (<>{seller.taxId && <p>{t('preview:tax:taxId', { lng })}: {seller.taxId}</p>}{seller.vatId && <p>{t('preview:tax:vatId', { lng })}: {seller.vatId}</p>}</>) : (tax && <p>Tax ID: {tax.tin}</p>)`. Keep the legacy line text exactly.
4. Recipient blocks: add `{recipient.taxId && <p>{t('preview:tax:recipientTaxId', { lng })}: {recipient.taxId}</p>}` after the email line.
5. `scripts/pdf-snapshot.mjs`: add an env switch `SNAPSHOT_SET` (`legacy` default = the current cases, unchanged; `line` = new cases). `line` cases: `LINE` = `BASE` without `tax`, with `seller: { taxId: 'DE-TAX-1', vatId: 'DE123456789' }`, `recipient.taxId: 'FR12345678901'`, rows at S 19, S 7 and E 0 (reason "Exempt under §4 UStG"); and `LINE_AE` = all rows AE 0 with reason "Reverse charge". Cases: `<template>-line`, `<template>-line-ae` for both templates.

**Verify**: `npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-021-after && sh scripts/pdf-compare.sh /tmp/manta-pdf-021-baseline /tmp/manta-pdf-021-after --light-ref` → `ALL IDENTICAL`. Then `SNAPSHOT_SET=line node scripts/pdf-snapshot.mjs /tmp/manta-pdf-021-line` twice (second to `/tmp/manta-pdf-021-line-2`) and compare them → `ALL IDENTICAL` (deterministic). Open `business-line-light.pdf` and `minimal-line-light.pdf`: three tax rows (19 %, 7 %, Exempt 0 %) with bases, the exemption note, seller Tax ID and VAT ID, client VAT ID. Commit.

### Step 9: Backup version

In `app/helpers/backup.js`, set `BACKUP_VERSION = 3` (019 made it 2). `parseBackup` accepts versions 1, 2 and 3 with the same rules as version 2. Change 019's test "version 3 → `newer-version`" to version 4, and add: a version 2 file parses. If `main/backup-files.js` `serializeBackup` copies `payload.version`, no change is needed there; check with `grep -n "version" main/backup-files.js`.

**Verify**: `npx vitest run app/helpers/__tests__/backup.spec.js` → pass.

### Step 10: Strings, full checks, smoke

1. `i18n/en/form.json`: `fields.tax.{rate,perLine,switchToLine,switchHint,on}`; `errors.{taxRateRequired,discountTooLarge}`; `fields.recipient.taxId`.
2. `i18n/en/settings.json`: `fields.{taxId,vatId}`; `taxRates.{title,add,edit,default,inactive,setDefault,markInactive,reactivate,delete,usedBy,hintSnapshot,hintAdvisor,name,rate,category,reason}`; `taxRates.categories.<code>.{label,help}` for 7 codes — S "Standard rate" / "The normal VAT rate, for example 19 % or 20 %."; Z "Zero rated" / "Taxable, but at 0 %."; E "Exempt" / "Exempt from VAT by law. Needs a reason."; AE "Reverse charge" / "The buyer pays the VAT. Needs a reason and the buyer's VAT ID."; K "Intra-community supply" / "Goods to a VAT-registered buyer in another EU country. Needs a reason."; G "Export outside the EU" / "No VAT is charged on the export. Needs a reason."; O "Outside the scope of VAT" / "Not subject to VAT, for example you are not VAT registered. Needs a reason."; `taxRates.errors.{name,rateStandard,rateZero,reasonRequired,duplicateId,noDefault,empty}`.
3. `i18n/en/preview.json`: `tax.{taxId,vatId,recipientTaxId,on}` (`"on": "on {{amount}}"`), `tax.category.<code>` (S "VAT", Z "VAT 0 %", E "VAT exempt", AE "Reverse charge", K "Intra-community supply", G "Export", O "Outside the scope of VAT"). `i18n/en/contacts.json`: `fields.taxId`.
4. Run `npm test`, `npm run lint`, `npm run test:e2e`.
5. Manual smoke list in "Test plan" on the profile copy, light and dark mode. Take screenshots of the editor with two rates and of Settings › Invoice defaults.

**Verify**: the three commands exit 0; smoke list done. Commit.

## Test plan

Unit tests (logic that can break silently):
- `tax.spec.js`: `roundMoney` — `1.005→1.01`, `2.675→2.68`, `-1.005→-1.01`, `0.5,0→1`, `1234.5,0→1235`, `-0.001→0` (not `-0`); `buildDefaultTaxRates` — amount 19 → Standard S 19 id `standard`; amount 0, `undefined`, missing tax → Zero rate Z id `zero`; `getTaxRates` — empty array falls back; `resolveRowTaxRate` — inactive id → default, unknown id → default, no active rate → `null`; `matchLegacyTaxRate` — reverse → AE, default 7 → S 7, no match → default; `getTaxRateErrors` — S 0 invalid, S 101 invalid, Z 5 invalid, E without reason invalid, AE with reason valid, name 41 chars invalid; `getTaxRatesErrors` — two defaults, inactive default, duplicate id, empty list; `getSellerTaxIds` — profile wins, empty profile → legacy tin, placeholder → `''`, whitespace trimmed.
- `totals.spec.js`, golden (invoice mode must equal `getInvoiceValue` with `Object.is` on `subtotal`, `grandTotal`, and `discount ?? 0`, `taxAmount ?? 0`): `data1` (110), `data2` (reverse: taxTotal 7.2, grandTotal 144, `addedToTotal` false), `data3` (300, empty breakdown), 018 BASE (3937.0375, not rounded), `method: undefined` (tax not added), discount without tax, a row with `subtotal: ''` (same string result as the old code), a doc with `tax` and a row with `taxRate` → line mode.
- `totals.spec.js`, line mode: group rounding — three lines of 1.03 at S 7 → tax `0.22` (per-line rounding would give 0.21); mixed — 100 @ S 19, 50 @ S 7, 30 @ E 0, 10 % discount → discount 18, bases 90/45/27, taxes 17.10/3.15/0, grandTotal 182.25; remainder — three groups of 10.00 (S 19, S 7, E 0), flat discount 1.00 → shares 0.34/0.33/0.33, taxes 1.84/0.68/0, grandTotal 31.52; fraction 0 — 1000 @ S 10 + 333 @ S 8 → taxTotal 127, grandTotal 1460; `price 0.333 × qty 3` → line net 1.00; two rate ids with the same category/rate/reason → one group; different non-empty reasons in one group → validation error; breakdown order S 19, S 7, Z, E, AE; explicit line mode with Tax off or zero rows keeps line rounding and `taxCalc: 1`, with zero tax and no `NaN`; negative net or discount is refused at save; fraction 3 is passed through all intermediate rounding; `subtotal 0` with a flat discount → shares 0.
- `totals-backup.spec.js`: real data from a profile copy (skipped without the env variable).
- `form.spec.js`, `FormReducer.spec.js`, `FormMW.spec.js`, `preview.spec.js`, `settings.spec.js`, `clients.spec.js`, `backup.spec.js`: cases listed in Steps 4, 5, 7, 9.
- Existing `invoice.spec.js`, `csv.spec.js`, `dashboard.spec.js` stay unchanged and pass (proof that old docs give the same numbers).

No markup or snapshot tests. PDF identity: Step 8 compare (`ALL IDENTICAL` for the complete inherited baseline, including 020 payment cases).

Manual smoke (profile copy, light and dark): an old invoice with 10 % tax shows the same totals in list, detail sheet, preview and dashboard; an old reverse-charge invoice still prints "Reverse Charge"; a new invoice with Tax on shows the Tax column with the default rate; mix 19 % and 7 % → footer and live preview show two groups with bases; choose the AE rate and a client with a VAT ID → PDF prints "Reverse charge", the reason, both VAT IDs; Settings: add, edit, set default, mark inactive, reactivate; delete a rate used by an item → "Mark inactive" offer; edit an old invoice → Tax group is invoice level; "Switch to tax per line" → rows get the matching rate; duplicate an old invoice → invoice level; CSV export → tax and total columns match the list; backup export → `version` is `3`.

## Done criteria

- [ ] `grep -rn "getInvoiceValue" app preview helpers --include='*.js' --include='*.jsx' | grep -v __tests__` → only `app/helpers/invoice.js`
- [ ] `git diff 3e89104..HEAD -- app/helpers/invoice.js | grep "^-" | grep -v "^---"` → no removed line inside `getInvoiceValue`
- [ ] `grep -c "Tax ID: {tax.tin}" preview/templates/business/components/Header.jsx preview/templates/minimal/components/Footer.jsx` → `1` each
- [ ] `npx vitest run app/helpers/__tests__/tax.spec.js app/helpers/__tests__/totals.spec.js app/helpers/__tests__/invoice.spec.js` → pass
- [ ] `sh scripts/pdf-compare.sh /tmp/manta-pdf-021-baseline /tmp/manta-pdf-021-after --light-ref` → `ALL IDENTICAL`
- [ ] `MANTA_TOTALS_BACKUP=/tmp/manta-021-backup.json npx vitest run app/helpers/__tests__/totals-backup.spec.js` → pass
- [ ] `npm test` → exit 0 · `npm run lint` → exit 0 · `npm run test:e2e` → exit 0
- [ ] Manual smoke done in light and dark mode; screenshots taken
- [ ] `git log --format=%B -6 | grep -ci "co-authored\|generated with"` → `0`

## STOP conditions

- A golden test shows any difference between `getInvoiceTotals` and `getInvoiceValue` for an invoice-level doc, or `totals-backup.spec.js` fails on real data.
- The legacy PDF compare is not `ALL IDENTICAL` after Step 8 and the cause is not a line you can revert in the new branch.
- A precondition fails, or 019 has no `items` database / `taxRateId` field.
- Any step needs a write to `invoice.tax`, a rewrite of old invoice docs, or a settings migration.
- 016's section save cannot store `invoice.taxRates` as an array (for example the validator or store flattens it).
- The operator or a tax advisor gives rules that conflict with Decision 5 or 7. Report; do not guess.

## Maintenance notes

- Totals: always call `getInvoiceTotals()`. `getInvoiceValue()` is the frozen legacy algorithm; never change it. A change to the line-mode rounding changes saved invoices' printed totals: dispatch on the stored `taxCalc` version (this plan writes 1); a later algorithm writes a new version and keeps the version-1 branch. Never recalculate saved version-1 documents with a changed policy.
- Line mode stores no breakdown; it is computed from row snapshots. 025 must read `getInvoiceTotals(doc).taxBreakdown` (category, rate, base, amount, exemptionReason) and `doc.seller` / `doc.recipient.taxId`.
- `invoice.tax` in settings stays for old data and as the source of `buildDefaultTaxRates` and the TIN fallback. A later plan may remove the fallback when no profile needs it.
- App tax validation does not establish legal compliance. Plan 025 checks the selected profile, two-decimal limits, country/identifier rules and forbidden category combinations (including O mixed with VAT categories); do not silently repair exported values.
- `scripts/pdf-snapshot.mjs` now has `SNAPSHOT_SET=line`. Plans that change templates must compare both sets.
- Later plans (022 estimates, 023 credit notes, 024 recurring) reuse the row snapshot keys and `getInvoiceTotals` unchanged.
- No AI or tool attribution in commits or PRs (AGENTS.md).
