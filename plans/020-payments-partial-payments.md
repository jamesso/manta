# Plan 020: Record payments on invoices, with partial payments, balance due and a Partially paid status

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- app/helpers/invoice.js app/helpers/form.js app/helpers/preview.js app/helpers/invoiceList.js app/helpers/dashboard.js app/helpers/clients.js app/helpers/csv.js app/constants/invoices.js app/constants/actions.jsx app/actions/invoices.jsx app/middlewares/InvoicesMW.jsx app/middlewares/FormMW.jsx app/reducers/FormReducer.jsx app/components/invoices app/components/form/editor ui/styles/globals.css preview/templates/minimal/components/Main.jsx preview/templates/business/components/Main.jsx helpers/formatNumber.js scripts/pdf-snapshot.mjs i18n/en`
> Plans 012–018 change most of these files on purpose: 012 creates `ui/styles/globals.css`; 014 creates `app/constants/invoices.js`, `app/helpers/invoiceList.js`, `app/components/invoices/*` and changes `invoice.js`, `InvoicesMW.jsx`, `actions/invoices.jsx`; 015 changes `form.js`, `FormMW.jsx`, `FormReducer.jsx` and creates `preview.js` and `app/components/form/editor/*`; 016 creates `clients.js` and `csv.js`; 017 creates `dashboard.js` and adds `getPaidDate`; 018 creates `scripts/pdf-snapshot.mjs`. Compare only the parts this plan depends on (listed in "Current state" part b). `helpers/formatNumber.js` and the two template `Main.jsx` files must be unchanged since `3e89104`. If one of these three changed, compare it with part (a). On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — this plan writes `status`, `paidAt` and a new `payments` array on saved invoices. A wrong rule can mark an unpaid invoice as paid.
- **Depends on**: plans/014-*.md (status model, `withStatus`, detail sheet, Mark as paid), plans/015-*.md (editor, duplicate, edit mode), plans/016-*.md (CSV export, client outstanding), plans/017-*.md (dashboard stats), plans/018-*.md (PDF snapshot and compare scripts). 019 must also be complete; execute this series in number order so backup and editor contracts are fixed.
- **Category**: feature
- **Planned at**: commit `3e89104`, 2026-11-01 (runs after 018)

## Why this matters

Today an invoice is either fully unpaid or fully paid. Many clients pay in parts (deposits, instalments). The user cannot record that, cannot see the balance due, and the dashboard counts a half-paid invoice as fully outstanding. After this plan, the user records payments (amount, date, method, note) from the invoice row menu or the detail sheet. The app shows "Partially paid", the amount paid and the balance due. The invoice becomes Paid automatically when payments cover the total. Dashboard, client totals and the CSV use the balance due. The PDF prints "Amount paid" and "Balance due" only when the invoice has payments. Old invoices print exactly as before.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current; git status --short` | record the current branch and existing changes; keep both |
| 012 status tokens | `grep -c "status-paid" ui/styles/globals.css` | ≥ 3 (theme mapping, light, dark) |
| 013 toast | `grep -n "export.*toast" ui/components/ui/toast.jsx` | an exported `toast` with `add`/`close` (note the import path the live `InvoicesMW.jsx` uses) |
| 014 helpers | `grep -nE "export (function\|const) (withStatus\|getDisplayStatus\|getStoredStatus\|getIssuedAt\|formatInvoiceAmount)" app/helpers/invoice.js` | 5 exports (they may be in one `export {}` list; then grep the names) |
| 014 constants | `grep -n "INVOICE_STATUSES\|DISPLAY_STATUSES\|UNDO_TIMEOUT_MS" app/constants/invoices.js` | 3 lines |
| 014 list + UI | `grep -n "matchesTab\|countByTab\|STATUS_SORT_RANK\|toInvoiceRow" app/helpers/invoiceList.js; ls app/components/invoices/{StatusBadge,InvoiceRowActions,InvoiceDetailSheet,BulkActionsBar}.jsx` | 4 names; 4 files |
| 014 bulk write | `grep -n "updateDocs" app/helpers/pouchDB.js app/helpers/__mocks__/pouchDB.js` | hits in both |
| 015 editor | `grep -n "resolveSaveStatus\|pickInvoiceFields\|getFormErrors" app/helpers/form.js; ls app/helpers/preview.js app/components/form/editor/{DatePickerField,TotalsFooter,LivePreview}.jsx` | 3 names; 4 files |
| 015 duplicate | `grep -n "FORM_LOAD_DUPLICATE" app/middlewares/InvoicesMW.jsx` | ≥ 1 hit, inside an `omit(...)` call |
| 016 CSV + clients | `grep -n "buildInvoicesCsv" app/helpers/csv.js; grep -n "summarizeClients" app/helpers/clients.js` | 1 export each |
| 017 dashboard | `grep -n "getDashboardStats\|getMonthlyPaid\|getNeedsAttention" app/helpers/dashboard.js; grep -n "getPaidDate" app/helpers/invoice.js; grep -n "paidAt" app/helpers/form.js` | 3 exports; 1 export; ≥ 1 hit |
| 018 PDF tools | `ls scripts/pdf-snapshot.mjs scripts/pdf-compare.sh; pdftoppm -v 2>&1 \| head -1; magick -version \| head -1` | both files; poppler and ImageMagick 7 versions |
| shadcn parts | `ls ui/components/ui/{dialog,field,input,textarea,select,popover,calendar,sheet,dropdown-menu,button}.jsx` | 10 files |
| Tests and lint | `npm test && npm run lint` | exit 0 |

If a name differs, find the real name with `grep -rn` and use it. If the thing does not exist, STOP.

Data safety: never run against the real profile. Copy it first: `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy`, then `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev`.

## Current state

### (a) At 3e89104 — code that 012–018 do not change

`helpers/formatNumber.js:30-42` — display rounding uses `toLocaleString('en', { minimumFractionDigits: fraction, maximumFractionDigits: fraction })`, then swaps separators (`commaDot`, `dotComma`, default space).

`app/helpers/invoice.js:28-47` — `getInvoiceValue(data)` returns unrounded floats. `grandTotal` is stored unrounded (018's snapshot fixture stores `grandTotal: 3937.0375`):

```js
28  function calTotal() {
29    let grandTotal = calSub(data);
...
43  return {
44    subtotal: calSub(data),
...
47    grandTotal: calTotal(),
```

`app.js:204-209` — default currency `{ code: 'USD', placement: 'before', separator: 'commaDot', fraction: 2 }`. `fraction` is an integer (`app/components/form/Currency.jsx:43` uses `parseInt`).

`app/helpers/pouchDB.js:157-183` — `getSingleDoc(db, id)` → `db.get`; `updateDoc(db, doc)` → `db.put(doc)` then `getAllDocs`. A `put` with an old `_rev` fails with 409.

`preview/templates/minimal/components/Main.jsx:207-215` — the last summary row. `InvoiceSummary tr:last-child` has no bottom border (`:73-81`):

```jsx
207        <Total>
208          <td>{t('preview:common:total', { lng: currentLanguage })}</td>
209          <td>
210            {currencyBefore ? currency : null}{' '}
211            {formatNumber(invoice.grandTotal, fraction, separator)}{' '}
212            {currencyBefore ? null : currency}
213          </td>
214        </Total>
215      </InvoiceSummary>
```

`preview/templates/business/components/Main.jsx:225-241` — `<InvoiceTotal accentColor customAccentColor>` with `<td colSpan="2" />`, `<td className="label">` total label, `<td colSpan="2">` money, then `</tfoot>`. The subtotal row pattern is at `:166-176` (`<td colSpan="2" /><td className="label" colSpan="2">…</td><td>money</td>`). Both templates import `getInvoiceValue` from `../../../../app/helpers/invoice` (line 6). `Footer.jsx` in both templates prints no totals. Do not change it.

`i18n/en/preview.json` `common` has `subtotal`, `total`. No paid/balance keys.

### (b) Expected after 012–018 (expectations — check with Preconditions)

- 012 Step 3 (`ui/styles/globals.css`): pairs `--status-<name>` / `--status-<name>-bg` in `:root` (light: `oklch(0.45 … h)` on `oklch(0.955 … h)`) and in `@media (prefers-color-scheme: dark) { :root {…} }` (dark: `oklch(0.86 …)` on `oklch(0.29 …)`). `@theme inline` maps `--color-status-<name>: var(--status-<name>)` and `--color-status-<name>-bg`. Usage: `text-status-<name> bg-status-<name>-bg`.
- 014 Step 2: `INVOICE_STATUSES = ['draft','pending','paid','refunded','cancelled']`, `DISPLAY_STATUSES = ['draft','pending','overdue','paid','refunded','cancelled']`, `UNDO_TIMEOUT_MS = 6000`. `getDisplayStatus(invoice, now)`: non-pending stored status is returned as is; pending + past due → `overdue`; else `pending`. `withStatus(doc, status, now)`: into `paid` sets `paidAt: now`; paid → paid keeps `paidAt`; any other status removes `paidAt`.
- 014 Step 3: `matchesTab` (`outstanding` → `pending` only), `countByTab`, `STATUS_SORT_RANK = { overdue: 0, pending: 1, draft: 2, paid: 3, refunded: 4, cancelled: 5 }`, `toInvoiceRow(invoice, now)`.
- 014 Step 6: `INVOICE_SET_STATUS` rejects statuses not in `INVOICE_STATUSES`; single id → `withStatus` + `INVOICE_UPDATE`; array → `updateDocs` + one toast.
- 014 Step 8: `InvoiceRowActions` item "Mark as paid" → `setInvoiceStatus(id, 'paid')`; `InvoiceDetailSheet` totals from `getInvoiceValue` + `formatInvoiceAmount`, footer button "Mark as paid"; `BulkActionsBar` "Mark as paid" → `setInvoiceStatus(selectedIds, 'paid')`; `StatusBadge` = icon + text.
- 015 Decision 5 + Step 6.5: `INVOICE_DUPLICATE` dispatches `FORM_LOAD_DUPLICATE` with `omit(invoice, ['_id', '_rev', 'status', 'paidAt', 'issuedAt', 'created_at'])`. Nothing is saved.
- 015 Step 5.6–5.7: `getInvoiceData(form, { mode, defaultCurrency, now })` keeps `_id`, `_rev`, `created_at` from `editMode.data`; `formToPreviewInvoice(form, {...})` feeds `LivePreview`. 015 Step 7.3: `TotalsFooter` shows Subtotal/Discount/Tax/Total.
- 017 Step 2.4: `form.js` keeps `paidAt: editMode.active ? editMode.data.paidAt : undefined`. 017 Step 2.3: `getPaidDate(invoice)` = `paidAt ?? issuedAt ?? created_at ?? null`. 017 Step 3: private `amountOf(inv)` (grandTotal or computed); `getDashboardStats` outstanding = display `pending|overdue` summed by `grandTotal`; `paidThisMonth` and `getMonthlyPaid` = `status === 'paid'` bucketed by `getPaidDate`; `getNeedsAttention` uses display `pending`.
- 016 Decision 2 + Step 2: `summarizeClients` outstanding = `grandTotal` of display `pending|overdue`. 016 Decision 9: CSV header `number,client,issued,due,status,currency,subtotal,tax,discount,total`; amounts `toFixed(currency.fraction ?? 2)`.
- 018 Step 0: `scripts/pdf-snapshot.mjs <outDir>` builds 14 cases × 2 themes from `BASE` (no `payments`) via `const invoice = { ...BASE, configs: { ...DEF, ...cfg } }`. `scripts/pdf-compare.sh <a> <b> --light-ref` prints `ALL IDENTICAL` or `DIFFERENCES FOUND` (exit 1). It reports `MISSING baseline <name>` for a PDF that exists only in `<b>`.

## Reference facts (recheck versions and APIs at execution)

- Rounding (Node 24.22, checked locally): `Math.round(Number((Math.abs(n) * 10 ** f).toPrecision(15))) / 10 ** f` gives `1.005→1.01`, `2.675→2.68`, `3937.0375→3937.04`, `0.1+0.2→0.3`, `99.995→100`, `1234.5 (f=0)→1235`. `toLocaleString` (used by `formatNumber`) gives the same results for these values, so the rounded number and the printed number agree. `0.1+0.2+0.3+0.4` rounds to `1`, so balance `1 − 1 = 0`. MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toPrecision , `Intl.NumberFormat` default `roundingMode` is `halfExpand`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat
- New status token `partial` (hue 215, teal, in sRGB gamut, computed 2026-11-01 with the OKLab → sRGB → WCAG formula): light text `oklch(0.45 0.07 215)` (#1a5f6d) on `oklch(0.955 0.025 215)` (#def5fb) = **6.40:1**; dark text `oklch(0.86 0.07 215)` (#9bddee) on `oklch(0.29 0.045 215)` (#093139) = **9.29:1**. Both ≥ 4.5:1. The 012 chroma (0.117) is out of gamut at this hue, so the chroma is lower.
- lucide-react 1.66.0 has `ChartPie`, `HandCoins`, `Trash2`, `CircleCheck` (checked in the npm tarball). Confirm with `npm view lucide-react version`.
- react-day-picker `disabled={{ after: date }}` disables days after `date` (exclusive): https://daypicker.dev/selections/disabling-dates
- i18next uses a `_zero` key when `count === 0` in every language: https://www.i18next.com/translation-function/plurals
- Undo instead of confirmation: https://www.nngroup.com/articles/confirmation-dialog/ . Base UI Toast `actionProps`: https://ui.shadcn.com/docs/components/base/toast . Base UI Dialog (nested dialogs supported): https://base-ui.com/react/components/dialog

### Decisions made by this plan

1. **Shape**: `payments: [{ id, date, amount, method, note }]` on the invoice doc. `date` = ms at local start of day. `amount` = number in invoice currency, rounded to `currency.fraction`, > 0. `method` ∈ `PAYMENT_METHODS = ['bank','cash','card','paypal','other']`. `note` = trimmed string, max 500 chars, `''` default.
2. **Legacy paid invoices**: when `payments` is **absent** (not an array) and stored status is `paid`, the invoice counts as paid in full (amount paid = total, balance = 0). As soon as `payments` is an array (even empty), only the array counts. No migration or backfill.
3. **No overpayment.** An amount above the balance due is a validation error. Reason: Manta has no credit balance; a negative balance would show "Balance due −10" on a legal document. Credit notes (023) handle the rest. Editing an invoice so that its total drops below the amount paid is also blocked (Decision 7).
4. **Who can get payments**: stored `pending` (display pending, partial, overdue) and stored `paid` with balance > 0. Drafts cannot (finalize first). `refunded` and `cancelled` cannot (set Pending first). Their existing payments stay as history and can be removed.
5. **Status sync** (`reconcilePaymentStatus`): runs only when `payments` is an array and stored status is `pending` or `paid`. Balance ≤ 0 → `paid` through `withStatus`, `paidAt` = date of the payment that cleared the balance (payments sorted by date, cumulative sum ≥ total). Balance > 0 on a `paid` invoice → `pending` (`withStatus` removes `paidAt`).
6. **Set status**: `paid` → record one payment for the full balance (method `other`, today). `draft` is refused when the invoice has payments. `pending` on an invoice whose payments cover the total stays `paid` and shows an info toast. `refunded`/`cancelled` keep the payments.
7. **Edit mode**: the editor keeps `payments` (like `paidAt`). On save, the status is reconciled. The save is refused when the new total is below the amount paid, or when the currency code or fraction changes on an invoice with payments. A legacy paid invoice without a payment array also has a settled amount: refuse a total or currency change until the user explicitly reopens it as Pending. Do not infer a new cash receipt from a changed legacy total.
8. **Duplicate** drops `payments`.
9. **Display**: `partial` = stored `pending`, not overdue, amount paid > 0 and balance > 0. Overdue wins in the badge. The detail sheet shows "Partially paid" as secondary text for an overdue invoice with payments.
10. **Dashboard money**: Outstanding/Overdue use the balance due. "Paid this month" and the monthly chart sum payment events by payment date, for stored `pending` and `paid` invoices only. A legacy paid invoice (Decision 2) is one event: total at `getPaidDate`.
11. **CSV**: append two columns `amount_paid,balance_due` at the end, so existing column positions do not move. `balance_due` is empty for `draft`, `refunded` and `cancelled`.
12. **Backup**: no format version bump. `payments` is an ordinary field, and older app versions ignore it. Reads go through `getPayments`, which drops malformed entries.

## Execution and verification rules (reviewed 2026-11-01)

- The source baseline is `3e89104`; prerequisite output is an expected contract, not code that exists today. Read the completed prerequisite changes before implementation. Expected changes from those plans are not a drift failure.
- Before a live UI check, call Jean `get_run_environments` and use its running URL and startup command. If none runs, use `start_run_environment`. Do not start a second server by hand. If no Run command is configured, report the missing configuration. Commands below describe the required copy-profile setup; they do not override this rule.
- Never overwrite a prior test profile or copy production data into an existing destination. Use a new empty, task-specific profile directory and set `MANTA_USER_DATA` before launch. Treat `/tmp/manta-profile-copy` below as an example path. Keep test output and PDF baselines outside the production export directory.
- Use the narrow spec for each logic change. Run the full checks once at the end for this cross-cutting feature. Verify UI interactions in the browser or Electron app; unit tests alone do not prove these flows.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| One spec | `npx vitest run <path>` | all pass |
| All unit tests | `npm test` | exit 0 |
| Lint / build | `npm run lint` / `npm run build` | exit 0 |
| e2e | `npm run test:e2e` | all pass |
| Dev on a copy | `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev` | app opens |
| PDF snapshot | `npm run build && node scripts/pdf-snapshot.mjs <dir>` | `Wrote N PDFs to <dir>` |
| PDF compare | `sh scripts/pdf-compare.sh <before> <after> --light-ref` | `ALL IDENTICAL` |

## Scope

**Create**
- `app/helpers/payments.js`, `app/helpers/__tests__/payments.spec.js`
- `app/helpers/money.js`, `app/helpers/__tests__/money.spec.js` (shared rounding and currency fraction; no imports from invoice, tax or credit helpers)
- `app/components/invoices/RecordPaymentDialog.jsx`, `app/components/invoices/PaymentsList.jsx`

**Change**
- `app/helpers/invoice.js` + `__tests__/invoice.spec.js` (money and read helpers, `partial`)
- `app/constants/invoices.js` (`partial`, `PAYMENT_METHODS`), `app/constants/actions.jsx` (3 new types), `app/actions/invoices.jsx`
- `app/middlewares/InvoicesMW.jsx` + spec, `app/middlewares/FormMW.jsx` + spec, `app/reducers/FormReducer.jsx` + spec
- `app/helpers/form.js` + spec, `app/helpers/preview.js` + spec
- `app/helpers/invoiceList.js` + spec, `app/helpers/dashboard.js` + spec, `app/helpers/clients.js` + spec, `app/helpers/csv.js` + spec
- `app/components/invoices/{StatusBadge,InvoiceRowActions,InvoiceDetailSheet,BulkActionsBar}.jsx`, `app/containers/Invoices.jsx` (dialog state only), `app/components/form/editor/{TotalsFooter,DatePickerField}.jsx`
- `ui/styles/globals.css` (partial token only)
- `preview/templates/minimal/components/Main.jsx`, `preview/templates/business/components/Main.jsx`
- `scripts/pdf-snapshot.mjs` (case overrides + 2 payment cases per template)
- `i18n/en/invoices.json`, `i18n/en/form.json`, `i18n/en/preview.json`

**Out of scope**: credit notes and refund amounts (023), payment reminders (026), online payment links, payments in other currencies or exchange rates, a separate payments database, a payments report page, translations other than English, template `Footer.jsx`, backup format changes.

## Git workflow

- Continue on the current branch and preserve existing changes. Do not switch branches, create a worktree, pull, or push unless the user requests it.
- Short imperative subjects, no prefix. No `Co-authored-by`, no "Generated with", no AI or tool attribution (AGENTS.md).
- Suggested commits: `Add payment and balance helpers` · `Record and remove payments through invoice actions` · `Keep payments when an invoice is edited` · `Show partial payments in the invoices table and sheet` · `Use balance due on the dashboard, clients and CSV` · `Print amount paid and balance due on invoices with payments`.

## Steps

### Step 0: PDF baseline before any change

1. Run `npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-020-before`.
2. Keep this folder until Step 11 passes.

**Verify**: the script prints `Wrote 28 PDFs to /tmp/manta-pdf-020-before`.

### Step 1: Money and read helpers in `app/helpers/invoice.js`

1. In `app/constants/invoices.js`: add `'partial'` to `DISPLAY_STATUSES` after `'pending'`. Add `export const PAYMENT_METHODS = ['bank', 'cash', 'card', 'paypal', 'other'];`. Do not change `INVOICE_STATUSES`.
2. Put `roundMoney` and currency-fraction normalization in `app/helpers/money.js`, with no invoice/tax/payment imports; import and re-export them from `invoice.js` so the public names below remain valid. Plans 021 and 023 must use the same implementation. Validate the fraction as an integer 0–8 (invalid → 2) and normalize negative zero. Reject non-finite money and unsafe scaled integers at write boundaries; display fallbacks must never turn invalid write input into a valid zero payment. Add and export in `app/helpers/invoice.js`:
   - `getCurrencyFraction(invoice)` → `Number(invoice?.currency?.fraction)` if it is an integer from 0 to 8, else `2`.
   - `roundMoney(value, fraction = 2)` → the formula in Facts; non-finite input → `0`; keep the sign.
   - `getInvoiceTotal(invoice)` → `Number.isFinite(invoice.grandTotal) ? invoice.grandTotal : Array.isArray(invoice.rows) ? Number(getInvoiceValue(invoice).grandTotal) || 0 : 0`.
   - `getPayments(invoice)` → `[]` when `payments` is not an array; else valid entries with a non-empty unique string `id`, finite numeric `amount > 0`, a finite numeric date within the JS Date range, and an amount representable at the invoice precision. Keep the first valid entry per id, sort stably by date, and preserve raw invalid entries on unrelated writes. Flag malformed imported payment data in the detail sheet rather than silently presenting it as complete history.
   - `getAmountPaid(invoice)`: `payments` not an array → `getStoredStatus(invoice) === 'paid' ? roundMoney(getInvoiceTotal(invoice), f) : 0` (Decision 2). Else `roundMoney(sum of getPayments amounts, f)`.
   - `getBalanceDue(invoice)` → `roundMoney(roundMoney(getInvoiceTotal(invoice), f) - getAmountPaid(invoice), f)`. Add the JSDoc: "Plan 023 subtracts issued credit notes here."
3. Change `getDisplayStatus`: after the overdue check, return `'partial'` when `getAmountPaid(invoice) > 0 && getBalanceDue(invoice) > 0`. Overdue is checked first, so it wins.
4. In 017's `app/helpers/dashboard.js`, make the private `amountOf` call `getInvoiceTotal` (same rule; no behavior change).
5. Add tests (Test plan group A).

**Verify**: `npx vitest run app/helpers/__tests__/invoice.spec.js app/helpers/__tests__/dashboard.spec.js` → all pass.

### Step 2: Payment logic in `app/helpers/payments.js`

Pure functions. No `window`, no i18n calls (return i18n keys), no `Date.now()` without a `now` parameter. Import from `./invoice` and `../constants/invoices`. Error keys are `invoices:payments:errors:<name>`.

- `startOfDay(ms)` → `moment(ms).startOf('day').valueOf()`.
- `formatAmountInput(amount, currency)` → `roundMoney(amount, f).toFixed(f)`, with `.` replaced by `,` when `currency.separator === 'dotComma'`.
- `parseMoneyInput(raw, separator)` → `{ value, decimals }` or `null`. Remove spaces (also ` `, ` `). For `dotComma`: remove `.`, then replace `,` with `.`. Otherwise remove `,`. Validate the original grouping before stripping separators: accept ungrouped digits or groups of exactly three after an initial 1–3 digit group, with at most one decimal separator. Reject `1,2,3`, `1.2.3`, whitespace-only, and a non-finite parsed value; never turn malformed input into a different valid amount. The normalized value must match `/^\d+(\.\d+)?$/`, else `null`.
- `canRecordPayment(invoice)` → `['pending','paid'].includes(getStoredStatus(invoice)) && getBalanceDue(invoice) > 0`.
- `getPaymentErrors({ amountRaw, date }, invoice, now)` → object with `amount` and/or `date` keys:
  - unparsable → `amountInvalid`; `decimals > f` → `tooManyDecimals`; `value <= 0` → `amountPositive`; `roundMoney(value, f) > getBalanceDue(invoice)` → `overpayment`.
  - `date` not a finite number → `dateRequired`; `date > moment(now).endOf('day').valueOf()` → `dateFuture`.
- `getClearingPaymentDate(invoice, now)` → walk `getPayments` in date order with a rounded running sum. Return the date where the sum first reaches `roundMoney(getInvoiceTotal(invoice), f)`. No payments → `now`.
- `reconcilePaymentStatus(doc, now)` → Decision 5. Return `doc` unchanged when `payments` is not an array or the stored status is not `pending`/`paid`. When the doc is already `paid` and the balance is ≤ 0, return it unchanged (keeps `paidAt`).
- `addPaymentToDoc(doc, input, { fullBalance = false, now })` → `{ ok: true, doc, payment }` or `{ ok: false, error }`. Order of checks: draft → `draft`; refunded/cancelled → `closed`; balance ≤ 0 → `nothingDue`; `input.id` already in `doc.payments` → `duplicate`; `input.date` not finite → `dateRequired`; amount (`fullBalance` ? balance : `roundMoney(input.amount, f)`) ≤ 0 → `amountPositive`; amount > balance → `overpayment`. Use the same date, precision, finite-value, amount and note-length validation as `getPaymentErrors` here; renderer validation is not a write boundary. Reject future dates, fractional excess, invalid Date values and non-finite input before rounding. Build the payment per Decision 1 (`id: input.id ?? crypto.randomUUID()`; unknown method → `'other'`). Append to the **raw** `doc.payments` array (or `[]`), so unknown entries are not lost. Return `reconcilePaymentStatus(newDoc, now)`.
- `removePaymentFromDoc(doc, paymentId, now)` → `{ ok: true, doc, payment }` or `{ ok: false, error: 'notFound' }`. Filter the raw array by `id`. Keep `payments: []` when it becomes empty (Decision 2). Reconcile.
- `markDocPaidInFull(doc, now)` → draft → `draft`; refunded/cancelled → `closed`; balance > 0 → `addPaymentToDoc(doc, { date: startOfDay(now), method: 'other', note: '' }, { fullBalance: true, now })`; balance ≤ 0 and stored `paid` → `nothingDue`; balance ≤ 0 and `pending` (zero total) → `{ ok: true, doc: withStatus(doc, 'paid', now) }`.
- `setDocStatus(doc, status, now)` → for `paid`: `markDocPaidInFull`. For `draft` with `getPayments(doc).length > 0` → `{ ok: false, error: 'draftWithPayments' }`. Otherwise `{ ok: true, doc: reconcilePaymentStatus(withStatus(doc, status, now), now), stillPaid }`, where `stillPaid` = requested `pending` and the result is `paid`.
- `getPaymentEditErrors(newDoc, editData)` → array of `{ key, values }`. `[]` when there are no payments and the original is not legacy Paid. For legacy Paid with no array, block total/currency changes until explicitly reopened; derive its settled amount from the original doc, not the proposed total. Currency code or normalized fraction differs → `form:errors:currencyLocked`. `roundMoney(getInvoiceTotal(newDoc), f) < getAmountPaid({ ...newDoc, payments: editData.payments })` → `form:errors:totalBelowPaid` with `{ total, paid }` numbers.
- `getPaymentEvents(invoice)` → stored status not `pending`/`paid` → `[]`. `payments` is an array → `getPayments(...).map(p => ({ date: p.date, amount: p.amount }))`. Else stored `paid` → `[{ date: getPaidDate(invoice), amount: getInvoiceTotal(invoice) }]`. Else `[]`.

**Verify**: `npx vitest run app/helpers/__tests__/payments.spec.js` → all pass (Test plan group B).

### Step 3: Actions and middleware

1. `app/constants/actions.jsx`: add `INVOICE_PAYMENT_ADD`, `INVOICE_PAYMENT_REMOVE`, `FORM_EDIT_DATA_SYNC`. Do not rename anything.
2. `app/actions/invoices.jsx`: generate a payment id once at action/dialog submission and preserve it on a retry; do not generate a new id inside a retrying write.
   - `recordPayment = createAction(INVOICE_PAYMENT_ADD, (invoiceID, payment) => ({ invoiceID, payment, fullBalance: false }))`
   - `recordFullPayment = createAction(INVOICE_PAYMENT_ADD, (invoiceIDOrIDs, payment = {}) => ({ invoiceID: invoiceIDOrIDs, payment, fullBalance: true }))`
   - `removePayment = createAction(INVOICE_PAYMENT_REMOVE, (invoiceID, paymentId) => ({ invoiceID, paymentId }))`
3. `app/reducers/FormReducer.jsx`: `FORM_EDIT_DATA_SYNC` → when `settings.editMode.active` and `editMode.data._id === payload._id`, return state with `settings.editMode.data = payload`. Otherwise return state unchanged. Reason: a payment recorded while the same invoice is open in the editor changes `_rev`; without the sync the next editor save fails with 409 and drops the payment.
4. `app/middlewares/InvoicesMW.jsx`: serialize payment read/validate/write operations for the same invoice id, and always read its current revision inside that queue. Report a 409 without replaying a stale document. 014's `updateDocs` resolves to the full list on complete success; on partial failure it rejects with `{ docs, succeeded, failed }`. Preserve that metadata and refresh Redux from `error.docs` before reporting the failure. Success counts, editor sync and Undo must reflect committed docs only, including mixed success/failure in a bulk operation. Do not mutate the action payload while setting defaults. Add a local `syncEditMode(allDocs, ids)`: if `getState().form.settings.editMode.active` and its `_id` is in `ids`, dispatch `FORM_EDIT_DATA_SYNC` with the fresh doc from `allDocs`. Use the same warning and toast calls that the live file uses (013/014).
   - `INVOICE_PAYMENT_ADD`: `ids = [].concat(invoiceID)`; `now = Date.now()`; `payment = { ...payment, date: payment.date ?? startOfDay(now), method: payment.method ?? 'other' }`. Read each doc with `getSingleDoc` (a failed read → `notFound`). Run `addPaymentToDoc(doc, payment, { fullBalance, now })`. If no result is ok: warning toast with the first error, `return false`. Else `updateDocs('invoices', okDocs)` → `next({ type: INVOICE_UPDATE, payload: allDocs })` → `syncEditMode` → success toast `invoices:payments:toast:recorded` (`count`) → if some failed, a warning toast `invoices:payments:toast:skipped` (`count`, `reason` = translated first error) → `return true`. `.catch`: warning, `return false`.
   - `INVOICE_PAYMENT_REMOVE`: `getSingleDoc` → `removePaymentFromDoc` → `updateDocs('invoices', [doc])` → `next(INVOICE_UPDATE)` → `syncEditMode` → toast `invoices:payments:toast:removed` with `timeout: UNDO_TIMEOUT_MS` and `actionProps: { children: t('invoices:payments:toast:undo'), onClick: () => { toast.close(id); dispatch(Actions.recordPayment(invoiceID, removed)); } }`. The removed payment keeps its `id` and `date`. `addPaymentToDoc` refuses a second restore (`duplicate`).
   - `INVOICE_SET_STATUS`: keep 014's unknown-status guard. Replace the per-doc `withStatus` call with `setDocStatus(doc, status, now)` for single ids and arrays. Write the ok docs with `updateDocs`, then `next(INVOICE_UPDATE)` and `syncEditMode`. Failed docs → one warning toast with the count and the first reason. `stillPaid` → info toast `invoices:payments:toast:stillPaid`.
   - `INVOICE_DUPLICATE`: add `'payments'` to 015's `omit` list.
5. Update `app/middlewares/__tests__/InvoicesMW.spec.js` (group C). `await` every middleware call.

**Verify**: `npx vitest run app/middlewares/__tests__/InvoicesMW.spec.js app/reducers/__tests__/FormReducer.spec.js` → all pass.

### Step 4: Edit mode keeps payments

1. `app/helpers/form.js` `getInvoiceData`: next to 017's `paidAt` line, add `payments: editMode.active ? editMode.data.payments : undefined` (PouchDB drops `undefined`). Then, in edit mode only, return `reconcilePaymentStatus(data, now)`.
2. `app/helpers/preview.js` `formToPreviewInvoice`: add `payments: form.settings.editMode.active ? form.settings.editMode.data.payments : undefined` to `invoice`, so the live preview prints the same payment lines as the PDF.
3. `app/middlewares/FormMW.jsx` `FORM_SAVE`, edit path only: after `getInvoiceData` returns `data`, call `getPaymentEditErrors(data, editMode.data)`. If the array is not empty: show one warning toast per error (format `total`/`paid` with `formatNumber` and the invoice currency), do not save, keep the form, and resolve `false`.
4. `TotalsFooter.jsx`: in edit mode with `getPayments(editMode.data).length > 0`, add the lines "Amount paid" and "Balance due" under Total. Use the live total and `editMode.data.payments`.
5. Tests (group D).

**Verify**: `npx vitest run app/helpers/__tests__/form.spec.js app/helpers/__tests__/preview.spec.js app/middlewares/__tests__/FormMW.spec.js` → all pass.

### Step 5: Status token, badge and list helpers

1. `ui/styles/globals.css`:
   - Next to the other `--color-status-*` lines in `@theme inline`, add `--color-status-partial: var(--status-partial);` and `--color-status-partial-bg: var(--status-partial-bg);`.
   - In light `:root`, add `--status-partial: oklch(0.45 0.07 215);` and `--status-partial-bg: oklch(0.955 0.025 215);`.
   - In the dark block, add `--status-partial: oklch(0.86 0.07 215);` and `--status-partial-bg: oklch(0.29 0.045 215);`.
2. `StatusBadge.jsx`: `partial` → icon `ChartPie`, classes `text-status-partial bg-status-partial-bg`, text `invoices:status:partial`.
3. `app/helpers/invoiceList.js`:
   - `matchesTab`: `outstanding` → `pending` or `partial`.
   - `countByTab` follows `matchesTab`.
   - `STATUS_SORT_RANK = { overdue: 0, partial: 1, pending: 2, draft: 3, paid: 4, refunded: 5, cancelled: 6 }`.
   - `toInvoiceRow` adds `amountPaid: getAmountPaid(invoice)` and `balance: getBalanceDue(invoice)`.
4. Amount cell (014 `columns.jsx`): when `displayStatus` is `partial` or `overdue` and `amountPaid > 0`, add a muted second line `invoices:payments:balanceShort` with the formatted balance.

**Verify**: `npx vitest run app/helpers/__tests__/invoiceList.spec.js` → pass. `grep -c "status-partial" ui/styles/globals.css` → `4` or more.

### Step 6: Record payment dialog

1. `DatePickerField.jsx`: add an optional `disabledDays` prop, passed to `Calendar` as `disabled`. Existing callers do not change.
2. Create `RecordPaymentDialog.jsx` (function component). Props: `invoice`, `open`, `onOpenChange`. Use shadcn `Dialog`, `Field`/`FieldLabel`/`FieldDescription`/`FieldError`, `Input`, `Select`, `Textarea`, `Button` and `DatePickerField`.
   - Title `payments:dialog:title`. Description: number + balance due (`formatInvoiceAmount` style: code before/after per `currency.placement`).
   - Amount: `Input` with `inputMode="decimal"`, `autoFocus`, and the currency code beside it. Default = `formatAmountInput(getBalanceDue(invoice), invoice.currency)`. A link button `payments:dialog:payFull` puts the full balance back.
   - Date: `DatePickerField`, default today, `disabledDays={{ after: new Date() }}`. Store `startOfDay(date.getTime())`.
   - Method: `Select` over `PAYMENT_METHODS` with labels `payments:methods:<m>`. Default `bank`.
   - Note: `Textarea`, `maxLength={500}`, optional.
   - Submit (a `<form onSubmit>`, so Enter submits): run `getPaymentErrors`. Show errors after the first submit, then live. If there are no errors: `const ok = await dispatch(recordPayment(invoice._id, { amount: parsed.value, date, method, note }))`. Close on `ok === true`.
   - Reset the fields each time the dialog opens.
3. `app/containers/Invoices.jsx`: add state `paymentForId` and render one `RecordPaymentDialog` for it.

**Verify**: `npm run build` → exit 0. Manual check in Step 12.

### Step 7: Row actions, detail sheet, bulk bar

1. `InvoiceRowActions.jsx`: replace "Mark as paid" with two items, shown only when `canRecordPayment(invoice)`:
   - "Record payment…" (`HandCoins`), which opens the dialog through `onRecordPayment(id)`.
   - "Mark as paid in full", which dispatches `recordFullPayment(id)`.
2. Create `PaymentsList.jsx`. Props: `invoice`, `dateFormat`. Show a `<ul>` of `getPayments(invoice)`, newest first. Each row shows the date, the method label, the note (muted) and the amount (`tabular-nums text-end`). It also has a remove icon button (`Trash2`, ≥ 24 px, `aria-label` `payments:remove` with amount and date) that dispatches `removePayment(invoice._id, p.id)`. When the list is empty, show `payments:empty`.
3. `InvoiceDetailSheet.jsx`:
   - Under Total, show "Amount paid" and "Balance due" when `getAmountPaid(invoice) > 0`.
   - Add a "Payments" section with `PaymentsList`.
   - Footer: "Record payment" and "Mark as paid in full" replace "Mark as paid". Show them only when `canRecordPayment(invoice)`.
   - Next to the badge: when `getDisplayStatus(invoice, now) === 'overdue'` and `getPayments(invoice).length > 0`, show the muted text `payments:partiallyPaid`.
   - The sheet renders its own `RecordPaymentDialog`. Base UI supports nested dialogs.
4. `BulkActionsBar.jsx`: the button label becomes `bulk:markPaidInFull`. It dispatches `recordFullPayment(selectedIds)`. The middleware skips invoices that cannot be paid and reports the count.

**Verify**: `npm run build && npm run lint` → exit 0. `grep -rn "setInvoiceStatus(.*'paid')" app/components` → no output.

### Step 8: Dashboard and client totals

1. `app/helpers/dashboard.js`:
   - `getDashboardStats`: outstanding/outstandingCount include display `partial`. Outstanding and overdue sum `getBalanceDue(inv)` instead of `amountOf(inv)`. `paidThisMonth` sums `getPaymentEvents(inv)` with a date in the current month.
   - `getMonthlyPaid`: bucket `getPaymentEvents` by event date.
   - `getNeedsAttention`: the "due soon" part includes display `partial`.
2. `app/helpers/clients.js` `summarizeClients`: outstanding = `getBalanceDue` of display `pending | partial | overdue`.
3. Tests (group E).

**Verify**: `npx vitest run app/helpers/__tests__/dashboard.spec.js app/helpers/__tests__/clients.spec.js` → all pass.

### Step 9: CSV columns

In `app/helpers/csv.js` `buildInvoicesCsv`: append `amount_paid,balance_due` to the header. `amount_paid` = `getAmountPaid(inv).toFixed(f)`. `balance_due` = `getBalanceDue(inv).toFixed(f)`, or `''` when the display status is `draft`, `refunded` or `cancelled`. `status` already comes from `getDisplayStatus`, so it can be `partial`.

**Verify**: `npx vitest run app/helpers/__tests__/csv.spec.js` → pass (group F).

### Step 10: Strings

1. `i18n/en/invoices.json`:
   - Add `status.partial: "Partially paid"`.
   - In `actions`, replace `markAsPaid` with `"recordPayment": "Record payment…", "markPaidInFull": "Mark as paid in full"`. In `bulk`, replace `markAsPaid` with `"markPaidInFull": "Mark as paid in full"`.
   - Add this group:
   ```json
   "payments": {
     "title": "Payments", "empty": "No payments recorded.", "amountPaid": "Amount paid", "balanceDue": "Balance due",
     "partiallyPaid": "Partially paid", "balanceShort": "{{amount}} due", "remove": "Remove payment of {{amount}} on {{date}}",
     "methods": { "bank": "Bank transfer", "cash": "Cash", "card": "Card", "paypal": "PayPal", "other": "Other" },
     "dialog": { "title": "Record payment", "description": "Invoice {{number}} · Balance due {{balance}}", "amount": "Amount",
       "payFull": "Pay full balance", "date": "Payment date", "method": "Method", "note": "Note",
       "notePlaceholder": "Reference or remark (optional)", "submit": "Record payment", "cancel": "Cancel" },
     "errors": { "amountInvalid": "Enter an amount, for example {{example}}.", "amountPositive": "The amount must be more than 0.",
       "tooManyDecimals_zero": "Use whole numbers only.", "tooManyDecimals_one": "Use at most {{count}} decimal place.",
       "tooManyDecimals_other": "Use at most {{count}} decimal places.", "overpayment": "The amount is more than the balance due ({{balance}}).",
       "dateRequired": "Choose a payment date.", "dateFuture": "The payment date cannot be in the future.",
       "draft": "Drafts cannot get payments. Save the invoice first.",
       "closed": "Refunded or cancelled invoices cannot get payments. Set the status to Pending first.",
       "nothingDue": "This invoice has no balance due.", "duplicate": "This payment is already recorded.",
       "notFound": "The invoice or payment was not found.",
       "draftWithPayments": "An invoice with payments cannot become a draft. Remove the payments first." },
     "toast": { "recorded_one": "Payment recorded", "recorded_other": "{{count}} payments recorded",
       "skipped_one": "{{count}} invoice skipped: {{reason}}", "skipped_other": "{{count}} invoices skipped: {{reason}}",
       "removed": "Payment removed", "undo": "Undo", "stillPaid": "The payments cover the total, so the invoice stays Paid." }
   }
   ```
2. `i18n/en/form.json` `errors`: add `"totalBelowPaid": "The new total ({{total}}) is less than the amount already paid ({{paid}}). Remove a payment first."` and `"currencyLocked": "This invoice has payments. You cannot change its currency."`. Under `totals`, add `"amountPaid": "Amount paid"` and `"balanceDue": "Balance due"`.
3. `i18n/en/preview.json` `common`: add `"amountPaid": "Amount paid"` and `"balanceDue": "Balance due"`. Other locales fall back to English.

**Verify**: `for f in invoices form preview; do node -e "JSON.parse(require('fs').readFileSync('i18n/en/$f.json','utf8'))" && echo ok; done` → 3 × `ok`. `grep -rhoE "invoices:payments:[a-zA-Z:]+" app | sort -u` → every key exists in the JSON (check plural keys without the suffix).

### Step 11: Templates and PDF baseline

1. In both `Main.jsx` files, import `getPayments`, `getAmountPaid`, `getBalanceDue` from the same `app/helpers/invoice` path as `getInvoiceValue`. Compute `const hasPayments = getPayments(invoice).length > 0;`.
2. Minimal: after `</Total>` and before `</InvoiceSummary>`, render only when `hasPayments`: `<AmountPaid>` (`styled.tr\`\``) and `<BalanceDue>` (`styled.tr\` font-weight: 700; \``). Each has a label `<td>` (`t('preview:common:amountPaid' | 'balanceDue', { lng: currentLanguage })`) and a money `<td>`. Copy the exact money markup from lines 210-212.
3. Business: after `</InvoiceTotal>` and before `</tfoot>`, render only when `hasPayments`: two rows with the subtotal-row structure (`<td colSpan="2" /><td className="label" colSpan="2">label</td><td>money</td>`). Give the balance row `styled.tr` with `font-weight: 700;`.
4. Do not change any existing row, style or prop. Invoices without payments must render byte-for-byte the same.
5. `scripts/pdf-snapshot.mjs`:
   - Change the case loop so that a case may hold invoice overrides: `const { invoice: extra = {}, ...cfg } = def; const invoice = { ...BASE, ...extra, configs: { ...DEF, ...cfg } };`.
   - For each template, add `${template}-partial` with `invoice: { payments: [{ id: 'p1', date: Date.UTC(2026, 0, 20), amount: 1500, method: 'bank', note: '' }] }`.
   - Also add `${template}-paid-full` with `invoice: { status: 'paid', paidAt: Date.UTC(2026, 0, 25), payments: [{ id: 'p2', date: Date.UTC(2026, 0, 25), amount: 3937.04, method: 'bank', note: '' }] }`.
6. Run:
   ```sh
   npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-020-after
   mkdir -p /tmp/manta-pdf-020-new && mv /tmp/manta-pdf-020-after/*-partial-* /tmp/manta-pdf-020-after/*-paid-full-* /tmp/manta-pdf-020-new/
   sh scripts/pdf-compare.sh /tmp/manta-pdf-020-before /tmp/manta-pdf-020-after --light-ref
   pdftotext -layout /tmp/manta-pdf-020-new/minimal-partial-light.pdf - | grep -iE "amount paid|balance due"
   pdftotext -layout /tmp/manta-pdf-020-new/business-paid-full-light.pdf - | grep -iE "amount paid|balance due"
   ```
7. Open `minimal-partial-light.pdf` and `business-partial-light.pdf`. Confirm by eye that the two new rows align with Total and that the page count is 1.
8. New baseline: `cp /tmp/manta-pdf-020-new/*.pdf /tmp/manta-pdf-020-after/`. `/tmp/manta-pdf-020-after` (36 PDFs) is now the baseline for later template plans. Write its path in your report.

**Verify**:
- The compare prints `ALL IDENTICAL` for the 28 old cases.
- The partial PDF shows `Amount paid … $ 1,500.00` and `Balance due … $ 2,437.04`.
- The paid-full PDF shows `$ 3,937.04` and `$ 0.00`.

### Step 12: Full checks and manual smoke

1. `npm test` → exit 0. `npm run lint` → exit 0. `npm run test:e2e` → all pass.
2. On `/tmp/manta-profile-copy` (`MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev`), check each item in **light and dark** mode:
   - Old invoices show the same status and amount as before.
   - Old paid invoices show no payments and Balance due 0, and they offer no "Record payment".
   - On a pending invoice of 100, record 40. The badge becomes "Partially paid" (teal, icon + text). The sheet lists the payment. The row shows "60.00 due". The invoice stays in the Outstanding tab.
   - Record 70 → error "more than the balance due (60.00)". Record 60 → Paid. Check in Redux DevTools: `paidAt` = the date of the 60 payment.
   - Remove the 60 payment → Partially paid. Undo → Paid again. Click Undo twice → only one payment exists.
   - A future date cannot be picked. Amount `0` and `abc` show errors. For a `dotComma` currency, `1.234,5` is accepted as 1234.5.
   - Select 2 pending invoices and 1 draft → bulk "Mark as paid in full" → 2 paid. The toast says 1 skipped.
   - Edit a partially paid invoice and add a row → after Update it stays Partially paid. The payments are still there.
   - Edit a paid invoice and lower a price below the paid amount → the save is refused with a toast, and the form keeps your input.
   - Duplicate a paid invoice → the editor has no payments. After save, the copy is Pending.
   - Record a payment while the same invoice is open in the editor, then press Update → no 409 error, and the payment is kept.
   - Dashboard: Outstanding drops by the paid part. "Paid this month" grows by the payment amount, not by the invoice total.
   - The client sheet shows the balance as outstanding. CSV has `amount_paid,balance_due` and `partial`.
   - The preview window and the editor live preview show "Amount paid"/"Balance due" only for invoices with payments. The paper stays white in dark mode.
3. Take screenshots (table with a Partially paid badge, sheet with payments, dialog), light and dark, if possible.

**Verify**: every item behaves as written. Record any failure in the report.

## Test plan

Logic only. No markup, snapshot or class-name tests. TZ is UTC (`vitest.config.mjs`). `crypto.randomUUID` → `'id-string'` (`vitest.setup.js`).

- **A. `invoice.spec.js`**:
  - `roundMoney`: the Facts values, negative values, `NaN` → 0, fraction `'x'` → 2.
  - Consistency: for `[1.005, 2.675, 3937.0375, 99.995, 0.125]`, `formatNumber(roundMoney(x, 2), 2, 'commaDot') === formatNumber(x, 2, 'commaDot')`.
  - `getPayments` removes duplicate ids and entries with missing/invalid ids or out-of-range dates; drops `{amount: -1}`, `{amount: 'x'}`, `null` and entries without `date`, and sorts by date.
  - `getAmountPaid`:
    - legacy paid without `payments` → total
    - paid with `payments: []` → 0
    - pending without payments → 0
    - `0.1+0.2` payments → `0.3`
  - `getBalanceDue`: total `3937.0375` minus a payment of `3937.04` → `0`; fraction 0.
  - `getDisplayStatus`:
    - pending + 40/100 → `partial`
    - past due + 40/100 → `overdue`
    - pending + 0 paid → `pending`
    - paid → `paid`
- **B. `payments.spec.js`**:
  - `parseMoneyInput` for `commaDot`, `dotComma` and space, with `1,234.50`, `1.234,5`, `1 234.5`, `''`, `1e3` and `-5`.
  - Round trip `parseMoneyInput(formatAmountInput(x, c), c.separator).value === roundMoney(x, f)`.
  - `getPaymentErrors`: each error key; the boundary amount = balance is ok; a date at today 23:59 is ok; tomorrow 00:00 → `dateFuture`.
  - Transitions on one invoice of 100:
    - add 40 → pending/partial
    - add 60 → paid with `paidAt` = date of the second payment
    - remove 60 → pending without `paidAt`, partial
    - remove 40 → pending, `payments: []`, display pending
  - A back-dated payment that clears the balance sets `paidAt` to the clearing date, not the newest date.
  - `addPaymentToDoc` also refuses `Infinity`, future/out-of-range dates, excess decimals and a 501-character note when called directly. It refuses: draft, refunded, cancelled, legacy paid (`nothingDue`), duplicate id, overpayment. The input doc is not mutated. Unknown method → `other`.
  - `markDocPaidInFull`: pending → one payment of the exact balance, status paid; zero-total pending → paid without a payment; draft/refunded → error.
  - `setDocStatus`:
    - `draft` with payments → error
    - `pending` on a fully paid doc → stays paid, `stillPaid: true`
    - `cancelled` keeps payments and removes `paidAt`
    - `pending` on a refunded doc with full payments → paid
  - `getPaymentEditErrors`: currency code/fraction change and total below paid are blocked; an unpaid doc without payments has no error; a legacy paid doc without payments cannot change total/currency until explicitly reopened.
  - `getPaymentEvents`: payments, legacy paid, refunded → `[]`.
- **C. `InvoicesMW.spec.js`**:
  - ADD single → `updateDocs` gets 1 doc with the payment and `next` gets `INVOICE_UPDATE`; resolves `true`.
  - ADD with an array and `fullBalance` → each doc gets its own balance. A draft in the array is skipped, and the warning has `count: 1`.
  - All fail → resolves `false` and `updateDocs` is not called. Mixed bulk write results count committed docs only; a 409 never overwrites the latest revision. Two overlapping additions to the same invoice cannot exceed its remaining balance or lose an event; retry with the same id cannot add it twice.
  - REMOVE → calling the toast `actionProps.onClick` dispatches `recordPayment` with the removed payment (same `id`).
  - SET_STATUS `paid` → payment added. `'overdue'` is still refused.
  - Edit-mode sync: the open invoice's id → `FORM_EDIT_DATA_SYNC` with the fresh doc. Another id → no sync.
  - DUPLICATE → the `FORM_LOAD_DUPLICATE` payload has no `payments`.
- **D. Edit mode**:
  - `form.spec.js`: edit keeps `payments` and `paidAt`; a raised total on a paid doc with payments → `status: 'pending'`, no `paidAt`; a new invoice has no `payments` key.
  - `preview.spec.js`: edit mode passes `payments`.
  - `FormMW.spec.js`: a total below paid → no save, resolves `false`.
  - `FormReducer.spec.js`: `FORM_EDIT_DATA_SYNC` matching id → replaced; other id → unchanged.
- **E. `dashboard.spec.js` / `clients.spec.js`**:
  - USD 100 with 40 paid on 2026-11-03 → outstanding 60, `paidThisMonth` 40 for `now = 2026-11-15`.
  - The same invoice overdue → overdue 60.
  - Payments in October and November → two month buckets.
  - Legacy paid → total at `getPaidDate`.
  - A refunded invoice with payments counts nowhere.
  - EUR and USD stay separate.
  - Client outstanding = balance. Partial is included.
  - Update 017's existing expectations that assumed `grandTotal`.
- **F. `csv.spec.js`**:
  - Header ends with `amount_paid,balance_due`.
  - A partial invoice prints `40.00,60.00` and status `partial`.
  - Draft/cancelled → empty `balance_due`.
  - Fraction 0.
- **Existing tests to update, not delete**: 014's `InvoicesMW` SET_STATUS and bulk "paid" expectations; 014's `invoiceList` tab/rank tests; 017's dashboard sums.
- **PDF**: the 018 compare (Step 11) proves that old invoices print identically.
- No new e2e test.

## Done criteria

- [ ] `npm test`, `npm run lint`, `npm run build` exit 0; `npm run test:e2e` all pass.
- [ ] `npx vitest run app/helpers/__tests__/payments.spec.js app/helpers/__tests__/invoice.spec.js app/middlewares/__tests__/InvoicesMW.spec.js` → groups A–C present and passing.
- [ ] `sh scripts/pdf-compare.sh /tmp/manta-pdf-020-before /tmp/manta-pdf-020-after --light-ref` (without the new cases) → `ALL IDENTICAL`.
- [ ] `grep -rn "'partial'" app/middlewares app/helpers/pouchDB.js` → no output (`partial` is never stored).
- [ ] `grep -n "INVOICE_PAYMENT_ADD\|INVOICE_PAYMENT_REMOVE\|FORM_EDIT_DATA_SYNC" app/constants/actions.jsx` → 3 lines. `git diff 3e89104 -- app/constants/actions.jsx` shows no renamed type.
- [ ] `grep -c "status-partial" ui/styles/globals.css` → ≥ 4.
- [ ] `grep -n "'payments'" app/middlewares/InvoicesMW.jsx` → the duplicate `omit` list.
- [ ] Manual smoke (Step 12) passed in light and dark mode on a copied profile.
- [ ] `git log --format=%B <base>..HEAD | grep -ci "co-authored\|generated with"` → `0`.
- [ ] `plans/README.md` row for 020 updated (unless a reviewer maintains it).

## STOP conditions

- A precondition fails, or a 014–018 name cannot be found.
- The drift check shows `helpers/formatNumber.js` or a template `Main.jsx` changed since `3e89104`.
- Step 0 does not write 28 PDFs, or Step 11 reports any difference for the 28 old cases. Do not change the snapshot `BASE` or the compare script to hide it.
- An invoice on the copied profile changes status, amount or `paidAt` only because the app was opened (no user action).
- A test shows that `addPaymentToDoc` or `reconcilePaymentStatus` can make an invoice `paid` while `getBalanceDue > 0`.
- The editor save after a recorded payment fails with 409, and `FORM_EDIT_DATA_SYNC` cannot fix it inside 015's reducer shape.
- You feel you must store `partial` or `overdue`, add a payments database, or change the backup format.

## Maintenance notes

- **Rules live in two files.** Read helpers are in `app/helpers/invoice.js` (`roundMoney`, `getPayments`, `getAmountPaid`, `getBalanceDue`, `getDisplayStatus`). Write rules are in `app/helpers/payments.js`. Never compute paid or balance elsewhere. Every payment write must go through `addPaymentToDoc` / `removePaymentFromDoc` / `setDocStatus`, so `reconcilePaymentStatus` always runs.
- **023 (credit notes)** extends `getBalanceDue` with issued credit notes. Then `reconcilePaymentStatus` and the overpayment rule apply to "payments + credits". Keep the JSDoc note.
- **022/023 doc types**: `canRecordPayment` must also require `getDocType(doc) === 'invoice'` once 022 adds `docType`. Estimates and credit notes get no payments.
- **024 (recurring)** creates drafts. Drafts have no `payments` key. Keep it that way.
- **026 (email reminders)** should print the balance due, not the total, for partial invoices.
- **paidAt** follows 014's `withStatus`: it is removed when the invoice leaves `paid`. Keep 017's dashboard/date rules aligned with this lifecycle.
- **Legacy rule** (Decision 2) depends on `payments` being absent. Do not write `payments: []` to docs that never had a payment (for example in an import or migration). That would make old paid invoices show a full balance due.
- **PDF baseline**: `/tmp/manta-pdf-020-after` (36 PDFs, machine-local) is the new reference. Later template plans (021 tax breakdown, 022/023 titles) take a fresh baseline at their own start, with the 4 payment cases included.
- The preview window does not refresh by itself after a payment. The user reopens the preview. A later plan can send `update-preview` after `INVOICE_UPDATE` if users ask for it.
- Reviewers: check that no code path stores `partial`, that the overpayment check uses rounded values, that undo cannot add a payment twice, that old PDFs are identical, and that `getPayments` filters malformed imported entries.
