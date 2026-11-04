# Plan 022: Add estimates (quotes) that convert into invoices, using a document type on the existing invoice database

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- app/reducers/InvoicesReducer.jsx app/reducers/FormReducer.jsx app/reducers/UIReducer.jsx app/store/enhancer.jsx app/helpers/pouchDB.js app/helpers/invoice.js app/helpers/numbering.js app/helpers/form.js app/helpers/preview.js app/helpers/invoiceList.js app/helpers/clients.js app/helpers/csv.js app/helpers/backup.js app/helpers/settings.js app/helpers/dashboard.js app/helpers/commandSearch.js app/middlewares/InvoicesMW.jsx app/middlewares/FormMW.jsx app/middlewares/UIMiddleware.jsx app/actions app/constants app/containers app/components/layout app/components/invoices app/components/form/editor app/components/settings/sections/InvoiceDefaults.jsx preview/templates/minimal/components/Header.jsx preview/templates/business/components/Header.jsx preview/containers/SideBar.jsx main/save-pdf.js app.js i18n/en`
> Plans 012–018 change most of these files on purpose (013 shell, palette and `UI_NEW_INVOICE`; 014 status helpers, table and undo delete; 015 editor, numbering, `issuedAt`, `FORM_LOAD_DUPLICATE`; 016 clients, CSV, backup, settings sections; 017 dashboard and the `save-pdf.js` onboarding block; 018 preview sidebar). 019–021 also change `app/helpers/invoice.js`, `InvoicesMW.jsx`, the editor and the templates. Compare only the parts this plan depends on: the names in "Current state (b)". If a name is missing and you cannot find its new name with one grep, STOP.
>
> **Rule**: do NOT add `Co-authored-by` trailers or any AI/tool attribution to commits or PRs. Pass this rule to any subagent.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED — estimates live in the same `invoices` database. Every invoice list, total, CSV export and status helper must filter by `docType`. A missed filter adds quotes to revenue.
- **Depends on**: plans/014, 015, 016, 017 (all screens that list invoices). 018 for the PDF compare scripts, and 021 (therefore 019 and 020). Execute in number order; the payment and line-tax contracts are required, not optional.
- **Category**: feature
- **Planned at**: commit `3e89104`, 2026-11-01 (runs after 018)

## Why this matters

Freelancers send a quote before they send an invoice. Manta has no quote. Users copy an invoice and change the title in a PDF editor, or use another tool. This plan adds estimates: a numbered document with a "Valid until" date, its own statuses (Draft, Sent, Accepted, Declined, Expired, Converted) and one action, "Convert to invoice". The conversion opens a new invoice draft in the editor with the same client, rows and totals. Nothing is saved until the user saves. 023 (credit notes) reuses the document-type field and the filter rules from this plan.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current; git status --short` | record the current branch and existing changes; keep both |
| 014 status helpers | `grep -nE "getStoredStatus\|getDisplayStatus\|getIssuedAt\|withStatus\|getInvoiceNumber\|formatInvoiceAmount" app/helpers/invoice.js` | all 6 exported |
| 014 constants | `grep -n "INVOICE_STATUSES\|UNDO_TIMEOUT_MS" app/constants/invoices.js` | both |
| 014 list + table | `ls app/helpers/invoiceList.js app/components/invoices/{StatusBadge,InvoicesTable,InvoiceRowActions,useNow}.js*` | all listed |
| 014 selector | `grep -n "getOverdueCount" app/reducers/InvoicesReducer.jsx` | one export |
| 015 numbering | `grep -nE "formatInvoiceNumber\|advanceNumbering\|normalizeNumbering\|DEFAULT_NUMBERING" app/helpers/numbering.js` | all 4 |
| 015 form | `grep -nE "pickInvoiceFields\|resolveSaveStatus\|getFormErrors" app/helpers/form.js; grep -n "FORM_LOAD_DUPLICATE" app/constants/actions.jsx app/reducers/FormReducer.jsx` | hits in both files |
| 015 editor | `ls app/components/form/editor/{EditorLayout,DetailsCard,CustomizeFieldsMenu,TotalsFooter,LivePreview}.jsx app/helpers/preview.js` | all listed |
| 016 helpers | `grep -n "export" app/helpers/clients.js app/helpers/csv.js app/helpers/backup.js app/helpers/settings.js \| grep -E "summarizeClients\|buildInvoicesCsv\|BACKUP_VERSION\|mergeImportedSettings\|getSettingsErrors"` | 5 hits |
| 016 settings UI | `ls app/components/settings/sections/InvoiceDefaults.jsx` | listed |
| 017 dashboard | `grep -nE "export (function\|const) (getDashboardStats\|getMonthlyPaid\|getNeedsAttention\|getRecentInvoices)" app/helpers/dashboard.js` | 4 hits |
| 013 shell | `ls app/components/layout/{AppSidebar,CommandPalette,TitleBar,AppMain}.jsx; grep -n "UI_NEW_INVOICE" app/middlewares/UIMiddleware.jsx` | files listed; one case |
| 018 PDF tools | `ls scripts/pdf-snapshot.mjs scripts/pdf-compare.sh; pdftoppm -v 2>&1 \| head -1` | both scripts; poppler version |
| 020 (required) | `grep -n "getAmountPaid\|payments" app/helpers/invoice.js \| head -3` | hits; enforce payment exclusions for every write path |
| Tests, lint | `npm test && npm run lint` | exit 0 |

Use a copy of user data for every manual run: `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy`, then `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev`.

## Current state

### (a) At 3e89104 (012–018 do not change these parts)

`app/reducers/InvoicesReducer.jsx:4-21`. The store keeps the **full** `invoices` database list. Every write path replaces it with `action.payload` (the result of `getAllDocs('invoices')`):
```js
 6    [combineActions(Actions.getInvoices, Actions.saveInvoice, Actions.saveInvoiceConfigs,
10      Actions.updateInvoice, Actions.deleteInvoice, Actions.setInvoiceStatus
13    )]: (state, action) => action.payload,
21 export const getInvoices = state => state.invoices;
```
`app/store/enhancer.jsx:5-8`: `Promise.all([getAllDocs('contacts'), getAllDocs('invoices')])` → `{ contacts, invoices }` (initial state, unfiltered).
`app/helpers/pouchDB.js:8`: `const invoicesDB = new PouchDB('invoices', { adapter: 'idb' });`. `getAllDocs` (`:140-154`) returns every doc. Migrations 1–4 (`:46-103`) never add `docType`. This plan adds no migration.
`reselect` `^5.3.0` is a dependency. `app/reducers/SettingsReducer.jsx:26` already uses `createSelector`.

Templates. `preview/templates/minimal/components/Header.jsx:56` and `business/components/Header.jsx:95` print the title:
```jsx
{t('preview:common:invoice', { lng: language })}
```
The due-date block is `minimal/…/Header.jsx:71-94` (`{dueDate && [ <p key="dueDate">…</p>, <p key="dueDateNote">…</p> ]}`) and `business/…/Header.jsx:110-135` (`{invoice.dueDate && [ … ]}`). `Main.jsx` in both templates prints no title and no due date.
`i18n/en/preview.json` `common`: `billedTo, chooseInvoiceToPreview, created, due, invoice, itemDescription, notice, order, price, qty, subtotal, total`.

PDF file name, `main/save-pdf.js:8-10`:
```js
ipcMain.on('save-pdf', async (event, docId) => {
  const exportDir = appConfig.get('invoice.exportDir');
  const pdfPath = path.join(exportDir, `${docId}.pdf`);
```
The caller is `preview/containers/SideBar.jsx:63-65` (`ipc.send('save-pdf', invoiceID)` with `invoiceID = this.props.invoice._id`). `preload/index.js:56-59` forwards extra arguments (`send: (channel, ...args)`). `preview/Viewer.jsx` only stores the invoice it gets on `update-preview`; it needs no change.

Settings defaults, `app.js:195-217` (`invoice: { exportDir, template, dateFormat, tax, currency, required_fields }`). `setInitialValues()` (`:221-240`) adds missing level-2 keys. So new `invoice.*` keys reach old Settings files without a migration.

### (b) Expected after 012–018 (expectations — Preconditions check each one)

| Name | Plan, step | This plan uses it for |
|---|---|---|
| `getStoredStatus`, `getDisplayStatus(inv, now)`, `getIssuedAt`, `getDueDate`, `withStatus`, `getInvoiceNumber`, `formatInvoiceAmount` in `app/helpers/invoice.js` | 014 Step 2 | estimate rows; `getDisplayStatus` delegates to estimates |
| `INVOICE_STATUSES` guard in `INVOICE_SET_STATUS` ("Unknown invoice status") | 014 Step 6.5 | per-type status check |
| `INVOICE_DELETE` with `removeDocs` + Undo toast, `INVOICE_RESTORE` | 014 Step 6 | delete estimates |
| `matchesSearch`, `toInvoiceRow`, `STATUS_SORT_RANK` in `app/helpers/invoiceList.js` | 014 Step 3 | estimate list helpers |
| `StatusBadge`, `InvoicesTable`, `InvoiceRowActions`, `InvoiceDetailSheet`, `useNow`, `getColumns` | 014 Step 8 | Estimates page |
| `getOverdueCount(state, now)` reads `state.invoices` | 014 Step 5.3 | must filter |
| `normalizeNumbering`, `formatInvoiceNumber`, `advanceNumbering`, `mergeNumbering`, `DEFAULT_NUMBERING` | 015 Step 2 | estimate numbering |
| `pickInvoiceFields`, `resolveSaveStatus(mode, editData)`, `getFormErrors(form, mode)`, `getInvoiceData(form, opts)` | 015 Step 5 | doc-type save |
| `populateFromInvoice`, `FORM_LOAD_DUPLICATE`, `FORM_SET_ERRORS` | 015 Step 6.3 | edit, duplicate, convert |
| `handleSave(store, mode)` in `FormMW.jsx`; number pre-fill after `FORM_CLEAR` / `FORM_LOAD_DUPLICATE` | 015 Step 6.4 | numbering per type, convert link |
| `INVOICE_DUPLICATE` → `FORM_LOAD_DUPLICATE` with an `omit` list | 015 Step 6.5 | omit estimate fields |
| `formToPreviewInvoice(form, { invoiceSettings, … })` | 015 Step 5.7 | live preview title |
| `summarizeClients(contacts, invoices, now)` | 016 Step 1 | must ignore estimates |
| `buildInvoicesCsv(invoices, now)`, `collectBackup`, `exportCsv` | 016 Steps 9, 12 | CSV filters; backup keeps all |
| `BACKUP_VERSION`, `parseBackup`, `mergeImportedSettings` (`numbering.next = max`) | 016 Step 9 (019 may bump the version) | version bump, estimate numbering merge |
| `getSettingsErrors('invoice', data)`, `InvoiceDefaults.jsx` | 016 Steps 6–8 | settings rules and UI |
| `getDashboardStats`, `getMonthlyPaid`, `getNeedsAttention`, `getRecentInvoices` | 017 Step 3 | must ignore estimates |
| `getChecklistState(…, invoices, …)` | 017 Step 4 | gets filtered invoices |
| `AppSidebar.jsx`, `CommandPalette.jsx` (`useSelector(s => s.invoices)`), `TitleBar.jsx`, `UI_NEW_INVOICE` in `UIMiddleware.jsx` | 013 Steps 7, 11 | nav, palette, New estimate |
| `scripts/pdf-snapshot.mjs`, `scripts/pdf-compare.sh` | 018 Step 0 | prove old invoices print identically |

## Reference facts (recheck versions and APIs at execution)

- `reselect` 5 `createSelector(inputs, combiner)` memoizes on input references: https://reselect.js.org/api/createselector . react-redux 9 `useSelector` runs a dev "stability check" and warns when a selector returns a new reference for the same state: https://react-redux.js.org/api/hooks#development-mode-checks . So a filtering selector **must** be memoized.
- moment counts calendar days correctly across DST (014 Facts). Use `moment(x).startOf('day').add(n, 'days')`. Never add `n * 864e5`.
- lucide-react 1.66.0 (`npm view lucide-react version`) exports `FileText`, `ReceiptText`, `Send`, `CircleX`, `CalendarX`, `ArrowRightLeft`, `FilePlus`, `FileCheck` (checked in the 1.66.0 package typings).
- PouchDB `put` of an existing doc needs its current `_rev`, else 409: https://pouchdb.com/api.html#create_document
- Base UI Toast `toast.add({ title, actionProps, timeout })`: https://ui.shadcn.com/docs/components/base/toast
- Confirm versions at run time with `npm view <pkg> version`. This plan adds no package.

## Execution and verification rules (reviewed 2026-11-01)

- The source baseline is `3e89104`; prerequisite output is an expected contract, not code that exists today. Read the completed prerequisite changes before implementation. Expected changes from those plans are not a drift failure.
- Before a live UI check, call Jean `get_run_environments` and use its running URL and startup command. If none runs, use `start_run_environment`. Do not start a second server by hand. If no Run command is configured, report the missing configuration. Commands below describe the required copy-profile setup; they do not override this rule.
- Never overwrite a prior test profile or copy production data into an existing destination. Use a new empty, task-specific profile directory and set `MANTA_USER_DATA` before launch. Treat `/tmp/manta-profile-copy` below as an example path. Keep test output and PDF baselines outside the production export directory.
- Use the narrow spec for each logic change. Run the full checks once at the end for this cross-cutting feature. Verify UI interactions in the browser or Electron app; unit tests alone do not prove these flows.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| One spec | `npx vitest run <path>` | pass |
| All unit tests | `npm test` | exit 0 |
| Lint / build | `npm run lint`, `npm run build` | exit 0 |
| e2e | `npm run test:e2e` | all pass |
| PDF baseline / compare | `node scripts/pdf-snapshot.mjs <dir>`, `sh scripts/pdf-compare.sh <base> <after> --light-ref` | `ALL IDENTICAL` |
| Dev on a copy | `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev` | app opens |

## Scope

**Create**
- `app/helpers/docType.js`, `app/helpers/estimate.js`, `app/helpers/estimateList.js` (+ specs in `app/helpers/__tests__/`)
- `app/constants/estimates.js`, `app/actions/estimates.jsx`
- `app/containers/Estimates.jsx`, `app/components/estimates/{columns.jsx,EstimateRowActions.jsx,EstimatesEmpty.jsx}`
- `main/pdf-file-name.js`, `main/__tests__/pdf-file-name.spec.js`
- `i18n/en/estimates.json`

**Change**: `app/reducers/{InvoicesReducer,FormReducer}.jsx`, `app/helpers/{invoice,numbering,form,preview,clients,csv,backup,settings,dashboard}.js`, `app/middlewares/{InvoicesMW,FormMW,UIMiddleware}.jsx`, `app/constants/actions.jsx`, `app/actions/{form,ui}.jsx`, `app/components/layout/{AppSidebar,AppMain,CommandPalette,TitleBar}.jsx`, `app/components/invoices/{StatusBadge,InvoiceDetailSheet}.jsx`, the editor files `EditorLayout.jsx`, `DetailsCard.jsx`, `CustomizeFieldsMenu.jsx`, `TotalsFooter.jsx`, `app/components/settings/sections/InvoiceDefaults.jsx`, both template `Header.jsx` files, `preview/containers/SideBar.jsx`, `main/save-pdf.js`, `scripts/pdf-snapshot.mjs` (estimate manifest), `app/helpers/payments.js` (type guard), `app.js` (defaults only), `i18n/en/{index.js,preview.json,form.json,messages.json}` and the 013 nav strings file, related specs.

**Out of scope**: estimates in CSV export, client history or dashboard; a "Quote" wording setting (the title is "Estimate"; see Maintenance notes); bulk actions on estimates; e-mail (026); credit notes (023); translations other than English; changing 014's invoice tabs.

## Git workflow

Continue on the current branch and preserve existing changes. Do not switch branches, create a worktree, pull, or push unless the user requests it. Short imperative subjects, no prefix, no attribution, no `Co-authored-by`. Suggested commits: `Add document type helpers and filter invoice views`, `Add estimate status, validity and conversion helpers`, `Number estimates separately`, `Save estimates from the editor`, `Convert estimates into invoices`, `Add the Estimates page`, `Print estimates with their own title`.

## Decisions (fixed for this plan)

1. **Store**: `state.invoices` keeps every sales document (the raw DB list). The selector `getInvoices` filters to invoices. New selectors `getAllSalesDocs` and `getEstimates`. The reducer and every `getAllDocs('invoices')` write path stay unchanged.
2. **`getDocType(doc)`** returns `'invoice'` only when `docType` is missing, null or the empty string; all other values are returned unchanged. Unknown non-empty values are returned as they are, so they match no filter and never count as revenue.
3. **Defense in depth**: money helpers (`summarizeClients`, `buildInvoicesCsv`, the 4 dashboard functions) also filter with `onlyInvoices` at their first line. `getDisplayStatus` delegates to `getEstimateDisplayStatus` for estimates, so an unfiltered estimate is never `pending` or `overdue`.
4. **Estimate statuses**: stored `draft | sent | accepted | declined | converted` (missing/unknown → `draft`). `expired` is derived: stored `draft` or `sent`, and `validUntil` is before the start of today (local, calendar days). "Valid until today" is still valid.
5. **Save status** for estimates: "Save draft" → `draft`. "Save & preview" on a new estimate or an edited draft → `sent` (same idea as invoice `pending` = issued). Other edits keep the stored status. Users can also "Mark sent" from the row menu.
6. **`validUntil`** (ms, start of a local day). Default = `issuedAt` + `invoice.estimateValidDays` (default 30, integer 1–365) calendar days. The editor shows the default until the user picks a date. Estimates never store `dueDate`.
7. **Numbering**: `invoice.estimateNumbering = { prefix: 'EST-', next: 1, padding: 4 }`. The form's `docType` selects the counter. Saving an estimate never moves the invoice counter, and the reverse.
8. **Conversion**: `ESTIMATE_CONVERT` reads fresh docs from PouchDB, checks `canConvert`, then dispatches 015's `FORM_LOAD_DUPLICATE` with `estimateToInvoiceDraft(estimate)`. Nothing is saved. Serialize conversion saves by source estimate id, including the fresh duplicate check and invoice write; a check followed by an unguarded write can create two invoices on overlapping clicks. Disable repeated submission and preserve the generated invoice id if a successful invoice write is followed by a failed link write. On the first save (draft or final), FormMW saves the invoice (with `sourceEstimateId`) **first**, then marks the estimate `converted` with `convertedInvoiceId` and `convertedAt`. Any live invoice with `sourceEstimateId === estimate._id` blocks a second conversion, so a failed second write cannot create duplicates.
9. **Status changes**: `setInvoiceStatus` accepts per type: invoices `INVOICE_STATUSES`; estimates `draft | sent | accepted | declined`. Only the convert flow writes `converted`. A converted estimate rejects status changes.
10. **PDF file name**: invoices keep `<_id>.pdf` (unchanged). Estimates get `estimate-<_id>.pdf`.
11. **Sidebar icon**: the brief fixes `FileText` for Estimates. If 013's Invoices item also uses `FileText`, change the Invoices icon to `ReceiptText`, so the two items differ.

## Steps

### Step 1: Document type helpers

1. Create `app/helpers/docType.js` and export:
   - `DOC_TYPES = ['invoice', 'estimate', 'creditNote']`
   - `getDocType(doc)` (Decision 2), `isInvoice(doc)`, `isEstimate(doc)`
   - `onlyInvoices(docs = [])`, `onlyEstimates(docs = [])` (pure `filter`)
   - `getDocTitleKey(doc)` → `'preview:common:estimate'` for estimates, `'preview:common:invoice'` for invoices; unsupported types have no export title and must be refused at the export boundary
   - `listTabFor(docType)` → `'estimates'` for estimates, else `'invoices'`
2. Create `app/helpers/__tests__/docType.spec.js` (Test plan A).

**Verify**: `npx vitest run app/helpers/__tests__/docType.spec.js` → pass.

### Step 2: Estimate helpers

1. Create `app/constants/estimates.js`:
   ```js
   export const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'converted'];
   export const ESTIMATE_SETTABLE_STATUSES = ['draft', 'sent', 'accepted', 'declined'];
   export const ESTIMATE_TABS = ['all', 'draft', 'sent', 'accepted', 'declined', 'expired', 'converted'];
   export const ESTIMATE_SORT_RANK = { expired: 0, sent: 1, draft: 2, accepted: 3, declined: 4, converted: 5 };
   export const DEFAULT_ESTIMATE_VALID_DAYS = 30;
   ```
2. Create `app/helpers/estimate.js` (imports `moment`, `lodash/omit`, `./docType`, the constants; it must **not** import `./invoice`, to avoid an import cycle). Export:
   - `getEstimateStoredStatus(e)` → `e.status` if in `ESTIMATE_STATUSES`, else `'draft'`.
   - `getEstimateDisplayStatus(e, now = Date.now())` → Decision 4. No `validUntil` → never expired.
   - `normalizeValidDays(v)` → integer 1–365, else `DEFAULT_ESTIMATE_VALID_DAYS`.
   - `getDefaultValidUntil(issuedAt, days)` → `moment(issuedAt).startOf('day').add(normalizeValidDays(days), 'days').valueOf()`.
   - `getValidInDays(e, now)` → `null` without `validUntil`, else calendar-day diff (014 `getDueInDays` style).
   - `buildLinkIndex(docs)` → `{ byId: Map(_id → doc), bySource: Map(sourceEstimateId → invoice) }` (invoices only in `bySource`).
   - `findConvertedInvoice(e, index)` → `index.byId.get(e.convertedInvoiceId)` if it is an invoice and its `sourceEstimateId === e._id`, else `index.bySource.get(e._id)`, else `null`.
   - `canConvert(e, index)` → `false` if not an estimate, or `findConvertedInvoice` finds one, or stored status is `declined`. Otherwise `true` (`draft`, `sent`, `accepted`, and `converted` whose invoice was deleted).
   - `ESTIMATE_DRAFT_OMIT = ['_id', '_rev', 'docType', 'status', 'validUntil', 'invoiceID', 'issuedAt', 'created_at', 'convertedInvoiceId', 'convertedAt', 'sourceEstimateId', 'payments', 'paidAt', 'dueDate', 'sentAt', 'remindedAt', 'cancelledByCredit', 'recurringTemplateId', 'recurringOccurrence']`
   - `estimateToInvoiceDraft(e)` → `{ ...omit(e, ESTIMATE_DRAFT_OMIT), docType: 'invoice', sourceEstimateId: e._id }`. It keeps `recipient`, `seller`, `taxMode`, `taxCalc`, `rows` (with any 019 `unitCode` and 021 tax snapshots), `currency`, `discount`, `tax`, `note`, `configs`.
   - `withConversion(e, invoiceId, now)` → `{ ...e, status: 'converted', convertedInvoiceId: invoiceId, convertedAt: now }`.
   - `isSettableStatus(doc, status)` → estimates: in `ESTIMATE_SETTABLE_STATUSES` and stored status is not `converted`; invoices only: in `INVOICE_STATUSES` (import from `../constants/invoices`); unsupported types including creditNote return false until their own lifecycle handler exists.
3. In `app/helpers/invoice.js`:
   - First line of `getDisplayStatus`: `if (isEstimate(invoice)) return getEstimateDisplayStatus(invoice, now);`.
   - First line of `getStoredStatus`: `if (isEstimate(invoice)) return getEstimateStoredStatus(invoice);` (an estimate branch; 023 adds a credit-note branch next to it).
   - Re-export the type helpers, so later plans (023) find them there: `export { DOC_TYPES, getDocType, isInvoice, isEstimate, onlyInvoices, onlyEstimates } from './docType';`.
4. Write `app/helpers/__tests__/estimate.spec.js` (Test plan B) and add the delegation case to `app/helpers/__tests__/invoice.spec.js`.

**Verify**: `npx vitest run app/helpers/__tests__/estimate.spec.js app/helpers/__tests__/invoice.spec.js` → pass.

### Step 3: Selectors and the invoice-consumer audit

1. In `app/reducers/InvoicesReducer.jsx` (keep the reducer):
   ```js
   export const getAllSalesDocs = state => state.invoices;
   export const getInvoices = createSelector([getAllSalesDocs], onlyInvoices);
   export const getEstimates = createSelector([getAllSalesDocs], onlyEstimates);
   ```
   Change 014's `getOverdueCount` to read `getInvoices(state)`, not `state.invoices`.
2. Run the audit grep. Save the output in your report:
   ```sh
   grep -rnE "state\.invoices|s\.invoices|getInvoices\b|getAllDocs\('invoices'\)|getSingleDoc\('invoices'|summarizeClients|buildInvoicesCsv|getDashboardStats|getMonthlyPaid|getNeedsAttention|getRecentInvoices|getOverdueCount|getChecklistState|searchRecords|collectBackup" app ui preview main --include='*.js' --include='*.jsx' | grep -v __tests__
   ```
3. Treat each hit with this table. A hit that is not in the table: apply the rule "lists, totals, counts and exports use invoices only; storage, backup and single-doc reads by `_id` use all docs". Name it in your report.

| Expected hit | Action |
|---|---|
| `app/actions/invoices.jsx` `getInvoices` action creator, `app/App.jsx` dispatch | none (loads the DB) |
| `app/store/enhancer.jsx`, `InvoicesMW.jsx` `getAllDocs`/`getSingleDoc`/`saveDoc`/`updateDoc`/`removeDocs` | none (raw store; Decision 1) |
| `app/reducers/InvoicesReducer.jsx` selectors, `getOverdueCount` | Step 3.1 |
| `app/containers/Invoices.jsx` (014) `useSelector(getInvoices)` | filtered by the selector. If it reads `state.invoices`, switch to `getInvoices` |
| 013 sidebar overdue badge (`getOverdueCount`) | filtered by Step 3.1 |
| `app/containers/Contacts.jsx` + client sheet (016) `getInvoices` | filtered; plus `summarizeClients` first line `invoices = onlyInvoices(invoices)` |
| `app/containers/Dashboard.jsx` (017) `getInvoices` | filtered; plus first line `onlyInvoices` in all 4 dashboard functions |
| `getChecklistState` (017) | gets filtered invoices. Estimates do not complete "first invoice" (accepted) |
| `app/helpers/csv.js` `buildInvoicesCsv` | first line `invoices = onlyInvoices(invoices)` |
| `app/helpers/backupFlow.js` `collectBackup` / `previewImport` / `runImport` | none: backup keeps estimates |
| `backupFlow.js` `exportCsv` | none (helper filters) |
| `CommandPalette.jsx` `useSelector(s => s.invoices)` | Step 9 |
| 020 payment code (required) | Step 6.6 |

4. Add the filter tests (Test plan C) to `app/reducers/__tests__/InvoicesReducer.spec.js`, `app/helpers/__tests__/dashboard.spec.js`, `clients.spec.js`, `csv.spec.js`.

**Verify**: `npx vitest run app/reducers/__tests__/InvoicesReducer.spec.js app/helpers/__tests__/dashboard.spec.js app/helpers/__tests__/clients.spec.js app/helpers/__tests__/csv.spec.js` → pass. Re-run the grep: every hit is in the table or in your report.

### Step 4: Settings, numbering per type, backup

1. `app.js` `defaultOptions.invoice`: add `estimateNumbering: { prefix: 'EST-', next: 1, padding: 4 }` and `estimateValidDays: 30`.
2. `app/helpers/numbering.js`: add `DEFAULT_ESTIMATE_NUMBERING`, `numberingKeyFor(docType)` → `'estimateNumbering'` for estimates, else `'numbering'`, and `defaultNumberingFor(docType)`. Give `normalizeNumbering(value, defaults = DEFAULT_NUMBERING)` an optional second argument. Keep all old call sites valid.
3. `app/helpers/settings.js` `getSettingsErrors('invoice', …)`: apply the `numbering` rules to `estimateNumbering` too (when present). Add `estimateValidDays`: integer 1–365 (`settings:errors:validDays`).
4. `app/helpers/backup.js`:
   - `mergeImportedSettings`: keep `Math.max` of `next` for `estimateNumbering`, as for `numbering`.
   - Set `BACKUP_VERSION = 4` (021 writes 3); stop if the live value differs and reconcile the index before writing. Reason: an older Manta would import estimates as invoices. With the bump it refuses the file (`newer-version`). `parseBackup` keeps accepting versions 1–3 with their existing validation; keep rejecting unknown future versions.
5. `InvoiceDefaults.jsx`: under the invoice numbering group, add an "Estimates" group: prefix, next, digits (copy the numbering controls and their sample line, bound to `estimateNumbering`), and "Valid for (days)" (`Input type="number"`, bound to `estimateValidDays`). Use the 016 instant-apply path.
6. Tests: Test plan D.

**Verify**: `npx vitest run app/helpers/__tests__/numbering.spec.js app/helpers/__tests__/settings.spec.js app/helpers/__tests__/backup.spec.js` → pass. `grep -c "estimateNumbering\|estimateValidDays" app.js` → `2`.

### Step 5: Form state and save path

1. Constants and actions: add `FORM_SET_DOC_TYPE`, `ESTIMATE_CONVERT`, `ESTIMATE_MARK_CONVERTED`, `UI_NEW_ESTIMATE` to `app/constants/actions.jsx`. Add `setFormDocType` to `app/actions/form.jsx`. Create `app/actions/estimates.jsx` with `convertEstimate = createAction(ESTIMATE_CONVERT, e => e)` and `markEstimateConverted = createAction(ESTIMATE_MARK_CONVERTED, p => p)` (`{ estimateId, invoiceId }`). Add `newEstimate = createAction(UI_NEW_ESTIMATE)` to `app/actions/ui.jsx`.
2. `FormReducer.jsx`:
   - `initialState`: `docType: 'invoice'`, `validUntil: null`, `sourceEstimateId: null`.
   - `populateFromInvoice`: `docType: getDocType(payload)`, `validUntil: payload.validUntil ?? null`, `sourceEstimateId: payload.sourceEstimateId ?? null`.
   - `FORM_SET_DOC_TYPE`: ignore when `settings.editMode.active` or when the type is unchanged. Else set `docType`, and reset `validUntil`, `sourceEstimateId`, `errors`, `errorMode`.
   - `FORM_CLEAR`: keep `docType`; reset `validUntil` and `sourceEstimateId`.
3. `app/helpers/form.js`:
   - `pickInvoiceFields`: always copy `docType`. For estimates copy `validUntil` and drop `dueDate`. For invoices copy `sourceEstimateId` when set.
   - `resolveSaveStatus(mode, editData, docType = 'invoice')`: estimate rules from Decision 5; invoice rules unchanged.
   - `getInvoiceData(form, { …, estimateValidDays })`: estimates get `validUntil: form.validUntil ?? getDefaultValidUntil(issuedAt, estimateValidDays)`.
   - `getFormErrors`: for estimates skip the `dueDate` rules. In final mode add `validUntil`: if set and before the start of the issue day → `form:errors:validUntilBeforeIssue`.
4. `app/helpers/preview.js` `formToPreviewInvoice`: pass `docType`. For estimates set `validUntil` (form value or the default from `invoiceSettings.estimateValidDays`).
5. `FormMW.jsx` `handleSave`:
   - Read `estimateValidDays` with `normalizeValidDays(appConfig.get('invoice.estimateValidDays'))` and pass it to `getInvoiceData`.
   - New invoice with `data.sourceEstimateId`: before the save, `docs = await getAllDocs('invoices')`. If the estimate exists and `!canConvert(est, buildLinkIndex(docs))`: dispatch the warning `estimates:toast:alreadyConverted` and return (keep the form). If the estimate no longer exists, save without marking.
   - Numbering: `key = numberingKeyFor(data.docType)`; `appConfig.set('invoice.' + key, advanceNumbering(normalizeNumbering(appConfig.get('invoice.' + key), defaultNumberingFor(data.docType)), data.invoiceID))`.
   - After a successful new save with `sourceEstimateId` (and the estimate exists): `await dispatch(markEstimateConverted({ estimateId: data.sourceEstimateId, invoiceId: data._id }))`.
   - After an edit, change the tab to `listTabFor(data.docType)`.
   - Number pre-fill: also after `FORM_SET_DOC_TYPE` passes. Use the counter of `getState().form.docType`. Skip it in edit mode.
6. Tests: Test plan E.

**Verify**: `npx vitest run app/reducers/__tests__/FormReducer.spec.js app/helpers/__tests__/form.spec.js app/helpers/__tests__/preview.spec.js app/middlewares/__tests__/FormMW.spec.js` → pass.

### Step 6: Invoices middleware

1. `INVOICE_SET_STATUS`: keep 014's early guard, but accept the union of `INVOICE_STATUSES` and `ESTIMATE_SETTABLE_STATUSES` (`overdue`, `expired`, `converted` are rejected before any fetch). After `getSingleDoc`, reject with a warning when `!isSettableStatus(doc, status)`. Apply this to each doc of an array payload too.
2. `INVOICE_DUPLICATE` (015): add `'convertedInvoiceId', 'convertedAt', 'sourceEstimateId', 'validUntil', 'payments', 'sentAt'` to its `omit` list. `docType` stays, so a duplicated estimate stays an estimate.
3. `ESTIMATE_CONVERT`: guard any dirty editor, including a new unsaved invoice (not only edit mode), with the 013 unsaved-work confirmation before replacing form data. `docs = await getAllDocs('invoices')`; `est = docs.find(d => d._id === action.payload._id)`. Missing or `!canConvert(est, buildLinkIndex(docs))` → warning toast `estimates:toast:alreadyConverted` (or `notFound`), return `false`. Else `contacts = await getAllDocs('contacts')`, dispatch `{ type: FORM_LOAD_DUPLICATE, payload: { ...estimateToInvoiceDraft(est), contacts } }`, then `changeActiveTab('form')`. Do not load over unsaved work unless that confirmation succeeds.
4. `ESTIMATE_MARK_CONVERTED`: `doc = await getSingleDoc('invoices', estimateId)`; `docs = await updateDoc('invoices', withConversion(doc, invoiceId, Date.now()))`; `next({ type: INVOICE_UPDATE, payload: docs })`; toast `estimates:toast:converted` (number). On error: warning `estimates:toast:linkFailed` and return `false`. The invoice is already saved, and Decision 8 still blocks a second conversion.
5. Toast texts by type: `INVOICE_SAVE` uses `messages:estimate:saved` / `draftSaved` for estimates. `INVOICE_DELETE` uses `estimates:toast:deleted` when every removed snapshot is an estimate. `INVOICE_SAVE` of a non-draft estimate still opens the preview.
6. In every payment helper and middleware write entry point, including set-status/bulk paths, require `isInvoice(doc)`. In each payment case (`grep -n "payment" app/middlewares/InvoicesMW.jsx`), after the doc fetch, reject non-invoices (`!isInvoice(doc)`) with a warning and return `false`. Hide "Record payment" for estimates in any shared component.
7. Tests: Test plan F (`await` every middleware call).

**Verify**: `npx vitest run app/middlewares/__tests__/InvoicesMW.spec.js` → pass.

### Step 7: Editor doc-type mode

1. `EditorLayout.jsx` and 013 `TitleBar.jsx`: title by `form.docType` and edit mode: `form:header:newEstimate` / `editEstimate` (`app:titles:newEstimate` / `editEstimate`).
2. `DetailsCard.jsx` in estimate mode:
   - Number label `form:fields:estimateNumber:label`. Hint `form:fields:estimateNumber:hint`.
   - Replace the whole due-date group with a `DatePickerField` "Valid until" (`form:fields:validUntil`). Value = `validUntil ?? getDefaultValidUntil(issuedAt ?? now, savedSettings.invoice.estimateValidDays)`. On change dispatch `updateFieldData('validUntil', startOfDay(date))`. Error from `errors.validUntil`.
3. `CustomizeFieldsMenu.jsx`: hide the `dueDate` item in estimate mode.
4. `TotalsFooter.jsx`: same buttons. The "Save & preview" label stays. Payments: hide any payments area in estimate mode.
5. For a form loaded by conversion (`docType === 'invoice' && sourceEstimateId`), show a muted line under the title: `form:convertedFrom` with the estimate number (look it up in `getAllSalesDocs`).

**Verify**: `npm run build` → exit 0. Manual check in Step 12.

### Step 8: Estimates page, sidebar, status badge

1. Create `app/helpers/estimateList.js`:
   - `toEstimateRow(e, now, index)` → `{ id, invoice: e, number: getInvoiceNumber(e), client, issuedAt: getIssuedAt(e), validUntil: e.validUntil ?? null, validInDays, displayStatus, amount: e.grandTotal ?? 0, amountText: formatInvoiceAmount(e), convertedInvoice, canConvert }`. Use the same keys as 014 rows, so 014's `matchesSearch` works unchanged. Check that `matchesSearch` reads only these keys.
   - `matchesEstimateTab(display, tab)` → `tab === 'all' || display === tab`.
   - `countByEstimateTab(rows)` → one count per `ESTIMATE_TABS` entry.
   - Tests in `app/helpers/__tests__/estimateList.spec.js` (Test plan G).
2. `StatusBadge.jsx` (014): add estimate statuses (icon + text, never color alone): `sent` `Send` / `--status-pending`; `accepted` `CircleCheck` / `--status-paid`; `declined` `CircleX` / `--status-cancelled`; `expired` `CalendarX` / `--status-overdue`; `converted` `ArrowRightLeft` / `--status-refunded`. Text: `estimates:status:<s>` for these five. `draft` keeps its look.
3. `app/components/estimates/columns.jsx`: copy the 014 column factory. Columns: select is not needed. Use Number (button → `editInvoice(e)`), Client, Issued, Valid until (date + muted `estimates:valid:inDays` / `today` / `expiredDays` for `draft`/`sent`), Amount, Status (sort by `ESTIMATE_SORT_RANK`), Actions.
4. `EstimateRowActions.jsx` (shadcn `DropdownMenu`, trigger `MoreHorizontal`, `aria-label` `estimates:actions:open`):
   - Edit → `editInvoice(e)`. Duplicate → `duplicateInvoice(e)`.
   - Mark sent (stored `draft`), Mark accepted (stored `draft`/`sent`/`declined`), Mark declined (stored `draft`/`sent`/`accepted`) → `setInvoiceStatus(id, s)`.
   - Convert to invoice (`row.canConvert`, icon `FilePlus`) → `convertEstimate(e)`. When `row.convertedInvoice` exists: "Open invoice" (`FileCheck`) → `ipc.send('preview-invoice', row.convertedInvoice)` instead.
   - Preview / Export PDF → `ipc.send('preview-invoice', e)`.
   - Separator, Delete (destructive) → `deleteInvoice(id)` (014 Undo toast).
5. `EstimatesEmpty.jsx`: shadcn `Empty`, icon `FileText`. Variants `none` (button "New estimate" → `newEstimate()`) and `noResults` (Clear filters).
6. `app/containers/Estimates.jsx` (function component). Copy the 014 container without selection, bulk bar and sheet:
   - `useSelector(getEstimates)`, `useSelector(getAllSalesDocs)` → `index = useMemo(() => buildLinkIndex(all), [all])`, `useNow()`.
   - State `tab`, `query`, `sorting` (`[{ id: 'issuedAt', desc: true }]`).
   - Header: `<h1>` `estimates:header:name`, search, primary button "New estimate". `Tabs` with counts. Table via 014 `InvoicesTable` (if it takes the table as a prop; else copy it). Row click → `editInvoice(e)`.
7. `AppMain.jsx`: `{activeTab === 'estimates' && <Estimates />}`. `TitleBar.jsx`: title `app:nav:estimates` for that tab.
8. `AppSidebar.jsx`: add "Estimates" (`FileText`, tab `estimates`, tooltip) after "Invoices" (order: Dashboard, Invoices, Estimates, then any 024/016/019 items). Apply Decision 11. `isActive` for Estimates: `activeTab === 'estimates' || (activeTab === 'form' && formDocType === 'estimate')`. "New invoice" is active only when `formDocType === 'invoice'`.
9. `InvoiceDetailSheet.jsx` (014): when `invoice.sourceEstimateId` resolves in `getAllSalesDocs`, show `invoices:sheet:fromEstimate` with the estimate number.

**Verify**: `npx vitest run app/helpers/__tests__/estimateList.spec.js` → pass; `npm run build` → exit 0; `grep -rn "styled-components\|ion-" app/containers/Estimates.jsx app/components/estimates` → no output.

### Step 9: New estimate action and command palette

1. `UIMiddleware.jsx`:
   - `UI_NEW_ESTIMATE`: copy the 013 `UI_NEW_INVOICE` flow (confirm in edit mode, then `clearForm(null, true)`). Then dispatch `setFormDocType('estimate')` and `changeActiveTab('form')`. Never call `next`.
   - `UI_NEW_INVOICE`: before the tab change, dispatch `setFormDocType('invoice')`. Typed content of a new (unsaved) form stays. Only the type and number change.
2. `CommandPalette.jsx`:
   - Replace `useSelector(s => s.invoices)` with `useSelector(getInvoices)`. Add `useSelector(getEstimates)`.
   - "Go to": add Estimates (`nav-estimates`, keywords `['quotes', 'estimates']`).
   - "Actions": add New estimate (`action-new-estimate`, keywords `['quote']`) → `newEstimate()`.
   - Add a group "Estimates": `searchRecords({ query, invoices: estimates }).invoices`, `value` `estimate-<_id>`, `onSelect` → `ipc.send('preview-invoice', e)`.
3. Update `UIMiddleware.spec.js` (Test plan H).

**Verify**: `npx vitest run app/middlewares/__tests__/UIMiddleware.spec.js` → pass.

### Step 10: Templates and PDF file name

1. PDF baseline **before** any template change: `npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-before-022`.
2. In both `Header.jsx` files:
   - Import `getDocTitleKey`, `isEstimate` from `app/helpers/docType`.
   - Title: `t(getDocTitleKey(invoice), { lng: language })`.
   - Wrap the due-date block: `{isEstimate(invoice) ? validUntilLine : (<existing block, unchanged>)}`. `validUntilLine` = `invoice.validUntil != null && <p>{t('preview:common:validUntil', { lng: language })}:{' '}{moment(invoice.validUntil).lang(language).format(configs.dateFormat)}</p>`. Use the same element and spacing as the due-date `<p>`.
3. `i18n/en/preview.json` `common`: add `"estimate": "Estimate"` and `"validUntil": "Valid until"`.
4. Create `main/pdf-file-name.js` (ESM `export`, like `main/print-options.js`): `pdfFileName(docId, docType)` → `base` is a non-empty filename component derived from a validated string id: strip both slash styles and control characters, handle Windows reserved names and trailing dots/spaces, enforce a bounded length, and verify the resolved path remains inside the export directory; estimates → `estimate-${base}.pdf`; else `${base}.pdf`. Write `main/__tests__/pdf-file-name.spec.js` (Test plan I).
5. `main/save-pdf.js`: `ipcMain.on('save-pdf', async (event, docId, meta) => {` and `path.join(exportDir, pdfFileName(docId, meta && meta.docType))`. Keep the rest (017's onboarding block too).
6. `preview/containers/SideBar.jsx` (018 version): `ipc.send('save-pdf', invoice._id, { docType: getDocType(invoice) })`.
7. Compare: `npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-after-022 && sh scripts/pdf-compare.sh /tmp/manta-pdf-before-022 /tmp/manta-pdf-after-022 --light-ref` → `ALL IDENTICAL`.
8. Estimate check: add a persistent `SNAPSHOT_SET=estimate` manifest branch in `scripts/pdf-snapshot.mjs` (keep the legacy and line branches unchanged), using `BASE.docType = 'estimate'`, `BASE.status = 'sent'`, `BASE.validUntil = getDefaultValidUntil(T, 30)` and delete `BASE.dueDate` for its fixtures. Do not move the script to `/tmp`: relative imports would break. Run `SNAPSHOT_SET=estimate node scripts/pdf-snapshot.mjs /tmp/manta-pdf-estimate`. Then `pdftotext /tmp/manta-pdf-estimate/minimal-default-light.pdf - | grep -c "Estimate\|Valid until"` → `2` or more; same for `business-default-light.pdf`. Open both PDFs and check the layout by eye.

**Verify**: Step 10.7 prints `ALL IDENTICAL`; `npx vitest run main/__tests__/pdf-file-name.spec.js` → pass.

### Step 11: Strings

1. Create `i18n/en/estimates.json` and register it in `i18n/en/index.js`:
   ```json
   { "header": { "name": "Estimates", "count_one": "{{count}} estimate", "count_other": "{{count}} estimates" },
     "newEstimate": "New estimate",
     "search": { "label": "Search estimates", "placeholder": "Search number, client or amount" },
     "tabs": { "all": "All", "draft": "Draft", "sent": "Sent", "accepted": "Accepted", "declined": "Declined", "expired": "Expired", "converted": "Converted" },
     "status": { "sent": "Sent", "accepted": "Accepted", "declined": "Declined", "expired": "Expired", "converted": "Converted" },
     "columns": { "number": "Number", "client": "Client", "issued": "Issued", "validUntil": "Valid until", "amount": "Amount", "status": "Status", "actions": "Actions" },
     "valid": { "today": "Valid until today", "inDays_one": "Valid {{count}} more day", "inDays_other": "Valid {{count}} more days", "expiredDays_one": "Expired {{count}} day ago", "expiredDays_other": "Expired {{count}} days ago" },
     "actions": { "open": "Estimate actions", "edit": "Edit", "duplicate": "Duplicate", "markSent": "Mark as sent", "markAccepted": "Mark as accepted", "markDeclined": "Mark as declined", "convert": "Convert to invoice", "openInvoice": "Open invoice", "preview": "Preview / Export PDF", "delete": "Delete" },
     "empty": { "title": "No estimates yet", "description": "Create an estimate. Convert it into an invoice when the client accepts.", "noResults": "No matching estimates", "clearFilters": "Clear filters" },
     "toast": { "converted": "Estimate {{number}} converted", "alreadyConverted": "This estimate is already converted into an invoice", "notFound": "This estimate no longer exists", "linkFailed": "The invoice is saved, but the estimate could not be marked as converted", "deleted_one": "Estimate deleted", "deleted_other": "{{count}} estimates deleted" } }
   ```
2. Add to `i18n/en/form.json`: `header.newEstimate` "New estimate", `header.editEstimate` "Edit estimate", `fields.validUntil` "Valid until", `fields.estimateNumber.{label,hint}` "Estimate number" / "Next number from Settings", `errors.validUntilBeforeIssue` "The valid-until date must be on or after the issue date", `convertedFrom` "Created from estimate {{number}}".
3. `i18n/en/messages.json`: `estimate.saved` "Estimate saved", `estimate.draftSaved` "Estimate saved as draft". `invoices.json`: `sheet.fromEstimate` "Created from estimate {{number}}". 013 nav file (`grep -rln '"newInvoice"' i18n/en`): `nav.estimates`, `titles.newEstimate`, `titles.editEstimate`, `palette.newEstimate`, `palette.estimates`. `settings.json`: the Estimates group labels and `errors.validDays`.

**Verify**: `for f in i18n/en/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || echo BAD $f; done` → no `BAD`. `grep -rhoE "estimates:[a-zA-Z:]+" app | sort -u` → each key exists (plural keys without `_one`/`_other`).

### Step 12: Full checks and manual smoke

1. `npm test` → exit 0. `npm run lint` → exit 0. `npm run test:e2e` → all pass.
2. On `/tmp/manta-profile-copy`, in **light and dark** mode:
   - Old invoices appear unchanged. Dashboard, Clients and CSV totals equal the values before this plan (write them down first).
   - Palette → New estimate: the title is "New estimate", the number is `EST-0001`, "Valid until" shows issue date + 30 days, and there is no due date.
   - Save draft → the Estimates page shows it under Draft. Save & preview another one → status Sent; the preview prints "Estimate" and "Valid until".
   - Dashboard KPIs, Needs attention, the Invoices list, the overdue badge, the client sheet and the CSV do not include the estimates.
   - A Sent estimate with a past "Valid until" shows Expired and is under the Expired tab.
   - Mark accepted → Convert to invoice → the editor shows "New invoice", the next `INV-` number, the same client, rows and totals. Clear → nothing saved; the estimate is still Accepted.
   - Convert again → Save draft → the invoice is in Invoices (Draft). The estimate is Converted. Its menu shows "Open invoice", not "Convert".
   - Duplicate an estimate → the editor shows the next `EST-` number. Delete an estimate → Undo brings it back.
   - Export an estimate PDF → the file name starts with `estimate-`. Export an invoice PDF → the name is `<id>.pdf` as before.
   - Payments: no "Record payment" on estimates.
3. Take screenshots of the Estimates page and the estimate editor in both modes, if possible.

**Verify**: every item behaves as written. Record failures in the report.

## Test plan

Unit tests only for logic (no markup, snapshot or class tests):
- **A. `docType.spec.js`**: `getDocType` for missing, `null`, `''` → `invoice`; `0`, `false`, arrays and objects are unsupported values and never treated as an invoice; `estimate`, `creditNote` → same; `'foo'` → `'foo'` (not invoice). `onlyInvoices` on a mixed list keeps old docs without `docType` and drops estimates and `'foo'`. `getDocTitleKey`, `listTabFor`.
- **B. `estimate.spec.js`** (TZ=UTC unless stated):
  - `getEstimateDisplayStatus`: draft and sent with past `validUntil` → `expired`; `validUntil` = today 00:00, `now` = today 23:59 → not expired; accepted/declined/converted with past date → unchanged; no `validUntil` → never expired; missing or unknown status → `draft`. TZ `America/New_York` across 2026-11-01 DST: valid until 2026-10-31, `now` 2026-11-01 00:30 → expired, `getValidInDays` → `-1`.
  - `getDefaultValidUntil(Date.UTC(2026,0,15,10), 30)` → `Date.UTC(2026,1,14)`; days `0`, `'x'`, `400` → 30. NY TZ across DST → exact local midnight.
  - `estimateToInvoiceDraft`: copies recipient, rows, currency, discount, tax, note, configs; no `_id`, `_rev`, `status`, `validUntil`, `invoiceID`, `issuedAt`, `created_at`, `convertedInvoiceId`, `payments`, `dueDate`; `docType === 'invoice'`; `sourceEstimateId === e._id`; input not mutated.
  - `canConvert`: draft/sent/accepted → true; declined → false; converted with a live linked invoice → false; estimate still `accepted` but an invoice has `sourceEstimateId` → false; converted whose invoice was deleted → true; an invoice passed in → false.
  - `withConversion` sets status, link and `convertedAt`. `isSettableStatus`: estimate + `accepted` → true; estimate + `paid` → false; invoice + `sent` → false; converted estimate + `draft` → false.
  - `invoice.spec.js`: `getDisplayStatus` of a sent estimate with a past date → `expired`, never `pending`/`overdue`; `getStoredStatus` of an estimate without `status` → `draft` (not `pending`); old invoice without `status` → still `pending`.
- **C. Filters**: `getInvoices` drops estimates and returns the same reference for the same state; `getEstimates`; `getOverdueCount` ignores a sent estimate with an old date. `getDashboardStats`, `getMonthlyPaid`, `getNeedsAttention`, `getRecentInvoices` give equal results with and without an added estimate. `summarizeClients`: an estimate for the client changes neither `invoiceCount` nor `outstanding`. `buildInvoicesCsv`: line count ignores estimates.
- **D. Settings**: `numberingKeyFor`; `normalizeNumbering(undefined, DEFAULT_ESTIMATE_NUMBERING)` → `EST-`; `advanceNumbering` with `EST-0003`; `getSettingsErrors` for `estimateNumbering.next: 0` and `estimateValidDays: 0 | 366 | 2.5`; `mergeImportedSettings` keeps the larger `estimateNumbering.next`; `parseBackup` accepts the previous `BACKUP_VERSION` and round-trips an estimate with `docType`, `validUntil` and `convertedInvoiceId`.
- **E. Form**: reducer `FORM_SET_DOC_TYPE` (ignored in edit mode), `FORM_CLEAR` keeps `docType` and clears `sourceEstimateId`, `INVOICE_EDIT` of an old invoice → `docType: 'invoice'`, of an estimate → `validUntil` set. `getInvoiceData` for an estimate: `docType`, default `validUntil`, no `dueDate`; for an invoice: `docType: 'invoice'`, `sourceEstimateId` kept. `resolveSaveStatus` estimate cases (draft, new final → `sent`, edited draft final → `sent`, accepted edit → `accepted`). `getFormErrors`: estimate skips due-date rules; `validUntil` before issue → error in final mode only. `FormMW`: new estimate save sets only `invoice.estimateNumbering`; new invoice save sets only `invoice.numbering`; conversion save → `saveInvoice` then `markEstimateConverted({ estimateId, invoiceId })` in that order; already converted → no `saveInvoice`, form kept; failed invoice save → no mark.
- **F. `InvoicesMW.spec.js`**: `ESTIMATE_CONVERT` → `FORM_LOAD_DUPLICATE` with the mapping, then `changeActiveTab('form')`, no `saveDoc`; converted estimate → warning, no `FORM_LOAD_DUPLICATE`. `ESTIMATE_MARK_CONVERTED` → `updateDoc` payload has `status: 'converted'` and the link; `next` gets `INVOICE_UPDATE`. Set status: `expired` → no fetch; estimate `accepted` → update; estimate `paid` and invoice `sent` → warning, no update. Duplicate of an estimate keeps `docType`, drops `convertedInvoiceId` and `validUntil`. 020: payment on an estimate → rejected.
- **G. `estimateList.spec.js`**: every tab × display status; `countByEstimateTab` sums; `toEstimateRow` sets `convertedInvoice` and `canConvert` from the index; `matchesSearch` finds an estimate row by client and amount digits.
- **H. `UIMiddleware.spec.js`**: `UI_NEW_ESTIMATE` outside edit mode → `setFormDocType('estimate')` then `changeActiveTab('form')`; in edit mode + confirm `false` → nothing. `UI_NEW_INVOICE` dispatches `setFormDocType('invoice')`.
- **I. `pdf-file-name.spec.js`**: invoice id → `<id>.pdf` (unchanged); missing type → same; estimate → `estimate-<id>.pdf`; `'../x'` → `x.pdf`; backslash traversal, control characters, empty ids, Windows reserved names and unsupported types are safely handled or rejected; resolved output never escapes the export directory.
- Add a focused regression for concurrent conversion saves (one invoice per source), and link-write failure/retry (same saved invoice id, no second invoice). Existing e2e must pass. PDF compare in Step 10.7 proves old invoices render identically.

## Done criteria

- [ ] `npm test`, `npm run lint`, `npm run build` exit 0; `npm run test:e2e` all pass
- [ ] `sh scripts/pdf-compare.sh /tmp/manta-pdf-before-022 /tmp/manta-pdf-after-022 --light-ref` → `ALL IDENTICAL`
- [ ] `grep -rnE "state\.invoices|s\.invoices" app ui --include='*.js' --include='*.jsx' | grep -v __tests__` → only `getAllSalesDocs` in `InvoicesReducer.jsx`
- [ ] `grep -c "onlyInvoices" app/helpers/dashboard.js app/helpers/clients.js app/helpers/csv.js` → `≥4`, `≥1`, `≥1`
- [ ] `grep -n "estimateNumbering\|estimateValidDays" app.js` → 2 hits
- [ ] `grep -n "pdfFileName" main/save-pdf.js` → 1+ hit
- [ ] Manual smoke list in Step 12 passed in light and dark mode on a copied profile
- [ ] `git log --format=%B <base>..HEAD | grep -ci "co-authored\|generated with"` → `0`
- [ ] `plans/README.md` row for 022 updated (unless a reviewer maintains it)

## STOP conditions

- A precondition fails, or a 014–017 name is missing and one grep does not find its new name.
- The PDF compare in Step 10.7 shows any difference for the invoice cases.
- A dashboard, client or CSV total on the copied profile changes after this plan when the profile has no estimates.
- Any step needs a migration that writes `docType` to existing docs, or another destructive change to saved data.
- `getInvoices` cannot be memoized (react-redux stability warning stays in the console).
- 015's `FORM_LOAD_DUPLICATE` saves a doc or advances a counter (then conversion would save at once).
- The audit grep finds an invoice consumer that you cannot classify with the rule in Step 3.3.

## Maintenance notes

- **Rule for new code**: lists, totals, counts and exports read `getInvoices` / `onlyInvoices`. Raw `state.invoices` is only for storage-level code. 023 adds `creditNote` to `docType.js` and its own selector; keep `getInvoices` invoice-only.
- `getDocType` lives in `app/helpers/docType.js` and is re-exported from `app/helpers/invoice.js` (023 greps for it there). Keep both.
- `docType` is written on every save from now on. Old docs have none and count as invoices. No backfill exists or is needed.
- Conversion order is invoice first, estimate second. The invoice's `sourceEstimateId` is the source of truth for "already converted"; the per-estimate save queue closes the check/write race within this renderer. Do not remove that check from `canConvert`.
- If a converted invoice is deleted, the estimate stays `converted` but can be converted again. Block reconversion while a delete is still undoable. After the undo interval expires, reconversion is allowed. A restore from a later backup can still produce duplicate source links; show the conflict and keep both docs rather than silently choosing one.
- The title is "Estimate" only. A "Quote" wording option was rejected for now: it needs a setting that reaches both the preview window configs and the live preview. Translators can choose the word per locale (`preview:common:estimate`).
- Other locales print "Estimate" and "Valid until" in English until they get translations (`fallbackLng: 'en'`).
- Snapshot manifests now include `SNAPSHOT_SET=estimate`; later template plans must compare this set as well as legacy/payment and line-tax cases.
- `BACKUP_VERSION` was bumped so older Manta builds refuse backups with estimates. Bump it again whenever a new doc type or database appears.
- Estimate PDFs are `estimate-<_id>.pdf`. 026 (email) must use `pdfFileName` and never build the name itself.
- Template changes to `Header.jsx` need a new 018 PDF baseline only for estimate output. Invoice output must stay identical.
- Reviewers: check the audit grep output in the report, the memoized selectors, the `onlyInvoices` first lines, the save order in `handleSave`, and the PDF compare output.
