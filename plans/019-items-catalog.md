# Plan 019: Add a saved items catalog (products and services) with autocomplete in invoice line items

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- app/helpers/pouchDB.js app/helpers/__mocks__/pouchDB.js app/reducers/index.jsx app/store/index.jsx app/constants/actions.jsx app/App.jsx app/components/layout app/components/form app/helpers/form.js app/helpers/backup.js app/helpers/backupFlow.js main/backup-files.js main/menu.js app/components/settings/sections i18n/en/index.js preview/templates`
> Plans 012–018 change most of these files on purpose: 013 rewrites `app/App.jsx`, `app/components/layout/*` and `main/menu.js`; 014 adds `removeDocs`/`restoreDocs` to `app/helpers/pouchDB.js` and its mock; 015 replaces `app/components/form/*` with `app/components/form/editor/*` and rewrites `app/helpers/form.js`; 016 creates `app/helpers/backup.js`, `app/helpers/backupFlow.js`, `main/backup-files.js`, `bulkSaveDocs` and `app/components/settings/sections/*`; 017 adds the Dashboard tab; 018 moves template wrappers. Compare only the parts this plan depends on (the names in "Expected after 012–018"). `preview/templates/**` must have no change from this plan.
>
> **Rule**: do NOT add `Co-authored-by` trailers or any AI/tool attribution to commits or PR text. Pass this rule to any subagent.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (new PouchDB database; backup file format changes from version 1 to 2)
- **Depends on**: plans/015-*.md (editor line items), plans/016-*.md (backup/restore, Clients table pattern), plans/013-*.md (sidebar, command palette, toasts). Also requires plans/018-*.md as a completed prerequisite (which requires 017). Transitively 012 and 014.
- **Category**: feature
- **Planned at**: commit `3e89104`, 2026-11-01 (runs after 018)

## Why this matters

Freelancers and small businesses bill the same services again and again ("Web design, per hour", "Monthly hosting"). Today every line item is typed by hand. Typos and price errors are common, and nothing remembers the price. This plan adds an **Items** page (products and services) and autocomplete in the invoice line description. One choice fills the description, the unit price and the unit. Each row also gets a `unitCode` (UN/ECE Recommendation 20). Plan 025 (ZUGFeRD/Factur-X, XRechnung) needs this code on every invoice line. The backup must include the new database, or a restore loses the catalog.

## Decisions (fixed by this plan)

1. **Storage**: new PouchDB database `items`, adapter `idb`, created like `contacts`. No migration. Doc shape: `{ _id, name, description, unitPrice, unitCode, taxRateId, archived, created_at }`. `taxRateId` is always `null` until plan 021.
2. **Units**: a fixed list in `app/constants/units.js`: `C62` Unit, `HUR` Hour, `DAY` Day, `MON` Month, `KGM` Kilogram, `MTR` Metre, `LS` Lump sum. Default `C62`. `getUnitCode(value)` returns `value` when it matches `/^[A-Z0-9]{2,3}$/`, else `'C62'`. An unknown valid code (from a later version) is kept and shown as the raw code.
3. **Rows**: line rows get an optional `unitCode`. A missing value reads as `'C62'`. Rows do NOT store an item id. An invoice keeps a copy of the item data (like `recipient`). Edits to an item never change saved invoices.
4. **Row text**: the row description = `item.description.trim()` when it is not empty, else `item.name`. `name` is the short label for search and the Items table. `description` is the text that prints.
5. **Delete vs archive**: delete is always allowed, because invoices keep copies. Delete uses the 014 pattern (delete at once, Undo toast for `UNDO_TIMEOUT_MS`). Archive hides an item from autocomplete but keeps it on the Items page (tab "Archived"). No usage check.
6. **Names are unique** among active items (trimmed, case- and accent-insensitive). An archived item may share a name. Unarchive must check the same rule and remain archived on conflict; never create two active items with the same normalized name.
7. **Price has no currency.** `unitPrice` is a plain number. It takes the currency of the invoice. The Items page formats it with `invoice.currency.fraction` and `separator` from settings, without a currency code.
8. **Templates do not change.** The PDF stays identical. The unit is stored, but no template prints it. Plans 021 and 025 may print it later (with a new PDF baseline).
9. **Autocomplete** uses Base UI `Autocomplete` (free text), not `Combobox` (fixed value). shadcn has no `autocomplete` component in `base-nova`, so this plan writes a small wrapper. The popup opens after 1 typed character when there are matches. It shows up to 8 active items.
10. **Backup format version 2**: the file gets an `items` array. Import accepts version 1 and 2. A missing `items` key reads as `[]`. A present `items` that is not an array → `invalid-format`. Older apps refuse version 2 files (`newer-version`); this is expected.
11. **Out of scope**: CSV export of items, per-item tax (021), stock/inventory, item images, usage statistics, printing units.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current; git status --short` | record the current branch and existing changes; keep both |
| 013 sidebar and palette | `ls app/components/layout/AppSidebar.jsx app/components/layout/CommandPalette.jsx app/components/layout/AppMain.jsx` | 3 files |
| 013 toast | `grep -rn "export.*toast" ui/components/ui/toast.jsx` | an exported `toast` with `add`/`close`. Note the import path. |
| 013 search normalize | `grep -n "export function normalize" app/helpers/commandSearch.js` | 1 hit |
| 014 undo delete | `grep -n "removeDocs\|restoreDocs" app/helpers/pouchDB.js app/helpers/__mocks__/pouchDB.js && grep -n "UNDO_TIMEOUT_MS" app/constants/invoices.js` | exports in both pouchDB files; constant exists |
| 014 table | `npm ls @tanstack/react-table && ls app/components/invoices/invoiceTableFeatures.js` | `9.x`; file exists |
| 015 editor rows | `ls app/components/form/editor/LineItems.jsx app/components/form/editor/LineItemRow.jsx && grep -nE "export (function\|const) (updateRowField\|pickInvoiceFields\|parseNumberInput\|isBlankRow)" app/helpers/form.js` | 2 files; 4 exports |
| 015 rows keep extra keys | `grep -n "rows" app/helpers/form.js \| grep -n "pickInvoiceFields\|map\|filter"` | read the code: rows are copied with `...row` (extra keys kept). If rows are rebuilt from a fixed key list, STOP. |
| 016 backup | `grep -n "BACKUP_VERSION = 1" app/helpers/backup.js && grep -n "serializeBackup" main/backup-files.js && grep -n "bulkSaveDocs" app/helpers/pouchDB.js app/helpers/backupFlow.js` | hits in all 4 files |
| 016 client dialog pattern | `ls app/components/contacts/ClientEditorDialog.jsx app/components/contacts/ClientsTable.jsx` | 2 files |
| 017 dashboard tab | `grep -n "dashboard" app/components/layout/AppMain.jsx` | 1+ hit |
| 018 legacy CSS gone | `grep -rln "styled-components" app \| grep -v __tests__` | no output |
| shadcn parts | `ls ui/components/ui/{dialog,field,input,textarea,select,table,tabs,dropdown-menu,empty,badge,button}.jsx` | 11 files. Add a missing one with `npx shadcn@latest add <name>`. |
| Base UI Autocomplete | `node -e "const b=require('@base-ui/react');console.log(typeof b.Autocomplete)"` | `object`. If `undefined`, try `require('@base-ui/react/autocomplete')`. If both fail, STOP. |
| PDF scripts (018) | `ls scripts/pdf-snapshot.mjs scripts/pdf-compare.sh` | 2 files |
| Tests and lint | `npm test && npm run lint` | exit 0 |
| Data copy | `ls /tmp/manta-profile-copy` | exists. If not: `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy` |

If a name differs from this plan, find the real name with `grep -rn` and use it. If the thing does not exist, STOP.

## Current state

### (a) At 3e89104 (not changed by 012–018 except where noted)

`app/helpers/pouchDB.js:5-8` — databases:
```js
// Keep the 'idb' adapter: existing user data was written by it.
// The newer 'indexeddb' adapter cannot read these databases.
const contactsDB = new PouchDB('contacts', { adapter: 'idb' });
const invoicesDB = new PouchDB('invoices', { adapter: 'idb' });
```
`app/helpers/pouchDB.js:122-137` — `setDB` knows only two names. **An unknown name never resolves or rejects** (the promise hangs):
```js
const setDB = dbName =>
  new Promise((resolve, reject) => {
    if (dbName === 'contacts') {
      resolve(contactsDB);
    }
    if (dbName === 'invoices') {
      if (alreadyRunInvoiceMigration) {
        resolve(invoicesDB);
      }
```
`getAllDocs` (`:140`), `saveDoc` (`:168`, `db.put`), `deleteDoc` (`:174`), `updateDoc` (`:180`) each resolve to the full doc list. Export line `:185`. 014 adds `removeDocs`/`restoreDocs`/`updateDocs`; 016 adds `bulkSaveDocs`. Migrations (`:41-119`) run only for `invoices`.

`app/helpers/__mocks__/pouchDB.js:30-42` — the mock `getAllDocs` has a `switch` without `break` and rejects every name except `contacts`/`invoices`. `saveDoc`/`updateDoc` (`:44-62`) resolve only for those two names; **for any other name the promise never settles**.

`app/actions/contacts.jsx:4-11` — pattern to copy:
```js
export const getAllContacts = createAction(ACTION_TYPES.CONTACT_GET_ALL);
export const saveContact = createAction(
  ACTION_TYPES.CONTACT_SAVE,
  invoiceData => invoiceData
);
```
`app/reducers/ContactsReducer.jsx:4-18` — `handleActions` + `combineActions(...)` → `(state, action) => action.payload`, initial `[]`, selector `getContacts = state => state.contacts`.

`app/middlewares/ContactsMW.jsx:34-58` — `CONTACT_SAVE`: `saveDoc('contacts', action.payload)`, then `next({ type: CONTACT_SAVE, payload: newDocs })`, then `dispatch` a `UI_NOTIFICATION_NEW` success; `.catch` → `next` a `UI_NOTIFICATION_NEW` warning with `err.message`.

`app/reducers/index.jsx:8-14` — `combineReducers({ ui, form, invoices, contacts, settings })`.
`app/store/index.jsx:16` — `const middlewares = [FormMW, ContactsMW, InvoicesMW, SettingsMW, UIMiddleware];`
`app/constants/actions.jsx:35-37` — `CONTACT_GET_ALL`, `CONTACT_DELETE`, `CONTACT_SAVE` (016 adds `CONTACT_UPDATE`, `CONTACT_RESTORE`).
`app/App.jsx:32-34` — initial loads: `dispatch(ContactsActions.getAllContacts()); dispatch(InvoicesActions.getInvoices()); dispatch(SettingsActions.getInitalSettings());` (013 moves them into one `useEffect`).
`main/menu.js:121-146` — Go menu items send `menu-change-tab` with `'invoices'`, `'contacts'`, `'settings'`.
`i18n/en/index.js` — imports each namespace JSON and exports them in one object. A new namespace file must be added there.

Templates print rows only through `row.description`, `row.quantity`, `row.price`, `row.subtotal` (`preview/templates/minimal/components/Main.jsx:127-136`, `preview/templates/business/components/Main.jsx:126-138`). They ignore other keys, so `unitCode` does not change the PDF.

### (b) Expected after 012–018 (expectations — check them in Preconditions)

- **013 Step 6.4 / 7.5 / 11**: `toast` from `@/components/ui/toast`; `UI_NOTIFICATION_NEW` becomes a toast in `UIMiddleware`. `AppSidebar.jsx` has `SidebarMenu` items "Invoices" (`FileText`, tab `invoices`) and "Clients" (`Users`, tab `contacts`). `CommandPalette.jsx` has a "Go to" group, uses `filterCommands` with `keywords`. `app/helpers/commandSearch.js` exports `normalize(text)` (NFD, strip diacritics, lower case, trim). `TitleBar.jsx` maps `activeTab` to a title with `t('app:nav:…')`. Nav strings live in `i18n/en/app.json`.
- **014 Step 2 / 4 / 6**: `UNDO_TIMEOUT_MS = 6000` in `app/constants/invoices.js`. `removeDocs(dbName, ids)` → `{ removed, failed, docs }`; `restoreDocs(dbName, docs)` → all docs (409 → skip). `INVOICE_DELETE` shows `toast.add({ title, timeout: UNDO_TIMEOUT_MS, actionProps: { children, onClick } })`; Undo dispatches `restoreInvoices(removed)`.
- **015 Step 5 / 9**: `updateRowField(row, name, raw)`, `parseNumberInput(raw, { integer })`, `isBlankRow(row)`, `pickInvoiceFields(form, defaultCurrency)` in `app/helpers/form.js`. `LineItems.jsx` grid `grid-cols-[1.5rem_1fr_7rem_6rem_7rem_2rem]`; `LineItemRow.jsx` has a drag handle, description `Input`, price and quantity inputs, read-only amount, remove button; Enter in any input dispatches `addItem()`; changes dispatch `updateItem(updateRowField(item, name, e.target.value))`.
- **016 Step 9 / 11 / 12**: `app/helpers/backup.js` with `BACKUP_VERSION = 1`, `sanitizeDoc`, `buildBackup({ settings, invoices, contacts })`, `parseBackup(text)`, `planMerge`. `main/backup-files.js` `serializeBackup(payload, appVersion, date)` writes an **explicit field list** (`app, version, appVersion, exportedAt, settings, invoices, contacts`) — a new key is dropped unless it is added there. `app/helpers/backupFlow.js` `collectBackup`, `previewImport`, `runImport` (safety snapshot first, then `bulkSaveDocs`). `ImportDialog.jsx` shows counts. 016 Step 3 `ClientsTable.jsx` and Step 4 `ClientEditorDialog.jsx` are the patterns for this plan.
- **017 Step (Dashboard)**: `activeTab` default `'dashboard'`; sidebar order starts with Dashboard.

## Reference facts (recheck versions and APIs at execution)

- Base UI **Autocomplete**: "Autocomplete's input can contain free-form text"; use Combobox when "the value can't be custom". Root props: `items`, `value`/`onValueChange` (the input text), `filter` (`null` = no built-in filter), `itemToStringValue`, `mode` (`list` default: the input does not change on highlight), `openOnInputClick` (default `false`), `limit`. Parts: `Input`, `Portal`, `Positioner`, `Popup`, `List`, `Item`, `Empty`. `Autocomplete.Item` `onClick` "fires on pointer clicks and also when Enter is pressed while the item is highlighted". Source: https://base-ui.com/react/components/autocomplete
- shadcn `base-nova` registry has `combobox` but **no** `autocomplete` (`https://ui.shadcn.com/r/styles/base-nova/autocomplete.json` → 404, checked 2026-11-01). The combobox wrapper imports `{ Combobox as ComboboxPrimitive } from "@base-ui/react"`: https://ui.shadcn.com/r/styles/base-nova/combobox.json , docs https://ui.shadcn.com/docs/components/base/combobox
- `@base-ui/react` 1.9.0 (2026-10-09): https://base-ui.com/react/overview/releases ; Field: https://ui.shadcn.com/docs/components/base/field ; Data table (TanStack Table v9, 9.3.1): https://ui.shadcn.com/docs/components/base/data-table ; Toast: https://ui.shadcn.com/docs/components/base/toast
- UN/ECE Recommendation 20 unit codes (`C62` one/unit, `HUR`, `DAY`, `MON`, `KGM`, `MTR`, `LS`) are the code list for the invoice line unit (EN 16931 BT-130, UBL `cbc:InvoicedQuantity/@unitCode`, example `C62`): https://docs.peppol.eu/poacc/upgrade-3/codelist/UNECERec20/ , https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/cac-InvoiceLine/cbc-InvoicedQuantity/unitCode
- PouchDB: `put` without the current `_rev` on an existing doc → 409. `bulkDocs` returns per-doc results. https://pouchdb.com/api.html
- lucide-react 1.66.0 icons used: `Package`, `Plus`, `Search`, `MoreHorizontal`, `Archive`, `ArchiveRestore`, `Trash2`, `Pencil`, `BookmarkPlus`. Check: `node -e "const l=require('lucide-react');console.log(['Package','Plus','Search','MoreHorizontal','Archive','ArchiveRestore','Trash2','Pencil','BookmarkPlus'].filter(n=>!l[n]))"` → `[]`. https://lucide.dev/guide/version-1
- UX: undo over confirmation https://www.nngroup.com/articles/confirmation-dialog/ ; data tables https://www.nngroup.com/articles/data-tables/ ; empty states https://www.nngroup.com/articles/empty-state-interface-design/
- Confirm versions at execution time: `npm view @base-ui/react version`, `npm view @tanstack/react-table version`, `npm view lucide-react version`.

## Execution and verification rules (reviewed 2026-11-01)

- The source baseline is `3e89104`; prerequisite output is an expected contract, not code that exists today. Read the completed prerequisite changes before implementation. Expected changes from those plans are not a drift failure.
- Before a live UI check, call Jean `get_run_environments` and use its running URL and startup command. If none runs, use `start_run_environment`. Do not start a second server by hand. If no Run command is configured, report the missing configuration. Commands below describe the required copy-profile setup; they do not override this rule.
- Never overwrite a prior test profile or copy production data into an existing destination. Use a new empty, task-specific profile directory and set `MANTA_USER_DATA` before launch. Treat `/tmp/manta-profile-copy` below as an example path. Keep test output and PDF baselines outside the production export directory.
- Use the narrow spec for each logic change. Run the full checks once at the end for this cross-cutting feature. Verify UI interactions in the browser or Electron app; unit tests alone do not prove these flows.

## Commands you will need

```bash
npx vitest run <path/to/file.spec.js>      # one spec
npm test                                    # all unit tests
npm run lint
npm run build && MANTA_USER_DATA=/tmp/manta-profile-copy npm start   # manual smoke on a COPY only
npm run test:e2e
node scripts/pdf-snapshot.mjs <dir> && sh scripts/pdf-compare.sh <before> <after>   # 018 tools
```

## Scope

**In scope**
- `items` database, Redux actions/reducer/middleware, initial load.
- Items page: table, search, Active/Archived tabs, create/edit dialog, archive, delete with Undo, empty states.
- Sidebar item "Items" (after Clients), title bar title, command palette "Go to", Go menu item.
- Editor: description autocomplete, per-row unit select, "Save as item" row action.
- Backup format version 2 with `items`; import of version 1 files.

**Files to create**
- `app/constants/units.js`
- `app/helpers/items.js`, `app/helpers/__tests__/items.spec.js`
- `app/actions/items.jsx`, `app/reducers/ItemsReducer.jsx`, `app/middlewares/ItemsMW.jsx`
- `app/reducers/__tests__/ItemsReducer.spec.js`, `app/middlewares/__tests__/ItemsMW.spec.js`
- `app/containers/Items.jsx`
- `app/components/items/ItemsTable.jsx`, `ItemEditorDialog.jsx`, `ItemRowActions.jsx`, `ItemsEmpty.jsx`, `itemTableFeatures.js`
- `app/components/form/editor/ItemAutocomplete.jsx`
- `i18n/en/items.json`

**Files to change**: `app/helpers/pouchDB.js`, `app/helpers/__mocks__/pouchDB.js`, `app/helpers/__tests__/pouchDB.spec.js`, `app/constants/actions.jsx`, `app/reducers/index.jsx`, `app/store/index.jsx`, `app/App.jsx`, `app/components/layout/AppMain.jsx`, `AppSidebar.jsx`, `TitleBar.jsx`, `CommandPalette.jsx`, `main/menu.js`, `app/components/form/editor/LineItems.jsx`, `LineItemRow.jsx`, `app/helpers/__tests__/form.spec.js`, `app/helpers/backup.js` (+ spec), `main/backup-files.js` (+ spec), `app/helpers/backupFlow.js` (+ spec), `app/components/settings/sections/ImportDialog.jsx`, `i18n/en/index.js`, `i18n/en/app.json`, `i18n/en/messages.json`, `i18n/en/form.json`, `i18n/en/settings.json`.

**Files to delete**: none. **Must not change**: `preview/templates/**`, `main/save-pdf.js`, existing doc shapes (only the optional row key `unitCode` is added).

## Git workflow

- Continue on the current branch. Do not switch branches, create a worktree, pull, or discard existing changes. Branch changes need an explicit user request.
- Commits (short imperative subject, no prefix, no attribution): Steps 2–4 `Add the items database and catalog state`; Steps 5–7 `Add the Items page`; Step 8 `Suggest saved items in invoice line items`; Step 9 `Include items in backups`; Steps 10–11 `Add item strings and final fixes`.
- Do not push.

## Steps

### Step 1: Preconditions and PDF baseline

1. Run every check in "Preconditions". Write down the toast import path and the real names of any 013–016 file that differs. Write down the start commit (`git rev-parse HEAD`) as `<start-commit>`.
2. `npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-019-before`.

**Verify**: every precondition matches; `ls /tmp/manta-pdf-019-before/*.pdf | wc -l` → 2 or more.

### Step 2: Units and pure item helpers

1. Create `app/constants/units.js`:
   ```js
   export const DEFAULT_UNIT_CODE = 'C62';
   // UN/ECE Recommendation 20 codes. Plan 025 writes them into e-invoices.
   export const UNIT_CODES = ['C62', 'HUR', 'DAY', 'MON', 'KGM', 'MTR', 'LS'];
   ```
   Labels come from i18n keys `items:units:<code>` (Step 10).
2. Create `app/helpers/items.js`. Import `normalize` from `./commandSearch` and `UNIT_CODES`, `DEFAULT_UNIT_CODE`. Export:
   - `getUnitCode(value)` → Decision 2.
   - `isKnownUnit(code)` → `UNIT_CODES.includes(code)`.
   - `getItemErrors(values, items, selfId)` → `{ [field]: i18nKey }`. `name` trimmed empty → `items:errors:nameRequired`; longer than 120 → `items:errors:nameTooLong`; same normalized name as another item with `!archived` and `_id !== selfId` → `items:errors:nameTaken`. `unitPrice`: `String(values.unitPrice ?? '').trim() === ''` or `!Number.isFinite(Number(values.unitPrice))` → `items:errors:price`. Negative prices remain valid for legacy invoice-level calculations; they are not a payment/deposit ledger. Plan 021 must reject negative line nets in its new line-tax mode until signed discount allocation is supported. `unitCode` not matching `/^[A-Z0-9]{2,3}$/` → `items:errors:unit`.
   - `buildItem(values, existing, now)` → `name` and `description` trimmed, `unitPrice: Number(values.unitPrice)`, `unitCode: getUnitCode(values.unitCode)`. With `existing`: spread `existing` first (keeps `_id`, `_rev`, `created_at`, `archived`, `taxRateId` and unknown keys). Without: `_id: crypto.randomUUID()`, `taxRateId: null`, `archived: false`, `created_at: now`.
   - `withArchived(item, archived)` → `{ ...item, archived: Boolean(archived) }`.
   - `itemToRowDescription(item)` → Decision 4.
   - `applyItemToRow(row, item)` → new object `{ ...row, description: itemToRowDescription(item), price: item.unitPrice, quantity, unitCode: getUnitCode(item.unitCode), subtotal: item.unitPrice * quantity }` where `quantity = row.quantity === '' || row.quantity == null ? 1 : row.quantity`. Never mutate `row`. Keep `row.id`.
   - `rowToItemValues(row)` → `{ name, description, unitPrice, unitCode }` for the dialog. `name` = first line of the trimmed description, cut to 80 characters. `description` = the full trimmed text when it differs from `name`, else `''`. `unitPrice` = `row.price === '' || row.price == null ? '' : String(row.price)`. `unitCode` = `getUnitCode(row.unitCode)`.
   - `searchItems(items, query, limit = 8)` → empty normalized query → `[]`. Skip archived items. Split the query on whitespace; every term must be in `normalize(name + ' ' + description)`. Rank: name starts with the full query (0), name contains it (1), other (2); then `name.localeCompare(b.name, undefined, { sensitivity: 'base' })`. Return the first `limit`.
   - `matchesItemQuery(item, query)` → empty query → true; else every term is in `normalize(name + ' ' + description + ' ' + unitCode)`.
   - `ITEM_VIEWS = ['active', 'archived']`; `countItems(items)` → `{ active, archived }`; `filterItems(items, { view, query })` → items whose `Boolean(archived) === (view === 'archived')` and `matchesItemQuery`.
3. Create `app/helpers/__tests__/items.spec.js` with the cases in "Test plan" group A.

**Verify**: `npx vitest run app/helpers/__tests__/items.spec.js` → all pass.

### Step 3: The `items` database

1. In `app/helpers/pouchDB.js`, after line 8, add `const itemsDB = new PouchDB('items', { adapter: 'idb' });`. Keep the comment about `idb`.
2. In `setDB`, add `if (dbName === 'items') { return resolve(itemsDB); }` before the `invoices` branch. At the end of the executor function, add `if (dbName !== 'contacts' && dbName !== 'invoices') reject(new Error(\`Unknown database: ${dbName}\`));` so a wrong name fails instead of hanging. Do not change the `invoices` migration queue.
3. In `app/helpers/__mocks__/pouchDB.js`: add `const itemDoc = { _id: 'item-1', name: 'Design', description: '', unitPrice: 80, unitCode: 'HUR', taxRateId: null, archived: false, created_at: 1 };` and `itemsRecords: [itemDoc]` in `mockData`. Add an `'items'` branch to `getAllDocs` (before `default`), `saveDoc` and `updateDoc`. Make `removeDocs` and `restoreDocs` return `mockData[\`${dbName}Records\`]` for `docs` (if 016 already made them name-aware, add `items` the same way).
4. In `app/helpers/__tests__/pouchDB.spec.js` (real PouchDB on fake-indexeddb), add: (a) `saveDoc('items', doc)` then `getAllDocs('items')` contains it and `getAllDocs('contacts')` does not; (b) `getAllDocs('nope')` rejects with `Unknown database`.

**Verify**: `npx vitest run app/helpers/__tests__/pouchDB.spec.js` → all pass. `grep -n "new PouchDB" app/helpers/pouchDB.js` → 3 lines, all with `adapter: 'idb'`.

### Step 4: Actions, reducer, middleware, store

1. `app/constants/actions.jsx`: add an `// ITEMS` block with `ITEM_GET_ALL`, `ITEM_SAVE`, `ITEM_UPDATE`, `ITEM_DELETE`, `ITEM_RESTORE`. Do not rename existing types.
2. `app/actions/items.jsx`: `getAllItems`, `saveItem(doc)`, `updateItem(doc, messageKey = 'messages:item:updated')` (payload `doc`, meta `{ messageKey }` — use the third `createAction` argument), `deleteItem(idOrIds)`, `restoreItems(docs)`.
3. `app/reducers/ItemsReducer.jsx`: copy `ContactsReducer.jsx`. `combineActions` of all five actions → `action.payload`. Initial `[]`. Selectors `getItems = state => state.items` and `getActiveItems = createSelector([getItems], items => items.filter(i => !i.archived))`. Import `createSelector` from the installed `reselect`; do not return a fresh array for unchanged state.
4. `app/middlewares/ItemsMW.jsx` (`({ dispatch }) => next => action`). Copy the shape of `ContactsMW.jsx`:
   - `ITEM_GET_ALL`: `getAllDocs('items')` → `next({ ...action, payload })`. Catch → warning.
   - `ITEM_SAVE`: `saveDoc('items', payload)` → `next({ type, payload: docs })`, success notification `messages:item:saved`, resolve `true`. Catch → warning, resolve `false`.
   - `ITEM_UPDATE`: validate active-name uniqueness against fresh item docs before an edit or unarchive, excluding the item's own id; on conflict, warn and resolve `false` without writing. Then `updateDoc('items', payload)` → same, message `action.meta?.messageKey ?? 'messages:item:updated'`. Resolve `true`/`false`.
   - `ITEM_DELETE`: copy 014's `INVOICE_DELETE`. `ids = [].concat(payload)`; `removeDocs('items', ids)`; `next({ type: ITEM_DELETE, payload: docs })`; failed → warning `messages:item:deleteFailed`; removed → `toast.add({ title: i18n.t('messages:item:deleted', { count }), timeout: UNDO_TIMEOUT_MS, actionProps: { children: i18n.t('messages:item:undo'), onClick: () => { toast.close(id); dispatch(restoreItems(removed)); } } })`.
   - `ITEM_RESTORE`: `restoreDocs('items', payload)` → `next({ type: ITEM_RESTORE, payload: docs })` + toast `messages:item:restored`.
   - `default`: `return next(action)`.
5. `app/reducers/index.jsx`: add `items: ItemsReducer`. `app/store/index.jsx`: add `ItemsMW` after `ContactsMW` in `middlewares`.
6. Tests: `ItemsReducer.spec.js` and `ItemsMW.spec.js` (group B). Mock the toast module like 014 (`vi.mock('<toast path>', () => ({ toast: { add: vi.fn(() => 't1'), close: vi.fn() } }))`). Every test must `await` the middleware.

**Verify**: `npx vitest run app/reducers/__tests__/ItemsReducer.spec.js app/middlewares/__tests__/ItemsMW.spec.js` → all pass. Commit.

### Step 5: Load items and add navigation

1. `app/App.jsx`: in the `useEffect` that loads data, add `dispatch(ItemsActions.getAllItems());` after `getAllContacts()`.
2. `AppMain.jsx`: add `{activeTab === 'items' && <Items />}` (import `../../containers/Items`).
3. `AppSidebar.jsx`: add a `SidebarMenuItem` after "Clients": icon `Package`, label `t('app:nav:items')`, tab `items`, `isActive`, `tooltip`. Final order: Dashboard, Invoices, (Estimates, Recurring when they exist), Clients, Items.
4. `TitleBar.jsx`: `items` → `t('app:nav:items')`.
5. `CommandPalette.jsx`: add "Items" to the "Go to" group, `value` `nav-items`, `keywords: ['products', 'services', 'catalog']`, `onSelect` → `changeActiveTab('items')`.
6. `main/menu.js` Go menu: after Clients/Contacts add `{ label: 'Items', click() { mainWindow.webContents.send('menu-change-tab', 'items'); } }`. No accelerator (`CmdOrCtrl+Shift+I` opens DevTools on Windows/Linux). The channel already exists in `preload/index.js`.
7. If 013 put a tab whitelist in `App.jsx` or `UIReducer` (`grep -rn "'contacts'" app/App.jsx app/reducers/UIReducer.jsx`), add `'items'` to it.
8. Create a stub `app/containers/Items.jsx` that renders a heading, so the build passes. Step 7 replaces it.

**Verify**: `npm run build` → exit 0. Manual on the copy: the sidebar shows "Items" with a label and a tooltip when collapsed; ⌘K → "Items" opens the page; Go › Items works.

### Step 6: Item editor dialog

1. Create `app/components/items/ItemEditorDialog.jsx`. Copy the structure of 016's `ClientEditorDialog.jsx`. Props: `open`, `onOpenChange`, `item` (existing doc or `null`), `initialValues` (optional, for "Save as item"), `onSaved` (optional).
2. Fields (shadcn `Field`, `FieldLabel`, `FieldError`, `FieldDescription`):
   - Name * — `Input`, `maxLength={120}`, `autoComplete="off"`.
   - Description — `Textarea`, 3 rows. `FieldDescription`: `items:dialog:descriptionHint` ("This text prints on the invoice. If empty, the name prints.").
   - Unit price * — `Input type="number" step="0.01" className="text-end tabular-nums"`. `FieldDescription`: `items:dialog:priceHint` ("Uses the currency of the invoice.").
   - Unit — `Select` with `UNIT_CODES` labels `t('items:units:<code>')`. If the value is not known (Decision 2), add it as an extra option with the raw code.
3. Local state: `values` (strings). Initial: `item` → `{ name, description, unitPrice: String(unitPrice), unitCode: getUnitCode(unitCode) }`; else `initialValues ?? { name: '', description: '', unitPrice: '', unitCode: 'C62' }`. Reset when `open` turns true.
4. Submit: `errors = getItemErrors(values, items, item?._id)` with `items` from `useSelector(getItems)`. Errors → inline (`aria-invalid`), focus the first invalid field, keep the dialog open. Else `doc = buildItem(values, item, Date.now())`; `ok = await dispatch(item ? updateItem(doc) : saveItem(doc))`; if `ok`, call `onSaved?.(doc)` and close. If not `ok`, keep the dialog open (the middleware shows the warning).
5. Title: `items:dialog:newTitle` / `items:dialog:editTitle`. Buttons: Cancel (outline), Save (primary, disabled while saving).

**Verify**: `npm run build` → exit 0.

### Step 7: Items page

1. `itemTableFeatures.js`: copy 014's `invoiceTableFeatures.js` with `rowSortingFeature` and `sortedRowModel` only (no selection).
2. `ItemsTable.jsx`: copy the 016 `ClientsTable.jsx` markup. Columns:
   - **Name**: `name` in medium weight; `description` below in muted text with `line-clamp-1`. Sortable, default ascending, `localeCompare(…, { sensitivity: 'base' })`.
   - **Unit**: label from `t('items:units:<code>')`, or the raw code.
   - **Unit price**: `text-end tabular-nums`, `formatNumber(unitPrice, currency.fraction, currency.separator)` with `currency` from `useSelector(s => s.settings.saved?.invoice?.currency)` (fallback `{ fraction: 2, separator: 'commaDot' }`). Sortable.
   - **Actions**: `ItemRowActions`.
   A row click opens the editor. Menu clicks call `event.stopPropagation()`.
3. `ItemRowActions.jsx`: `DropdownMenu`, trigger icon button `MoreHorizontal` with `aria-label` `items:actions:open` ("Actions for {{name}}"). Items: Edit (`Pencil`); Archive (`Archive`) → `updateItem(withArchived(item, true), 'messages:item:archived')` or Unarchive (`ArchiveRestore`) → `updateItem(withArchived(item, false), 'messages:item:unarchived')`; separator; Delete (`Trash2`, destructive) → `deleteItem(item._id)`. No confirmation dialog (Decision 5).
4. `ItemsEmpty.jsx` (shadcn `Empty`), three variants:
   - `none`: icon `Package`, `items:empty:title` "No items yet", `items:empty:description` "Save products and services you sell often. Then pick them when you add invoice lines.", button New item.
   - `noResults`: `items:empty:noResults` "No items match “{{query}}”", button Clear search.
   - `noArchived`: `items:empty:noArchived` "No archived items".
5. Rewrite `app/containers/Items.jsx` (function component): state `view` (`'active'`), `query` (`''`), `sorting` (`[{ id: 'name', desc: false }]`), `editing` (`null` | item | `'new'`). `counts = countItems(items)`, `visible = filterItems(items, { view, query })`. Layout like 016 Clients: `<h1>` `items:header` + count, search `Input` (`type="search"`, lucide `Search`, Escape clears), button New item (`Plus`); `Tabs` Active/Archived with counts; table or empty state; `ItemEditorDialog`. If the edited item disappears from the store (deleted), close the dialog.

**Verify**: `npm run build && npm run lint` → exit 0. `grep -rn "styled-components\|ion-\|className=\"row" app/containers/Items.jsx app/components/items` → no output. Manual on the copy: create 3 items, edit one, search, archive one (moves to Archived tab), delete one and click Undo (it returns), restart the app (data is still there). Commit.

### Step 8: Editor autocomplete, unit select and "Save as item"

1. Create `app/components/form/editor/ItemAutocomplete.jsx`. Use `Autocomplete` from `@base-ui/react` (path from Preconditions). Props: `id`, `value` (row description), `items` (active items), `onTextChange(text)`, `onPick(item)`, `onEnterWithoutPick()`, `inputProps` (aria-label, aria-invalid, ref).
   - Root: `items={matches}` where `matches = useMemo(() => searchItems(items, value), [items, value])`, `value={value}`, `onValueChange` routes user text edits to `onTextChange` (selection events are handled only by `onPick`), `filter={null}` (we filter), `itemToStringValue={itemToRowDescription}`, `open` controlled: `open = userOpen && matches.length > 0`, `onOpenChange={setUserOpen}`.
   - Render `Autocomplete.Input` with the same classes as `ui/components/ui/input.jsx` (copy the `className` string; use `cn`). Popup: `Autocomplete.Portal` › `Positioner` (`sideOffset={4}`, `align="start"`) › `Popup` with the classes of `ui/components/ui/combobox.jsx` `ComboboxContent` › `List`. Each `Autocomplete.Item` (`value={item}`, `onClick={() => onPick(item)}`) shows the name, the description in muted text (`line-clamp-1`), and on the end side the unit label and the formatted price (`tabular-nums`).
   - Keyboard: ArrowDown/ArrowUp move, Enter picks the highlighted item (Base UI), Escape closes. In the input `onKeyDown`: when Enter is pressed and the popup is closed, call `onEnterWithoutPick()`. When the popup is open, do not call it (Enter belongs to the list).
   - A pick must perform one atomic row update. A selection-triggered `onValueChange` must not dispatch a text-only update from a stale row after `onPick`, because it can restore the old price, quantity and unit. Use the installed Base UI event reason to distinguish text edits from selections; if that API differs, keep a small selection guard and prove both event orders in a focused behavior test. Preserve IME composition: Enter while composing must neither pick an item nor add a row.
2. `LineItemRow.jsx`:
   - Replace the description `Input` with `ItemAutocomplete`. `onTextChange` → `updateItem(updateRowField(item, 'description', text))`. `onPick` → `updateItem(applyItemToRow(item, picked))`. `onEnterWithoutPick` → `addItem()` (old Enter behavior). Keep the ref map, `aria-label` and errors from 015.
   - Add a unit `Select` after quantity: value `getUnitCode(item.unitCode)`, options from `UNIT_CODES` (+ raw unknown code), `aria-label` `form:fields:items:unit` with the row number, `onValueChange` → `updateItem({ ...item, unitCode: v })`.
   - Add a "Save as item" icon button (`BookmarkPlus`, `size-8`, `aria-label` `form:fields:items:saveAsItem` with the row number, `Tooltip` with the same text) before the remove button. Show it when `item.description?.trim()` is not empty. Click → `onSaveAsItem(item)` (prop from `LineItems`).
3. `LineItems.jsx`:
   - Read `useSelector(getActiveItems)` and pass it to rows.
   - Change the grid to `grid-cols-[1.5rem_1fr_7rem_6rem_6rem_7rem_4.5rem]` (Unit column after Quantity; actions column fits two 32 px buttons). Add the "Unit" header label.
   - Hold one `ItemEditorDialog` with `item={null}` and `initialValues={rowToItemValues(row)}`. `onSaveAsItem(row)` opens it. On save, the middleware toast "Item saved" shows.
4. In `app/helpers/__tests__/form.spec.js` add (group C): `pickInvoiceFields` keeps `unitCode` on rows; a row with only `unitCode: 'HUR'` and no description, price or quantity is still blank (`isBlankRow` → true) and is dropped.

**Verify**: `npx vitest run app/helpers/__tests__/form.spec.js app/helpers/__tests__/items.spec.js` → pass. `npm run build` → exit 0. Manual on the copy (Test plan smoke list, editor part). `grep -rn "unitCode" preview` → no output. Commit.

### Step 9: Backup format version 2

1. `app/helpers/backup.js`:
   - `BACKUP_VERSION = 2`.
   - `buildBackup({ settings, invoices, contacts, items = [] })` adds `items: items.map(sanitizeDoc)`.
   - `parseBackup`: accept `version` 1 and 2. `items` missing → `[]`. `items` present but not an array → `invalid-format`. A valid item doc is a plain object with a valid `_id` (same rule as other docs) and a non-empty string `name`. Count invalid and duplicate items in `invalid.items` and `duplicates.items`. Run `sanitizeDoc` on each.
2. `main/backup-files.js` `serializeBackup`: add `items: payload.items` to the written object. Throw when `payload.items` is not an array (renderer and main ship together).
3. `app/helpers/backupFlow.js`: `collectBackup` adds `items: await getAllDocs('items')`. `previewImport` returns item counts too. `runImport` plans and writes items with `bulkSaveDocs('items', …)` after contacts and invoices (skip empty lists), and returns item counts and failures. Keep the safety snapshot as the first action.
4. After import (where 016 dispatches `getAllContacts()` and `getInvoices()`), also dispatch `ItemsActions.getAllItems()`.
5. `ImportDialog.jsx`: change the count line to `settings:backup:summaryWithItems` ("{{invoices}} invoices, {{clients}} clients and {{items}} items in this file. {{added}} are new. {{existing}} already exist."). Show invalid/duplicate item counts when not zero.
6. Tests (group D): update `backup.spec.js`, `backup-files.spec.js` (existing `serializeBackup` cases now pass `items: []`), `backupFlow.spec.js`.

**Verify**: `npx vitest run app/helpers/__tests__/backup.spec.js main/__tests__/backup-files.spec.js app/helpers/__tests__/backupFlow.spec.js` → all pass. Commit.

### Step 10: Strings

1. Create `i18n/en/items.json` with `header`, `count`, `new`, `search.{label,placeholder}`, `views.{active,archived}`, `columns.{name,unit,unitPrice,actions}`, `actions.{open,edit,archive,unarchive,delete}`, `dialog.{newTitle,editTitle,name,description,descriptionHint,unitPrice,priceHint,unit,save,cancel}`, `errors.{nameRequired,nameTooLong,nameTaken,price,unit}`, `empty.{title,description,noResults,clearSearch,noArchived}`, `units.{C62:"Unit",HUR:"Hour",DAY:"Day",MON:"Month",KGM:"Kilogram",MTR:"Metre",LS:"Lump sum"}`. Register it in `i18n/en/index.js` (`import items from './items.json'` and add `items` to the export).
2. `i18n/en/app.json`: `nav.items` "Items".
3. `i18n/en/messages.json`: `item.{saved:"Item saved",updated:"Item updated",archived:"Item archived",unarchived:"Item restored to active",deleted_one:"Item deleted",deleted_other:"{{count}} items deleted",deleteFailed:"The item could not be deleted",undo:"Undo",restored:"Item restored"}`.
4. `i18n/en/form.json`: `fields.items.{unit:"Unit",saveAsItem:"Save line {{n}} as item",noMatch:"No saved items match"}`.
5. `i18n/en/settings.json`: `backup.summaryWithItems`. Other locales fall back to English. Do not machine-translate.

**Verify**: `node -e "for (const f of ['items','app','messages','form','settings']) JSON.parse(require('fs').readFileSync('i18n/en/'+f+'.json','utf8'));console.log('ok')"` → `ok`. With the app running, no raw key such as `items:header` is visible.

### Step 11: Final checks

1. `npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-019-after && sh scripts/pdf-compare.sh /tmp/manta-pdf-019-before /tmp/manta-pdf-019-after` → no differences.
2. `npm test`, `npm run lint`, `npm run test:e2e` → exit 0 (this plan does not change e2e tests).
3. Manual smoke list (Test plan) on `/tmp/manta-profile-copy`, light and dark mode. Screenshots of the Items page, the dialog and the open autocomplete, if possible.
4. Commit.

**Verify**: all commands exit 0; smoke list done.

## Test plan

**A. `app/helpers/__tests__/items.spec.js`** (new)
- `getUnitCode`: `undefined` → `C62`; `'HUR'` → `HUR`; `'XYZ'` (valid shape, unknown) → `XYZ`; `'hour'`, `''`, `42` → `C62`.
- `getItemErrors`: empty and whitespace name; 121-character name; price `''` and `'abc'`; price `'-5'` is valid; duplicate name with different case and spaces among active items → `nameTaken`; unarchive with an active namesake fails without changing either document; same name as an archived item → valid; editing itself (`selfId`) → valid; bad unit `'h'`.
- `buildItem`: create sets string `_id`, `taxRateId: null`, `archived: false`, `created_at: now`, numeric `unitPrice`, trimmed text; edit keeps `_id`, `_rev`, `created_at`, `archived`, `taxRateId` and an unknown key.
- `applyItemToRow`: keeps `row.id`; empty quantity → 1; quantity 3 kept; `subtotal` is a number (`80 * 3 = 240`); empty description → name; `unitCode` copied; item without `unitCode` → `C62`; input row object is not changed (`Object.freeze`).
- `rowToItemValues`: multi-line text → first line as name, full text as description; 100-character line → 80-character name; short text → description `''`; `price: ''` → `''`; missing `unitCode` → `C62`.
- `searchItems`: empty query → `[]`; archived excluded; `cafe` finds `Café`; two terms are AND; name-prefix match ranks above description match; `limit` respected.
- `filterItems`/`countItems`: active vs archived views; query on unit code.

**B. Redux** (new)
- `ItemsReducer.spec.js`: each of the 5 actions replaces state with the payload; `getActiveItems` excludes archived.
- `ItemsMW.spec.js`: `ITEM_GET_ALL` reads `'items'` (never `'contacts'`); `ITEM_SAVE` success → `next` with the list, resolves `true`; `saveDoc` rejects → warning, resolves `false`, `next` not called with `ITEM_SAVE`; `ITEM_UPDATE` uses `meta.messageKey` in the notification; `ITEM_DELETE` with one id → `removeDocs('items', [id])`, then call the `actionProps.onClick` given to `toast.add` → `dispatch` gets `restoreItems(removed)`; `ITEM_RESTORE` → `restoreDocs('items', docs)`.
- `pouchDB.spec.js`: items round trip in its own database; unknown name rejects.

**C. `form.spec.js`** (additions): `unitCode` survives `pickInvoiceFields`; a row with only `unitCode` is blank and dropped.

**D. Backup** (additions)
- `backup.spec.js`: version 1 file without `items` → ok, `items: []`; version 2 with items → ok; `items: {}` → `invalid-format`; version 3 → `newer-version`; item without `name` counted in `invalid.items`; duplicate item `_id` counted; item `_rev` and `_deleted` stripped; round trip `parseBackup(JSON.stringify(buildBackup(x)))` keeps items without `_rev`.
- `backup-files.spec.js`: `serializeBackup` output contains `items`; throws when `items` is not an array.
- `backupFlow.spec.js`: skip mode writes only new items with `bulkSaveDocs('items', …)`; a rejected snapshot still means no `bulkSaveDocs` call at all (the 016 safety test must also cover items).

Add a focused integration test for the app-owned autocomplete callbacks: a mouse pick and ArrowDown + Enter retain the selected price/unit without adding a row; IME Enter does not add a row. This verifies row state, not the Base UI popup markup. No tests for table layout, icons or i18n copy.

**Manual smoke** (profile copy, light and dark mode):
1. Old invoices open and print as before. Their rows show unit "Unit".
2. Items page: create, edit, duplicate-name error, archive/unarchive, delete + Undo, search, empty states, restart keeps data.
3. Editor: type 2 letters of an item name → popup shows matches with price and unit; ArrowDown + Enter fills description, price, unit, quantity 1 and amount, and does NOT add a new row; Enter with the popup closed adds a row (old behavior); Escape closes the popup; mouse click picks too. An archived item does not show.
4. Type a new line, click "Save as item" → dialog is prefilled → Save → the item appears in autocomplete on the next row.
5. Save the invoice, reopen it → unit and text are kept. Change the item price → the saved invoice does not change.
6. Backup: export in profile A (`node -e "const b=require('/tmp/manta-backup.json');console.log(b.version,b.items.length)"` → `2 <n>`); import into an empty profile B → items appear; import an old version 1 backup file → works, items unchanged.
7. Keyboard only: Tab reaches the unit select and the "Save as item" button; targets are ≥ 24 px.

## Done criteria

- [ ] `grep -n "new PouchDB('items', { adapter: 'idb' })" app/helpers/pouchDB.js` → 1 line
- [ ] `grep -c "ITEM_" app/constants/actions.jsx` → `5`
- [ ] `grep -n "items: ItemsReducer" app/reducers/index.jsx && grep -n "ItemsMW" app/store/index.jsx` → hits
- [ ] `grep -n "BACKUP_VERSION = 2" app/helpers/backup.js && grep -n "items" main/backup-files.js` → hits
- [ ] `git diff --stat <start-commit>..HEAD -- preview/templates main/save-pdf.js` → no output; PDF compare (Step 11) shows no difference
- [ ] `npx vitest run app/helpers/__tests__/items.spec.js app/middlewares/__tests__/ItemsMW.spec.js app/reducers/__tests__/ItemsReducer.spec.js app/helpers/__tests__/backup.spec.js main/__tests__/backup-files.spec.js app/helpers/__tests__/backupFlow.spec.js` → all pass
- [ ] `npm test`, `npm run lint`, `npm run test:e2e` → exit 0
- [ ] Manual smoke list done in light and dark mode
- [ ] `git log --format=%B -6 | grep -ci "co-authored\|generated with"` → `0`
- [ ] `plans/README.md` row for 019 updated (unless a reviewer maintains the index)

## STOP conditions

- A precondition from 013–016 fails (no toast, no `removeDocs`/`restoreDocs`, no 015 editor files, no 016 backup helpers).
- `@base-ui/react` has no `Autocomplete` export, or `Autocomplete.Item` `onClick` does not fire on Enter. Report it. Do not switch to `Combobox` (it forces a fixed value and breaks free text).
- 015 `pickInvoiceFields` rebuilds rows from a fixed key list, so `unitCode` would be lost. Report; do not rewrite 015 logic beyond adding the key.
- Existing invoices or contacts do not show after Step 3 (data visibility regression), or `setDB` changes break the `invoices` migration queue.
- The PDF compare in Step 11 shows any difference.
- Any manual check would need the real user-data folder.
- During a backup round trip, any invoice, client or item count goes down in the target profile.

## Maintenance notes

- **Backup version** is now 2 (`app/helpers/backup.js`). Plans 021, 022 and 023 advance it to 3, 4 and 5; plan 024 (recurring) adds `recurring` and advances it to 6 the same way: optional key on read, explicit key in `serializeBackup`, item counts in `ImportDialog`.
- **`serializeBackup` writes an explicit field list.** Every new database must be added there, or exports silently drop it. Reviewers: check this first.
- **`unitCode` on rows**: plan 025 maps it to BT-130 (`@unitCode`). Plan 021 adds `taxRateId` handling: 021 resolves `item.taxRateId` to a rate and applies a full rate snapshot after `applyItemToRow`; it must not copy a rate id without its rate/category/reason snapshot. It also adds a tax select to `ItemEditorDialog`. Until then `taxRateId` stays `null`.
- **Templates do not print the unit.** When 021/025 print it, regenerate the 018 PDF baseline in that plan and say so.
- **Unit list** is fixed and small on purpose. To add a code, add it to `UNIT_CODES` and `items:units.*`. Unknown codes from files stay as raw codes (Decision 2).
- **No item id on rows** (Decision 3). If a later plan needs usage counts, add an optional `itemId` to rows then; old rows will not have it.
- **`setDB` now rejects unknown names.** Before this plan, a wrong name hung forever. New databases (024 `recurring`) must add a branch.
- Reviewers: check the `idb` adapter on the new database, that delete uses `removeDocs`/`restoreDocs`, that Enter in an open popup does not add a row, that `preview/templates/**` is unchanged, and that no commit has AI attribution.
