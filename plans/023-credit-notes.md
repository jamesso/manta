# Plan 023: Add credit notes linked to an original invoice, with partial credit and balance updates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- app/helpers/invoice.js app/helpers/invoiceList.js app/helpers/dashboard.js app/helpers/csv.js app/helpers/clients.js app/helpers/backup.js app/helpers/form.js app/helpers/numbering.js app/constants app/actions/invoices.jsx app/reducers/FormReducer.jsx app/middlewares/InvoicesMW.jsx app/middlewares/FormMW.jsx app/containers/Invoices.jsx app/containers/Dashboard.jsx app/components/invoices app/components/form/editor preview/templates app.js scripts/pdf-snapshot.mjs i18n/en`
> Plans 012–022 change almost all of these files on purpose (014 table and status helpers, 015 editor and numbering, 016 CSV and backup, 017 dashboard, 018 PDF scripts, 020 payments, 021 tax, 022 `docType` and estimates). Compare only the parts this plan depends on: the names in "Expected after 012–022" and the template lines in "At 3e89104". If a name differs, find the real name with the Preconditions greps and use it. If a thing does not exist, STOP.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: HIGH — this plan writes a new document type into the `invoices` database and changes the stored status of the credited invoice.
- **Depends on**: plans/022 (`docType`, `getDocType`, doc-type editor mode), plans/020 (`getAmountPaid`, `getBalanceDue`), 014, 015, 016, 017 (and transitively 012, 013, 018, 019, 021)
- **Category**: feature
- **Planned at**: commit `3e89104`, 2026-11-01 (runs after 018 and after 019–022)

## Why this matters

Issued invoices need a separate correction history. This feature provides a credit note: a new numbered document that refers to the original invoice. Today Manta has no credit notes. Users edit or delete a sent invoice, so the books and the client's copy do not match. This plan adds credit notes with full and partial credit. A credit note reduces the balance due of its invoice. When a credit note fully credits an unpaid invoice, the invoice closes. 025 (ZUGFeRD/Factur-X) needs these documents for type code 381 with a preceding-invoice reference.

## Decisions (fixed for this plan)

1. **Storage**: credit notes live in the `invoices` database with `docType: 'creditNote'` (022 rule). Doc shape:
   `{ _id, _rev, docType: 'creditNote', status, invoiceID, creditedInvoiceId, creditedInvoice: { invoiceID, issuedAt }, issuedAt, created_at, recipient, rows, currency, tax?, discount?, note?, configs?, subtotal, grandTotal, voidedAt? }`.
   `invoiceID` holds the credit note number (`CN-0001`), so the templates read it without change. `creditedInvoice` is a snapshot of the original number and issue date. The template prints it, and it still works if the original is missing (for example after a partial import). 025 maps it to BT-25/BT-26.
2. **Statuses**: stored `draft | issued | void`. Unknown or missing → `draft`. Only `issued` credit notes change balances, statuses, dashboard and creditable amounts. Drafts do not reserve an amount.
3. **Amounts are positive** in rows and totals. The title "Credit note" and the label "Total credit" give the meaning. The CSV shows credit notes as negative numbers (Decision 9).
4. **Who can be credited**: only `docType === 'invoice'` with stored status `pending`, `paid` or `refunded` (display `pending`, `overdue`, `partial`, `paid`, `refunded`), and only when the creditable amount is > 0. `draft` is blocked (it is not issued; edit it). `cancelled` is blocked (it is closed). `refunded` is allowed, because users often record the refund first and then need the credit document.
5. **Creditable amount**: `getCreditableAmount(invoice, creditNotes, { excludeId })` = `max(0, round(invoiceTotal − Σ grandTotal of issued credit notes linked to it, except excludeId))`. Round to `currency.fraction ?? 2`. A credit note cannot be saved or issued when its `grandTotal` is greater than the creditable amount. The check runs again on fresh database docs at save and at issue time, inside a queue keyed by original invoice id. This covers create-final, draft issue, edit, void and payment operations that affect the same balance. A read/check/write sequence without that queue can over-credit through two simultaneous credit notes. Validate currency code and normalized fraction as well as amount; malformed or mismatched imported credits must be reported, never silently summed.
6. **Status rule** (`resolveStatusAfterCredit(invoice, creditNotes, now)`). It runs after each issue or void. It never touches `draft` or `refunded`, or `cancelled` without `cancelledByCredit: true` (a manual cancel). Let `credited` = issued credit total, `paid` = effective paid amount (Step 2), and `balance = total − paid − credited`:
   - `credited ≥ total` and `paid = 0` → `cancelled`, set `cancelledByCredit: true`.
   - otherwise `balance ≤ 0` → `paid` (keep the existing `paidAt`; if it was not paid, use the clearing payment/credit event date). If a previously pending invoice has no `payments` array, write `payments: []` when credits cause this transition. This marks zero recorded cash and prevents 020's legacy-paid fallback from inventing a full cash payment. Remove `cancelledByCredit`. Never add a synthetic payment for credit value.
   - otherwise (`balance > 0`): if the status is `paid`, or `cancelled` with `cancelledByCredit`, → `pending` and remove `cancelledByCredit`. Else no change.
   - The rule never sets `refunded`. When `balance < 0` (the client paid more than the net amount), the detail sheet shows "Refund due". The user sets "Refunded" by hand after paying the money back. This keeps the model simple. 020 has no refund payments.
   - All status writes go through 014's `withStatus`. The same credit-aware settlement function must run after payment add/remove, invoice edit and credit issue/void. A separate payment-only reconciler must not reopen an invoice already settled by credits.
7. **Lifecycle**: drafts can be edited and deleted (014 delete with Undo). An issued credit note cannot be edited or deleted. It can only be voided (confirmation dialog, because void has no Undo). Void is final. An invoice that has any linked credit note (any status) cannot be deleted. Enforce lifecycle checks in middleware and FormMW using the fresh saved status, not only by hiding UI actions; direct edit/update/config-save/status/duplicate actions must not mutate an issued or void credit note. Keep the original recipient, seller tax snapshot, currency and tax-calculation version on credit drafts.
8. **Numbering**: settings key `invoice.creditNoteNumbering = { prefix: 'CN-', next: 1, padding: 4 }`. Reuse 015's `normalizeNumbering`, `formatInvoiceNumber` and `advanceNumbering`. The number is pre-filled and advances on the first save (draft or issued), as for invoices.
9. **Dashboard and CSV**: "Paid this month" stays cash received (020 rule). A separate line "Credit notes this month: −X" shows issued credit notes per currency by issue date. "Outstanding" and "Overdue" use the balance after credits. The CSV gets the columns `docType` and `creditedInvoice` at the end. Credit note rows have negative `subtotal`, `tax`, `discount` and `total`. Never add amounts of different currencies.
10. **Backup**: bump version 4 → 5. A 022 build has no credit accounting and must refuse this backup rather than restore a misleading invoice balance. Import keeps accepting versions 1–4. Plan 024 then advances to 6.
11. **UI**: no new sidebar item. The Invoices page gets a tab "Credit notes". The invoice row menu and the detail sheet get "Create credit note". Both detail sheets link to each other.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current; git status --short` | record the current branch and existing changes; keep both |
| 022 doc types | `grep -n "getDocType" app/helpers/invoice.js` | one export |
| 022 numbering per type | `grep -n "estimateNumbering" app.js` | one hit in `defaultOptions.invoice` |
| 022 editor mode | `grep -rn "docType" app/reducers/FormReducer.jsx app/helpers/form.js` | hits (note how the form stores the type) |
| 022 template title switch | `grep -rln "estimate" preview/templates` | both `Header.jsx` files (note the helper or key it uses) |
| 020 payments | `grep -nE "getAmountPaid\|getBalanceDue" app/helpers/invoice.js` | two exports |
| 020 callers | `grep -rn "getBalanceDue(" app --include='*.js' --include='*.jsx' \| grep -v __tests__` | list of callers (you update each in Step 4) |
| 014 helpers | `grep -nE "withStatus\|getStoredStatus\|getIssuedAt\|getInvoiceNumber\|formatInvoiceAmount" app/helpers/invoice.js` | all exported |
| 014 list + sheet | `ls app/helpers/invoiceList.js app/components/invoices/InvoiceDetailSheet.jsx app/components/invoices/InvoiceRowActions.jsx app/components/invoices/columns.jsx` | all listed |
| 014 bulk helpers | `grep -nE "removeDocs\|restoreDocs\|updateDocs" app/helpers/pouchDB.js` | three exports |
| 015 numbering | `grep -nE "normalizeNumbering\|formatInvoiceNumber\|advanceNumbering" app/helpers/numbering.js` | three exports |
| 016 CSV | `grep -n "buildInvoicesCsv" app/helpers/csv.js` | one export |
| 016 import status check | `grep -n "STATUSES" app/helpers/backup.js` | note the result (Step 9) |
| 017 dashboard | `grep -n "getDashboardStats" app/helpers/dashboard.js` | one export |
| 018 PDF scripts | `test -f scripts/pdf-snapshot.mjs && test -f scripts/pdf-compare.sh && echo ok` | `ok` |
| 013 dialog + toast | `ls ui/lib/dialog.js && grep -rn "export.*toast" ui/lib ui/components/ui/toast.jsx` | file listed; `toast` export |
| PDF tools | `pdftoppm -v 2>&1 \| head -1; magick -version \| head -1` | versions print |
| Tests and lint | `npm test && npm run lint` | exit 0 |

Use a **copy** of user data for every manual run: `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy`, then `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev`.

## Current state

### (a) At 3e89104 (012–022 do not change these parts, or change them only around them)

`app/helpers/invoice.js:1-51`: `getInvoiceValue(data)` returns `{ subtotal, discount, taxAmount, grandTotal }`. Discount is subtracted. Tax is added only when `tax.method === 'default'` (`:34-38`). 021 adds `getInvoiceTotals` with per-rate groups and freezes `getInvoiceValue`; this plan must use `getInvoiceTotals` for new calculations. Credit notes reuse it unchanged.

`preview/templates/minimal/components/Header.jsx:56,67-70` (title and issue date):

```jsx
56          {t('preview:common:invoice', { lng: language })}
67        <p>
68          {t('preview:common:created', { lng: language })}:{' '}
69          {moment(invoice.created_at).lang(language).format(configs.dateFormat)}
70        </p>
```

`preview/templates/business/components/Header.jsx:95,106-109`: the same title and date lines. 015 replaced `invoice.created_at` with `getIssuedAt(invoice)`. 022 replaced the title key with a doc-type switch.

`preview/templates/minimal/components/Main.jsx:207-214` and `business/components/Main.jsx:226-239`: the total row prints `t('preview:common:total', …)` and `formatNumber(invoice.grandTotal, fraction, separator)`.

`i18n/en/preview.json` `common`: `billedTo, chooseInvoiceToPreview, created, due, invoice, itemDescription, notice, order, price, qty, subtotal, total`.

`app.js:195-218`: `defaultOptions.invoice` (`exportDir`, `template`, `dateFormat`, `tax`, `currency`, `required_fields`). `app.js:221-240`: `setInitialValues()` adds missing level-2 keys. So a new `invoice.creditNoteNumbering` key reaches existing users without a migration.

`app/store/index.jsx:16`: `const middlewares = [FormMW, ContactsMW, InvoicesMW, SettingsMW, UIMiddleware];`. Credit note actions go into `InvoicesMW` (it owns all writes to the `invoices` database).

`app/middlewares/InvoicesMW.jsx:206-213` at HEAD: `INVOICE_SET_STATUS` writes any status. 014 adds a guard against `INVOICE_STATUSES`. Credit note statuses must therefore use their own actions (Step 5), never `setInvoiceStatus`.

### (b) Expected after 012–022 (expectations — check each in Preconditions)

- 014: `app/constants/invoices.js` `INVOICE_STATUSES = ['draft','pending','paid','refunded','cancelled']`, `UNDO_TIMEOUT_MS`. `app/helpers/invoice.js`: `getIssuedAt`, `getStoredStatus`, `getDueDate`, `getDisplayStatus`, `withStatus(doc, status, now)` (sets/clears `paidAt`), `getInvoiceNumber`, `formatInvoiceAmount`. `app/helpers/invoiceList.js`: `INVOICE_TABS`, `matchesTab`, `toInvoiceRow`, `countByTab`, `matchesSearch`. Components `InvoiceDetailSheet.jsx`, `InvoiceRowActions.jsx`, `StatusBadge.jsx`, `columns.jsx` (`getColumns({ t, dateFormat, onOpen, actions })`). `pouchDB.js`: `removeDocs`, `restoreDocs`, `updateDocs` (014 Step 4).
- 015: `app/helpers/numbering.js` (`DEFAULT_NUMBERING`, `normalizeNumbering`, `formatInvoiceNumber`, `advanceNumbering`). `FormMW` `handleSave(store, mode)` with `getFormErrors(form, mode)`, `resolveSaveStatus(mode, editData)`, `FORM_LOAD_DUPLICATE`. Editor cards in `app/components/form/editor/` (`ClientField`, `DetailsCard`, `TotalsFooter`, …) (015 Steps 5–9).
- 016: `app/helpers/csv.js` `buildInvoicesCsv(invoices, now)` with header `number,client,issued,due,status,currency,subtotal,tax,discount,total` (020/022 may have added columns). `app/helpers/clients.js` `summarizeClients`. `app/helpers/backup.js` `parseBackup`, `planMerge` (016 Step 9).
- 017: `app/helpers/dashboard.js` `getDashboardStats(invoices, now, fallbackCurrency)` → `byCurrency[code] = { outstanding, overdue, paidThisMonth, … }`; `KpiCards.jsx`; `getPaidDate` (017 Steps 2–3).
- 018: `scripts/pdf-snapshot.mjs <outDir>` and `scripts/pdf-compare.sh <a> <b>` (018 Step 0).
- 020 (BRIEF decision): `payments: [{ id, date, amount, method, note }]`; `getAmountPaid(invoice)`; `getBalanceDue(invoice)` = grandTotal − paid; display status `partial`; "Record payment" dialog.
- 022 (BRIEF decision): `docType: 'invoice' | 'estimate' | 'creditNote'`, missing → `'invoice'`; `getDocType(doc)`; lists, dashboard, CSV and status helpers filter to `docType === 'invoice'`; numbering by type; editor doc-type mode; templates switch the title by type.

## Reference facts (recheck versions and APIs at execution)

- EN 16931 / XRechnung: document type code **381** = credit note, **384** = corrected invoice. For 381, the amounts need no extra minus sign: https://e-rechnung-bund.de/en/faq/how-should-i-indicate-credits-and-invoice-corrections/
- The preceding-invoice reference group BG-3 must contain BT-25 (preceding invoice number). BT-26 is its issue date: https://docs.peppol.eu/tdd/sk/tdd-sk/trn-tdd/businessrule/BR-55/ ; Peppol credit note notes: https://arviddejong.github.io/ubl-peppol/docs/credit-notes.html
- The code type (BT-3) carries the credit meaning; quantities and amounts stay positive in practice (Dutch NLCIUS note): https://psb.econnect.eu/documents/invoices/ubl/nlcius.html . 025 must confirm this against the KoSIT validator.
- CSV: RFC 4180 and the OWASP formula-injection rule are already in 016's `escapeCsvField`. Negative numbers are numbers, not text, so they get no `'` prefix (016 test "a negative discount number is NOT prefixed").
- lucide-react 1.x icons used here: `ReceiptText`, `FileMinus`, `Ban`, `PencilLine`, `ArrowUpRight`. Check: `node -e "const l=require('lucide-react');console.log(['ReceiptText','FileMinus','Ban','PencilLine','ArrowUpRight'].filter(n=>!l[n]))"` → `[]`. If a name is missing, pick the nearest name from https://lucide.dev/icons.
- NN/g: confirm only irreversible actions (void), use Undo for the rest: https://www.nngroup.com/articles/confirmation-dialog/
- No new npm package. Confirm the installed versions with `npm ls lucide-react @base-ui/react @tanstack/react-table`.

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
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |
| e2e | `npm run test:e2e` | all pass |
| PDF snapshot | `npm run build && node scripts/pdf-snapshot.mjs <dir>` | PDFs written |
| PDF compare | `sh scripts/pdf-compare.sh <before> <after>` | no `FAIL` line, exit 0 |
| Dev on a copy | `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev` | app opens |

## Scope

**Create**
- `app/helpers/creditNotes.js`, `app/helpers/__tests__/creditNotes.spec.js`
- A shared per-invoice mutation queue in `app/helpers/invoiceMutations.js` (+ focused spec), used by payment and credit writes; reuse an existing equivalent from 020 if present
- `app/components/invoices/CreditNoteDetailSheet.jsx`, `app/components/invoices/creditNoteColumns.jsx`, `app/components/invoices/CreditNoteRowActions.jsx`

**Change**
- `app/constants/invoices.js` (credit note constants), `app/constants/actions.jsx` (4 new types), `app/actions/invoices.jsx`
- `app/helpers/invoice.js` (+ spec): `getBalanceDue` credits argument; `getStoredStatus` per doc type
- `app/helpers/invoiceList.js` (+ spec), `app/helpers/dashboard.js` (+ spec), `app/helpers/csv.js` (+ spec), `app/helpers/clients.js` (+ spec, raw context and balance update), `app/helpers/backup.js` (+ spec, version 5, credit-note validation and counter merge), `app/helpers/numbering.js`, `app/helpers/settings.js` (+ specs, credit-note numbering)
- `app/helpers/payments.js` (+ spec, credit-aware balance and settlement), `app/helpers/preview.js`, `app/helpers/docType.js`, `app/reducers/InvoicesReducer.jsx` (+ specs, credit selector), `main/pdf-file-name.js` (+ spec, credit filenames), `app/helpers/backupFlow.js` (+ spec, raw document export context)
- `app/middlewares/InvoicesMW.jsx`, `app/middlewares/FormMW.jsx`, `app/reducers/FormReducer.jsx`, `app/helpers/form.js` (+ their specs)
- Editor cards in `app/components/form/editor/` (credit note mode), the 016/022 numbering settings partial
- `app/containers/Invoices.jsx`, `InvoiceDetailSheet.jsx`, `InvoiceRowActions.jsx`, `StatusBadge.jsx`, 017 `KpiCards.jsx`
- Both template `Header.jsx` and `Main.jsx` (credit note branch only)
- `app.js` (one default key), `scripts/pdf-snapshot.mjs` (2 new cases, after the compare)
- `i18n/en/invoices.json`, `i18n/en/preview.json`, `i18n/en/form.json`, `i18n/en/dashboard.json`

**Out of scope**
- E-invoice XML (025). Credit note reason codes. Corrected invoices (type 384).
- Refund payments (negative payments). Automatic `refunded` status.
- Printing "Credited" or "Balance due" on the original invoice PDF (the preview receives one doc only).
- A sidebar item or a command palette entry for credit notes.
- Translations other than English. The PDF title falls back to English for other invoice languages (see Maintenance notes).

## Git workflow

- Continue on the current branch and preserve existing changes. Do not switch branches, create a worktree, pull, or push unless the user requests it.
- Short imperative subjects, no prefix, no `Co-authored-by`, no AI or tool attribution.
- Suggested commits: `Add credit note helpers and status rule`, `Subtract issued credit notes from the balance due`, `Create, issue and void credit notes`, `Show credit notes on the Invoices page`, `Print credit notes in both templates`, `Show credit notes on the dashboard and in the CSV`.

## Steps

### Step 1: Baseline PDFs before any template change

1. Run `npm run build`.
2. Run `node scripts/pdf-snapshot.mjs /tmp/manta-pdf-023-before`.

**Verify**: `ls /tmp/manta-pdf-023-before/*.pdf | wc -l` → the same count as 018 wrote (28 or more).

### Step 2: Constants and pure helpers

1. In `app/constants/invoices.js` add:
   ```js
   export const CREDIT_NOTE_STATUSES = ['draft', 'issued', 'void'];
   export const CREDITABLE_STATUSES = ['pending', 'paid', 'refunded'];
   ```
2. In `app/helpers/invoice.js`:
   - `getStoredStatus(doc)`: for `getDocType(doc) === 'creditNote'`, return `doc.status` if it is in `CREDIT_NOTE_STATUSES`, else `'draft'`. Keep the invoice and estimate branches. `getDisplayStatus` returns the stored status for credit notes (no derived status).
   - `getBalanceDue(invoice, creditNotes = [])` = `roundMoney(roundMoney(getInvoiceTotal(invoice), f) − getAmountPaid(invoice) − getCreditedTotal(invoice, creditNotes), f)`, using 020's normalized `f`. `amountOf` is private to dashboard code and must not be referenced here. Without the second argument, the result is the same as 020's. Keep the issued-credit sum in the dependency-free read path in `invoice.js`; re-export it from `creditNotes.js`. `creditNotes.js` can import invoice read helpers, but `invoice.js` must not import `creditNotes.js` back. Use `docType.js` for type predicates. This keeps module loading acyclic.
3. Create `app/helpers/creditNotes.js`. No React, no `window`, no i18n. Export:
   - `isCreditNote(doc)` → `getDocType(doc) === 'creditNote'`.
   - Import `roundMoney` and fraction normalization from `./money` (020); never add the incompatible `Math.round(x * scale)` variant.
   - `groupCreditNotesByInvoice(docs)` → `Map<creditedInvoiceId, creditNote[]>` (all statuses).
   - Re-export `getCreditedTotal` from `./invoice`: include only issued credit notes for this invoice, with matching currency code/fraction and finite non-negative totals, and round the sum once. Invalid linked notes produce a visible data warning and block further issue/payment writes until resolved; do not silently ignore an amount and allow over-crediting.
   - `getEffectivePaid(invoice)` → `getAmountPaid(invoice)` exactly. Preserve the distinction between an absent payments array (legacy fallback) and `payments: []` (zero recorded cash); testing only array length invents payments after credit settlement.
   - `getCreditableAmount(invoice, creditNotes, { excludeId } = {})` (Decision 5).
   - `canCreateCreditNote(invoice, creditNotes)` (Decision 4).
   - `buildCreditNoteDraft(invoice, { idFn })` → form payload: `docType: 'creditNote'`, `creditedInvoiceId: invoice._id`, `creditedInvoice: { invoiceID: getInvoiceNumber(invoice), issuedAt: getIssuedAt(invoice) }`, and deep copies of `recipient`, `seller`, `taxMode`, `taxCalc`, `rows` (new row `id` from `idFn()`), `currency`, `tax`, `discount`, `configs`. It omits `_id`, `_rev`, `status`, `payments`, `paidAt`, `dueDate`, `issuedAt`, `created_at`, `note`, `invoiceID`, `cancelledByCredit`. It does not mutate the input.
   - `validateCreditTotal(creditNote, invoice, creditNotes)` → `null` when OK. Else one of `'creditedMissing'` (no invoice), `'creditZero'` (`grandTotal ≤ 0`), `'creditCurrency'` (currency code differs), `'creditExceeds'` (rounded credit total > rounded creditable amount; compare integer minor units without an arbitrary half-unit tolerance). Use `excludeId: creditNote._id`.
   - `resolveStatusAfterCredit(invoice, creditNotes, now)` (Decision 6). It returns a new doc, or the same object when nothing changes. Compare amounts with `roundMoney`.
   - `partitionDeletable(ids, docs)` → `{ deletable, blocked: [{ id, reason }] }`. `reason` = `'hasCreditNotes'` for an invoice with any linked credit note. `reason` = `'issuedCreditNote'` for a credit note whose status is not `draft`.
4. Write `app/helpers/__tests__/creditNotes.spec.js` and extend `invoice.spec.js` (Test plan, groups A and B).

**Verify**: `npx vitest run app/helpers/__tests__/creditNotes.spec.js app/helpers/__tests__/invoice.spec.js` → all pass.

### Step 3: Numbering setting

1. In `app.js` `defaultOptions.invoice`, add `creditNoteNumbering: { prefix: 'CN-', next: 1, padding: 4 }` next to 022's `estimateNumbering`.
2. Find how 022 maps a doc type to its settings key (`grep -rn "estimateNumbering" app`). Extend `numberingKeyFor('creditNote')` → `'creditNoteNumbering'` (the bare key, as in 022), plus its default config. FormMW alone prefixes `'invoice.'`; do not produce `'invoice.invoice.creditNoteNumbering'`. Extend numbering validation and backup `next = max(local, imported)` merging to this key, and add tests. The pre-fill and `advanceNumbering` in `FormMW` must use that key.
3. In the Settings numbering section (016 "Invoice defaults", extended by 022), add a "Credit note numbering" block. Copy the 022 estimate block.

**Verify**: `grep -n "creditNoteNumbering" app.js` → 1 hit. `npm run build` → exit 0.

### Step 4: Pass complete credit context to every settlement caller

1. In `InvoicesReducer.jsx`, keep 022's `getInvoices` invoice-only. Add memoized `getCreditNotes` and a page selector for invoices plus credit notes, based on `getAllSalesDocs`. Never widen `getInvoices`, which would put credits into invoice counts and cash totals.
2. Build `groupCreditNotesByInvoice(allSalesDocs)` before filtering. Update Dashboard, Clients, CSV-export and the Invoices page callers to supply raw all-document context separately from their filtered invoice lists. A helper that starts with `onlyInvoices` must retain the raw list to find credits. `buildInvoicesCsv` receives invoice/credit-note docs; estimates stay excluded. Add these caller files to scope when found by the audit.
3. Pass the linked credits to `getBalanceDue`, `getDisplayStatus`, `canRecordPayment`, payment validation, full-balance defaults, `addPaymentToDoc`, `removePaymentFromDoc`, `setDocStatus`, editor validation and their settlement calls. Thread optional credit context through the existing helper signatures; preserve no-credit behavior. At the mutation boundary, use freshly read docs inside the queue, not a Redux snapshot. Editor validation must enforce `new total >= amount paid + issued credits` for unpaid/refunded-excluded settlement, and lock currency code/fraction whenever any credit note exists. The existing refund-due state remains allowed when credits are newly issued against paid invoices.
4. Pass credits to invoice list/detail/status calculations, dashboard needs-attention and client outstanding calculations. Fully credited invoices must not retain an Overdue badge or an outstanding count after a failed status-sync write. Read-time display derives settlement from authoritative issued notes while the stored status is repaired.
5. The original invoice PDF keeps its historical payment-only content in this plan. At the template call site use an explicit payment-only balance helper/option; do not claim every `getBalanceDue` call includes credits while intentionally keeping PDFs unchanged. Structured export (025) must state its policy for prior credits separately. Credit note PDFs have no payment/balance rows.

**Verify**: audit every `getBalanceDue`, payment validation/reconciliation and `onlyInvoices` call in `app` and `preview`, classify its source of credit context, and record the result. `npx vitest run app/helpers app/middlewares app/reducers/__tests__/InvoicesReducer.spec.js` → pass. Tests start from a mixed raw list and prove a partial credit lowers invoice/client/dashboard/CSV balance while leaving invoice counts and cash received unchanged.

### Step 5: Actions and middleware

1. `app/constants/actions.jsx`: add `CREDIT_NOTE_NEW_FROM_INVOICE`, `CREDIT_NOTE_ISSUE`, `CREDIT_NOTE_VOID`, `CREDIT_NOTE_SYNC_INVOICE`. Do not rename existing types.
2. `app/actions/invoices.jsx`: add `createCreditNote(invoice)`, `issueCreditNote(id)`, `voidCreditNote(id)`, `syncCreditedInvoice(invoiceId)` with `createAction`.
3. `app/middlewares/InvoicesMW.jsx` (every new case returns a promise; tests `await` it):
   - `CREDIT_NOTE_NEW_FROM_INVOICE`: protect dirty editor work with 013's awaited confirmation, fetch the latest invoice and credit docs, validate `canCreateCreditNote`, then `getAllDocs('contacts')`. Dispatch 015's `FORM_LOAD_DUPLICATE` (or 022's load action for a doc type, if it exists) with `{ ...buildCreditNoteDraft(invoice, { idFn: () => crypto.randomUUID() }), contacts }`. Then `changeActiveTab('form')`. Nothing is saved.
   - `CREDIT_NOTE_ISSUE`: `docs = await getAllDocs('invoices')`. Find the credit note and its invoice. If it is already `issued`, run invoice sync idempotently and return without a second issue write. If it is `void`, show a warning and stop. Run `validateCreditTotal`. On an error, show the toast `invoices:creditNotes:errors:<code>` and do not write. Else `updateDocs('invoices', [{ ...cn, status: 'issued' }])`, then dispatch `syncCreditedInvoice(cn.creditedInvoiceId)`.
   - `CREDIT_NOTE_VOID`: the credit note must be `issued`; already `void` reruns sync idempotently. A draft is rejected. Write `{ ...cn, status: 'void', voidedAt: Date.now() }`. Then sync.
   - `CREDIT_NOTE_SYNC_INVOICE`: fresh docs. `updatedInvoice = resolveStatusAfterCredit(invoice, linkedCNs, Date.now())`. If `updatedInvoice !== invoice`, call `updateDocs('invoices', [updatedInvoice])`. Do not shadow the Redux `next` callback. Always end with `next({ type: INVOICE_UPDATE, payload: allDocs })` so the list refreshes. A missing invoice: no write, no error.
   - `INVOICE_DELETE`: before `removeDocs`, fetch fresh sales docs inside the same per-invoice mutation queue and call `partitionDeletable(ids, docs)`. A stale Redux snapshot must not permit deletion after a credit was issued. Remove only `deletable`. For `blocked`, show the toast `invoices:creditNotes:toast:<reason>` with the count. If nothing is deletable, stop.
4. Apply the queue to every credit save/issue/void and payment write for the original id. `updateDocs` returns all docs on full success; a partial failure rejects with `{ docs, succeeded, failed }` (014). Refresh from those docs and preserve the failure metadata. Only committed note writes can trigger sync/success. On `INVOICE_GET_ALL`, repair statuses for invoices with linked issued/void notes before publishing the raw store; use fresh revisions, preserve unrelated fields and show a warning on failed repairs. Refresh the list even after a successful note write followed by sync failure. Retrying issue/void is idempotent and can repair the invoice. Do not announce total success after a partial write.
5. Update `app/middlewares/__tests__/InvoicesMW.spec.js` (group D).

**Verify**: `npx vitest run app/middlewares/__tests__/InvoicesMW.spec.js` → all pass.

### Step 6: Editor credit note mode

1. `app/helpers/form.js`:
   - `resolveSaveStatus(mode, editData, docType)`: for `creditNote`, `draft` → `'draft'` and `final` → `'issued'`.
   - `pickInvoiceFields` copies `docType`, `creditedInvoiceId` and `creditedInvoice` for credit notes. It never copies `dueDate` for credit notes.
   - `getFormErrors(form, mode)`: for credit notes, skip due-date and contact-selection rules, but validate the copied recipient object and positive line amounts/tax snapshot fields. A missing recipient is not valid merely because it is read-only.
2. `app/reducers/FormReducer.jsx`: make sure the 022 populate function keeps `creditedInvoiceId` and `creditedInvoice`, and that `FORM_CLEAR` removes them.
3. `FormMW` `handleSave` for `docType === 'creditNote'` (after `getFormErrors` and before the write):
   - `docs = await getAllDocs('invoices')` inside the original-invoice queue. Reject edits when the saved credit note is issued or void, regardless of submitted status. Run `validateCreditTotal(data, original, linked)` for both modes. Preserve the source seller/recipient/tax version; a change to current settings must not alter the credit basis.
   - On an error: `setFormErrors({ creditTotal: 'form:errors:<code>' }, mode)` and a warning toast. Do not save.
   - After a successful save with status `issued`, dispatch `syncCreditedInvoice(data.creditedInvoiceId)`. Do not save a new contact. Do not send `preview-invoice` for drafts.
   - Edit of an invoice (`docType === 'invoice'`): if the new rounded total is below effective paid plus issued credits, or changes currency code/fraction with any linked credit, show the error `form:errors:belowCredited` and do not save.
4. Editor cards when `form.docType === 'creditNote'`:
   - Header title `form:header:newCreditNote` / `form:header:editCreditNote`.
   - `ClientField`: read-only recipient summary (no combobox, no "Add new client").
   - `DetailsCard`: number, issue date, and a read-only line `form:creditNote:credits` ("Credits invoice {{number}} of {{date}}"). No due date. Currency is read-only.
   - Line items, adjustments and notes stay editable.
   - `TotalsFooter`: line `form:creditNote:remaining` with the creditable amount (computed from the store with `getCreditableAmount(…, { excludeId })`). The total turns `text-destructive` and `FieldError` shows `errors.creditTotal` when it is greater. Buttons: "Save draft" and "Issue credit note" (`saveFormData('final')`).
5. Update `form.spec.js`, `FormReducer.spec.js` and `FormMW.spec.js` (group C).

**Verify**: `npx vitest run app/helpers/__tests__/form.spec.js app/reducers/__tests__/FormReducer.spec.js app/middlewares/__tests__/FormMW.spec.js` → all pass. `npm run build` → exit 0.

### Step 7: Invoices page tab, row actions and detail sheets

1. `app/helpers/invoiceList.js`:
   - Append `'creditNotes'` to `INVOICE_TABS`.
   - Use the page-specific selector from Step 4 to keep `invoice` and `creditNote` on this page only; retain the global invoice-only selector.
   - Add `toCreditNoteRow(cn, invoicesById)` → `{ id, docType: 'creditNote', doc: cn, number, client, issuedAt, creditedNumber: cn.creditedInvoice?.invoiceID ?? '', creditedId, displayStatus: getStoredStatus(cn), amount, amountText }`.
   - `matchesTab(row, tab)`: credit note rows match only `creditNotes`. Invoice rows never match `creditNotes`. Keep the old rules for invoice rows. If 014's signature takes a display status, change it to take the row and update the callers.
   - `countByTab` adds `creditNotes`. `all` counts invoices only.
2. `creditNoteColumns.jsx`: Number (button, opens the sheet), Client, Issued, Credits (a button with the original number that opens the invoice sheet), Amount (`text-end tabular-nums`), Status, Actions. No select column. When `tab === 'creditNotes'`, `Invoices.jsx` uses these columns and hides `BulkActionsBar`.
3. `StatusBadge.jsx`: add `issued` (icon `ReceiptText`, `--status-paid` colors) and `void` (icon `Ban`, `--status-cancelled` colors). `draft` reuses the draft style. Text is `invoices:creditNotes:status:<s>`. Pass the doc type, so that `draft` text is the same and the icons stay correct.
4. `InvoiceRowActions.jsx` and the `InvoiceDetailSheet.jsx` footer: add "Create credit note" (icon `FileMinus`). Show it only when `canCreateCreditNote(invoice, linked)`. It dispatches `createCreditNote(invoice)`.
5. `InvoiceDetailSheet.jsx`: when linked credit notes exist, add a "Credit notes" section. Each row is a `<button>` with number, issue date, status badge and amount, and opens the credit note sheet. In the totals, add "Credited" (issued sum) and "Balance due" (`getBalanceDue` with credits). When the balance is < 0, show "Refund due" with the absolute value.
6. `CreditNoteDetailSheet.jsx` (shadcn `Sheet`, side `right`):
   - Title `creditNotes:sheet:title` with the number, and the status badge.
   - Link button "Credits invoice INV-0007" (icon `ArrowUpRight`). It opens the invoice sheet. If the invoice is missing, show plain text.
   - Client, issued date, items, totals ("Total credit"), note.
   - Footer: Preview / Export PDF (`preview-invoice`). Draft: Edit (`editInvoice`), Issue (`issueCreditNote`), Delete (014 delete with Undo). Issued: Void. Void opens the 013 `confirm()` dialog (`creditNotes:void:title`, `creditNotes:void:description`, destructive button `creditNotes:void:confirm`), then dispatches `voidCreditNote`.
7. `CreditNoteRowActions.jsx`: the same actions as the sheet footer, in a `DropdownMenu`.
8. `Invoices.jsx`: one `openId` state. Render `CreditNoteDetailSheet` when the open doc is a credit note, else `InvoiceDetailSheet`. The cross links set `openId` to the other id.
9. Update `invoiceList.spec.js` (group G).

**Verify**: `npx vitest run app/helpers/__tests__/invoiceList.spec.js` → all pass. `npm run build` → exit 0. `npm run lint` → exit 0.

### Step 8: Templates

1. Extend 022's `getDocTitleKey` and `listTabFor` in `docType.js` for credit notes (title `preview:common:creditNote`, list `invoices`). In both `Header.jsx` files, extend 022's title switch: `creditNote` → `preview:common:creditNote`.
2. Directly after the issue date `<p>`, add, only when `isCreditNote(invoice)`, a `<p>` with the same markup as the issue date line: `t('preview:common:creditsInvoice', { lng: language, number: invoice.creditedInvoice?.invoiceID ?? '', date: <formatted> })`. Format the date the same way as the issue date line (`moment(…).lang(language).format(configs.dateFormat)`, or the live variant). Do not add new styled components.
3. In both `Main.jsx` files, the total label becomes `isCreditNote(invoice) ? 'preview:common:totalCredit' : 'preview:common:total'`. Amounts stay positive.
4. Run `npm run build`, then `node scripts/pdf-snapshot.mjs /tmp/manta-pdf-023-after`, then `sh scripts/pdf-compare.sh /tmp/manta-pdf-023-before /tmp/manta-pdf-023-after`.
5. Only after the compare passes: add 2 cases to `scripts/pdf-snapshot.mjs`, `minimal-credit-note` and `business-credit-note`. Read the case loop. Add an optional `invoice` override that is merged over `BASE` (`{ ...BASE, ...c.invoice }`). Use `{ docType: 'creditNote', status: 'issued', invoiceID: 'CN-0001', creditedInvoiceId: 'pdf-snapshot-0001', creditedInvoice: { invoiceID: 'INV-0042', issuedAt: T }, dueDate: undefined }`. Future baselines then cover credit notes.

**Verify**: the compare prints no `FAIL` line and exits 0 (old invoices render identically). Open `/tmp/manta-pdf-023-new/minimal-credit-note-light.pdf` (after `node scripts/pdf-snapshot.mjs /tmp/manta-pdf-023-new`). It shows "Credit note", "CN-0001", "Credits invoice INV-0042 of 01/15/2026", no due date, and "Total credit".

### Step 9: Dashboard, CSV and backup

1. `app/helpers/dashboard.js` `getDashboardStats`:
   - Build the credit map once. Outstanding and overdue sums use `getBalanceDue(inv, credits)`. Invoices with a balance ≤ 0 are not outstanding.
   - Add `byCurrency[code].creditedThisMonth` = sum of `grandTotal` of `issued` credit notes with `getIssuedAt` in `[start of month(now), start of next month)` (local time). Add `creditNoteCount` for the same set. Key by the credit note's own currency code.
   - Do not change `paidThisMonth`, `getMonthlyPaid` or the draft count (credit note drafts are not invoice drafts).
2. `KpiCards.jsx`: in the "Paid this month" card, add a muted line `dashboard:kpi:creditedThisMonth` ("Credit notes: −{{amount}}") when `creditedThisMonth > 0`. Use `formatMoney`.
3. `app/helpers/csv.js` `buildInvoicesCsv`:
   - Include `invoice` and `creditNote` docs. Exclude estimates; start from the complete sales-document list before selecting invoice and credit-note rows.
   - Append the header fields `docType,creditedInvoice` after the last existing column. If 022 already added `docType`, append only `creditedInvoice`.
   - Credit note rows: `amount_paid` and `balance_due` are empty (credit notes do not receive payments); `subtotal`, `tax`, `discount` and `total` multiplied by `−1` (format `-0.00` as `0.00`). `due` is empty. `status` is the stored credit note status. `creditedInvoice` = `creditedInvoice.invoiceID` (as text, through `escapeCsvField(…, { text: true })`).
   - Invoice rows: the same values as before, plus `invoice` and an empty field.
4. `app/helpers/backup.js`: if the Preconditions grep found a status check, make it doc-type aware. Credit notes accept `CREDIT_NOTE_STATUSES`. Set `BACKUP_VERSION = 5` (022 writes 4); accept versions 1–5 and reject versions above 5. Being in the same array does not make credit accounting backward compatible.
5. Extend `main/pdf-file-name.js` with `creditNote` → `credit-note-<safe id>.pdf`; preserve invoice/estimate behavior and path validation.
6. Update `dashboard.spec.js`, `csv.spec.js` and, if changed, `backup.spec.js` (groups E, F, H).

**Verify**: `npx vitest run app/helpers/__tests__/dashboard.spec.js app/helpers/__tests__/csv.spec.js app/helpers/__tests__/backup.spec.js` → all pass.

### Step 10: Strings

Add to the English files only (other locales fall back to English):
- `i18n/en/invoices.json`: `tabs.creditNotes` "Credit notes"; `actions.createCreditNote` "Create credit note"; `sheet.{credited,balanceDue,refundDue,creditNotes}`; group `creditNotes` with `status.{draft,issued,void}`, `columns.credits`, `sheet.{title,credits,totalCredit}`, `actions.{issue,void,edit,delete,preview}`, `void.{title,description,confirm}` ("Void credit note {{number}}?", "This cannot be undone. The credited amount goes back to the invoice.", "Void"), `errors.{creditedMissing,creditZero,creditCurrency,creditExceeds}`, `toast.{issued,voided,hasCreditNotes_one,hasCreditNotes_other,issuedCreditNote_one,issuedCreditNote_other}`, `empty.{title,description}`.
- `i18n/en/preview.json` `common`: `creditNote` "Credit note", `creditsInvoice` "Credits invoice {{number}} of {{date}}", `totalCredit` "Total credit".
- `i18n/en/form.json`: `header.{newCreditNote,editCreditNote}`, `header.btns.issueCreditNote`, `creditNote.{credits,remaining}`, `errors.{creditedMissing,creditZero,creditCurrency,creditExceeds,belowCredited}`.
- `i18n/en/dashboard.json`: `kpi.creditedThisMonth`.

**Verify**: `for f in invoices preview form dashboard; do node -e "JSON.parse(require('fs').readFileSync('i18n/en/$f.json','utf8'))" && echo ok; done` → 4 × `ok`.

### Step 11: Full checks and manual smoke test

1. `npm test` → exit 0. `npm run lint` → exit 0. `npm run test:e2e` → all pass.
2. Run on the profile copy. Check in **light and dark** mode:
   - Old invoices show the same status, amount and balance as before.
   - Pending invoice of 1,000 → row menu "Create credit note" → the editor shows "Credits invoice …", the copied rows and "Remaining 1,000.00". Halve one quantity → "Issue credit note" → number `CN-0001`. The invoice stays Pending, and the sheet shows "Credited" and the lower "Balance due".
   - Try a second credit note for more than the rest → inline error, nothing saved.
   - Credit the rest → the invoice becomes Cancelled and leaves Outstanding on the dashboard.
   - Void the second credit note (confirm) → the invoice goes back to Pending.
   - Paid invoice → full credit note → it stays Paid, and the sheet shows "Refund due". Set status ▸ Refunded by hand.
   - Delete an invoice with a credit note → blocked toast. Delete a draft credit note → Undo works. An issued credit note has no Delete.
   - Draft and Cancelled invoices have no "Create credit note".
   - Cross links between both sheets work. The Credit notes tab count is correct.
   - Preview / Export PDF of a credit note in both templates: title, reference line, "Total credit", paper white in dark mode.
   - Dashboard "Credit notes: −X" line in the right currency. CSV export: credit note rows negative, `docType` column filled.
   - Next new credit note number is `CN-0003`. The invoice counter did not move.
3. Take screenshots of the Credit notes tab, both sheets and a credit note PDF, if possible.

**Verify**: every item behaves as written. Record any failure in the report.

## Test plan

Unit tests only for logic. No markup, snapshot or class-name tests. Use the existing `inv({...})` factories where they exist. `TZ=UTC` from `vitest.config.mjs`.

- **A. `creditNotes.spec.js`**
  - `getCreditableAmount`: no credit notes → total. One issued 300 of 1,000 → 700. Draft and void are ignored. A credit note of another invoice is ignored. `excludeId` ignores itself. Over-credited data → `0`, never negative. `0.1 + 0.2` style sums round to the fraction (fraction 0 and 3 too).
  - `canCreateCreditNote`: true for `pending`, `paid`, `refunded`, a doc with no status (old → pending) and a `partial` invoice. False for `draft`, `cancelled`, `docType` `estimate` or `creditNote`, and for a fully credited invoice.
  - `buildCreditNoteDraft`: no `_id`, `_rev`, `status`, `payments`, `paidAt`, `dueDate`, `issuedAt`, `invoiceID`. Snapshot = number + issue date. An old invoice without `invoiceID` → first 8 chars of `_id`. Without `issuedAt` → `created_at`. Row ids come from `idFn`. The input is not mutated (`structuredClone` compare).
  - `validateCreditTotal`: each error code. Exactly equal to the creditable amount → `null`. One cent more → `creditExceeds`.
  - `resolveStatusAfterCredit` (table test):
    1. pending, full credit, no payments → `cancelled` + `cancelledByCredit`.
    2. pending, partial credit → unchanged (same object).
    3. pending, 400 paid + 600 credited of 1,000 → `paid`, `paidAt` = last payment date.
    4. paid with payments, full credit → stays `paid`, `paidAt` kept.
    5. old paid doc without payments, full credit → stays `paid` (regression guard for `getEffectivePaid`); pending invoice settled by credit records `payments: []`, and subsequent balance/cash calculations still show zero cash.
    6. cancelled by credit, credit voided → `pending`, flag removed.
    7. manual cancel without flag → unchanged.
    8. `refunded` and `draft` → unchanged.
    9. paid by credit + payment, credit voided → `pending`.
  - `partitionDeletable`: invoice with a void credit note → blocked. Draft credit note → deletable. Issued and void credit notes → blocked. Unknown id → deletable (014 handles failure).
- **B. `invoice.spec.js`**: `getBalanceDue` without a second argument equals 020's result; issued credit subtracts; draft/void do not; overpaid → negative. `getStoredStatus` for a credit note: `issued` kept, `pending` → `draft`, missing → `draft`. Invoice statuses unchanged.
- **C. Form specs**: `resolveSaveStatus` credit note `draft`/`final`. `pickInvoiceFields` keeps the link fields and drops `dueDate`. `FormMW`: a credit note save that exceeds the creditable amount → no save, `setFormErrors` with `creditTotal`. A valid new credit note → `appConfig.set('invoice.creditNoteNumbering', …)` once and no call for `invoice.numbering`. A new invoice save does not touch `creditNoteNumbering`. Issued save → dispatches `syncCreditedInvoice`. Draft save → no sync. Invoice edit below paid plus credited total, or currency code/fraction change with linked credits → no save.
- **D. `InvoicesMW.spec.js`** (`await` everything): concurrent credit issues cannot exceed the original total; payment plus issue uses one serial settlement queue; mixed write failure counts only saved docs; a note write followed by failed sync is repaired after retry and after restart without duplicate note/payment; direct edit/update/config-save of an issued/void note is rejected. No variable shadows Redux `next`. `CREDIT_NOTE_NEW_FROM_INVOICE` calls no save and dispatches the load action and then the tab change. `CREDIT_NOTE_ISSUE` exceeding → no `updateDocs`. Valid issue → `updateDocs` with `status: 'issued'`, then sync. Sync on a fully credited unpaid invoice → `updateDocs` with `cancelled`. Sync with no change → no write. `CREDIT_NOTE_VOID` on a draft → warning, no write. `INVOICE_DELETE` with one blocked and one free id → `removeDocs` gets only the free id, plus a blocked toast.
- **E. `dashboard.spec.js`**: issued credit note in November → `creditedThisMonth` for `now = 2026-11-15`; 2026-10-31T23:59:59.999Z → not counted. Draft and void credit notes → 0. USD and EUR credit notes stay separate. Partly credited pending invoice → outstanding = balance. Fully credited (cancelled) invoice → not outstanding. `paidThisMonth` unchanged by credit notes.
- **F. `csv.spec.js`**: the header ends with `docType,creditedInvoice`. A credit note row has `-120.00` totals, `issued`, empty `due`, and the original number. A credit note number starting with `=` gets `'`. Negative amounts get no `'`. Fraction 0 → `-120`. An invoice row has the same values as before plus `invoice` and an empty field.
- **G. `invoiceList.spec.js`**: `matchesTab` — credit note rows only in `creditNotes`. `all` and `closed` exclude credit notes. `countByTab` has `creditNotes`, and `all` counts invoices only. Search finds a credit note by number and by the original number.
- **H. `backup.spec.js`**: an imported credit note keeps `issued`/`void` and tax/seller snapshots; version 4 still imports; version 5 round-trips credits; version 6 is refused by this release. Include missing-original and mismatched-currency warnings without silently losing docs.
- **Delete**: no existing tests become markup-only in this plan.
- **e2e**: no new test. `npm run test:e2e` must still pass. **PDF**: Step 8 compare (old invoices identical).

## Done criteria

- [ ] `npm test` exits 0. `npx vitest run app/helpers/__tests__/creditNotes.spec.js` shows groups A.
- [ ] `npm run lint`, `npm run build` exit 0; `npm run test:e2e` all pass.
- [ ] `sh scripts/pdf-compare.sh /tmp/manta-pdf-023-before /tmp/manta-pdf-023-after` → no `FAIL`, exit 0.
- [ ] `grep -n "creditNoteNumbering" app.js` → 1 hit.
- [ ] `grep -rn "getBalanceDue(" app --include='*.js' --include='*.jsx' | grep -v __tests__` → each settlement call receives complete credit context; original-PDF payment-only calls are explicit and documented.
- [ ] `grep -n "'issued'\|'void'" app/middlewares/InvoicesMW.jsx` → hits only in the `CREDIT_NOTE_*` cases. `grep -n "setInvoiceStatus" app/components/invoices/CreditNote*.jsx` → no output.
- [ ] `git diff 3e89104 -- app/constants/actions.jsx` shows only added lines from this plan and earlier plans (no rename).
- [ ] Manual smoke list in Step 11 passed in light and dark mode on a copied profile.
- [ ] No attribution: `git log --format=%B 3e89104..HEAD | grep -ci "co-authored\|generated with"` → `0`.
- [ ] `plans/README.md` row for 023 updated (unless a reviewer maintains it).

## STOP conditions

- A precondition fails, especially: no `getDocType` (022), no `getBalanceDue` (020), no doc-type editor mode, no PDF scripts (018).
- The Step 8 PDF compare shows any difference for an existing invoice case.
- A real invoice on the copied profile changes status, amount or balance without a credit note.
- `resolveStatusAfterCredit` would need to change a `refunded`, `draft` or manually cancelled invoice to pass a test.
- Import drops or rewrites credit note docs after the required version-5 parser update, or repair would overwrite unrelated invoice fields.
- You feel you must store a negative amount in a document, or change `getInvoiceValue`.
- The drift check shows changes to the template total or title lines that neither 015, 018, 021 nor 022 explains.

## Maintenance notes

- **Single source of truth**: credit note math is in `app/helpers/creditNotes.js`. Balance is `getBalanceDue(invoice, creditNotes)`. New callers must pass the credit notes (`groupCreditNotesByInvoice`). Calls without them silently ignore credits.
- **Recovery is required**: note and invoice writes are separate puts. The original-id queue prevents local check/write races; idempotent issue/void retry and load-time sync repair a failed second write. Read-time settlement uses authoritative issued notes until repair succeeds. No load path alters an invoice that has no credit history.
- **`cancelledByCredit`** marks automatic cancels, so a void can reopen them. Manual cancels never reopen.
- **No automatic `refunded`**. When 020 or a later plan adds refund payments, extend Decision 6 and its table test.
- **Flat discounts** are copied as-is. For a partial credit, the user must lower them. The creditable check stops over-crediting.
- **Template language**: `creditNote`, `creditsInvoice` and `totalCredit` exist only in English. A German or French invoice language prints the English title until translators add the keys. Add them before marketing credit notes in those markets.
- **025**: export credit notes with type code 381, BT-25 = `creditedInvoice.invoiceID`, BT-26 = `creditedInvoice.issuedAt`, positive amounts. Confirm the sign rule with the KoSIT validator.
- **PDF baseline**: Step 8 adds two credit note cases to `scripts/pdf-snapshot.mjs`. Later template plans compare them too.
- Reviewers: check that only issued credit notes count, that issued credit notes cannot be edited or deleted, that old invoice PDFs are identical, that no amounts of different currencies are added, and that commits have no attribution.
