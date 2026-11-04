# Plan 015: Rebuild the invoice editor as a two-pane form with live preview, issue date, automatic numbering and drafts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- app/containers/Form.jsx app/components/form app/actions/form.jsx app/constants/actions.jsx app/reducers/FormReducer.jsx app/middlewares/FormMW.jsx app/middlewares/InvoicesMW.jsx app/middlewares/SettingsMW.jsx app/helpers/form.js app/helpers/invoice.js preview/templates preview/containers/MainContent.jsx preview/reducers/index.jsx app.js app/App.jsx app/index.jsx app/components/settings i18n/en`
> Plans 012–014 change some of these files on purpose: 012 changes `app/index.jsx` (CSS imports); 013 changes `app/App.jsx`, `app/helpers/form.js` and `app/components/settings/Invoice.jsx` (`openDialog()` → `ui/lib/dialog.js`), the page layout wrapper and the menu; 014 changes `helpers/date.js` (`calTermDate` fix), `app/helpers/invoice.js` (`getIssuedAt`, `getDueDate`, `getDisplayStatus`), `app/middlewares/InvoicesMW.jsx` (immediate delete with Undo; `INVOICE_DUPLICATE` saves a draft copy at once) and `app/components/invoices/*`. 014 does not touch the editor or the templates. Read the live content of those files. Any other difference from the "Current state" excerpts is a STOP condition.

## Execution checks added by review (2026-11-01)

- Record the execution start commit and starting changes. Scope checks compare this plan's changes with that baseline, not with a clean-tree requirement. Earlier plans can change the listed files; check the required behavior before treating expected changes as drift.
- Before a live app check, use Jean `get_run_environments`; use its running environment or `start_run_environment`. Do not start a second dev server by hand. Confirm that the environment uses a disposable `MANTA_USER_DATA` profile. Record the exact URL or Electron entry and profile used. If no Run command is configured, report that limit.
- Use the narrow tests listed for each changed behavior. Reuse passing results when the covered code has not changed. Run broad tests once at the final integration gate for shared state, persistence or IPC changes. Visual checks require the running app; do not replace them with markup assertions.
- Do not copy a profile while Manta is running. Close it first. Use a new temporary destination, or confirm the existing destination is disposable; repeated `cp -R` into an existing folder can create a nested profile.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (largest screen; changes the saved invoice shape: new `issuedAt`, `status: 'draft'`, auto `invoiceID`)
- **Depends on**: plans/014-*.md (and transitively 012, 013)
- **Category**: ui-redesign
- **Planned at**: commit `3e89104`, 2026-11-01

## Why this matters

The editor is the screen users spend most time on. Today it is one long column of Bootstrap fields. Users cannot see the invoice until they save it. Errors show as modal dialogs, one at a time. There is no issue date: templates print `created_at`, so a back-dated invoice is impossible. Invoice numbers are typed by hand and hidden by default. There are no drafts. This plan gives a two-pane editor with a live preview of the real template, inline errors, an issue date, automatic numbering and "Save draft". It also fixes three silent bugs found while planning: (1) `FORM_ITEM_MOVE` mutates state, so memoized views miss row reorders; (2) a failed save still clears the form (data loss); (3) the Alt+V menu item toggles a field named `vat` that does not exist. (014 already fixed the `calTermDate` month bug.)

## Preconditions

| Check | Command | Expected |
|---|---|---|
| On the series branch | `git branch --show-current` | current branch; record its name, do not switch |
| 012 done: Tailwind + shadcn | `test -f components.json && test -f ui/styles/globals.css && echo ok` | `ok` |
| 012 done: alias `@` | `grep -n "'@'" electron.vite.config.mjs vitest.config.mjs` | one hit per file |
| 013 done: dialog/toast API | `ls ui/lib/dialog.js && grep -rn "openDialog" app/helpers/form.js` | file listed; no `openDialog` hit |
| 013 done: base components | `ls ui/components/ui/button.jsx ui/components/ui/alert-dialog.jsx` | both listed |
| 014 done: date + status helpers | `grep -nE "export (function|const) (getIssuedAt|getDueDate|getDisplayStatus)" app/helpers/invoice.js` (or the `export {…}` list) | all three exported |
| 014 done: draft status | `grep -n "'draft'" app/constants/invoices.js` | at least one hit |
| 014 done: `calTermDate` fix | `grep -n "new Date()" helpers/date.js` | no output |
| Libraries | `npm ls @hello-pangea/dnd react-day-picker moment` | `18.x`, `10.x`, `2.x` |
| Tests pass | `npm test` | exit 0 |

## Current state

**Editor container** `app/containers/Form.jsx:60-133` — header with "Clear" + "Save & Preview"/"Update", then a single column: `Settings` panel, `InvoiceID` (only if `required_fields.invoiceID`), `Recipient`, `ItemsList`, then optional `DueDate`, `Currency`, `Discount`, `Tax`, `Note`. Exported through `connect`, `withTranslation()`, `_withFadeInAnimation` (`:177-181`).

**Form state** `app/reducers/FormReducer.jsx:11-43`:
```js
const initialState = {
  recipient: { newRecipient: true, select: {}, new: {} },
  rows: [],
  dueDate: { selectedDate: null, paymentTerm: null, useCustom: true },
  discount: {}, note: {}, invoiceID: '',
  currency: invoiceSettings.currency, tax: invoiceSettings.tax,
  settings: { open: false, editMode: { active: false }, required_fields: invoiceSettings.required_fields },
  savedSettings: { tax: …, currency: …, required_fields: … },
};
```
Row move mutates state (`:69-78`): `const newRows = state.rows; newRows.splice(dragIndex, 1); newRows.splice(hoverIndex, 0, dragRow);`. `INVOICE_EDIT` (`:118-166`) fills fields from `action.payload` and sets `required_fields.invoiceID: invoiceID !== undefined`.

**Save flow** `app/middlewares/FormMW.jsx:23-46`:
```js
case ACTION_TYPES.FORM_SAVE: {
  const currentFormData = getState().form;
  if (!validateFormData(currentFormData)) return;
  const currentInvoiceData = getInvoiceData(currentFormData);
  if (currentFormData.settings.editMode.active) {
    dispatch(InvoicesActions.updateInvoice(currentInvoiceData));
    dispatch(UIActions.changeActiveTab('invoices'));
  } else {
    dispatch(InvoicesActions.saveInvoice(currentInvoiceData));
  }
  if (currentFormData.recipient.newRecipient) { dispatch(ContactsActions.saveContact(…)); }
  dispatch(FormActions.clearForm(null, true));   // runs even if the save fails
```
`FORM_CLEAR` (`:56-64`) closes the settings panel, clears, then adds one empty row.

**Invoice data** `app/helpers/form.js:31-87` — `getInvoiceData(formData)` copies only toggled fields; `invoiceID` only if `required_fields.invoiceID` (`:60`); currency falls back to `appConfig.get('invoice.currency')` (`:64-68`); metadata at `:79-85`:
```js
_id: editMode.active ? editMode.data._id : crypto.randomUUID(),
_rev: editMode.active ? editMode.data._rev : null,
created_at: editMode.active ? editMode.data.created_at : Date.now(),
status: editMode.active ? editMode.data.status : 'pending',
subtotal: getInvoiceValue(invoiceData).subtotal,
grandTotal: getInvoiceValue(invoiceData).grandTotal,
```
Validation (`:6-29`, `:89-265`) returns booleans and opens one dialog per failure (013 swapped the dialog call, the logic is unchanged). `validateTax` and `validateCurrency` are also used by `app/middlewares/SettingsMW.jsx:36-37`.

**Totals** `app/helpers/invoice.js:1-49` — `getInvoiceValue(data)` returns `{ subtotal, discount, taxAmount, grandTotal }`. `calSub` adds `row.subtotal`; `ItemRow` stores `subtotal: ''` for incomplete rows, so `0 + ''` yields a string.

**Rows** `app/components/form/ItemRow.jsx:76-118` — local state mirrors the item; Enter (`e.which === 13`) calls `addItem()`; subtotal = price × quantity, `''` if either is empty. Drag: `hoc/_withDragNDrop.jsx` (`DragDropContext` + `Droppable`, `onDragEnd` → `moveRow`) and `hoc/_withDraggable.jsx` (whole row is the drag handle; inputs stay usable).

**Recipient** `app/components/form/Recipient.jsx:56-118` — radio "Create New"/"Select" toggles `newRecipient`; `RecipientForm` fields `fullname*`, `company`, `email*`, `phone`; `RecipientsList` is a native `<select>`.

**Due date** `DueDate.jsx` toggles `useCustom`; `DueDatePicker.jsx:76-78` stores `moment(date).toObject()` in `dueDate.selectedDate`; `DueDateTerms.jsx` picks from `libs/paymentTerms.js` (`['net7','net10','net30','net60','net90']`).

**Field toggles** `app/components/form/Settings.jsx` — collapsible panel with six switches (`invoiceID`, `dueDate`, `currency`, `discount`, `tax`, `note`) and "Save as default" → `updateSavedFormSettings('required_fields', …)`. `Currency.jsx` and `Tax.jsx` have their own "Save as default".

**Date helpers after 014** — `app/helpers/invoice.js` exports `getIssuedAt(invoice)` (`invoice.issuedAt ?? invoice.created_at ?? null`) and `getDueDate(invoice)` (custom date, or `calTermDate(getIssuedAt(invoice), term)`); `helpers/date.js` `calTermDate` is fixed. The 014 invoice list already reads `getIssuedAt`. Read the live code; do not re-implement these helpers.

**Preview window** `preview/containers/MainContent.jsx:43-56` chooses the template: `configs.template === 'business'` → `Business`, else `Minimal`; renders inside a styled `Page` (`width: 21cm; height: 29.7cm; display: flex; background: #fff`). Templates (`preview/templates/{minimal,business}/index.jsx`) take props `invoice`, `profile`, `configs`, `t`. They use styled-components and `font-family: Montserrat` (from `static/css/preview/font.css`), and import `helpers/date`, `helpers/formatNumber`, `app/helpers/invoice`, `libs/currencies.json`. They do not use `window.manta`. They translate with `t(key, { lng: configs.language })`. Dates: `minimal/components/Header.jsx:69` and `business/components/Header.jsx:108` print `moment(invoice.created_at)`; `:78` / `:118` call `calTermDate(invoice.created_at, …)`. Configs come from `preview/reducers/index.jsx:10-30` (`dateFormat`, `language`, `template` from settings plus `accentColor`, `logoSize`, `fontSize`, `alignItems`, `showLogo`, `useSymbol`, `customAccentColor`, `showRecipient`). A saved `invoice.configs` replaces them completely (`:34-40`).

**Other** — `app/middlewares/InvoicesMW.jsx:60-87` `INVOICE_SAVE` saves, toasts, then always sends `preview-invoice`; `:148-158` `INVOICE_DUPLICATE` saves a copy immediately with `created_at: Date.now()`. `app/components/invoices/Invoice.jsx:245,325` use `created_at` (014 may have replaced this file). `app.js:195-217` invoice defaults (`template: 'default'`, `dateFormat`, `tax`, `currency`, `required_fields`); `setInitialValues()` (`:220-240`) adds missing level-2 keys, so a new `invoice.numbering` key reaches existing users without a migration. `app/middlewares/SettingsMW.jsx:34-56` `SETTINGS_SAVE` writes the whole `invoice` object from the Settings tab. `app/App.jsx:54-56` dispatches `toggleField('vat')` for Alt+V. Menu `main/menu.js:49-113`: CmdOrCtrl+S save, CmdOrCtrl+R reset, CmdOrCtrl+I add item, Alt+S/T/C/V/D/N toggles. Main window `minWidth: 600` (`app.js:87`).

## Reference facts (recheck versions and APIs at execution)

- `npm view`: `react-day-picker 10.0.2`, `@hello-pangea/dnd 18.0.1` (peer react `^18||^19`), `@base-ui/react 1.9.0`, `lucide-react 1.66.0`, `date-fns 4.4.0`. Confirm with `npm view <pkg> version` before Step 1.
- shadcn `base-nova` registry: `calendar` depends on `react-day-picker@latest` + `date-fns` + `button`; `combobox` depends on `@base-ui/react` + `button`, `input-group`; `field` depends on `label`, `separator` (https://ui.shadcn.com/r/styles/base-nova/calendar.json, …/combobox.json, …/field.json).
- Date picker = `Popover` + `Calendar` + `Button`, no root component: https://ui.shadcn.com/docs/components/base/date-picker ; Calendar: https://ui.shadcn.com/docs/components/base/calendar
- Combobox (Base UI): `Combobox` root props `items`, `value`, `onValueChange`, `itemToStringLabel`, `isItemEqualToValue` (default `Object.is` — pass an `_id` compare), `filter`; parts `ComboboxInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem`, `ComboboxEmpty`: https://ui.shadcn.com/docs/components/base/combobox , https://base-ui.com/react/components/combobox
- Field: https://ui.shadcn.com/docs/components/base/field ; components list: https://ui.shadcn.com/docs/components ; Toast: https://ui.shadcn.com/docs/components/base/toast
- Base UI injects `<style>` in some parts; 012 keeps the existing style permission, so no `CSPProvider` is required: https://base-ui.com/react/utils/csp-provider
- Tailwind v4 container queries (`@container`, `@5xl:` = 64rem) are built in: https://tailwindcss.com/docs/responsive-design#container-queries ; RTL logical utilities: https://tailwindcss.com/docs/margin
- styled-components is in maintenance mode; templates keep it (018 rule): https://opencollective.com/styled-components/updates/thank-you
- NN/g: icons need visible labels https://www.nngroup.com/articles/icon-usability/ ; WCAG 2.2 target size 24×24 px https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

## Commands you will need

- One spec: `npx vitest run <path>`
- All unit tests: `npm test` · Lint: `npm run lint` · E2E: `npm run test:e2e`
- shadcn: `npx shadcn@latest add <names> --dry-run`, then without `--dry-run`
- Safe manual run: `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy` (Windows: `%APPDATA%\Manta`; Linux: `~/.config/Manta`), then `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev`

## Scope

**In scope**
- Create: `app/components/form/editor/` with `EditorLayout.jsx`, `ClientField.jsx`, `DetailsCard.jsx`, `DatePickerField.jsx`, `LineItems.jsx`, `LineItemRow.jsx`, `AdjustmentsCard.jsx`, `NotesCard.jsx`, `CustomizeFieldsMenu.jsx`, `TotalsFooter.jsx`, `LivePreview.jsx`; `app/helpers/numbering.js`; `app/helpers/preview.js`; `preview/templates/index.js`; `preview/constants/defaultConfigs.js`; `ui/hooks/use-debounced-value.js`; `app/components/settings/_partials/invoice/Numbering.jsx`; new specs listed in "Test plan".
- Change: `app/containers/Form.jsx`, `app/actions/form.jsx`, `app/constants/actions.jsx`, `app/reducers/FormReducer.jsx`, `app/middlewares/{FormMW,InvoicesMW,SettingsMW}.jsx`, `app/helpers/form.js`, both template `Header.jsx` files, `preview/containers/MainContent.jsx`, `preview/reducers/index.jsx`, `app.js` (default only), `app/App.jsx` (Alt+V fix), `app/index.jsx` (font CSS), `app/components/settings/Invoice.jsx`, `i18n/en/form.json`, `i18n/en/messages.json`, related specs.
- Delete: `app/components/form/{Recipient,RecipientForm,RecipientsList,ItemsList,ItemRow,DueDate,DueDatePicker,DueDateTerms,Currency,Discount,Tax,Note,InvoiceID,Settings}.jsx`, `app/components/form/hoc/` (logic moves into `LineItems.jsx`), and all 13 files in `app/components/form/__tests__/` (they test old markup and local-state syncing that no longer exists; the useful logic moves into helper tests).

**Out of scope**: saved items catalog, per-line taxes (later plans), preview window restyle (018), resizable panes, duplicate-number warnings, translations other than English, removing `static/css/*` (018).

## Git workflow

Work on the current branch. Do not switch branches or create a worktree. Commit after Steps 2, 4, 6, 9, 12 and 14. Short imperative subjects without prefix, for example `Add invoice numbering and issue date helpers`. No `Co-authored-by` or tool attribution. Do not push.

## Decisions (fixed for this plan)

1. **Live preview**: render the existing template components directly in the main renderer (no iframe). Reason: templates are plain React + styled-components with no `window.manta` use, and the only global element CSS (`static/css/general.css`, plus 012's globals) loads in both windows. The paper wrapper sets `bg-white text-neutral-900 [color-scheme:light]` so dark mode does not leak text color.
2. **Adapter**: `formToPreviewInvoice(form, { invoiceSettings, generalSettings, profile, now })` in `app/helpers/preview.js`. It is pure: no `crypto.randomUUID()`, no `Date.now()`, no settings reads.
3. **Invoice number** is always visible (removed from "Customize fields") and always saved when not empty. Required for new invoices. Not required when editing an old invoice that never had one.
4. **Numbering**: `invoice.numbering = { prefix: 'INV-', next: 1, padding: 4 }`. New and duplicated invoices get `formatInvoiceNumber(numbering)` pre-filled. After the first successful save of a new invoice (final or draft), `advanceNumbering(numbering, savedID)`: if `savedID` is `prefix` + digits and that number ≥ `next`, then `next = number + 1`; otherwise `next` stays. Edits never advance. Clearing or leaving the form never advances.
5. **Duplicate** no longer saves at once (this replaces 014's "save a draft copy" behavior; the operator confirmed this on 2026-11-01). It opens the editor as a new invoice with copied fields (no `_id`, `_rev`, `status`, `paidAt`, `issuedAt`), the next number and today's issue date. Cancel = nothing is saved and the counter stays. The user picks "Save draft" or "Save & preview".
6. **Drafts**: "Save draft" stores `status: 'draft'`. Draft rule: at least a recipient name/company/email OR one item with a description. Other rules do not apply to drafts. A new contact is saved only if it passes the full recipient rules. Drafts do not open the preview window. Blank rows (no description, price or quantity) are dropped on every save.
7. **Status on save** (`resolveSaveStatus(mode, editData)`): `draft` mode → `'draft'`; final mode on a new invoice → `'pending'`; final mode on an edited draft → `'pending'`; final mode on any other edit → keep `editData.status ?? 'pending'`.
8. **Issue date**: form `issuedAt` (ms or `null` = today). Saved docs always get a number. Reads use 014's `getIssuedAt(invoice)` from `app/helpers/invoice.js`. `created_at` stays the creation time.
9. **Validation**: pure `getFormErrors(form, mode)` returns `{ [path]: i18nKey }`. Paths: `issuedAt`, `invoiceID`, `recipient`, `recipient.fullname`, `recipient.email`, `rows`, `rows.<id>.description|price|quantity`, `dueDate`, `currency.fraction`, `discount`, `tax`, `note`. Values reuse the existing `dialog:validation:*:message` keys (translated in all locales); only new rules get new keys. Errors show after the first failed save and then update live.

## Steps

### Step 1: Add the shadcn components

1. Run `npx shadcn@latest add card field input textarea select popover calendar combobox dropdown-menu sheet separator toggle-group tooltip --dry-run`. Read the file list. Skip components that already exist (do not overwrite 013 edits; answer "no" to overwrite prompts).
2. Run the same command without `--dry-run`. Calendar adds `date-fns` and may bump `react-day-picker`.
3. Confirm the files are `.jsx` in `ui/components/ui/`.

**Verify**: `ls ui/components/ui/{card,field,calendar,combobox,popover,dropdown-menu,sheet,toggle-group}.jsx` → 8 files; `npm ls react-day-picker date-fns` → `10.x`, `4.x`; `npm run build` → exit 0.

### Step 2: Numbering helpers and setting default

1. Create `app/helpers/numbering.js` exporting:
   - `DEFAULT_NUMBERING = { prefix: 'INV-', next: 1, padding: 4 }`.
   - `normalizeNumbering(value)` — returns defaults for missing or invalid parts (`next` integer ≥ 1, `padding` integer 0–12, `prefix` string).
   - `formatInvoiceNumber(n)` — `prefix + String(next).padStart(padding, '0')`.
   - `advanceNumbering(n, savedID)` — rule from Decision 4. Escape the prefix before you build the RegExp.
   - `mergeNumbering(stored, saved, edited)` — per key: `edited[key] !== saved[key]` → `edited[key]`, else `stored[key]`.
2. In `app.js` `defaultOptions.invoice` add `numbering: { prefix: 'INV-', next: 1, padding: 4 }`.
3. Write `app/helpers/__tests__/numbering.spec.js` (cases in "Test plan").

**Verify**: `npx vitest run app/helpers/__tests__/numbering.spec.js` → all pass. `grep -n "numbering" app.js` → 1 hit.

### Step 3: Use the issue date everywhere

1. In both template `Header.jsx` files, add `getIssuedAt` to the existing import from `app/helpers/invoice`. Replace `invoice.created_at` with `getIssuedAt(invoice)` (4 places: the issue date line and the `calTermDate` call). Keep the label key `preview:common:created`.
2. Run `grep -rn "created_at" app preview helpers --include='*.js' --include='*.jsx' | grep -v __tests__`. Replace any remaining read used for display, sorting or due dates with `getIssuedAt(invoice)`. Keep the writes in `app/helpers/form.js`.

**Verify**: the grep shows only the writes in `app/helpers/form.js`, 014's fallback in `app/helpers/invoice.js`, 014's duplicate write in `InvoicesMW.jsx` (removed in Step 6) and (after Step 5) `app/helpers/preview.js`. `npx vitest run preview app/components/invoices` → pass.

### Step 4: Share template choice and preview defaults

1. Create `preview/constants/defaultConfigs.js`: `getDefaultPreviewConfigs(invoiceSettings, generalSettings)` returns the object now in `preview/reducers/index.jsx:14-29`. Use it in that reducer.
2. Create `preview/templates/index.js`: `getTemplate(name)` returns `Business` for `'business'`, else `Minimal`. Use it in `MainContent.renderTemplate()`.

**Verify**: `npx vitest run preview` → pass. Commit.

### Step 5: Refactor form helpers (errors, rows, invoice data, adapter)

In `app/helpers/form.js`:
1. Add `isBlankRow(row)`, `parseNumberInput(raw, { integer })` (empty or whitespace stays `''`; otherwise use `Number(raw)` and reject non-finite values and non-integers when `integer` is true; do not truncate `2.5` or accept `12abc`), and `updateRowField(row, name, raw)` (text for `description`; numbers for `price`/`quantity`; `subtotal = price * quantity`, `''` if either is `''`). This replaces `ItemRow` lines 82-113.
2. Add pure error getters: `getRecipientErrors`, `getRowErrors`, `getDueDateErrors`, `getCurrencyErrors`, `getDiscountErrors`, `getTaxErrors`, `getNoteErrors`, `getInvoiceIDErrors`. Copy the required-field rules from the current `validate*` bodies, and reject non-finite numbers and invalid dates. Drafts skip required-field rules but must still have safe finite stored values and a valid currency fraction; define omitted incomplete values explicitly. Also add these rules: final mode needs at least one non-blank row (`form:errors:noItems`); blank rows are skipped. Add `getFormErrors(form, mode)` that applies Decisions 3, 6 and 9. Draft failure key: `form:errors:draftEmpty`.
3. Keep `validateTax` and `validateCurrency` for `SettingsMW`: each calls its getter and shows the 013 dialog when an error exists. Delete `validateFormData` and the other `validate*` functions.
4. Add `pickInvoiceFields(form, defaultCurrency)` — the field-copy part of `getInvoiceData` (`:46-74`), plus: always copy `invoiceID` when not empty; drop blank rows; coerce `row.subtotal` to a number (`Number(x) || 0`).
5. Add `resolveSaveStatus(mode, editData)` (Decision 7).
6. Rewrite `getInvoiceData(form, { mode = 'final', defaultCurrency, now = Date.now() } = {})`: preserve existing document metadata in edit mode (including `configs`, `paidAt` and unknown extension keys), then apply fields from `pickInvoiceFields`; explicitly remove optional editor fields that were disabled; `issuedAt: form.issuedAt ?? (editMode.active ? getIssuedAt(editMode.data) : now)`; `status: resolveSaveStatus(...)`; keep `_id`, `_rev`, `created_at` logic; totals from `getInvoiceValue`.
7. Create `app/helpers/preview.js` with `formToPreviewInvoice(form, { invoiceSettings, generalSettings, profile, now })`. It returns `{ invoice, configs, profile }`. `invoice` = `pickInvoiceFields(form, invoiceSettings.currency)` + `_id: editMode.data?._id ?? 'preview'`, `recipient` = `form.recipient.newRecipient ? form.recipient.new : form.recipient.select` (always an object), `issuedAt: form.issuedAt ?? editIssued ?? now`, `created_at` = same value, totals. `configs` = `editMode.data?.configs ?? getDefaultPreviewConfigs(invoiceSettings, generalSettings)`.
8. Rewrite `app/helpers/__tests__/form.spec.js` and add `app/helpers/__tests__/preview.spec.js`.

**Verify**: `npx vitest run app/helpers` → pass. `grep -n "openDialog\|dialog" app/helpers/form.js` → hits only inside `validateTax`/`validateCurrency`.

### Step 6: Actions, reducer and middleware

1. `app/constants/actions.jsx`: add `FORM_SET_ERRORS`, `FORM_LOAD_DUPLICATE`.
2. `app/actions/form.jsx`: `saveFormData = createAction(FORM_SAVE, mode => (mode === 'draft' ? 'draft' : 'final'))` (click events and menu calls become `'final'`); add `setFormErrors(errors, mode)`.
3. `FormReducer.jsx`: add `issuedAt: null`, `invoiceID: formatInvoiceNumber(normalizeNumbering(invoiceSettings.numbering))`, `errors: {}`, `errorMode: null` to `initialState` (guard `invoiceSettings` being a string in tests). Fix `FORM_ITEM_MOVE` to copy the array first. Extract `populateFromInvoice(state, payload)` from `INVOICE_EDIT` and add `issuedAt: getIssuedAt(payload) ?? null`. `INVOICE_EDIT` = populate + edit mode. `FORM_LOAD_DUPLICATE` = populate + `editMode: { active: false }`, `invoiceID: ''`, `issuedAt: null`. `FORM_SET_ERRORS` stores `errors` and `errorMode`. `FORM_CLEAR` resets these new keys.
4. `FormMW.jsx` `FORM_SAVE`: move the body into `async function handleSave(store, mode)` and `return handleSave(...)` from the case:
   - Acquire one middleware-level save guard for all entry points. If a save is pending, return that promise without another write. Capture the form snapshot; lock editing until it finishes, and release the guard in `finally`. `mode = action.payload`; `errors = getFormErrors(form, mode)`. If not empty: dispatch `setFormErrors(errors, mode)`, dispatch a warning `UI_NOTIFICATION_NEW` with `form:errors:summary`, return.
   - `data = getInvoiceData(form, { mode, defaultCurrency: appConfig.get('invoice.currency') })`.
   - Edit: `ok = await dispatch(updateInvoice(data))`. New: `ok = await dispatch(saveInvoice(data))`. If `!ok`: return (keep the form).
   - New only: `appConfig.set('invoice.numbering', advanceNumbering(normalizeNumbering(appConfig.get('invoice.numbering')), data.invoiceID))`. This is after invoice persistence: if it throws, retain the saved invoice id and show a partial-success warning. Never retry invoice creation. Reconcile the counter before suggesting another number.
   - Save the new contact if `recipient.newRecipient` and `getRecipientErrors(recipient)` is empty. A failed contact save is reported separately after the saved invoice; it must not make retry create a second invoice.
   - Edited draft finalized (`editMode.data.status === 'draft' && mode === 'final'`): `ipc.send('preview-invoice', data)`.
   - Edit: change tab to `'invoices'`. Then `clearForm(null, true)`.
   - After `FORM_CLEAR` and `FORM_LOAD_DUPLICATE` pass through: dispatch `updateFieldData('invoiceID', formatInvoiceNumber(normalizeNumbering(appConfig.get('invoice.numbering'))))`.
   - After `FORM_FIELD_UPDATE_DATA`, `FORM_ITEM_*` and `FORM_RECIPIENT_UPDATE` pass through: if `getState().form.errors` is not empty, dispatch `setFormErrors(getFormErrors(form, errorMode), errorMode)`.
5. `InvoicesMW.jsx`: `INVOICE_SAVE` and `INVOICE_UPDATE` resolve `true` on success and `false` in `catch`. `INVOICE_SAVE` sends `preview-invoice` only when `status !== 'draft'` and toasts `messages:invoice:draftSaved` for drafts. `INVOICE_DUPLICATE` (replace 014's version): before replacing a dirty form, await a discard confirmation; Cancel leaves it unchanged. Then `getAllDocs('contacts')`, then `dispatch({ type: FORM_LOAD_DUPLICATE, payload: { ...omit(invoice, ['_id', '_rev', 'status', 'paidAt', 'issuedAt', 'created_at']), contacts } })`, then `changeActiveTab('form')`. It does not save.
6. `SettingsMW.jsx`: take `getState`. In `SETTINGS_SAVE`, before writing, set `payload.invoice.numbering = mergeNumbering(normalizeNumbering(appConfig.get('invoice.numbering')), getState().settings.saved.invoice.numbering ?? {}, payload.invoice.numbering ?? {})`. This stops a stale Settings tab from rewinding `next`.
7. `app/App.jsx`: Alt+V handler dispatches `toggleField('tax')`.
8. Update `FormReducer.spec.js`, `FormMW.spec.js`, `InvoicesMW.spec.js`, `SettingsMW.spec.js` (cases in "Test plan").

**Verify**: `npx vitest run app/reducers/__tests__/FormReducer.spec.js app/middlewares` → pass. Commit.

### Step 7: Editor layout and footer

1. Rewrite `app/containers/Form.jsx` as a function component (`useSelector`, `useDispatch`, `useTranslation`). Drop `_withFadeInAnimation`. Render `EditorLayout`.
2. `EditorLayout.jsx`: root `@container flex h-full flex-col`. Header row: title (`form:header:new` / `form:header:edit`), `CustomizeFieldsMenu`, a ghost "Clear" button (`clearForm`), and a "Preview" button (lucide `Eye`, visible label) shown only below `@5xl`, which opens a right `Sheet` containing `LivePreview`. Body: `grid @5xl:grid-cols-[minmax(28rem,1fr)_minmax(24rem,1fr)]`; left pane `overflow-y-auto` with the cards in order Client · Details · Line items · Adjustments (only if discount or tax is on) · Notes (only if note is on); right pane `hidden @5xl:block overflow-y-auto bg-muted`. Footer: `TotalsFooter`, `sticky bottom-0 border-t bg-background`.
3. `TotalsFooter.jsx`: compute `getInvoiceValue(formToPreviewInvoice(...).invoice)`. Show Subtotal, Discount (if on), Tax (if on), Total with `helpers/formatNumber` and the currency code. Buttons: new invoice → "Save draft" (outline) + "Save & preview" (primary); edited draft → same two; other edit → "Update" (primary). Use `onClick={() => dispatch(saveFormData('draft'))}` style handlers. Add `tabular-nums` and `text-end` to amounts.

**Verify**: `npm run build` → exit 0; manual run shows two panes at ≥ 1024 px editor width and a "Preview" button below it.

### Step 8: Client, Details and date fields

1. `ClientField.jsx` (Card "Client"): if there are no contacts or `recipient.newRecipient`, render inline fields `fullname*`, `company`, `email*`, `phone` (`Field` + `FieldLabel` + `Input` + `FieldError`, `aria-invalid` from `errors['recipient.<name>']`). Otherwise render a `Combobox` with `items={contacts}`, `value={recipient.select._id ? recipient.select : null}`, `itemToStringLabel={c => c.fullname || c.company}`, `isItemEqualToValue={(a, b) => a._id === b._id}`, items showing name + email, `ComboboxEmpty` text `form:fields:recipient:noMatch`. Below it, a button "Add new client" (lucide `UserPlus`) sets `newRecipient: true`; in the inline form a link button "Choose existing client" sets it back (only if contacts exist). Always dispatch `updateRecipient({ ...recipient, <changes> })`. When the form opens without a selection and contacts exist, do not auto-select (the old `RecipientsList` auto-select is removed; the error `recipient` shows if nothing is chosen).
2. `DatePickerField.jsx`: props `id`, `label`, `value` (Date or `null`), `onChange`, `placeholder`, `error`, `clearable`. `Popover` + `PopoverTrigger render={<Button variant="outline">}` (lucide `CalendarIcon`) + `Calendar mode="single" weekStartsOn={1}`. Format the label with `moment(value).format(dateFormat)` from saved settings. Clear button: lucide `X`, `aria-label`, `size-6` minimum.
3. `DetailsCard.jsx` (Card "Details"): Invoice number `Input` (`errors.invoiceID`; `FieldDescription` "Next number from Settings"). Issue date `DatePickerField` (value `issuedAt ?? now`, writes `updateFieldData('issuedAt', date.getTime())`). If due date is on: `ToggleGroup` "Date | Payment terms" bound to `dueDate.useCustom`; date mode writes `moment(date).toObject()` into `dueDate.selectedDate` (keep the stored shape); terms mode is a `Select` of `paymentTerms` and shows the computed date `calTermDate(issuedAt ?? now, term)` (014-fixed helper). When switching to terms with `paymentTerm === null`, set `paymentTerms[0]` (old `DueDateTerms` behavior). If currency is on: currency `Combobox` (items from `libs/currencies.json`, sorted by name, label `name (code)`), `Select` separator, `Select` placement, `Input type=number` fraction (`parseNumberInput(..., { integer: true })`), and a "Save as default" ghost button when `!isEqual(currency, savedSettings.currency)`.

**Verify**: `npm run build` → exit 0. Manual: pick a client, add a new client, pick dates; Redux DevTools shows `issuedAt` as a number and `dueDate.selectedDate` as an object.

### Step 9: Line items, adjustments, notes, field menu

1. `LineItems.jsx` (Card "Line items"): header row `grid grid-cols-[1.5rem_1fr_7rem_6rem_7rem_2rem]` with labels Description, Price, Quantity, Amount. Wrap rows in `DragDropContext` + `Droppable` (`onDragEnd` → `moveRow(source.index, destination.index)`). On mount, if `rows.length === 0`, dispatch `addItem()`. After the row count grows, focus the new row's description input (ref map keyed by `item.id`). Button "Add item" (lucide `Plus`) below.
2. `LineItemRow.jsx`: `Draggable draggableId={item.id} index={index}`; spread `draggableProps` on the row and `dragHandleProps` only on a handle `<button type="button">` with lucide `GripVertical` and `aria-label` "Reorder item N" (shown when `rows.length > 1`). Inputs: description (`Input`), price and quantity (`Input type="number" step="0.01" className="text-end tabular-nums"`), amount read-only text. Each input `aria-label` with row number, `aria-invalid` + `FieldError` from `errors['rows.<id>.<field>']`. On change dispatch `updateItem(updateRowField(item, name, e.target.value))`. Enter in any input dispatches `addItem()`. Remove button: lucide `Trash2`, `size-8`, `aria-label` "Remove item N", shown when `rows.length > 1`. Tab order follows DOM order: handle, description, price, quantity, remove.
3. `AdjustmentsCard.jsx`: Discount (amount `Input`, `parseNumberInput(..., { integer: true })` as today; `ToggleGroup` percentage | flat). Tax (TIN, amount %, `Select` method default | reverse, "Save as default" when it differs from `savedSettings.tax`). Errors `discount`, `tax`.
4. `NotesCard.jsx`: `Textarea` → `updateFieldData('note', { content })`, error `note`.
5. `CustomizeFieldsMenu.jsx`: `DropdownMenu` with `open={settings.open}` and `onOpenChange={o => o !== settings.open && toggleFormSettings()}` (keeps Alt+S working). Trigger: outline button, lucide `SlidersHorizontal`, label "Customize fields". Items: `DropdownMenuCheckboxItem` for dueDate, currency, discount, tax, note (`toggleField(name)`; confirm items do not close the menu — Base UI `closeOnClick` default). Separator. Item "Save as default" → `updateSavedFormSettings('required_fields', settings.required_fields)`, disabled when equal to `savedSettings.required_fields`.
6. Delete the old component files, `hoc/`, and `app/components/form/__tests__/` (list in "Scope").

**Verify**: `ls app/components/form` → `editor` only; `npm test` → pass; `npm run lint` → exit 0. Commit.

### Step 10: Live preview

1. `ui/hooks/use-debounced-value.js`: `useDebouncedValue(value, delay = 250)` with `setTimeout`/`clearTimeout` in `useEffect`.
2. `LivePreview.jsx`: read `form` (debounced) and `getSavedSettings`. Call `formToPreviewInvoice(form, { invoiceSettings: saved.invoice, generalSettings: saved.general, profile: saved.profile, now })` in `useMemo`; `now` = start of today, computed once per mount. `Template = getTemplate(configs.template)`. Measure the pane with `ResizeObserver`; `scale = Math.min(1, (width - 32) / 794)`. Outer box: inline `width: 794 * scale`, `height: 1123 * scale`, `overflow: hidden`, `mx-auto`, `shadow`. Inner paper: `flex w-[21cm] h-[29.7cm] bg-white text-neutral-900 [color-scheme:light] origin-top-left`, inline `transform: scale(${scale})`. Render `<Template invoice={…} profile={…} configs={…} t={i18n.t.bind(i18n)} UILang={…} />`. Wrap in `ErrorBoundary` from `app/components/shared/ErrorBoundary` with a short fallback text.
3. In `app/index.jsx` add `import '../static/css/preview/font.css';`. Do not import `print.css`.

**Verify**: `npm run build` → exit 0. Manual: typing a description updates the preview within ~0.3 s; switch Settings › template to Business → preview changes.

### Step 11: Numbering setting in Settings

Create `_partials/invoice/Numbering.jsx` with Prefix, Next number, Digits inputs and a sample line (`formatInvoiceNumber`). Add it to `app/components/settings/Invoice.jsx` like the other partials; it writes `numbering` into the component state and calls `updateSettings('invoice', …)`. 016 moves it to "Invoice defaults".

**Verify**: manual: set prefix `2026-`, save Settings, clear the form → number shows `2026-0001` style with the current `next`.

### Step 12: Strings

Add to `i18n/en/form.json`: `header.btns.saveDraft`, `cards.{client,details,items,adjustments,notes}`, `fields.issuedAt`, `fields.invoiceNumber.{label,hint}`, `fields.recipient.{addNew,chooseExisting,search,noMatch}`, `fields.items.{amount,reorder,remove}`, `fields.dueDate.{modeDate,modeTerms,computed}`, `customize.{name,saveAsDefault}`, `preview.{toggle,error}`, `totals.{subtotal,total}`, `errors.{summary,noItems,draftEmpty,recipientRequired}`. Add `invoice.draftSaved` to `i18n/en/messages.json`. Replace every hard-coded English string in `app/components/form/editor/` with `t()`. Other locales fall back to English.

**Verify**: `grep -rn ">[A-Z][a-z]" app/components/form/editor | grep -v "{t("` → no user-facing literals. Commit.

### Step 13: E2E check for numbering persistence

Add one test to `e2e/app.e2e.mjs`: on the main window, fill client name + email and one item, click "Save draft", then expect the invoice number input to have value `INV-0002`. If the main window is hidden on a fresh profile, call `app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Manta').show())` first.

**Verify**: `npm run test:e2e` → all tests pass.

### Step 14: Full checks and manual smoke

Run `npm test`, `npm run lint`, `npm run test:e2e`. Then do the smoke list in "Test plan" on a profile copy, in light and dark mode, and take screenshots of the editor at 1280 px and 800 px width. Commit.

**Verify**: all three commands exit 0; screenshots saved outside the repo.

## Test plan

New or rewritten unit tests (behavior that can break silently):
- `app/helpers/__tests__/numbering.spec.js`: format with padding (`next: 7, padding: 4` → `INV-0007`), `next` longer than padding, empty prefix; `normalizeNumbering(undefined)` → defaults, bad `next` → 1; `advanceNumbering`: accepted suggestion → +1, typed higher number with prefix → that + 1, lower number → unchanged, other prefix → unchanged, prefix with RegExp characters (`INV.(26)-`); `mergeNumbering`: unchanged `next` keeps stored value, edited `next` wins, edited prefix with stale `next` keeps stored `next`.
- `app/helpers/__tests__/form.spec.js`: `updateRowField` subtotal and `''` handling; `parseNumberInput`; `getFormErrors` final mode (each rule maps to its path; blank rows ignored; zero rows → `rows`; new invoice without number → `invoiceID`; edit of a doc without `invoiceID` passes); draft mode (recipient only passes, item only passes, both empty → `draftEmpty`, bad email passes); `getInvoiceData`: `issuedAt` from state, `null` → `now`, edit keeps old `issuedAt` or `created_at`, `invoiceID` saved without toggle, blank rows dropped, numeric totals; `resolveSaveStatus` (4 cases); `validateTax`/`validateCurrency` still return booleans.
- `app/helpers/__tests__/preview.spec.js`: same input gives deep-equal output and `crypto.randomUUID` is not called; default currency when the currency field is off; edit `configs` replace defaults; `issuedAt` fallback; rows with `subtotal: ''` give numeric `grandTotal`; recipient from `select` vs `new`.
- `app/reducers/__tests__/FormReducer.spec.js`: keep existing cases; add `FORM_ITEM_MOVE` does not mutate the previous `rows` array; `INVOICE_EDIT` sets `issuedAt` from `created_at` for old docs; `FORM_LOAD_DUPLICATE` keeps edit mode off and empties `invoiceID`; `FORM_SET_ERRORS` and `FORM_CLEAR` reset.
- `app/middlewares/__tests__/FormMW.spec.js` (async, `dispatch` returns `Promise.resolve(true|false)`): errors → no save; new save success → `appConfig.set('invoice.numbering', …)` once, form cleared; save failure → no numbering, no clear; two rapid saves → one write and one counter advance; secondary contact/counter failure → saved invoice retained, no duplicate on retry; edit → no numbering; draft with incomplete new recipient → no contact saved; `FORM_CLEAR` pre-fills the number.
- `app/middlewares/__tests__/InvoicesMW.spec.js`: save resolves `true`/`false`; draft save does not send `preview-invoice`; `INVOICE_DUPLICATE` does not call `saveDoc`, dispatches `FORM_LOAD_DUPLICATE` without `_id`/`status`/`issuedAt`, then the tab change (replace 014's duplicate expectations).
- `app/middlewares/__tests__/SettingsMW.spec.js`: `SETTINGS_SAVE` with stale numbering does not rewind `next`.
- E2E: Step 13.

Deleted (markup or old local-state tests): all 13 files in `app/components/form/__tests__/`. No new component markup tests.

Manual smoke (profile copy, light and dark): new invoice shows `INV-000N`; live preview matches the preview window for both templates; dark mode paper stays white with dark text; drag a row → preview order changes; Enter adds a row and focuses it; inline errors show and clear while typing; Save draft keeps you on a cleared form with the next number; the draft shows a Draft badge in Invoices; edit the draft → Save & preview opens the preview window and status becomes Pending; edit a paid invoice → only Update; duplicate → editor opens with the next number, Clear → counter unchanged; an old invoice (no `issuedAt`) shows its creation date in list and preview; CmdOrCtrl+S, CmdOrCtrl+I, Alt+S, Alt+V work; at 800 px the "Preview" sheet opens; Tab order is logical; the remove and handle buttons are ≥ 24 px.

## Done criteria

- [ ] `ls app/components/form` → `editor`; `ls app/components/form/__tests__ 2>/dev/null` → nothing
- [ ] `grep -rn "styled-components\|className=\"ion-" app/components/form` → no output
- [ ] `grep -rn "created_at" app preview helpers --include='*.jsx' --include='*.js' | grep -v __tests__` → only `app/helpers/form.js` (writes), `app/helpers/preview.js` (write), `app/helpers/invoice.js` (014 fallback) and the `omit` list in `InvoicesMW.jsx`
- [ ] `grep -n "toggleField('vat')" app/App.jsx` → no output
- [ ] `npm test` → exit 0 · `npm run lint` → exit 0 · `npm run test:e2e` → exit 0
- [ ] Manual smoke list done in light and dark mode; screenshots taken
- [ ] `git log --format=%B <execution-start-SHA>..HEAD | grep -i "co-authored\|generated with"` → no output

## STOP conditions

- A template throws or renders blank inside `LivePreview` and the fix needs more than the adapter or a wrapper style (for example, edits to template layout code). Report the error.
- The live preview differs visibly from the preview window for the same invoice (fonts, spacing) and the cause is global CSS that only the main window loads.
- `npx shadcn add` wants to overwrite components that 012/013 customized, or bumps `react-day-picker` to a major other than 10.
- `@hello-pangea/dnd` drag does not work with the handle-only setup.
- Any step needs a destructive change to saved invoices, contacts or settings (rename, delete or rewrite of existing keys).
- 014 did not ship `status: 'draft'` support in the invoice list (no Draft badge / filter).
- A precondition fails.

## Review acceptance checks

- Guard async saves in middleware, including Cmd/Ctrl+S. While a save is pending, a second request must reuse or reject that operation. Clear pending state in `finally` and disable save controls. Test two immediate requests: one document and one numbering advance.
- Capture the form version for a save. Lock editing while it saves, or clear only if the version still matches; a delayed success must not clear newer input. Test both a delayed success and a failure.
- Before Duplicate or New from client replaces an existing form, preserve typed work or await a discard confirmation. Test cancellation with an unsaved new form and with an edited invoice.
- A contact-save or numbering-write failure after invoice persistence is a partial success. Retain the saved invoice id and report the secondary failure; retry must not create another invoice. Test this path.
- Drafts relax required fields, but must not persist NaN/Infinity or an unsafe currency fraction. Keep incomplete raw input in form state; define safe omitted draft values and validate every present number. Test malformed text, non-finite values and fractional quantity.
- Initialize the suggested number from current settings on form entry/clear, not only at reducer import. Copy rows with `{ ...row }` so later unit/tax keys survive.
- The fixed A4 live preview clips long invoices. Show an overflow warning and verify a long multiline invoice at narrow width against the separate preview. Clamp the scale above zero.
- Add `issuedAt` to error paths and reject invalid dates before final save.

## Maintenance notes

- `issuedAt` is the business date; `created_at` is the technical creation time. New code must read dates through `getIssuedAt()` / `getDueDate()` in `app/helpers/invoice.js` (014).
- The template label still says "Created" (`preview:common:created`). Renaming it to "Issued" changes PDF output; do it in 018 together with the PDF comparison.
- `mergeNumbering` in `SettingsMW` exists only because the Settings tab saves the whole `invoice` object. When 016 saves single keys immediately, write `invoice.numbering.prefix`/`padding` directly and remove the merge.
- `required_fields.invoiceID` stays in settings but the editor ignores it.
- `pickInvoiceFields` is shared by save and preview. Change both paths through it, never separately.
- Later plans (items catalog, per-line taxes) extend `LineItemRow` and `updateRowField`; keep totals in `getInvoiceValue`.
- No AI or tool attribution in commits or PRs (AGENTS.md).
