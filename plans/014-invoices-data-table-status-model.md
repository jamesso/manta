# Plan 014: Show invoices in a searchable, sortable data table with Draft and Overdue statuses, a detail sheet and undoable delete

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- app/containers/Invoices.jsx app/containers/__tests__/Invoices.spec.jsx app/components/invoices app/components/shared/SplitButton.jsx app/components/shared/_tests_/SplitButton.spec.jsx app/actions/invoices.jsx app/constants/actions.jsx app/reducers/InvoicesReducer.jsx app/reducers/__tests__/InvoicesReducer.spec.js app/middlewares/InvoicesMW.jsx app/middlewares/__tests__/InvoicesMW.spec.js app/helpers/invoice.js app/helpers/__tests__/invoice.spec.js app/helpers/pouchDB.js app/helpers/__tests__/pouchDB.spec.js app/helpers/__mocks__/pouchDB.js helpers/date.js i18n/en/invoices.json README.md`
> Plan 013 changes `app/containers/Invoices.jsx` on purpose (the delete confirmation moves from `openDialog()` to the in-app dialog API) and may change the notification calls in `app/middlewares/InvoicesMW.jsx` (AppNoti → toasts). Read the live content of those two files. Any other difference from the "Current state" excerpts is a STOP condition.

## Execution checks added by review (2026-11-01)

- Record the execution start commit and starting changes. Scope checks compare this plan's changes with that baseline, not with a clean-tree requirement. Earlier plans can change the listed files; check the required behavior before treating expected changes as drift.
- Before a live app check, use Jean `get_run_environments`; use its running environment or `start_run_environment`. Do not start a second dev server by hand. Confirm that the environment uses a disposable `MANTA_USER_DATA` profile. Record the exact URL or Electron entry and profile used. If no Run command is configured, report that limit.
- Use the narrow tests listed for each changed behavior. Reuse passing results when the covered code has not changed. Run broad tests once at the final integration gate for shared state, persistence or IPC changes. Visual checks require the running app; do not replace them with markup assertions.
- Do not copy a profile while Manta is running. Close it first. Use a new temporary destination, or confirm the existing destination is disposable; repeated `cp -R` into an existing folder can create a nested profile.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED — this plan writes the saved `status` field and adds `paidAt`. It also deletes invoice documents and re-creates them on Undo.
- **Depends on**: plans/013-*.md (and transitively 012)
- **Category**: ui-redesign
- **Planned at**: commit `3e89104`, 2026-11-01

## Why this matters

The invoices page is the screen users open most. Today it shows a grid of large cards (`col-lg-6`). It has no search, no sort and no due-date warning. The order is random, because `getAllDocs` returns PouchDB's `_id` order (random UUIDs) and nothing sorts it. The card shows Pending for an invoice that is 3 months late. Delete asks for confirmation, but NN/g recommends Undo instead (https://www.nngroup.com/articles/confirmation-dialog/).

The plan also fixes a real bug. `calTermDate` (`helpers/date.js:26-27`) builds the term date from **today's** month and year plus the invoice's day of month. An invoice created on 2025-01-15 with `net30` shows a due date of 2026-12-15 when it is viewed in November 2026 (verified, see Facts). Every due date that comes from a payment term is wrong in the list and in the preview/PDF templates. Without this fix, Overdue cannot work.

After this plan, the page has these parts:
- A dense table: checkbox, Number, Client, Issued, Due (with relative text), Amount and a Status badge.
- Status tabs with counts: All · Draft · Outstanding · Overdue · Paid · Closed.
- Search, column sort, and a row-actions menu.
- A detail Sheet that opens when you click a row.
- Bulk Mark as paid and bulk Delete.
- Delete with an Undo toast.
- An overdue count badge on the sidebar item.

The stored statuses become `draft | pending | paid | refunded | cancelled`. `overdue` is derived and never stored.

**README claim checked**: `README.md:59` says "🏷 Custom statuses for invoices." This is not true. The code has 4 fixed statuses (`app/containers/Invoices.jsx:120`, `app/components/invoices/Invoice.jsx:260-273`). Users cannot add statuses. Step 11 corrects the line.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current` | current branch; record its name, do not switch |
| 012 done: alias + Tailwind | `grep -n "'@'" electron.vite.config.mjs vitest.config.mjs; test -f jsconfig.json && echo ok` | alias lines in both files; `ok` |
| 012 done: status tokens | `grep -c "status-overdue" ui/styles/globals.css` | ≥ 2 (light + dark) |
| 013 done: sidebar | `grep -rln "SidebarMenuItem" app ui --include='*.jsx'` | one app file that renders the nav (note its path) |
| 013 done: imperative toast | `grep -rn "export.*toast" ui/components/ui/toast.jsx ui/lib 2>/dev/null` | an exported `toast` object with `add` and `close` (note the import path) |
| 013 done: New invoice action | `grep -rn "New invoice\|newInvoice" app ui --include='*.jsx' --include='*.js' -l` | the file with the sidebar "New invoice" handler (reuse it) |
| shadcn config | `node -p "require('./components.json').style"` | `base-nova` |
| Tests pass | `npm test` | exit 0 |
| Lint passes | `npm run lint` | exit 0 |

Use a **copy** of user data for every manual run. Never use the real profile:
`cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy` (macOS), then `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev`.

## Current state

`app/containers/Invoices.jsx` (class component, 170 lines). Filter = one stored status, 4 fixed statuses, card grid:

```jsx
103:    const filteredInvoices = filter
104:      ? invoices.filter(invoice => invoice.status === filter)
105:      : invoices;
120:    const statuses = ['paid', 'pending', 'refunded', 'cancelled'];
145:            <div className="row">{invoicesComponent}</div>
```

`app/components/invoices/Invoice.jsx` (card, styled-components, Ionicons). Number fallback, due date, amount:

```jsx
191:  viewInvoice() {
192:    ipc.send('preview-invoice', this.props.invoice);
237:    const { dueDate, configs } = invoice;
238:    const { useCustom, paymentTerm, selectedDate } = dueDate;
239:    const dateFormat = configs ? configs.dateFormat : this.props.dateFormat;
241:    if (useCustom === true) {
242:      return moment(selectedDate).format(dateFormat);
245:    const paymentTermDate = calTermDate(invoice.created_at, paymentTerm);
274:    const currencyBefore = invoice.currency.placement === 'before';
301:                  {invoice.invoiceID
302:                    ? invoice.invoiceID
303:                    : truncate(invoice._id, { length: 8, omission: '' })}
312:                  {currencyBefore ? invoice.currency.code : null}{' '}
313:                  {formatNumber(invoice.grandTotal, invoice.currency.fraction, invoice.currency.separator)}{' '}
318:                  {currencyBefore ? null : invoice.currency.code}
```

`app/components/shared/SplitButton.jsx` is used only by `Invoice.jsx` (`grep -rln SplitButton app` → `Invoice.jsx`, itself, `_tests_/SplitButton.spec.jsx`). `app/components/shared/Button.jsx` is used by 6 other files. Keep it.

`helpers/date.js:1-28` (bug: line 26 uses today, not `createdAt`):

```js
 1	function calTermDate(createdAt, adjustment) {
 2	  const createdDate = new Date(createdAt);
...	  // net10/net30/net60/net90 → 10/30/60/90, default (incl. 'net7') → 7
26	  const paymentTermDate = new Date();
27	  return paymentTermDate.setDate(createdDate.getDate() + numberOfDaysToAdd);
```

Callers of `calTermDate`: `Invoice.jsx:245`, `preview/templates/minimal/components/Header.jsx:78`, `preview/templates/business/components/Header.jsx:118`.

Due-date shapes stored in docs:
- `{ useCustom: true, selectedDate: <moment.toObject()> }`. The object looks like `{years, months (0-based), date, hours, …}` in local time (`app/components/form/DueDatePicker.jsx:77`).
- `{ useCustom: false, paymentTerm: 'net7'|'net10'|'net30'|'net60'|'net90' }` (`libs/paymentTerms.js`).
- `{ useCustom: true, selectedDate: null }` (field on, no date picked; form default `app/reducers/FormReducer.jsx:18-22`).
- `{ useCustom: true, selectedDate: <old value> }`, from `app/helpers/pouchDB.js:79-89` migration 3.
- The `dueDate` key can be absent when the field is off (`app/helpers/form.js:61`).

How status is stored and defaulted:
- `app/helpers/form.js:82`: `status: editMode.active ? editMode.data.status : 'pending',`
- `app/helpers/pouchDB.js:47-53`: migration 1 sets `status: 'pending'` on docs without status.
- `app/middlewares/InvoicesMW.jsx:206-213`: `INVOICE_SET_STATUS` gets the doc and dispatches `INVOICE_UPDATE` with `Object.assign({}, doc, { status })`. It does not validate the status.
- `InvoicesMW.jsx:148-157`: `INVOICE_DUPLICATE` copies everything, `status` included. A duplicate of a paid invoice is saved as paid.

Delete today, `InvoicesMW.jsx:114-135`:

```js
114	      case ACTION_TYPES.INVOICE_DELETE: {
115	        return deleteDoc('invoices', action.payload)
116	          .then(remainingDocs => {
117	            next({ type: ACTION_TYPES.INVOICE_DELETE, payload: remainingDocs });
...	            // success notification, then:
130	            const { editMode } = getState().form.settings;
131	            if (editMode.active) {
132	              if (editMode.data._id === action.payload) {
133	                dispatch({ type: ACTION_TYPES.FORM_CLEAR });
```

`InvoicesMW.jsx:12` imports `getInvoiceValue` but never uses it. `app/middlewares/__tests__/InvoicesMW.spec.js:9,18` mocks `../../helpers/invoice` and also never uses it. Remove both (Step 6), so the middleware can use the real status helpers.

`app/reducers/InvoicesReducer.jsx:4-21`: one `combineActions(...)` → `action.payload` (the full list). Selector `getInvoices = state => state.invoices`. It does not sort.

`app/helpers/pouchDB.js:173-177`: `deleteDoc` = `db.get(id)` → `db.remove(record)` → `getAllDocs`. `getAllDocs` uses `allDocs({ include_docs: true, attachments: true })`. No code writes `_attachments` (`grep -rn _attachments app` → none).

Preview IPC: `main/preview-window.js:9-15`. `ipcMain.on('preview-invoice', (event, invoiceData) => { previewWindow.show(); previewWindow.focus(); previewWindow.webContents.send('update-preview', invoiceData); })`. The preview window has the PDF export. The channel is already in the `preload/index.js:26` allow-list.

Quit path: `app.js:445-449` `before-quit` calls `mainWindow.destroy()`. `app.js:105-112` hides the main window on macOS close (renderer keeps running).

Tests at HEAD:
- `app/containers/__tests__/Invoices.spec.jsx`: markup and filter-button tests for the old container. **Delete.**
- `app/components/invoices/__tests__/Invoice.spec.jsx`: Ionicons markup and click tests for the old card. **Delete.**
- `app/components/shared/_tests_/SplitButton.spec.jsx`: **Delete** with the component.
- `app/middlewares/__tests__/InvoicesMW.spec.js`: 583 lines. These are behavior tests. **Keep and update** them. Note: many tests call `middleware(...).then(...)` without `return`/`await`, so failures inside do not fail the test. New and updated tests must `await`.
- `app/reducers/__tests__/InvoicesReducer.spec.js`: keep; extend.
- `vitest.config.mjs` sets `env: { TZ: 'UTC' }`. `vitest.setup.js:1` sets `process.env.TZ = 'UTC'` and `vitest.setup.js:39` mocks `crypto.randomUUID` → `'id-string'`.

i18n: `i18n/en/invoices.json` has `header.name`, `fields.*`, `status.{pending,paid,refunded,cancelled}`, `btns.*`. Keys use `ns:a:b` (i18next joins the parts after the namespace with `.`).

## Reference facts (recheck versions and APIs at execution)

- `@tanstack/react-table` latest = **9.3.1** (`npm view @tanstack/react-table version`; confirm at execution time). The shadcn Base UI data-table guide uses v9: https://ui.shadcn.com/docs/components/base/data-table
- TanStack Table v9 API (https://tanstack.com/table/latest/docs/framework/react/guide/migrating):
  - The hook is `useTable` (not `useReactTable`). The `features` option is required, built with `tableFeatures({...})`.
  - Row models are `create*RowModel()` entries inside the features object. The `get*RowModel` options are gone.
  - Feature names: `rowSortingFeature`, `rowSelectionFeature`, `globalFilteringFeature`, `columnFilteringFeature`. Sort functions are registered under `sortFns` (for example `sortFn_alphanumeric`, `sortFn_text`).
  - Columns use `createColumnHelper()`, then `columnHelper.accessor` / `.display`.
  - Render cells with `<table.FlexRender header={header} />` / `<table.FlexRender cell={cell} />`.
  - `getRowId` still exists. V8-style controlled `state` + `on*Change` still works. Read state with `table.state`.
  - Selection: `row.toggleSelected(v)`, `table.toggleAllRowsSelected(v)`. Sorting: `column.toggleSorting(...)`, `column.getIsSorted()`.
- Base UI Toast (https://base-ui.com/react/components/toast, https://ui.shadcn.com/docs/components/base/toast):
  - `toast.add({ title, description, type, timeout, actionProps, onClose })` returns an id. `timeout` default is 5000; `0` means it never closes by itself. `actionProps` renders an action button.
  - `Toast.createToastManager()` lets non-React code queue toasts.
- PouchDB 9 (`pouchdb-browser`, `idb` adapter, verified locally with fake-indexeddb): after `db.remove(doc)`, `db.put(doc)` with the old `_rev` fails with **409 conflict**. `db.put(doc)` **without** `_rev` succeeds (new rev `3-…`), and `allDocs` lists the doc again.
- Electron `win.destroy()`: "Force closing the window, the unload and beforeunload event won't be emitted for the web page" (https://www.electronjs.org/docs/latest/api/browser-window#windestroy). Manta's `before-quit` calls `destroy()`.
- Node 24 honours `process.env.TZ = '...'` set at runtime (verified). In `America/New_York`, US DST ends 2026-11-01. Across that change, `(startOfDay(b) - startOfDay(a)) / 864e5` gives `3.0417`. `moment(b).startOf('day').diff(moment(a).startOf('day'), 'days')` gives exactly `3`. Always count calendar days with moment.
- `calTermDate(Date.parse('2025-01-15T10:00:00Z'), 'net30')` at HEAD, run on 2026-11-01 → `2026-12-15T…` (wrong; must be 2025-02-14).
- lucide-react 1.x icon names used here: `PencilLine`, `Clock`, `CircleAlert`, `CircleCheck`, `Undo2`, `Ban`, `MoreHorizontal`, `ArrowUpDown`, `Search`, `Plus`, `FileText`. Check: `node -e "const l=require('lucide-react');console.log(['PencilLine','Clock','CircleAlert','CircleCheck','Undo2','Ban','MoreHorizontal','ArrowUpDown','Search','Plus','FileText'].filter(n=>!l[n]))"` → `[]`. If a name is missing, pick the nearest v1 name from https://lucide.dev/icons.
- UX sources: data tables https://www.nngroup.com/articles/data-tables/ ; empty states https://www.nngroup.com/articles/empty-state-interface-design/ ; undo over confirmation https://www.nngroup.com/articles/confirmation-dialog/

### Decision: delete at once, re-save on Undo (not deferred commit)

There were two options:
- (A) Hide the ids, then commit the delete after 6 s or on `beforeunload`.
- (B) Delete at once, keep the removed docs in memory, and on Undo `put` them again without `_rev`.

**Use (B).** Reasons:
1. `before-quit` calls `mainWindow.destroy()`, which skips `beforeunload`/`unload`. So (A) cannot guarantee the commit, and a "deleted" invoice comes back after a restart.
2. With (A), every view must filter the hidden ids: the list, the sidebar badge, 016 client history, 017 dashboard and the open preview. With (B), the database is the single truth.
3. (B) never loses data the user wants to keep. If the app quits during the 6 s, the delete simply stays done, which is what the user asked for.

What you lose: the doc gets a new `_rev`. No code depends on `_rev` history (there is no sync).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| One spec | `npx vitest run <path>` | all pass |
| All unit tests | `npm test` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |
| e2e | `npm run test:e2e` | all pass |
| Dev on a copy | `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev` | app opens |
| Add shadcn parts | `npx shadcn@latest add <names>` | files in `ui/components/ui/` |

## Scope

**Create**
- `app/constants/invoices.js`: status constants and the undo timeout.
- `app/helpers/invoiceList.js` + `app/helpers/__tests__/invoiceList.spec.js`: rows, tabs, search, counts.
- `helpers/__tests__/date.spec.js`
- `app/components/invoices/`: `invoiceTableFeatures.js`, `columns.jsx`, `InvoicesTable.jsx`, `StatusBadge.jsx`, `DueCell.jsx`, `InvoiceRowActions.jsx`, `InvoiceDetailSheet.jsx`, `BulkActionsBar.jsx`, `InvoicesEmpty.jsx`, `useNow.js`
- shadcn files in `ui/components/ui/` (only the missing ones): `table`, `tabs`, `input`, `checkbox`, `dropdown-menu`, `badge`, `sheet`, `empty`, `separator`

**Change**
- `helpers/date.js` (bug fix)
- `app/helpers/invoice.js`, `app/helpers/__tests__/invoice.spec.js`
- `app/helpers/pouchDB.js`, `app/helpers/__tests__/pouchDB.spec.js`, `app/helpers/__mocks__/pouchDB.js`
- `app/constants/actions.jsx` (add `INVOICE_RESTORE` only), `app/actions/invoices.jsx`
- `app/reducers/InvoicesReducer.jsx`, `app/reducers/__tests__/InvoicesReducer.spec.js`
- `app/middlewares/InvoicesMW.jsx`, `app/middlewares/__tests__/InvoicesMW.spec.js`
- `app/containers/Invoices.jsx` (rewrite as a function component)
- the 013 sidebar file found in Preconditions (badge only)
- `i18n/en/invoices.json`, `README.md` (line 59 only)
- `package.json`, `package-lock.json` (`@tanstack/react-table`)

**Delete**
- `app/components/invoices/Invoice.jsx`
- `app/components/invoices/__tests__/Invoice.spec.jsx`
- `app/containers/__tests__/Invoices.spec.jsx`
- `app/components/shared/SplitButton.jsx`
- `app/components/shared/_tests_/SplitButton.spec.jsx`

**Out of scope**
- Editor, `app/helpers/form.js`, numbering, `issuedAt` input, "Save draft" (all in 015).
- Dashboard (017).
- Preview window UI (018).
- Other locales (they fall back to English).
- Existing action type names. Keep them all.
- `dialog:deleteInvoice` i18n keys (018 removes unused keys).

## Git workflow

- Work on the current branch. Do not switch branches or create a worktree. Do not create another branch. Do not push.
- Short imperative subjects, no prefix, no AI attribution, no `Co-authored-by`.
- Suggested commits:
  1. `Use the invoice date for payment terms`
  2. `Add draft status and derived overdue status helpers`
  3. `Add bulk delete, restore and status helpers for invoices`
  4. `Show invoices in a sortable data table with status tabs`
  5. `Add invoice detail sheet and bulk actions`
  6. `Show overdue count in the sidebar`

## Steps

### Step 1: Fix `calTermDate`

1. In `helpers/date.js`, replace lines 26-27 with:
   ```js
   const termDate = new Date(createdAt);
   termDate.setDate(termDate.getDate() + numberOfDaysToAdd);
   return termDate.getTime();
   ```
   Remove the now unused `createdDate` line. Keep the switch and the export.
2. Create `helpers/__tests__/date.spec.js` with these regression tests:
   - `net30` from `Date.UTC(2025,0,15,10)` → `Date.UTC(2025,1,14,10)`.
   - Month/year rollover: `net7` from `Date.UTC(2025,11,28)` → `Date.UTC(2026,0,4)`.
   - Unknown or `null` term → 7 days.
   - Use `vi.setSystemTime(new Date('2026-11-01'))` so the old bug would fail the test.

**Verify**: `npx vitest run helpers/__tests__/date.spec.js` → all pass. Prove the regression without stashing: copy the old calculation from `git show <execution-start-SHA>:helpers/date.js` into an isolated scratch test with the same fixed date. It must give the wrong month/year; the new helper must give 2025-02-14.

### Step 2: Status constants and helpers

1. Create `app/constants/invoices.js`:
   ```js
   export const INVOICE_STATUSES = ['draft', 'pending', 'paid', 'refunded', 'cancelled'];
   export const DISPLAY_STATUSES = ['draft', 'pending', 'overdue', 'paid', 'refunded', 'cancelled'];
   export const UNDO_TIMEOUT_MS = 6000;
   ```
2. Add to `app/helpers/invoice.js` (keep `getInvoiceValue`; import `moment`, `calTermDate` from `../../helpers/date`, constants). Export all:
   - `getIssuedAt(invoice)` → `invoice.issuedAt ?? invoice.created_at ?? null`. 015 adds `issuedAt`. Old docs fall back to `created_at`.
   - `getStoredStatus(invoice)` → `invoice.status` if it is in `INVOICE_STATUSES`, else `'pending'`. Missing and unknown values count as pending.
   - `getDueDate(invoice)` → ms timestamp or `null`:
     - no `dueDate` → `null`.
     - `useCustom === true`: `selectedDate == null` → `null`; else `moment(selectedDate)`; `null` if `!isValid()`, else `.valueOf()`.
     - otherwise: `base = getIssuedAt(invoice)`; `null` if `base == null`; else `calTermDate(base, dueDate.paymentTerm)`.
   - `getDisplayStatus(invoice, now = Date.now())`: `s = getStoredStatus(invoice)`. If `s !== 'pending'`, return `s`. `due = getDueDate(invoice)`. Return `'overdue'` if `due !== null && due < moment(now).startOf('day').valueOf()`, else `'pending'`.
   - `getDueInDays(invoice, now = Date.now())` → `null` when there is no due date, else `moment(due).startOf('day').diff(moment(now).startOf('day'), 'days')` (negative = late).
   - `withStatus(doc, status, now = Date.now())` → new object `{ ...doc, status }`. If `status === 'paid'` and `doc.status !== 'paid'`, set `paidAt: now`. If `status === 'paid'` and the doc is already paid, keep the existing `paidAt`. If `status !== 'paid'`, remove `paidAt`.
   - `getInvoiceNumber(invoice)` → `invoice.invoiceID || invoice._id.slice(0, 8)` (same as `Invoice.jsx:301-303`).
   - `formatInvoiceAmount(invoice)` → returns the same string as `Invoice.jsx:312-318`: `"USD 1,234.00"` when placement is `before`, `"1,234.00 USD"` otherwise. Use `formatNumber(grandTotal, currency.fraction, currency.separator)`. If `currency` is missing, return only the number with 2 digits.
3. Extend `app/helpers/__tests__/invoice.spec.js` (see Test plan, group A).

**Verify**: `npx vitest run app/helpers/__tests__/invoice.spec.js` → all pass.

### Step 3: List helpers (tabs, search, rows)

Create `app/helpers/invoiceList.js`:
- `INVOICE_TABS = ['all', 'draft', 'outstanding', 'overdue', 'paid', 'closed']`
- `matchesTab(displayStatus, tab)`. Rules:
  - `all` → true.
  - `draft` → `draft`.
  - `outstanding` → `pending` only (not overdue).
  - `overdue` → `overdue`.
  - `paid` → `paid`.
  - `closed` → `refunded` or `cancelled`.
- `STATUS_SORT_RANK = { overdue: 0, pending: 1, draft: 2, paid: 3, refunded: 4, cancelled: 5 }`
- `toInvoiceRow(invoice, now)` → `{ id: invoice._id, invoice, number, client, issuedAt, dueAt, dueInDays, displayStatus, amount: invoice.grandTotal ?? 0, amountText }`. `client` = `recipient.fullname || recipient.company || ''`. `dueAt` is `null` when there is no due date.
- `countByTab(rows)` → `{ all, draft, outstanding, overdue, paid, closed }`.
- `matchesSearch(row, query)`: trim and lower-case the query. An empty query matches everything. Else match a substring of: `number`, `recipient.fullname`, `recipient.company`, `recipient.email`, `amountText`, and `amountText` with all non-digits removed (so `1234` finds `1,234.00`).

Tests in `app/helpers/__tests__/invoiceList.spec.js` (group B).

**Verify**: `npx vitest run app/helpers/__tests__/invoiceList.spec.js` → all pass.

### Step 4: PouchDB helpers for bulk delete, restore and update

Add to `app/helpers/pouchDB.js` and export them:

```js
// Removes each doc. Returns snapshots (without _rev) so Undo can re-create them.
const removeDocs = (dbName, ids) =>
  setDB(dbName).then(async db => {
    const removed = [];
    const failed = [];
    for (const id of ids) {
      try {
        const doc = await db.get(id, { attachments: true });
        await db.remove(doc);
        const { _rev, ...snapshot } = doc;
        removed.push(snapshot);
      } catch (err) {
        failed.push(id);
      }
    }
    return { removed, failed, docs: await getAllDocs(dbName) };
  });

// Re-creates deleted docs. A live doc with the same _id is never overwritten (409 → skip).
const restoreDocs = (dbName, docs) =>
  setDB(dbName).then(async db => {
    for (const doc of docs) {
      const { _rev, ...clean } = doc;
      try {
        await db.put(clean);
      } catch (err) {
        if (err.status !== 409) throw err;
      }
    }
    return getAllDocs(dbName);
  });

// Keep the existing success contract (full doc list). On partial failure,
// the caller must refresh Redux from error.docs before reporting failures.
const updateDocs = (dbName, docs) =>
  setDB(dbName).then(async db => {
    const succeeded = [];
    const failed = [];
    for (const doc of docs) {
      try {
        await db.put(doc);
        succeeded.push(doc._id);
      } catch (error) {
        failed.push({ id: doc._id, status: error.status, message: error.message });
      }
    }
    const allDocs = await getAllDocs(dbName);
    if (failed.length) {
      throw Object.assign(new Error('partial-update'), { succeeded, failed, docs: allDocs });
    }
    return allDocs;
  });
```

Do not change `deleteDoc` (contacts use it). Add `removeDocs`, `restoreDocs` and `updateDocs` to `app/helpers/__mocks__/pouchDB.js` as `vi.fn` that:
- resolve `{ removed: ids.map(id => ({ _id: id })), failed: [], docs: [] }`;
- resolve `mockData.invoicesRecords`;
- resolve `mockData.invoicesRecords`.

Tests in `app/helpers/__tests__/pouchDB.spec.js` (group C, real PouchDB on fake-indexeddb).

**Verify**: `npx vitest run app/helpers/__tests__/pouchDB.spec.js` → all pass.

### Step 5: Actions, constants, reducer, selector

1. `app/constants/actions.jsx`: add `export const INVOICE_RESTORE = 'INVOICE_RESTORE';`. Do not rename anything.
2. `app/actions/invoices.jsx`:
   - `deleteInvoice` payload: an id **or** an array of ids. Same creator; update the comment.
   - `setInvoiceStatus(invoiceIDOrIDs, status)`: same payload shape `{ invoiceID, status }`; `invoiceID` may be an array.
   - Add `export const restoreInvoices = createAction(ACTION_TYPES.INVOICE_RESTORE, docs => docs);`.
3. `app/reducers/InvoicesReducer.jsx`:
   - Add `Actions.restoreInvoices` to `combineActions`.
   - Add a selector:
     ```js
     export const getOverdueCount = (state, now = Date.now()) =>
       state.invoices.filter(inv => getDisplayStatus(inv, now) === 'overdue').length;
     ```
4. Reducer spec:
   - `INVOICE_RESTORE` replaces state with the payload.
   - `getOverdueCount` with a fixed `now` counts only pending + past-due docs (one each of draft/paid/pending-future/pending-past → `1`).

**Verify**: `npx vitest run app/reducers/__tests__/InvoicesReducer.spec.js` → all pass.

### Step 6: Middleware

In `app/middlewares/InvoicesMW.jsx`:
1. Remove the unused `getInvoiceValue` import (line 12).
2. Import `removeDocs`, `restoreDocs`, `updateDocs`, `withStatus`, `INVOICE_STATUSES`, `UNDO_TIMEOUT_MS`, `* as Actions from '../actions/invoices'`, and the 013 `toast` (path from Preconditions).
3. `INVOICE_DELETE`:
   - `const ids = [].concat(action.payload)`.
   - Call `removeDocs('invoices', ids)`, then:
     - Call `next({ type: INVOICE_DELETE, payload: docs })`.
     - If `editMode.active && removed.some(doc => doc._id === editMode.data._id)`, dispatch `FORM_CLEAR`.
     - If `failed.length`, dispatch the existing warning notification shape with `i18n.t('invoices:toast:deleteFailed', { count: failed.length })`.
     - If `removed.length`, show the undo toast:
       ```js
       const toastId = toast.add({
         title: i18n.t('invoices:toast:deleted', { count: removed.length }),
         timeout: UNDO_TIMEOUT_MS,
         actionProps: {
           children: i18n.t('invoices:toast:undo'),
           onClick: () => {
             toast.close(toastId);
             dispatch(Actions.restoreInvoices(removed));
           },
         },
       });
       ```
   - Remove the old "deleted successfully" notification (the toast replaces it). Keep the `.catch` warning.
4. `INVOICE_RESTORE`: `restoreDocs('invoices', action.payload)`, then `next({ type: INVOICE_RESTORE, payload: docs })` and `toast.add({ title: i18n.t('invoices:toast:restored', { count: action.payload.length }) })`. On error: the existing warning shape.
5. `INVOICE_SET_STATUS`:
   - If `!INVOICE_STATUSES.includes(status)`, call `next(warning 'Unknown invoice status: <status>')` and `return Promise.resolve()`. This stops `'overdue'` from ever being stored.
   - Single string id: keep today's flow, but use `payload: withStatus(doc, status, Date.now())`.
   - Array: `Promise.all(ids.map(id => getSingleDoc('invoices', id)))`, map with `withStatus`, call `updateDocs('invoices', docs)`, then `next({ type: INVOICE_UPDATE, payload: allDocs })` and one success toast `i18n.t('invoices:toast:updated', { count })`. On a partial-update error, first call `next({ type: INVOICE_UPDATE, payload: err.docs })`, report successful/failed counts, and keep failed ids available for retry. On other errors, reload the persisted list before reporting. Never leave Redux showing pre-write state after a partial success.
6. `INVOICE_DUPLICATE`: start from `omit(action.payload, ['paidAt', 'issuedAt'])` (lodash) and set `created_at: Date.now()`, `_id: crypto.randomUUID()`, `_rev: null`, `status: 'draft'`. A copy starts as a draft and is never overdue. Without `issuedAt`, its issue date falls back to its new `created_at`.
7. Update `app/middlewares/__tests__/InvoicesMW.spec.js`:
   - Remove `vi.mock('../../helpers/invoice')` and the `getInvoiceValue` import.
   - Mock the toast module: `vi.mock('<toast path>', () => ({ toast: { add: vi.fn(() => 't1'), close: vi.fn() } }))`.
   - Rewrite the `INVOICE_DELETE` block and update the `INVOICE_SET_STATUS` and `INVOICE_DUPLICATE` expectations (group D). Every new or changed test must `await middleware(action)`.

**Verify**: `npx vitest run app/middlewares/__tests__/InvoicesMW.spec.js` → all pass.

### Step 7: Install the table library and the shadcn parts

1. `npm view @tanstack/react-table version` → `9.x`. If the major is not 9, STOP.
2. `npm install @tanstack/react-table@^9.3.1`
3. `ls ui/components/ui/`. Then run `npx shadcn@latest add <missing>` with only the missing names from: `table tabs input checkbox dropdown-menu badge sheet empty separator`. If the CLI asks to overwrite a file, answer **No** (013 may have customised it).
4. Find the exact sort function names: `grep -o "sortFn_[A-Za-z]*" -r node_modules/@tanstack/table-core/dist | sort -u | head`. Note them for Step 8.

**Verify**: `npm ls @tanstack/react-table` → `9.x`; `npm run build` → exit 0; `git status ui/components/ui` → only new files.

### Step 8: Build the invoices page

Rules for all new components:
- Function components. Tailwind classes only (no styled-components, no Bootstrap classes, no `ion-*`).
- Logical properties (`ms-`, `pe-`, `text-end`) for RTL.
- Real `<button>`s with targets ≥ 24 px.
- Every string through `t('invoices:…')`.

1. `invoiceTableFeatures.js`:
   ```js
   export const features = tableFeatures({
     rowSortingFeature,
     rowSelectionFeature,
     sortedRowModel: createSortedRowModel(),
     sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text /* + basic/number fn from Step 7.4 */ },
   });
   ```
   Do the tab and search filtering in plain JS before the table (with `matchesTab` / `matchesSearch`). The table only sorts and selects. Do not add pagination (see Maintenance notes).
2. `columns.jsx` (factory `getColumns({ t, dateFormat, onOpen, actions })`, uses `createColumnHelper()`):
   - `select` (display): header checkbox (`table.getIsAllRowsSelected()`, indeterminate when `table.getIsSomeRowsSelected()`, `table.toggleAllRowsSelected(!!v)`, `aria-label` `columns:selectAll`). Row checkbox (`row.toggleSelected(!!v)`, `aria-label` `columns:select` with the number). Wrap it in an element that calls `event.stopPropagation()` on click.
   - `number`: a `<button>` that calls `onOpen(row.id)`, so keyboard users can open the sheet. Sort with `alphanumeric`.
   - `client` (text).
   - `issuedAt`: `moment(v).format(dateFormat)`. Use `invoice.configs?.dateFormat ?? dateFormat`, as `Invoice.jsx:239` does.
   - `dueAt`: accessor returns `dueAt ?? Number.POSITIVE_INFINITY`. The cell is `DueCell`.
   - `amount`: header and cell `text-end tabular-nums`. The cell shows `amountText`.
   - `status`: accessor returns `STATUS_SORT_RANK[displayStatus]`. The cell is `StatusBadge`.
   - `actions` (display): `InvoiceRowActions` (stop click propagation).
   - Sortable headers are `<button>`s with an `ArrowUpDown` icon. They call `column.toggleSorting(column.getIsSorted() === 'asc')` and set `aria-sort` on the `<th>`.
3. `DueCell.jsx`: line 1 = formatted date, or `t('invoices:due:none')` (shown as `—`). Line 2 (muted, small) only for `pending`/`overdue`:
   - `dueInDays === 0` → `due:today`
   - `> 0` → `due:inDays` (`count`)
   - `< 0` → `due:overdueDays` (`count: -dueInDays`), in `text-status-overdue`
4. `StatusBadge.jsx`: shadcn `Badge`. It shows an icon + text, and the icon is `aria-hidden`. Icons:
   - draft = `PencilLine`
   - pending = `Clock`
   - overdue = `CircleAlert`
   - paid = `CircleCheck`
   - refunded = `Undo2`
   - cancelled = `Ban`

   Colors come from the 012 `--status-*` tokens. Read `grep -n "status-" ui/styles/globals.css` and use the utilities 012 exposes (for example `bg-status-paid/15 text-status-paid`). Text is `t('invoices:status:<s>')`.
5. `InvoiceRowActions.jsx`: shadcn `DropdownMenu`. The trigger is an icon button `MoreHorizontal` with `aria-label` `actions:open`. Items:
   - Preview / Export PDF → `window.manta.ipc.send('preview-invoice', invoice)`
   - Edit → `dispatch(editInvoice(invoice))`
   - Duplicate → `dispatch(duplicateInvoice(invoice))`
   - Mark as paid (hidden when already paid) → `dispatch(setInvoiceStatus(id, 'paid'))`
   - Set status ▸ submenu: radio items for `draft`, `pending`, `refunded`, `cancelled`; the current stored status is checked.
   - separator, then Delete (destructive variant) → `dispatch(deleteInvoice(id))`
6. `InvoiceDetailSheet.jsx`: shadcn `Sheet` (side `right`; it flips in RTL). Props: `invoice | null`, `open`, `onOpenChange`, `dateFormat`.
   - Title: `sheet:title` with the number. Next to it: `StatusBadge`.
   - Summary `<dl>`: client (name, company, email), issued, due (+ `DueCell` text), currency code.
   - Items table: `invoice.rows`, with description, quantity, price and subtotal (formatted with `formatNumber` and the invoice currency).
   - Totals: subtotal, discount and tax from `getInvoiceValue(invoice)` (only when present), and total = `formatInvoiceAmount`.
   - The note, if present.
   - Footer buttons: Preview / Export PDF (primary), Edit, Duplicate, Mark as paid (if not paid), Delete. Delete closes the sheet first.
7. `BulkActionsBar.jsx`: shown when `selectedIds.length > 0`. It is a bar above the table (not a floating overlay) with `role="region"` and `aria-label` `bulk:label`. Contents: text `bulk:selected` (count), buttons Mark as paid → `setInvoiceStatus(selectedIds, 'paid')`, Delete → `deleteInvoice(selectedIds)`, Clear selection. After an action, clear the selection.
8. `InvoicesEmpty.jsx`: shadcn `Empty`.
   - Variant `none`: icon `FileText`, `empty:title`, `empty:description`, primary button "New invoice" (013 handler).
   - Variant `noResults`: `empty:noResults`, `empty:noResultsDescription`, button `empty:clearFilters`.
9. `useNow.js`: `useState(Date.now())`. Update it on the window `focus` event and every 60 s, and clean up on unmount. Overdue then flips after midnight without a reload.
10. Rewrite `app/containers/Invoices.jsx` as a function component (drop `_withFadeInAnimation`, PropTypes, IPC listeners and `openDialog`):
    - `useSelector(getInvoices)`, `useSelector(getDateFormat)`, `useDispatch()`, `useTranslation()`, `useNow()`.
    - State: `tab` (`'all'`), `query` (`''`), `sorting` (`[{ id: 'issuedAt', desc: true }]`), `rowSelection` (`{}`), `openId` (`null`). It is component state only; do not persist it.
    - `rows = useMemo(() => invoices.map(i => toInvoiceRow(i, now)), [invoices, now])`, `counts = countByTab(rows)` (counts ignore the search), `visible = rows.filter(tab && search)`.
    - Clear `rowSelection` when `tab` or `query` changes. Drop selected ids that no longer exist in `rows`. Close the sheet when `openId` is no longer in `rows`.
    - `useTable({ features, data: visible, columns, getRowId: r => r.id, state: { sorting, rowSelection }, onSortingChange: setSorting, onRowSelectionChange: setRowSelection })`.
    - Layout:
      - Header row: `<h1>` `header:name` + muted `header:count`, search `Input` (`type="search"`, `Search` icon, `aria-label` `search:label`, placeholder `search:placeholder`) and the "New invoice" button.
      - `Tabs` with a trigger per `INVOICE_TABS`, each with its count.
      - `BulkActionsBar`, the table (`InvoicesTable.jsx`: shadcn `Table` with `<table.FlexRender …/>`; rows are `cursor-pointer` and call `onOpen(row.id)` on click), or `InvoicesEmpty`.
      - `InvoiceDetailSheet`.
    - Press Escape in the search input to clear it.

**Verify**:
- `npm run build` → exit 0.
- `npm run lint` → exit 0.
- `grep -rn "styled-components\|ion-\|className=\"row\|col-lg" app/containers/Invoices.jsx app/components/invoices` → no output.

### Step 9: Remove the old card UI and its markup-only tests

`git rm app/components/invoices/Invoice.jsx app/components/invoices/__tests__/Invoice.spec.jsx app/containers/__tests__/Invoices.spec.jsx app/components/shared/SplitButton.jsx app/components/shared/_tests_/SplitButton.spec.jsx`

**Verify**: `grep -rn "invoices/Invoice'\|SplitButton" app` → no output; `npm test` → exit 0.

### Step 10: Overdue badge in the sidebar

In the 013 sidebar file, for the Invoices `SidebarMenuItem`:
- Add `const overdue = useSelector(state => getOverdueCount(state));`.
- Render `<SidebarMenuBadge aria-label={t('invoices:nav:overdueBadge', { count: overdue })}>{overdue}</SidebarMenuBadge>` only when `overdue > 0`.
- Use the `--status-overdue` color.
- Add the count to the collapsed-state tooltip text.

The sidebar is a function component from 013. If it is a class, use `connect` instead.

**Verify**: `npm run build` → exit 0. Manual check in Step 12.

### Step 11: Strings and README

1. Edit `i18n/en/invoices.json`:
   - Change `header.name` to `"Invoices"`.
   - Add `status.draft` (`"Draft"`) and `status.overdue` (`"Overdue"`).
   - Add the new groups below. Keep `fields` and `btns` only if `grep -rn "invoices:fields\|invoices:btns" app preview` still has hits; else remove them.
   ```json
   "header": { "name": "Invoices", "count_one": "{{count}} invoice", "count_other": "{{count}} invoices" },
   "newInvoice": "New invoice",
   "search": { "label": "Search invoices", "placeholder": "Search number, client or amount" },
   "tabs": { "all": "All", "draft": "Draft", "outstanding": "Outstanding", "overdue": "Overdue", "paid": "Paid", "closed": "Closed" },
   "columns": { "select": "Select invoice {{number}}", "selectAll": "Select all invoices", "number": "Number", "client": "Client", "issued": "Issued", "due": "Due", "amount": "Amount", "status": "Status", "actions": "Actions" },
   "due": { "none": "No due date", "today": "Due today", "inDays_one": "Due in {{count}} day", "inDays_other": "Due in {{count}} days", "overdueDays_one": "{{count}} day overdue", "overdueDays_other": "{{count}} days overdue" },
   "actions": { "open": "Invoice actions", "preview": "Preview / Export PDF", "edit": "Edit", "duplicate": "Duplicate", "markAsPaid": "Mark as paid", "setStatus": "Set status", "delete": "Delete" },
   "bulk": { "label": "Selected invoices", "selected_one": "{{count}} selected", "selected_other": "{{count}} selected", "markAsPaid": "Mark as paid", "delete": "Delete", "clear": "Clear selection" },
   "empty": { "title": "No invoices yet", "description": "Create your first invoice. It will show here.", "noResults": "No matching invoices", "noResultsDescription": "Try another search or tab.", "clearFilters": "Clear filters" },
   "sheet": { "title": "Invoice {{number}}", "client": "Client", "issued": "Issued", "due": "Due", "currency": "Currency", "items": "Items", "description": "Description", "quantity": "Qty", "price": "Price", "subtotal": "Subtotal", "discount": "Discount", "tax": "Tax", "total": "Total", "note": "Note" },
   "toast": { "deleted_one": "Invoice deleted", "deleted_other": "{{count}} invoices deleted", "deleteFailed_one": "{{count}} invoice could not be deleted", "deleteFailed_other": "{{count}} invoices could not be deleted", "undo": "Undo", "restored_one": "Invoice restored", "restored_other": "{{count}} invoices restored", "updated_one": "Invoice updated", "updated_other": "{{count}} invoices updated" },
   "nav": { "overdueBadge_one": "{{count}} overdue invoice", "overdueBadge_other": "{{count}} overdue invoices" }
   ```
2. `README.md:59`: replace the line with `- 🏷 Invoice statuses: Draft, Pending, Overdue (automatic), Paid, Refunded and Cancelled.`

**Verify**:
- `node -e "JSON.parse(require('fs').readFileSync('i18n/en/invoices.json','utf8'));console.log('ok')"` → `ok`.
- `grep -rhoE "invoices:[a-zA-Z:]+" app | sort -u` → each key exists in the JSON. Check by eye; plural keys are used without the `_one`/`_other` suffix.

### Step 12: Full checks and manual smoke test

1. `npm test` → exit 0. `npm run lint` → exit 0. `npm run test:e2e` → all pass.
2. Make the copy profile (see Preconditions), then run `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev`. If you have no real data, use an empty temp folder and create 4 invoices: a custom due date 10 days ago, a custom due date in 5 days, `net30`, and a duplicate (it becomes Draft).
3. Check each item in **light and dark** mode (Settings theme select):
   - Old invoices appear and keep their status.
   - The default order is newest issued first.
   - The past-due pending invoice shows Overdue + "N days overdue" and appears in the Overdue tab.
   - All tab counts add up.
   - Search by client name and by amount digits.
   - Each header sorts.
   - A row click opens the sheet. Tab to the Number button and press Enter: it opens too.
   - Row menu → Mark as paid: the badge becomes Paid and the invoice moves to the Paid tab.
   - Set status ▸ Draft works.
   - Select 2 rows → bulk Mark as paid.
   - Delete one invoice → the toast shows Undo → click Undo → the invoice returns with the same number, client and amount.
   - Delete again, wait 7 s → it stays deleted after a reload (View › Reload).
   - Delete, then quit at once (⌘Q) → after restart the invoice is gone, and no other invoice changed.
   - The sidebar badge shows the overdue count.
   - The empty states work (search `zzzz`, then Clear filters).
   - Preview / Export opens the preview window. A `net30` invoice shows its correct due date there.
   - Keyboard focus rings are visible.
4. Take screenshots of the table (light + dark) and the sheet if possible, and attach them to your report.

**Verify**: every item above behaves as written. Record any failure in the report.

## Test plan

Write tests only for logic. Do not write markup, snapshot or class-name tests.

- **A. `app/helpers/__tests__/invoice.spec.js`** (TZ=UTC unless stated):
  - `getDueDate`:
    - custom moment object `{years:2026, months:9, date:31}` → `Date.UTC(2026,9,31)`
    - `selectedDate: null` → `null`
    - no `dueDate` key → `null`
    - invalid `selectedDate` (`'garbage'`) → `null`
    - `net30` from `created_at` → +30 days
    - `issuedAt` wins over `created_at`
    - term with neither date → `null`
  - `getDisplayStatus`:
    - old doc without `status` and past due → `overdue`
    - doc without `status` and no due date → `pending`
    - unknown status `'void'` → `pending` rules
    - `draft`, `paid`, `refunded`, `cancelled` with a past due date → unchanged
    - due today at 00:00 with `now` = today 23:59 → `pending`
    - due yesterday 23:59 with `now` = today 00:00 → `overdue`
  - Timezone edge: set `process.env.TZ = 'America/New_York'` in the test and restore `'UTC'` in `afterEach`.
    - Due `{years:2026, months:9, date:31}`, `now = new Date(2026,10,1,0,30)` → `overdue`, and `getDueInDays` → `-1`.
    - `now = new Date(2026,10,3,0,30)` → `getDueInDays` → `-3`. This is across the DST change; a ms-division version gives a fraction.
    - Spring case: due `new Date(2027,2,13)`, now `new Date(2027,2,15,0,30)` → `-2`.
  - `withStatus`:
    - pending → paid sets `paidAt = now`
    - paid → paid keeps the old `paidAt`
    - paid → refunded removes `paidAt`
    - the input object is not mutated
  - `formatInvoiceAmount`: before/after placement with `dotComma`; missing `currency` → number only.
- **B. `app/helpers/__tests__/invoiceList.spec.js`**:
  - `matchesTab` for every tab × display status. Outstanding excludes overdue; closed = refunded + cancelled.
  - `countByTab` on a mixed list → exact numbers, with `all` = total.
  - `matchesSearch`: case-insensitive on name, company, email and number. `'1234'` matches amount `1,234.00`. Empty query matches.
  - `toInvoiceRow` number fallback to the first 8 chars of `_id`.
- **C. `app/helpers/__tests__/pouchDB.spec.js`** (real PouchDB, fake-indexeddb):
  - Save 2 invoices, then `removeDocs(['a','missing'])` → `removed` has `a` without `_rev`, `failed` = `['missing']`, `docs` lacks `a`.
  - `restoreDocs(removed)` → `a` is back with equal fields (except `_rev`).
  - `restoreDocs` again → no error, and the live doc is not changed (409 skip).
  - `updateDocs` writes 2 status changes in one call. A successful first write and conflicting second write reject with the fresh full list and exact per-id outcomes; the first stored change survives.
  - Bulk status middleware handles that rejection by replacing Redux with the persisted list and reports only actual successes.
- **D. `app/middlewares/__tests__/InvoicesMW.spec.js`** (`await` everything):
  - Delete with one id and with an array → `removeDocs` gets the array, and `next` gets `INVOICE_DELETE` with the remaining docs.
  - The form is cleared when the edited id is among the deleted ids.
  - Take the `actionProps.onClick` passed to `toast.add`, call it → `dispatch` gets `restoreInvoices(removed)`.
  - `INVOICE_RESTORE` → `next` gets `INVOICE_RESTORE` with the docs.
  - Set status `'overdue'` → no `getSingleDoc` call and a warning goes to `next`.
  - Single paid → `INVOICE_UPDATE` payload has `status: 'paid'` and `paidAt: 'now'` (`Date.now` is mocked).
  - Array status → `updateDocs` gets 2 docs, each with the new status.
  - Duplicate → payload has `status: 'draft'`, no `paidAt`/`issuedAt`, new `_id`, `_rev: null`.
  - Keep the other existing tests (GET_ALL, SAVE, EDIT, UPDATE, CONFIGS_SAVE, NEW_FROM_CONTACT, pass-through).
- **E. `helpers/__tests__/date.spec.js`**: Step 1 regression tests.
- **F. Reducer spec**: restore + `getOverdueCount`.
- Deleted (markup-only): `Invoice.spec.jsx`, `Invoices.spec.jsx`, `SplitButton.spec.jsx`.
- No new e2e test. `npm run test:e2e` must still pass.

## Done criteria

- [ ] `npm test` exits 0. `npx vitest run app/helpers helpers app/middlewares app/reducers` shows the new groups A–F.
- [ ] `npm run lint` exits 0; `npm run build` exits 0; `npm run test:e2e` all pass.
- [ ] `grep -n "'overdue'" app/middlewares/InvoicesMW.jsx app/helpers/pouchDB.js` → no output (no code path writes `overdue`; the guard uses `INVOICE_STATUSES`).
- [ ] `grep -rn "INVOICE_RESTORE" app/constants/actions.jsx` → 1 line; no existing action type renamed (`git diff 3e89104 -- app/constants/actions.jsx` shows one added line).
- [ ] `test ! -f app/components/invoices/Invoice.jsx && test ! -f app/components/shared/SplitButton.jsx && echo ok` → `ok`
- [ ] `npm ls @tanstack/react-table` → `9.x`
- [ ] `grep -n "Custom statuses" README.md` → no output
- [ ] Manual smoke list in Step 12 passed in light and dark mode on a copied profile
- [ ] Commits have no attribution lines: `git log --format=%B 3e89104..HEAD | grep -ci "co-authored\|generated with"` → `0`
- [ ] `plans/README.md` row for 014 updated (unless a reviewer maintains it)

## STOP conditions

- A precondition fails. This includes: no imperative `toast` from 013, no 013 sidebar, or no `--status-*` tokens.
- `@tanstack/react-table` latest major is not 9, or `useTable` / `tableFeatures` / `createSortedRowModel` are not exported by the installed version.
- The drift check shows changes not explained by 013.
- A real invoice (on the copied profile) does not appear, loses its status, or shows another amount after this plan.
- Undo does not bring back an invoice with identical fields in the manual test.
- `restoreDocs` overwrites a live doc in any test.
- The `calTermDate` fix makes a preview template crash or show `Invalid date`.
- You feel you must change `app/helpers/form.js`, the editor, or the preview templates. These belong to 015/018.

## Review acceptance checks

- Deduplicate ids before bulk delete/status changes. Clear an edited form only when its id is in `removed`; a failed delete must keep typed work. Add a partial-delete regression test.
- `updateDocs` keeps its array return on full success. Partial failure rejects with `docs`, `succeeded` and `failed`; every caller must refresh from those persisted docs before reporting. Later plans must preserve this contract.
- Undo must never overwrite a newly created live document. Test delete → recreate with new content → Undo using real PouchDB. Keep the tested no-revision resurrection behavior; if an adapter rejects it, report it rather than removing conflict protection.
- Invalid issue/due dates return null, never NaN. Test malformed legacy dates and a non-finite `calTermDate` result.
- Move any still-relevant behavior tests from the old container into middleware tests before deleting its spec.

## Maintenance notes

- **Status model**: stored = `INVOICE_STATUSES` in `app/constants/invoices.js`. `overdue` only comes from `getDisplayStatus`. 016 (client history, outstanding total) and 017 (KPIs) must use `getDisplayStatus`/`getDueDate`/`getIssuedAt` from `app/helpers/invoice.js`. Do not re-implement them.
- **`paidAt`** (new, ms): set when an invoice becomes paid through `withStatus`. Old paid docs have no `paidAt`. 017 "Paid this month" must fall back to `getIssuedAt(invoice)` for them and say so in its plan.
- **015**: "Save draft" stores `status: 'draft'`. "Save & preview" of a draft should store `pending`. `app/helpers/form.js:82` still defaults new invoices to `pending` until 015. Duplicates are drafts now. Until 015 ships, users change them with "Set status ▸ Pending". This draft copy is an interim state: the operator confirmed on 2026-11-01 that 015 replaces it. In 015, "Duplicate" opens the editor as a new invoice with the next number and saves nothing until the user saves.
- **`calTermDate` fix** changes the due date printed on PDFs for term-based invoices (now correct). 018 PDF comparisons must use exports made **after** this plan.
- Unknown stored statuses (for example from a future import) show as Pending. 016 import should validate statuses against `INVOICE_STATUSES`.
- Deleted invoices are snapshots in memory only while the Undo toast lives (6 s, `UNDO_TIMEOUT_MS`). After that the delete is final. There is no trash bin. If users ask for one, add a `deletedAt` soft-delete in a later plan.
- No pagination. All rows render. If a user has more than ~1,000 invoices and scrolling becomes slow, add `rowPaginationFeature` + `createPaginatedRowModel()` and the shadcn `pagination` component.
- `getOverdueCount` is not memoized and reads `Date.now()`. That is fine for local data sizes. Pass the same `useNow()` value to the sidebar selector so its badge updates at midnight without a store change.
- Amount sort compares raw `grandTotal` across currencies. This is accepted: the column shows the currency code. Do not sum across currencies anywhere.
- Reviewers: check that Undo uses `restoreDocs` (no `_rev`, 409 skip), that no code stores `overdue`, that the old markup tests are gone and the logic tests are present, and that all new strings are in `i18n/en/invoices.json`.
