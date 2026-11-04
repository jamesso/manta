# Plan 016: Add client editing and a client detail view, rebuild Settings with a sub-nav and instant apply, and add JSON backup/restore and CSV export

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- app/containers/Contacts.jsx app/components/contacts app/actions/contacts.jsx app/reducers/ContactsReducer.jsx app/middlewares/ContactsMW.jsx app/containers/Settings.jsx app/components/settings app/actions/settings.jsx app/reducers/SettingsReducer.jsx app/middlewares/SettingsMW.jsx app/constants/actions.jsx app/helpers/pouchDB.js app/helpers/__mocks__/pouchDB.js main/select-export-directory.js preload/index.js app.js vitest.setup.js i18n/en/settings.json i18n/en/contacts.json i18n/en/messages.json`
> Earlier plans change some of these files on purpose:
> 012 adds the temporary theme select to `app/components/settings/General.jsx`, the `set-theme` channel to `preload/index.js`, and `nativeTheme` code plus the `general.theme` default to `app.js`.
> 013 replaces `openDialog()` in `app/containers/Contacts.jsx` and `app/components/settings/Invoice.jsx`, turns notifications into toasts, and may restyle `Contacts.jsx` and `Settings.jsx`.
> 014 adds helpers to `app/helpers/invoice.js`, the `removeDocs` / `restoreDocs` helpers in `app/helpers/pouchDB.js` (delete at once, re-save on Undo), and the data-table pattern.
> 015 adds `invoice.numbering` to `app.js` and to the invoice settings UI.
> Read the live code of these files before you edit them. If a difference is NOT explained by 012–015, STOP.
>
> **Rule**: do NOT add `Co-authored-by` trailers or any AI/tool attribution to commits. Pass this rule to any subagent.

## Execution checks added by review (2026-11-01)

- Record the execution start commit and starting changes. Scope checks compare this plan's changes with that baseline, not with a clean-tree requirement. Earlier plans can change the listed files; check the required behavior before treating expected changes as drift.
- Before a live app check, use Jean `get_run_environments`; use its running environment or `start_run_environment`. Do not start a second dev server by hand. Confirm that the environment uses a disposable `MANTA_USER_DATA` profile. Record the exact URL or Electron entry and profile used. If no Run command is configured, report that limit.
- Use the narrow tests listed for each changed behavior. Reuse passing results when the covered code has not changed. Run broad tests once at the final integration gate for shared state, persistence or IPC changes. Visual checks require the running app; do not replace them with markup assertions.
- Do not copy a profile while Manta is running. Close it first. Use a new temporary destination, or confirm the existing destination is disposable; repeated `cp -R` into an existing folder can create a nested profile.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (backup import writes user data)
- **Depends on**: plans/015-*.md (and transitively 012–014). Run after 015 so there is one editor/settings contract to maintain.
- **Category**: ui-redesign
- **Planned at**: commit `3e89104`, 2026-11-01

## Why this matters

- Users cannot edit a client. A typo in an email address stays forever. A user can create a client only by saving an invoice.
- The Clients page shows a plain list. It has no search, no invoice count and no outstanding amount.
- Settings has three tabs and one global Save button. A user who changes the language and switches tabs without saving loses the change. Also, the save validation needs a tax amount `> 0` (`validateTax(true, …)` in `SettingsMW.jsx:36`). The default tax amount is `0` (`app.js`, `invoice.tax.amount: 0`). So on a fresh install, every Save shows the warning "Invalid tax" until the user enters a tax rate. This plan fixes that bug.
- All data is in local IndexedDB and in one settings file. The app has no backup, no restore and no export. One damaged profile loses all invoices.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current` | current branch; record its name, do not switch |
| 012 done (Tailwind, shadcn, theme) | `test -f components.json && test -f ui/styles/globals.css && grep -rln "set-theme" preload main app.js` | file list contains `preload/index.js` |
| 013 done (dialog, toast) | `test -f ui/lib/dialog.js && grep -rln "toast" ui/lib ui/components/ui` | at least 1 file |
| 014 done (status, table, undoable delete) | `grep -n "getDisplayStatus" app/helpers/invoice.js && npm ls @tanstack/react-table` | export line; `@tanstack/react-table@9.x` |
| 014 undo-delete helpers | `grep -n "removeDocs\|restoreDocs\|UNDO_TIMEOUT_MS" app/helpers/pouchDB.js app/middlewares/InvoicesMW.jsx` | exports in `pouchDB.js`; use in the `INVOICE_DELETE` and `INVOICE_RESTORE` blocks of `InvoicesMW.jsx` |
| 014 invoice detail | `grep -rn "detail" app/containers/Invoices.jsx \| head` | write down how the detail sheet opens (local state or Redux) |
| 015 numbering (required) | `grep -n "numbering" app.js` | numbering exists; otherwise finish 015 first. |
| shadcn components | `ls ui/components/ui` | need: `table sheet dialog alert-dialog dropdown-menu input field select switch toggle-group checkbox radio-group empty badge button label`. Add the missing ones with `npx shadcn@latest add <name>`. |
| Unit tests | `npm test` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Data copy | `ls /tmp/manta-profile-copy` | exists. If not: `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy` |

## Current state (HEAD `3e89104`)

**Contacts: there is a save path but no update path.** `app/constants/actions.jsx:35-37` defines only `CONTACT_GET_ALL`, `CONTACT_DELETE`, `CONTACT_SAVE`. `app/actions/contacts.jsx:8-11`:
```js
export const saveContact = createAction(
  ACTION_TYPES.CONTACT_SAVE,
  invoiceData => invoiceData
);
```
`app/middlewares/ContactsMW.jsx:34-40` saves with `saveDoc('contacts', action.payload)`, then calls `next({ type: CONTACT_SAVE, payload: newDocs })` (the full list), then dispatches `UI_NOTIFICATION_NEW` with `messages:contact:saved`. The only caller is `app/middlewares/FormMW.jsx:39-42` (a new recipient on invoice save). `app/reducers/ContactsReducer.jsx:6-10` replaces the state with `action.payload` for get-all, save and delete.

**pouchDB helpers** (`app/helpers/pouchDB.js`): DB names `'contacts'` and `'invoices'` (lines 7-8, adapter `idb`). `getAllDocs(dbName)` (140), `saveDoc(dbName, doc)` (168, `db.put`), `deleteDoc(dbName, id)` (174), `updateDoc(dbName, doc)` (180, `db.put`, needs `_rev`). Each one resolves to the full doc list. There is no bulk write. The mock is in `app/helpers/__mocks__/pouchDB.js` (exports line 92).

**Contact fields** (`app/components/form/RecipientForm.jsx:13`): `fullname` (required), `company`, `email` (required), `phone`. `app/helpers/form.js:48-57`: a new recipient gets `_id: crypto.randomUUID()` and `created_at`. A selected contact is copied as is (with its `_rev`) into `invoice.recipient`. So `invoice.recipient._id === contact._id`. Invoices keep a **copy** of the recipient.

**Email rule** (`app/helpers/form.js:116-118`): `/^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/`.

**Clients page** (`app/containers/Contacts.jsx`): class component, columns Contact/Email/Phone/Actions (lines 93-103). Delete asks for confirmation through `openDialog` (lines 54-66). 013 may have replaced this. New invoice: `dispatch(InvoicesActions.newInvoiceFromContact(contact))` (line 51).

**Settings container** (`app/containers/Settings.jsx`): tabs Profile/Invoice/General (lines 82-104). A global Save button shows when `!this.settingsSaved() && this.state.canSave` (line 73). `setSavable` (lines 60-62) goes to all three tabs, but no tab calls it (`grep -rn setSavable app` finds only `Settings.jsx`).

**Settings middleware** (`app/middlewares/SettingsMW.jsx:34-69`), case `SETTINGS_SAVE`:
```js
if (!validateTax(true, action.payload.invoice.tax)) break;
if (!validateCurrency(true, action.payload.invoice.currency)) break;
...
if (profile !== newProfile) { ipc.send('change-preview-window-profile', newProfile); }
...
if (language !== newLang) { i18n.changeLanguage(newLang); ipc.send('change-preview-window-language', newLang); }
appConfig.set('profile', …); appConfig.set('invoice', …); appConfig.set('general', …);
sounds.preload();
```
`validateTax`/`validateCurrency` (`app/helpers/form.js`) open dialogs. Tax fails when `!amount || amount <= 0`. Fraction fails when `< 0`.

**Settings reducer** (`app/reducers/SettingsReducer.jsx:7-17`): `SETTINGS_UPDATE` sets `current[setting] = data`. `SETTINGS_SAVE` sets `saved`. `getDateFormat` reads `settings.saved.invoice.dateFormat` (line 36-39).

**Settings sections today**:
- `Profile.jsx`: logo (`_partials/profile/Logo.jsx`), fullname, company, address, email, phone, website.
- `Invoice.jsx` + `_partials/invoice/`: `Fields.jsx` (required_fields switches: invoiceID, dueDate, currency, discount, tax, note), `Tax.jsx` (tin, amount, method), `Currency.jsx` (code, separator, placement, fraction), `Other.jsx` (exportDir with folder button → `ipc.send('select-export-directory')`, template, dateFormat).
- `General.jsx`: sound (`default`/`cs`), muted, language (9 options, lines 69-95), previewPDF. 012 adds theme.

**Settings defaults** (`app.js`, `setInitialValues`): `general: { language:'en', sound:'default', muted:false, previewPDF:true, … }`. `invoice: { exportDir: os.homedir(), template:'default', dateFormat:'MM/DD/YYYY', tax:{ tin, method:'default', amount:0 }, currency:{ code:'USD', placement:'before', separator:'commaDot', fraction:2 }, required_fields:{…all false} }`.

**Main-process dialog pattern** (`main/select-export-directory.js:9-14`):
```js
ipc.on('select-export-directory', async event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
```
The invoke pattern exists in `main/logo.js:5` (`ipcMain.handle('process-logo', …)`) and in `preload/index.js:79` (`processLogo: filePath => ipcRenderer.invoke('process-logo', filePath)`). Main files load in `app.js` `loadMainProcessFiles()` (lines 362-371).

**Preload** (`preload/index.js:3-48`): `CHANNELS` set. `ipc` has `send`, `on`, `removeAllListeners` only (lines 55-70). It has no `invoke`. `check-for-updates` and `reveal-file` are already in the set. The test mock is in `vitest.setup.js:6-16`.

**Updates**: `main/updater.js:19` listens to `check-for-updates`. `app/components/layout/AppUpdate.jsx` shows the results. No update setting is stored (migration 3 in `app.js` removed `checkUpdate`).

**Tests that exist**: `app/middlewares/__tests__/SettingsMW.spec.js` (tests `SETTINGS_SAVE`), `app/reducers/__tests__/SettingsReducer.spec.js`, `app/actions/__tests__/settings.spec.js`, `app/middlewares/__tests__/ContactsMW.spec.js`, `app/reducers/__tests__/ContactsReducer.spec.js`, `app/actions/__tests__/contacts.spec.js`, `app/helpers/__tests__/pouchDB.spec.js` (real PouchDB on `fake-indexeddb`). Markup-only tests: `app/components/contacts/__tests__/Contact.spec.jsx`, `app/components/settings/__tests__/General.spec.js`. Placeholders: `app/containers/__tests__/Contacts.spec.js`, `app/containers/__tests__/Settings.spec.js`.

## Reference facts (recheck versions and APIs at execution)

- Base UI Toast: `add({ id, title, description, timeout, … })`. If a toast with the same `id` exists, it is updated in place and its timer restarts. Default `limit` is 3. Source: https://base-ui.com/react/components/toast
- Electron `dialog.showSaveDialog(win, { defaultPath, filters })` resolves to `{ canceled, filePath }`. `showOpenDialog(win, { properties:['openFile'], filters })` resolves to `{ canceled, filePaths }`. Filter extensions have no dot. Source: https://www.electronjs.org/docs/latest/api/dialog
- `ipcMain.handle` / `ipcRenderer.invoke` is the request/response pattern: https://www.electronjs.org/docs/latest/tutorial/ipc ; `app.getPath('userData' | 'documents')`, `app.getVersion()`: https://www.electronjs.org/docs/latest/api/app
- PouchDB `put` without the current `_rev` on an existing doc gives a 409 conflict. `bulkDocs(docs)` returns one result per doc (`{ok,id,rev}` or `{error,status,name}`) and does not throw for single conflicts. Fields that start with `_` are reserved (`_deleted: true` deletes the doc). Source: https://pouchdb.com/api.html#batch_create , https://pouchdb.com/api.html#create_document
- CSV format: fields with `,` `"` CR or LF go in double quotes. A `"` inside a field becomes `""`. Lines end with CRLF. Source: https://www.rfc-editor.org/rfc/rfc4180
- CSV/formula injection: text cells that start with `=`, `+`, `-`, `@`, tab or CR must get a leading `'`. Source: https://owasp.org/www-community/attacks/CSV_Injection
- lodash `debounce` returns a function with `.flush()` and `.cancel()`: https://lodash.com/docs/4.17.15#debounce (lodash 4.18 is already a dependency).
- shadcn Base UI components: Sheet https://ui.shadcn.com/docs/components/base/sheet , Toggle Group https://ui.shadcn.com/docs/components/base/toggle-group , Field https://ui.shadcn.com/docs/components/base/field , Data table (TanStack Table v9, 9.3.1) https://ui.shadcn.com/docs/components/base/data-table , list: https://ui.shadcn.com/docs/components
- UX sources: undo is better than confirmation https://www.nngroup.com/articles/confirmation-dialog/ ; data tables https://www.nngroup.com/articles/data-tables/ ; empty states https://www.nngroup.com/articles/empty-state-interface-design/ ; vertical nav https://www.nngroup.com/articles/vertical-nav/
- Confirm versions before you install: `npm view @tanstack/react-table version`, `npm view lucide-react version`.

## Commands you will need

```bash
npx vitest run <path/to/file.spec.js>   # one spec
npm test                                 # all unit tests
npm run lint
npm run build && MANTA_USER_DATA=/tmp/manta-profile-copy npm start   # manual smoke on a COPY
npm run test:e2e
npx shadcn@latest add <component>        # only if a component is missing
```

## Scope

**In scope**
- Clients page: data table, search, sort by name, columns, row actions, delete with undo, empty states, "New client".
- Client editor dialog (create and edit). New action `CONTACT_UPDATE`.
- Client detail Sheet: contact info, outstanding per currency, invoice history.
- Settings page with a left sub-nav and 7 sections. Instant apply. Inline validation. No global Save.
- JSON backup export, JSON import (merge, never delete), automatic safety backup before import, CSV export of invoices.

**Out of scope**: saved items catalog, tax IDs per client, dashboard (017), preview window restyle (018), restyle of the logo drop zone (`_partials/profile/Logo.jsx`, `TargetBox.jsx` stay as they are; 018 removes their styled-components).

**Files to create**
- `app/helpers/clients.js`, `app/helpers/__tests__/clients.spec.js`
- `app/helpers/settings.js`, `app/helpers/__tests__/settings.spec.js`
- `app/helpers/backup.js`, `app/helpers/__tests__/backup.spec.js`
- `app/helpers/csv.js`, `app/helpers/__tests__/csv.spec.js`
- `app/helpers/backupFlow.js`, `app/helpers/__tests__/backupFlow.spec.js`
- `main/backup-files.js`, `main/__tests__/backup-files.spec.js`, `main/backup.js`
- `app/components/contacts/ClientEditorDialog.jsx`, `ClientDetailSheet.jsx`, `ClientsTable.jsx`
- `app/components/settings/SettingsNav.jsx`, `app/components/settings/useDebouncedSave.js`
- `app/components/settings/sections/BusinessProfile.jsx`, `InvoiceDefaults.jsx`, `Appearance.jsx`, `LanguageRegion.jsx`, `ExportBackup.jsx`, `ImportDialog.jsx`, `Updates.jsx`, `Sounds.jsx`

**Files to change**: `app/constants/actions.jsx`, `app/actions/contacts.jsx`, `app/reducers/ContactsReducer.jsx`, `app/middlewares/ContactsMW.jsx`, `app/containers/Contacts.jsx`, `app/containers/Settings.jsx`, `app/actions/settings.jsx`, `app/reducers/SettingsReducer.jsx`, `app/middlewares/SettingsMW.jsx`, `app/helpers/pouchDB.js`, `app/helpers/__mocks__/pouchDB.js`, `preload/index.js`, `vitest.setup.js`, `app.js` (one `require` line), `i18n/en/contacts.json`, `i18n/en/settings.json`, `i18n/en/messages.json`, and the spec files named in the steps.

**Files to delete**: `app/components/contacts/Contact.jsx`, `app/components/contacts/__tests__/Contact.spec.jsx`, `app/components/settings/General.jsx`, `Invoice.jsx`, `Profile.jsx`, `app/components/settings/_partials/invoice/` (all 4 files), `app/components/settings/__tests__/General.spec.js`.

## Git workflow

Work on the current branch. Do not switch branches or create a worktree. Make one commit per step group: Steps 1–5 "Add client editing and a client detail sheet", Steps 6–8 "Apply settings instantly from a sectioned Settings page", Steps 9–13 "Add JSON backup, restore and CSV export". Short imperative subject, no prefix, no attribution. Do not push.

## Decisions (fixed by this plan)

1. **Client matching**: an invoice belongs to a client when `invoice.recipient._id === contact._id`. Editing a client does NOT change existing invoices. The editor and the detail sheet show this hint: "Changes apply to new invoices. Existing invoices keep the details they were created with."
2. **Outstanding** = sum of `grandTotal` for invoices whose `getDisplayStatus` is `pending` or `overdue`, grouped by `currency.code`. Never add different currencies together.
3. **`_rev` is stripped on export.** A revision is local to one database. On overwrite, the import reads the current local `_rev`. All other top-level keys that start with `_` (except `_id`) are also stripped on export AND on import. This stops a file with `_deleted: true` from deleting data.
4. **Conflict rule**: `_id` already exists → **skip** (default) or **overwrite** (user choice in the summary dialog). Import never deletes. A file with a newer `version` than the app knows is refused.
5. **Safety backup**: before any import write, the app writes a full backup to `<userData>/backups/manta-auto-<UTC timestamp>.json`. It keeps the newest 10 automatic files and never touches other files. If this write fails, the import stops and writes nothing.
6. **Settings import** is optional (checkbox, default off). It imports `profile`, `invoice`, `general` only. It keeps the local `invoice.exportDir` (the path may not exist on this computer). `invoice.numbering.next` becomes `max(local, imported)`, so invoice numbers are never reused. A section that fails validation is not imported, and the result toast names it.
7. **Validation is pure**: `getSettingsErrors` does not open dialogs. The default tax amount may be `0` (fix for the bug in "Why this matters").
8. **Saved feedback**: each persisted change shows one toast with the fixed id `settings-saved`. Repeated saves update the same toast, so toasts do not stack.
9. **CSV**: columns and header row `number,client,issued,due,status,currency,subtotal,tax,discount,total`. The header names are fixed English identifiers for spreadsheets, not UI text. Dates are `YYYY-MM-DD`. Amounts use a dot decimal, no thousands separator, no symbol, `currency.fraction` decimals. The file starts with a UTF-8 BOM, so Excel opens it correctly.

## Steps

### Step 1: Add `CONTACT_UPDATE`

1. In `app/constants/actions.jsx`, add `export const CONTACT_UPDATE = 'CONTACT_UPDATE';` after `CONTACT_SAVE`.
2. In `app/actions/contacts.jsx`, add `export const updateContact = createAction(ACTION_TYPES.CONTACT_UPDATE, contact => contact);`.
3. In `app/reducers/ContactsReducer.jsx`, add `Actions.updateContact` to the `combineActions(...)` list.
4. In `app/middlewares/ContactsMW.jsx`, add a `CONTACT_UPDATE` case using `updateDoc('contacts', action.payload)` and `messages:contact:updated`. Both `CONTACT_SAVE` and `CONTACT_UPDATE` must return their persistence promise and resolve `true` after updating Redux, or `false` after the warning on failure. Import `updateDoc`. Do not swallow the return value.
5. Add `"updated": "Client updated"` under `contact` in `i18n/en/messages.json`. Change `saved` to `"Client saved"` and `deleted` to `"Client deleted"`.
6. Add tests: in `ContactsMW.spec.js`, a `describe('CONTACT_UPDATE')` with 2 tests: (a) `updateDoc` gets `('contacts', doc)` and `next` gets `{ type: CONTACT_UPDATE, payload: <list from updateDoc> }`; (b) a rejected `updateDoc` (409 conflict) calls `next` with a `UI_NOTIFICATION_NEW` warning and does not throw. In `ContactsReducer.spec.js`, one test: `CONTACT_UPDATE` replaces the state with the payload list.

**Verify**: `npx vitest run app/middlewares/__tests__/ContactsMW.spec.js app/reducers/__tests__/ContactsReducer.spec.js` → all pass.

### Step 2: Client helpers (pure)

Create `app/helpers/clients.js` with:
- `EMAIL_REGEX` (copy the regex from `form.js:116-117`).
- `getContactErrors(data)` → object. `fullname` trimmed empty → `{ fullname: 'contacts:errors:fullnameRequired' }`. `email` empty → `'contacts:errors:emailRequired'`. Email does not match → `'contacts:errors:emailInvalid'`. Valid → `{}`.
- `buildContact(data, existing, now)` → trimmed `fullname, company, email, phone`. With `existing`: keep `_id`, `_rev`, `created_at` and any other existing fields. Without it: `_id: crypto.randomUUID()`, `created_at: now`.
- `summarizeClients(contacts, invoices, now)` → `Map<contactId, { invoiceCount, outstanding: { [code]: number }, invoices: [] }>`. Use `getDisplayStatus(invoice, now)` from `app/helpers/invoice.js`. Ignore invoices whose `recipient._id` matches no contact. Sort each `invoices` list by `issuedAt ?? created_at`, newest first. Use `invoice.currency?.code ?? 'USD'` when the code is missing.
- `matchesClientQuery(contact, query)` → true when the trimmed, lower-case query is in `fullname`, `company`, `email` or `phone`. Also compare phone digits only, so `5551234` matches `+1 (555) 123-4`.

Create `app/helpers/__tests__/clients.spec.js`:
- `summarizeClients`: two currencies stay separate; `paid`, `draft`, `cancelled`, `refunded` are excluded; an old invoice with no `status` counts as outstanding (014 maps it to `pending`); a past-due pending invoice counts; an invoice for an unknown recipient is ignored; `invoiceCount` counts all statuses.
- `getContactErrors`: missing name, missing email, bad email, valid.
- `buildContact`: edit keeps `_rev` and `created_at`; create sets a new `_id`.
- `matchesClientQuery`: company match, case-insensitive email, phone digits.

**Verify**: `npx vitest run app/helpers/__tests__/clients.spec.js` → all pass.

### Step 3: Clients table

1. Rewrite `app/containers/Contacts.jsx` as a function component. Keep the file name and the default export, so the app shell does not change. Read `contacts` (`getContacts`) and `invoices` (`getInvoices` from `app/reducers/InvoicesReducer.jsx:21`) with `useSelector`. Compute `summarizeClients` in `useMemo`.
2. Create `app/components/contacts/ClientsTable.jsx`. Copy the table pattern from the 014 invoices table (the same TanStack v9 setup and the same shadcn `Table` markup). Columns:
   - **Name / Company**: `fullname` in bold, `company` below in muted text. Sortable. Default sort is ascending, with `a.localeCompare(b, undefined, { sensitivity: 'base' })`.
   - **Email**, **Phone**.
   - **Invoices**: `invoiceCount`, right-aligned, `tabular-nums`.
   - **Outstanding**: one line per currency, formatted like the 014 list (reuse its money formatter; otherwise `formatNumber` from `helpers/formatNumber.js` with the code before or after the amount). Show `—` when the client has nothing outstanding.
   - **Actions**: a `DropdownMenu` trigger (lucide `MoreHorizontal`, `aria-label` = "Actions for {name}") with **New invoice**, **Edit**, **Delete**.
3. Search: an `Input` with a lucide `Search` icon above the table. Filter with `matchesClientQuery` (TanStack global filter or a plain `filter` before the table — follow 014).
4. A row click opens the detail sheet (Step 5). Menu clicks call `event.stopPropagation()`.
5. Delete: copy the 014 pattern from `InvoicesMW.jsx` (`INVOICE_DELETE` + `INVOICE_RESTORE`). Delete the contact at once with `removeDocs('contacts', ids)`, keep the deleted docs, and show a toast with an Undo action for `UNDO_TIMEOUT_MS`. Undo dispatches a new `CONTACT_RESTORE` action that calls `restoreDocs('contacts', docs)`. Add `CONTACT_RESTORE` to `app/constants/actions.jsx`, the contacts actions, `ContactsMW` and `ContactsReducer`, with a middleware test (delete then restore gives the contact back; a restore after a conflict skips it). Do not open a confirmation dialog. Remove the old `confirmed-delete-contact` listener.
6. Header: title `contacts:header` ("Clients") and a primary button **New client** (lucide `UserPlus`).
7. Empty states (shadcn `Empty`):
   - No contacts: title "No clients yet", text "Clients are saved when you create an invoice, or you can add one now.", button **New client**.
   - Search with no result: "No clients match "{query}"" and a **Clear search** button.
8. Delete `app/components/contacts/Contact.jsx` and its spec `__tests__/Contact.spec.jsx` (markup-only test). Keep the placeholder `app/containers/__tests__/Contacts.spec.js` only if it still imports a valid module.

**Verify**: `npm run build` → exit 0. `npx vitest run app/helpers/__tests__/clients.spec.js` → pass. `grep -rn "confirmed-delete-contact\|ion-" app/containers/Contacts.jsx app/components/contacts` → no output.

### Step 4: Client editor dialog

1. Create `app/components/contacts/ClientEditorDialog.jsx`. Props: `open`, `onOpenChange`, `contact` (null = create). Use shadcn `Dialog` and `Field` with `FieldLabel`, `Input`, `FieldError`. Fields: Full name *, Company, Email *, Phone. Inputs: `autoComplete="off"`, email `type="email"`, phone `type="tel"`.
2. On submit: `errors = getContactErrors(values)`. If there are errors, show them inline (`aria-invalid`, `FieldError`), focus the first invalid field, and do not close. Otherwise `buildContact(values, contact, Date.now())`. Await dispatch of `updateContact` (edit) or `saveContact` (create). Close only after confirmed persistence; keep the dialog and values on failure. Both middleware cases must return `true` on success and `false` on failure; add tests for these outcomes.
3. In edit mode, show the hint from Decision 1 under the title.
4. Wire it in `Contacts.jsx`: **New client** opens it with `contact = null`. The **Edit** row action and the sheet **Edit** button open it with the contact from the store. The store contact has the latest `_rev`.

**Verify**: manual. Build, then `MANTA_USER_DATA=/tmp/manta-profile-copy npm start`. Create a client with a bad email → inline error, dialog stays open. Fix it → the row appears. Edit the phone → the row updates and the toast says "Client updated". Restart the app → the change is still there.

### Step 5: Client detail sheet

1. Create `app/components/contacts/ClientDetailSheet.jsx` (shadcn `Sheet`, `side="right"`, width `sm:max-w-md`). Props: `contact`, `summary`, `open`, `onOpenChange`.
2. Content: name (SheetTitle), company (SheetDescription), email, phone, Outstanding per currency, the hint text from Decision 1, buttons **New invoice** (dispatch `newInvoiceFromContact(contact)`) and **Edit**.
3. Invoice history: a list of `summary.invoices`. Each item is a `<button>` with the number (`invoiceID` or the first 8 characters of `_id`), the issued date (`issuedAt ?? created_at`, formatted with `getDateFormat`), the 014 status badge, and the total. On click: open the 014 invoice detail the way you wrote down in Preconditions (for example, `changeActiveTab('invoices')` plus its open-detail action). If 014 keeps its sheet state local, render `InvoiceDetailSheet` in this page with a selected invoice id, as 017 does. A history click opens read-only details; it must not replace an in-progress invoice form.
4. No invoices → text "No invoices for this client yet."
5. Keep the selected contact as an id in state. Read the contact from the store on each render, so the sheet shows the edited data after Step 4. If the contact is deleted while the sheet is open, close the sheet.

**Verify**: manual on the data copy. A client with invoices in two currencies shows two outstanding lines. A click on a history row opens that invoice. Light and dark mode both readable. Keyboard: Tab reaches every row action; Esc closes the sheet. `npm test` → pass. Commit Steps 1–5.

### Step 6: Settings validation and instant-apply middleware

1. Create `app/helpers/settings.js`:
   - `getSettingsErrors(section, data)` → `{ [fieldPath]: i18nKey }`. Rules for `invoice`: `tax.amount` must be a finite number `>= 0` (`settings:errors:taxAmount`). `currency.fraction` must be an integer from 0 to 8 (`settings:errors:fraction`). If `data.numbering` exists (015): `next` integer `>= 1`, `padding` integer 0–12, `prefix` string of up to 20 characters. Other sections → `{}`.
   - `SETTINGS_SECTIONS = ['profile', 'invoice', 'general']`.
2. Rewrite `app/middlewares/SettingsMW.jsx`:
   - Keep `SETTINGS_GET_INITIAL` as it is.
   - New behavior for `SETTINGS_UPDATE` (payload `{ setting, data }`):
     1. If `setting` is not in `SETTINGS_SECTIONS`, call `next(action)` and return.
     2. `const errors = getSettingsErrors(setting, data)`. If not empty: return `{ ok: false, errors }`. Do not call `next` or `appConfig.set`.
     3. `const previous = appConfig.get(setting)`.
     4. `try { appConfig.set(setting, data); } catch (error) { return { ok: false, message: error.message }; }`. Do not call `next`, run side effects or show Saved after failure.
     5. Side effects. `profile` changed (deep compare with lodash `isEqual`) → `ipc.send('change-preview-window-profile', data)`. `general.language` changed → `i18n.changeLanguage(lang)` and `ipc.send('change-preview-window-language', lang)`. `general.sound` changed → `sounds.preload()`. `general.theme` changed → send the 012 theme channel (`grep -rn "set-theme" app` shows where 012 sends it today. Move that send here and remove it from the old component).
     6. `next(action)`.
     7. Dispatch the saved toast through the 013 toast path with `id: 'settings-saved'` and the text `messages:settings:saved` ("Saved").
     8. Return `{ ok: true }`.
   - Remove the `SETTINGS_SAVE` case and the `validateTax`/`validateCurrency` import. Keep those two functions in `form.js`: the invoice form still uses them.
3. `app/reducers/SettingsReducer.jsx`: `SETTINGS_UPDATE` sets both `current[setting]` and `saved[setting]`. Remove the `SETTINGS_SAVE` case. Keep the selectors (`getDateFormat` reads `saved`).
4. `app/actions/settings.jsx`: remove `saveSettings`. Remove `SETTINGS_SAVE` from `app/constants/actions.jsx`. Run `grep -rn "saveSettings\|SETTINGS_SAVE" app` → no output.
5. `i18n/en/messages.json`: `settings.saved` → `"Saved"`. Add `settings:errors` keys to `i18n/en/settings.json`: `taxAmount` "Enter a number of 0 or more", `fraction` "Enter a whole number from 0 to 8", `numberingNext` "Enter a whole number of 1 or more", `numberingPadding` "Enter a whole number from 0 to 12", `numberingPrefix` "Use 20 characters or fewer".
6. Tests:
   - `app/helpers/__tests__/settings.spec.js`: tax `0` valid (regression for the fresh-install bug); tax `-1`, `NaN` and `''` invalid; fraction `2.5` and `9` invalid; numbering rules (only when the field exists).
   - Rewrite `app/middlewares/__tests__/SettingsMW.spec.js` for `SETTINGS_UPDATE`: (a) valid `general` data → `window.manta.settings.set('general', data)` and `next(action)`; (b) invalid `invoice` data → no `set`, no `next`, the return value has `errors`; (c) a language change calls `i18n.changeLanguage` and sends `change-preview-window-language`; an unchanged language sends nothing; (d) a sound change calls `sounds.preload`. Remove the `SETTINGS_SAVE` tests and the empty `it('should save data')`. Do not mock `../../helpers/form` any more.
   - `SettingsReducer.spec.js`: `SETTINGS_UPDATE` updates `current` and `saved`. Remove the `SETTINGS_SAVE` test ("update saved settings"). `app/actions/__tests__/settings.spec.js`: remove the `saveSettings` test.

**Verify**: `npx vitest run app/helpers/__tests__/settings.spec.js app/middlewares/__tests__/SettingsMW.spec.js app/reducers/__tests__/SettingsReducer.spec.js app/actions/__tests__/settings.spec.js` → all pass.

### Step 7: Settings page shell and sub-nav

1. Create `app/components/settings/useDebouncedSave.js`: `useDebouncedSave(save, delay = 500)`. Create one stable lodash debounced function that reads the latest `save` callback from a ref. Keep local draft state and the persisted baseline captured when editing begins. Each input updates that local draft. At flush time, calculate the edited leaf paths between baseline and draft and apply only those paths to the latest stored section (`settings.get(section)`), then dispatch the complete rebased section. This preserves a numbering/theme change made while typing. Flush on blur and before section change; flush then cancel on unmount. Do not reset a dirty local draft on each prop change. Selects and switches use the same merge path immediately. Test two rapid field edits and a pending text edit followed by a palette theme change.
2. Each section gets `value` (its settings object) and `onSave(nextObject)`. `onSave` dispatches `updateSettings(section, nextObject)` and returns the middleware result. When the result has `errors`, the section shows them inline (`aria-invalid` + `FieldError`). The invalid value stays in the input and is not saved.
3. Create `app/components/settings/SettingsNav.jsx`: a vertical list of real `<button>` elements with lucide icons and visible labels. Use `aria-current="page"` on the active one. Items and icons: Business profile (`Building2`), Invoice defaults (`FileText`), Appearance (`Palette`), Language & region (`Globe`), Export & backup (`HardDriveDownload`), Updates (`RefreshCw`), Sounds (`Volume2`). Under `md`, show it as a `Select` above the content.
4. Rewrite `app/containers/Settings.jsx` as a function component: a two-column grid (`md:grid-cols-[14rem_1fr]`). The nav is on the start side and one section is on the end side. Keep the active section in `useState` (default `'profile'`). Remove the global Save button, `settingsSaved`, `setSavable`, `canSave` and the old `Tabs`. Render `null` until `currentSettings` exists.

**Verify**: `npm run build` → exit 0. `grep -rn "setSavable\|canSave\|saveSettings" app` → no output.

### Step 8: Settings sections

Create the files in `app/components/settings/sections/`. Use shadcn `Field`, `Input`, `Select`, `Switch`. Section title `h2` plus one line of description. Each section maps to the stored keys as follows:

| Section | Stored keys (section object) | Controls |
|---|---|---|
| BusinessProfile | `profile`: `logo, fullname, company, address, email, phone, website` | Existing `_partials/profile/Logo.jsx` (unchanged) + 6 text inputs (debounced) |
| InvoiceDefaults | `invoice`: `template`, `currency.{code,separator,placement,fraction}`, `tax.{tin,amount,method}`, `required_fields.*`, `numbering.*` (015 only) | Template select (`minimal`, `business`). Currency group (copy the options from `Currency.jsx`, including `sortCurrencies`). Tax group. "Fields shown on new invoices" = 6 switches. If 015 is DONE, move its numbering controls here unchanged (prefix, next, padding, with a preview like `INV-0042`). |
| Appearance | `general.theme` | `ToggleGroup` with one value: System (`Monitor`), Light (`Sun`), Dark (`Moon`). Each item has an icon and a visible label. Remove the 012 temporary select. |
| LanguageRegion | `general.language`, `invoice.dateFormat` | Language select (the 9 options from `General.jsx:69-95`, each label in its own language). Date format select (the 12 options from `Other.jsx:57-95`, each one shows today's date). The date format saves through `onSave` of the `invoice` section. |
| ExportBackup | `invoice.exportDir`, `general.previewPDF` | PDF folder: a read-only input + **Choose folder** button (`ipc.send('select-export-directory')`, listen to `confirmed-export-directory` / `no-access-directory` as `Invoice.jsx:26-46` does, using the 013 dialog API). "Open PDF after export" switch. Backup and CSV area (Step 12). |
| Updates | none | Text "Manta checks for updates when it starts." + **Check for updates** button → `ipc.send('check-for-updates')`. `AppUpdate.jsx` shows the result. |
| Sounds | `general.sound`, `general.muted` | Sound select (`default`, `cs` "Counter Strike") + "Mute sounds" switch. |

Rules:
- Always save the whole section object: `onSave({ ...value, currency: { ...value.currency, fraction: n } })`. Never save a partial object.
- Number inputs: parse with `Number(input)`. Check `input.trim() === ''` before conversion and use `NaN` for empty input; `Number('')` returns 0 and would otherwise save an unintended zero.
- Delete `General.jsx`, `Invoice.jsx`, `Profile.jsx`, `_partials/invoice/*` and `__tests__/General.spec.js` (markup-only test).
- Add the new UI strings to `i18n/en/settings.json` under `nav.*`, `sections.<name>.title`, `sections.<name>.description`, and the new field labels. Reuse existing keys where they fit.

**Verify**: `npm run build && npm test` → pass. Manual on the data copy, in light and dark mode:
1. Change the language → the UI changes at once and the "Saved" toast shows. Restart → the language is kept.
2. Type a company name, then switch section before 500 ms → restart → the name is saved (flush on unmount).
3. Set tax `0` → saved, no warning. Set tax `-5` → inline error, and `Settings` file is unchanged (`grep -o '"amount":[^,}]*' /tmp/manta-profile-copy/Settings`).
4. Toggle Light/Dark/System → all windows follow.
5. Flip 4 switches fast → only one toast is visible.
Commit Steps 6–8.

### Step 9: Backup and CSV helpers (pure)

Create `app/helpers/backup.js`:
```js
export const BACKUP_APP = 'Manta';
export const BACKUP_VERSION = 1;
export function sanitizeDoc(doc)          // shallow copy; drop top-level keys that start with '_' except '_id'
export function buildBackup({ settings, invoices, contacts })
  // → { app: BACKUP_APP, version: BACKUP_VERSION, settings, invoices: invoices.map(sanitizeDoc), contacts: contacts.map(sanitizeDoc) }
export function parseBackup(text)
  // → { ok: false, error: 'invalid-json' | 'wrong-app' | 'newer-version' | 'invalid-format' }
  // → { ok: true, backup: { appVersion, exportedAt, settings|null, invoices, contacts },
  //     invalid: { invoices: n, contacts: n }, duplicates: { invoices: n, contacts: n } }
export function planMerge(incomingDocs, existingDocs, mode /* 'skip' | 'overwrite' */)
  // → { toWrite, counts: { added, overwritten, skipped } }
export function mergeImportedSettings(current, incoming)
  // → { settings: { profile, invoice, general }, skippedSections: [] }
```
Rules for `parseBackup`:
- `JSON.parse` throws → `invalid-json`. The top level is not a plain object → `invalid-format`.
- `app !== 'Manta'` → `wrong-app`. `version` is not an integer `>= 1` → `invalid-format`. `version > BACKUP_VERSION` → `newer-version`.
- `invoices` or `contacts` is not an array → `invalid-format`. `settings` is optional; anything other than a plain object becomes `null`.
- A doc is valid when it is a plain object, `_id` is a non-empty string that does not start with `_`, and: invoices have `Array.isArray(rows)` and a `recipient` object; contacts have a string `fullname`. Count invalid docs and drop them.
- Same `_id` twice in one array → keep the first, count the rest as duplicates.
- Run `sanitizeDoc` on every valid doc. If a document has `_attachments`, reject with an unsupported-data error rather than silently removing attachment content. Apply the same check to export and safety snapshots; include a fixture test.

Rules for `planMerge`: an `_id` not in existing → add without `_rev`. An existing `_id` with `skip` → skipped. With `overwrite` → `{ ...doc, _rev: existing._rev }`.

Rules for `mergeImportedSettings`: for each of `profile`, `invoice`, `general`: missing or not an object → keep current. Merge as `{ ...current[s], ...incoming[s] }`. For `invoice`: always keep `current.invoice.exportDir`. If both have `numbering`, `next = Math.max(current.next, incoming.next)`. Then run `getSettingsErrors(s, merged)`. If there are errors → keep current and push `s` to `skippedSections`.

Create `app/helpers/csv.js`:
- `escapeCsvField(value, { text })`: `null`/`undefined` → `''`. When `text` is true and the value starts with `=`, `+`, `-`, `@`, `\t` or `\r`, add a leading `'`. Quote the value when it contains `,`, `"`, `\r` or `\n`, and double the inner `"`.
- `buildInvoicesCsv(invoices, now)`: BOM `﻿` + header + one line per invoice, CRLF line ends. `number` = `invoiceID || _id` (text). `client` = `recipient.fullname || recipient.company` (text). `issued` = `issuedAt ?? created_at` as `YYYY-MM-DD` in local time, matching the UI. `due` = the 014/015 due-date helper (`grep -n "export" app/helpers/invoice.js helpers/date.js`; do NOT call `calTermDate` directly — see Maintenance notes), empty when there is no due date. `status` = `getDisplayStatus(invoice, now)`. `currency` = `currency.code`. `subtotal`, `tax` (= `taxAmount`), `discount`, `total` (= `grandTotal`) from `getInvoiceValue(invoice)`, with `toFixed(currency.fraction ?? 2)`. A missing tax or discount gives `0`.
- Sort lines by issued date, oldest first.

Tests:
- `app/helpers/__tests__/backup.spec.js`: bad JSON; `app: 'Other'`; `version: 2` (newer); `version: '1'`; `invoices` missing; a doc with `_id: '_design/x'`; a doc with `_deleted: true` and `_rev` → the keys are stripped and the doc is kept; duplicate `_id`s counted; `planMerge` skip vs overwrite (overwrite uses the local `_rev`, never the file `_rev`); an empty file merges to zero writes; `mergeImportedSettings` keeps `exportDir`, keeps the larger `numbering.next`, skips an `invoice` section with `tax.amount: -1`; round trip `parseBackup(JSON.stringify(buildBackup(x)))` gives the same docs without `_rev`.
- `app/helpers/__tests__/csv.spec.js`: a comma, a quote and a newline in a client name; `=SUM(A1)` in a name gets `'`; a negative discount number is NOT prefixed; BOM and CRLF present; fraction 0 and fraction 3; old invoice with `created_at` only; overdue shown as `overdue`.

**Verify**: `npx vitest run app/helpers/__tests__/backup.spec.js app/helpers/__tests__/csv.spec.js` → all pass.

### Step 10: Bulk write in pouchDB

1. Add to `app/helpers/pouchDB.js`:
```js
// Write many docs. Never throws for single-doc conflicts; returns them in `failed`.
const bulkSaveDocs = (dbName, docs) =>
  setDB(dbName)
    .then(db => db.bulkDocs(docs))
    .then(results =>
      getAllDocs(dbName).then(allDocs => ({
        succeeded: results.filter(r => r.ok).map(r => r.id),
        failed: results.filter(r => r.error),
        allDocs,
      }))
    );
```
   Export it. Add `bulkSaveDocs: vi.fn(...)` to `app/helpers/__mocks__/pouchDB.js`. It resolves to `{ succeeded: [], failed: [], allDocs: [] }`. Preserve these fields when later plans add databases.
2. Add 2 tests to `app/helpers/__tests__/pouchDB.spec.js` (real PouchDB on fake-indexeddb): (a) a new doc is added and an existing doc with its current `_rev` is overwritten; (b) a doc with a stale `_rev` is returned in `failed`, and the stored doc is unchanged.

**Verify**: `npx vitest run app/helpers/__tests__/pouchDB.spec.js` → all pass.

### Step 11: Main-process IPC and preload

1. Create `main/backup-files.js` (CommonJS, pure, like `main/print-options.js`):
   - `MAX_IMPORT_BYTES = 100 * 1024 * 1024`.
   - `backupFileName(date)` → `manta-backup-YYYY-MM-DD.json` (local date).
   - `autoBackupFileName(date)` → `manta-auto-` + `date.toISOString().replace(/[-:.]/g, '')` + `.json` (for example `manta-auto-20261101T153012123Z.json`).
   - `autoBackupsToPrune(names, keep = 10)` → keep only names that match `/^manta-auto-\d{8}T\d{9}Z\.json$/`, sort them, and return all except the newest `keep`.
   - `serializeBackup(payload, appVersion, date)` → `JSON.stringify({ app: 'Manta', version: payload.version, appVersion, exportedAt: date.toISOString(), settings: payload.settings, invoices: payload.invoices, contacts: payload.contacts }, null, 2)`. Throw when `payload.app !== 'Manta'` or when `invoices`/`contacts` are not arrays.
2. Create `main/__tests__/backup-files.spec.js`: prune keeps the newest 10, ignores `manta-backup-2026-11-01.json` and `notes.txt`, returns `[]` for 10 or fewer; `serializeBackup` throws for a bad payload; `autoBackupFileName` sorts in time order.
3. Create `main/backup.js`. Use the `ipcMain.handle` pattern from `main/logo.js`. Check that each sender is the trusted main window and validate request types/size before opening dialogs or writing. Use a unique temporary filename with restrictive permissions, then rename after a complete write; remove it on failure. Do not accept a renderer-supplied destination path. Add tests for invalid senders/payloads and interrupted writes. Prune automatic snapshots only after the new snapshot exists.
   - `backup-export` (payload) → `showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), backupFileName(new Date())), filters: [{ name: 'Manta backup', extensions: ['json'] }] })`. Canceled → `{ canceled: true }`. Otherwise write `serializeBackup(payload, app.getVersion(), new Date())` → `{ canceled: false, filePath }`.
   - `backup-import` () → `showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Manta backup', extensions: ['json'] }] })`. Canceled → `{ canceled: true }`. If `stat.size > MAX_IMPORT_BYTES` → `{ canceled: false, error: 'too-large' }`. Otherwise `{ canceled: false, filePath, text }` (UTF-8). Main does not parse. The renderer validates (pure and tested).
   - `backup-snapshot` (payload) → `mkdir(<userData>/backups, { recursive: true })`, write `autoBackupFileName(new Date())`, prune with `autoBackupsToPrune(readdir)`. Return `{ filePath }`. Let errors reject.
   - `csv-export` ({ text, defaultName }) → throw if `text` is not a string. `showSaveDialog` with `defaultPath: path.join(app.getPath('documents'), path.basename(String(defaultName || 'manta-invoices.csv')))` and filter `csv`. Write the text → `{ canceled, filePath }`.
4. In `app.js` `loadMainProcessFiles()`, add `require('./main/backup');` after `require('./main/logo');`.
5. In `preload/index.js`: add `'backup-export'`, `'backup-import'`, `'backup-snapshot'`, `'csv-export'` to `CHANNELS`. If `ipc.invoke` does not exist, add `invoke: (channel, ...args) => { check(channel); return ipcRenderer.invoke(channel, ...args); },`. In `vitest.setup.js`, add `invoke: vi.fn()` to `window.manta.ipc`.

**Verify**: `npx vitest run main/__tests__/backup-files.spec.js` → pass. `npm run build` → exit 0. `grep -c "backup-\|csv-export" preload/index.js` → `4` or more.

### Step 12: Export & backup UI and import flow

1. Create `app/helpers/backupFlow.js` (no React; inject `ipc` and `settingsStore` for tests, default `window.manta.ipc` / `window.manta.settings`):
   - `collectBackup()` → `buildBackup({ settings: { profile, invoice, general from settingsStore.get }, invoices: await getAllDocs('invoices'), contacts: await getAllDocs('contacts') })`.
   - `exportBackup()` → `ipc.invoke('backup-export', await collectBackup())`.
   - `exportCsv(now)` → `ipc.invoke('csv-export', { text: buildInvoicesCsv(await getAllDocs('invoices'), now), defaultName: 'manta-invoices-YYYY-MM-DD.csv' })`.
   - `previewImport(backup)` → read current docs with `getAllDocs`, return the counts of `planMerge` for `skip` and for `overwrite`.
   - `runImport(backup, { mode, includeSettings })`:
     1. `const snapshot = await ipc.invoke('backup-snapshot', await collectBackup())`. If it rejects, rethrow. Nothing is written.
     2. Read current docs again (fresh `_rev`s). `planMerge` for invoices and contacts.
     3. `bulkSaveDocs('contacts', …)`, then `bulkSaveDocs('invoices', …)`. Skip empty lists. Keep per-database actual result ids and failures. If a later batch throws, stop further writes and return the safety snapshot path plus completed/failed outcomes; refresh both lists in `finally`. Import is not transactional. Compute added/overwritten counts only from successful ids, not planned counts.
     4. If `includeSettings && backup.settings`: `mergeImportedSettings(current, backup.settings)`, then return the merged sections. The caller dispatches `updateSettings(section, data)` for each one, so the side effects run.
     5. Return `{ snapshotPath: snapshot.filePath, counts, failed, settings, skippedSections }`. Include whole-batch failures in `failed`; never discard completed outcomes.
   - Tests must include contacts success followed by an invoice-batch rejection: refresh persisted lists, show partial results and retain `snapshotPath`. Test per-doc failures and failed settings apply as well.
   - Tests (`app/helpers/__tests__/backupFlow.spec.js`, pouchDB mocked): (a) if `backup-snapshot` rejects, `bulkSaveDocs` is never called; (b) `skip` mode with one existing and one new doc writes only the new doc; (c) `failed` results are returned, not thrown. Test (a) is the main safety test of this plan.
2. In `ExportBackup.jsx`, add a "Backup" group:
   - **Export backup…** (lucide `Download`) → `exportBackup()`. Success → toast "Backup saved" with an action **Show file** (`ipc.send('reveal-file', filePath)`). Canceled → nothing. Error → error toast with the message.
   - **Import backup…** (lucide `Upload`) → `ipc.invoke('backup-import')`. Canceled → nothing. Then `parseBackup(text)`. Error → `AlertDialog` with the matching text: `invalid-json` "This file is not a valid backup.", `wrong-app` "This file is not a Manta backup.", `newer-version` "This backup was made by a newer version of Manta. Update Manta, then try again.", `invalid-format` "This backup file is damaged.", `too-large` "This file is too large (more than 100 MB)."
   - **Export invoices as CSV…** (lucide `Sheet`) → `exportCsv(Date.now())` + the same toasts.
   - One line of help: "Manta saves an automatic backup before every import."
3. Create `ImportDialog.jsx` (shadcn `AlertDialog`). Show the file name, `exportedAt` and the counts from `previewImport`: "{n} invoices and {m} clients in this file. {a} are new. {e} already exist." Show invalid and duplicate counts when they are not zero. A `RadioGroup` with "Skip items that already exist" (default) and "Replace items that already exist". A `Checkbox` "Also import settings" (default off; disabled when `settings` is null). Buttons: **Cancel** and **Import** (the Import button shows a spinner and is disabled while it runs).
4. After the import: dispatch `ContactsActions.getAllContacts()` and `InvoicesActions.getInvoices()`. Dispatch `updateSettings` for each returned settings section. Show the toast "Imported {added} new and replaced {overwritten} items. Skipped {skipped}." Add "{f} could not be written." when there are failed docs, and name the skipped settings sections. Toast action **Show safety backup** → `reveal-file` with the snapshot path.
5. Add all strings to `i18n/en/settings.json` under `backup.*`.

**Verify**: `npx vitest run app/helpers/__tests__/backupFlow.spec.js` → pass. Manual on COPIES only:
1. Close Manta. Confirm `/tmp/manta-a` and `/tmp/manta-b` do not exist, then `cp -R /tmp/manta-profile-copy /tmp/manta-a && mkdir /tmp/manta-b`. If either exists, choose fresh names and use them consistently; do not delete the existing directories.
2. `MANTA_USER_DATA=/tmp/manta-a npm start` → Export backup to `/tmp/manta-backup.json` → `node -e "const b=require('/tmp/manta-backup.json');console.log(b.app,b.version,b.invoices.length,b.contacts.length,JSON.stringify(b).includes('\"_rev\"'))"` → `Manta 1 <n> <m> false` (nested recipient `_rev`s can make the last value `true`; then check `b.invoices.some(d=>'_rev' in d)` → `false`).
3. `MANTA_USER_DATA=/tmp/manta-b npm start` → Import that file → the dialog shows `<n>` + `<m>` new → Import → the lists show the same counts. `ls /tmp/manta-b/backups` → one `manta-auto-*.json`.
4. In profile A, import the same file again with "Skip" → 0 added, all skipped, no data changed.
5. Edit one client in A, then import with "Replace" → the client returns to the file version. No invoice or client disappears.
6. Import a text file renamed to `.json` → "not a valid backup" and no `backups/` file is created.
7. Export CSV and open it in a spreadsheet app or `head -3` → BOM, header row, quoted values with commas.

### Step 13: Final checks

1. `grep -rn "ion-\|styled-components\|className=\"row\|col-md" app/containers/Contacts.jsx app/containers/Settings.jsx app/components/contacts app/components/settings/sections app/components/settings/SettingsNav.jsx` → no output.
2. `npm test` → exit 0. `npm run lint` → exit 0. `npm run test:e2e` → all pass (this plan does not change the e2e tests).
3. Manual smoke on `/tmp/manta-profile-copy` in light and dark mode: Clients page (search, sort, menu, delete + undo, sheet, editor), every Settings section, export, import, CSV. Take screenshots of the Clients page, the detail sheet and Settings › Export & backup in both modes if possible.
4. Commit Steps 9–13.

## Test plan

New unit tests (behavior that can break silently):
- `app/helpers/__tests__/clients.spec.js` — outstanding per currency, status filter, recipient matching, contact validation, edit keeps `_rev`, search.
- `app/helpers/__tests__/settings.spec.js` — validation rules, including the tax `0` regression.
- `app/helpers/__tests__/backup.spec.js` — bad JSON, wrong app, newer version, bad format, invalid docs, reserved `_` keys stripped, duplicates, skip vs overwrite, settings merge, round trip.
- `app/helpers/__tests__/csv.spec.js` — escaping, formula injection, BOM/CRLF, number format, dates, derived status.
- `app/helpers/__tests__/backupFlow.spec.js` — no write when the safety backup fails; skip mode; failures returned.
- `main/__tests__/backup-files.spec.js` — prune list, file names, payload check.
- Additions to `ContactsMW.spec.js`, `ContactsReducer.spec.js`, `pouchDB.spec.js`. Rewrite of `SettingsMW.spec.js`, plus edits to `SettingsReducer.spec.js` and `settings.spec.js` (actions).

Deleted (markup-only, component replaced): `app/components/contacts/__tests__/Contact.spec.jsx`, `app/components/settings/__tests__/General.spec.js`.

Add `ContactsMW` assertions for true/false outcomes and the failed-submit dialog flow through the persistence helper. Add settings tests for a thrown write, stable debounce callback and rebasing against a concurrent theme/numbering change. No new tests for table markup, sheet layout, icons or i18n text. UI is checked by the manual smoke steps in Steps 4, 5, 8, 12 and 13, on data copies, in light and dark mode.

## Done criteria

- [ ] `grep -n "CONTACT_UPDATE" app/constants/actions.jsx app/middlewares/ContactsMW.jsx` → 2+ lines
- [ ] `grep -rn "saveSettings\|SETTINGS_SAVE\|setSavable" app` → no output
- [ ] `ls app/components/settings/General.jsx app/components/settings/Invoice.jsx app/components/settings/Profile.jsx app/components/contacts/Contact.jsx 2>&1 | grep -c "No such file"` → `4`
- [ ] `grep -c "backup-export\|backup-import\|backup-snapshot\|csv-export" preload/index.js` → `4` or more
- [ ] `npx vitest run app/helpers/__tests__/backup.spec.js app/helpers/__tests__/csv.spec.js app/helpers/__tests__/backupFlow.spec.js main/__tests__/backup-files.spec.js` → all pass
- [ ] `npm test`, `npm run lint`, `npm run test:e2e` → exit 0
- [ ] Manual round trip (Step 12) passed: same counts in profile B, safety backup file exists, re-import with Skip changes nothing
- [ ] Fresh profile: a Settings change with tax `0` saves without a warning
- [ ] Every new string is in `i18n/en/*.json` (`grep -rn "t('" app/components/settings/sections app/components/contacts | wc -l` > 0 and no hard-coded English in JSX except the CSV header and "Counter Strike")
- [ ] `git log --format=%B -3 | grep -ci "co-authored\|generated with"` → `0`
- [ ] `plans/README.md` status row for 016 updated (unless a reviewer maintains the index)

## STOP conditions

Stop and report (do not improvise) if:
- A precondition from 012, 013 or 014 fails (no toast API, no `removeDocs`/`restoreDocs`, no `getDisplayStatus`, no TanStack table).
- 014 has no due-date helper and the only option is `calTermDate` (see Maintenance notes). Report it. Do not fix date logic in this plan.
- Any manual check would need the real user-data folder. Use copies only.
- During the round trip, any invoice or client count goes DOWN in the target profile, or a doc is changed in Skip mode.
- PouchDB `bulkDocs` throws for the whole batch instead of returning per-doc errors.
- `ipcRenderer.invoke` is blocked by the sandbox or the CSP.
- Existing invoices or contacts do not show after Step 1 or Step 3 (data visibility regression).
- 015 stores numbering under a different key than `invoice.numbering`. Report the key; do not guess.

## Review acceptance checks

- Debounced settings must save the latest local values, not a stale `value` prop. Keep one stable debounced function with the latest callback in a ref; flush on blur/section change and cancel after flush. Merge only edited fields into the latest stored section so a delayed save cannot rewind numbering, theme or another section's change. Test rapid edits to two fields and a pending edit followed by a palette theme change.
- Include save-failure handling: synchronous settings IPC can throw. Return `{ ok: false, errors/message }`, keep invalid or failed input visible and do not show Saved. Keep draft values separate from persisted `current`/`saved` state.
- Validate imported nested settings, including enum values, required object shapes and finite numeric bounds. Reject dangerous object keys (`__proto__`, `constructor`, `prototype`) before any merge. Do not coerce invalid imported counters through `Math.max`.
- Keep numbering limits consistent with 015 (`padding` 0–12), or document and test an explicit compatibility rule; a valid existing setting must remain editable.
- `sanitizeDoc` strips attachments. Current source does not write them. If an existing document contains `_attachments`, stop export/import with a clear unsupported-data message rather than silently dropping it; a full safety snapshot cannot lose data. Add a fixture and test this rejection.
- Import is not a multi-database transaction. Disable other write actions during snapshot/import; collect actual successes from bulk results, refresh all lists even if a later batch throws, and return the safety snapshot path plus partial results. Never claim all planned writes succeeded. Test first database success followed by second database rejection, per-doc conflicts and a failing settings apply.
- Derive import added/replaced counts from successful result ids, not `planMerge` predictions. Preview counts remain estimates until persistence finishes.
- Write a unique temporary file with restrictive permissions, rename only after a complete write, and remove the temporary file on error. Prune automatic backups only after the new snapshot is durable. Test interrupted write and pruning failure separately; report a snapshot warning instead of importing without a usable snapshot.
- Keep CSV local dates consistent with the invoice list (test a UTC-positive and UTC-negative timezone). Apply formula protection to every textual cell, including imported invoice numbers and currency codes.

## Maintenance notes

- **Backup format version**: `BACKUP_VERSION = 1` in `app/helpers/backup.js`. When a later plan changes the doc shape in a way that an old app cannot read, increase it, and add an upgrade function for older versions in `parseBackup`. The `version` field is the file format, not the app version (`appVersion` stores that).
- **Safety backups** are in `<userData>/backups/` (10 newest `manta-auto-*.json`). They contain full personal data. They are never uploaded.
- **Dates**: 014 fixes `calTermDate`; use its `getDueDate` and `getIssuedAt` helpers. Format CSV business dates in local time like the UI, not UTC, to avoid a one-day shift.
- **Client edits do not change old invoices.** This is intentional (invoices are legal records). A future "update client on open invoices" action must ask the user first.
- **Toast id** `settings-saved` replaces the previous toast. If 013 changes the toast API, keep the de-duplication.
- **Logo drop zone** still uses styled-components. 018 restyles or removes it.
- **Settings import** keeps `invoice.exportDir` local and takes the larger `numbering.next`. Review both rules when new path-like or counter-like settings are added.
- If the invoice history opens the editor instead of the 014 detail (Step 5 fallback), record that here.
- Reviewers: check that import never calls `deleteDoc`, that `sanitizeDoc` runs on import, that `runImport` writes nothing when the snapshot fails, and that no IPC handler parses user JSON in the main process.
