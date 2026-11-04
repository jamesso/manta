# Plan 024: Add recurring invoice profiles that create draft invoices when the app runs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- app/helpers/pouchDB.js app/helpers/__mocks__/pouchDB.js app/helpers/invoice.js app/helpers/form.js app/helpers/preview.js app/helpers/numbering.js app/helpers/backup.js app/helpers/backupFlow.js main/backup-files.js app/App.jsx app/store/index.jsx app/reducers/index.jsx app/reducers/UIReducer.jsx app/reducers/FormReducer.jsx app/middlewares/FormMW.jsx app/middlewares/InvoicesMW.jsx app/constants/actions.jsx app/actions app/components/layout app/components/invoices app/components/form app/containers/Invoices.jsx preload/index.js app.js helpers/date.js i18n/en`
> Plans 012–023 change almost all of these files on purpose: 013 (sidebar, palette, toasts, `App.jsx`, `UIReducer`), 014 (status helpers, `removeDocs`/`restoreDocs`, invoices table, `calTermDate` fix), 015 (editor, numbering, `getFormErrors`, `pickInvoiceFields`, `formToPreviewInvoice`), 016 (backup), 019 (`items` database, backup version), 020–023 (payments, tax, `docType`, credit notes). Compare only the parts this plan depends on (listed in "Current state" part b). A missing name is a STOP condition. A renamed name is not: find the real name and use it.

## Review rules (2026-11-01)

These rules take precedence over conflicting commands below. Before a live app check, call Jean `get_run_environments` and use the existing environment. If none runs, use Jean `start_run_environment` with its configured command. Do not start another server by hand or guess its port. Record the exact URL or Electron launch target used. Use a fresh disposable profile, never the production profile; do not delete or overwrite an existing review profile. For IndexedDB persistence checks, use the built `file://` app with `MANTA_USER_DATA`, because a dev HTTP origin cannot prove access to the existing `file://` database. A copied Settings file can still point `invoice.exportDir` at a real folder: change it to a disposable export directory before any export check. Run focused tests during each step. Run the full unit suite, lint and e2e once at the end, rather than after every edit. A passing library demo is not proof of the app's IPC, state or file behavior.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED — the app creates invoice documents by itself. A bug can create duplicates or many drafts at once.
- **Depends on**: 013–016, 019 (items database), 020 (payments), 021 (tax settings backup), 022 (document types and estimate settings), 023 (credit-note metadata). Execute after 023; do not implement optional alternate schemas.
- **Category**: feature
- **Planned at**: commit `3e89104`, 2026-11-01 (runs after 023)

## Why this matters

Many freelancers send the same invoice every month (retainers, rent, hosting). Today they must duplicate an old invoice by hand and fix the date. They forget, or they copy the wrong one. Manta has no server and no background job, so a cloud-style scheduler is not possible. This plan adds recurring profiles. While the app is open (start, every hour, and after the computer wakes up), Manta creates one **draft** for each due period. The user then opens the draft, checks it, and saves it. Nothing is sent automatically. The user stays in control, and missed months are caught up when the app opens again.

## Decisions (fixed for this plan)

1. **Dates on the profile are local calendar dates** as strings `'YYYY-MM-DD'` (`startDate`, `nextDate`, `endDate`). Reason: a period is a calendar day, not an instant. Strings do not shift when the time zone or DST changes. `periodKey` = the period date string.
2. **Profile doc** (database `recurring`): `{ _id, name, template, interval: 'weekly'|'monthly'|'quarterly'|'yearly', every: 1, startDate, anchorDay, nextDate, endDate|null, active, lastRunAt|null, created_at, sourceInvoiceId|null }`. `anchorDay` = day of month of `startDate` (1–31). `template` = invoice fields without `_id`, `_rev`, `status`, `paidAt`, `issuedAt`, `created_at`, `invoiceID`, `payments`, `recurringId`, `periodKey`, `sourceEstimateId`, `convertedInvoiceId`, `creditedInvoiceId`, `creditedInvoice`, `sentAt`, `remindedAt`; `docType` is forced to `'invoice'`.
3. **Month-end rule**: each period date is `min(anchorDay, daysInMonth)`. The anchor never drifts (Jan 31 → Feb 28 → Mar 31). Yearly on Feb 29 → Feb 28 in common years, Feb 29 in leap years.
4. **No invoice number at creation.** A recurring draft has no `invoiceID`. The editor pre-fills the next number when the user opens such a draft. The first successful save (draft or final) stores it and advances `invoice.numbering`. If the user leaves the Draft status from the row menu or a bulk action without opening the draft, `assignNumberIfMissing` gives it the next number at that moment. Reason: unwanted drafts do not consume invoice numbers. This does not guarantee gap-free or legally compliant numbering; a document write and a Settings counter write are separate operations.
5. **Created invoice**: `_id = 'rec-' + profile._id + '-' + periodKey` (deterministic), `status: 'draft'`, `docType: 'invoice'`, `issuedAt` = local start of the period day (ms), `created_at = now`, `recurringId`, `periodKey`, totals recomputed, new row ids. Due date: a payment term is copied as is (014's `getDueDate` computes it from `issuedAt`). A day offset (`dueDate.offsetDays`) becomes a fixed `selectedDate` = period date + offset.
6. **Idempotency, two layers**: (a) the runner skips a period when any invoice has the same `recurringId` + `periodKey`; (b) the deterministic `_id` makes a second `put` fail with 409, which the runner counts as "skipped", not as an error.
7. **Catch-up**: at most 12 periods per profile per run (`MAX_PERIODS_PER_RUN = 12`), oldest first. The rest come in the next run. The toast warns and names the profile.
8. **No back-fill on create, resume or import.** A new profile, a profile that the user resumes, and an imported profile get `nextDate` = first period on or after today (never earlier). Only periods missed while the app was closed are caught up. Keep a stable profile identity across backup/restore; existing invoice `recurringId` and `periodKey` values must still refer to the same profile.
9. **Runs**: the main window renderer runs the check on startup, every hour (`setInterval`), after `powerMonitor` `resume` (IPC `system-resumed`), and after a profile is saved or resumed. A single-flight lock joins overlapping triggers to the run in progress.
10. **Template editing reuses the 015 editor** in a "template" mode (no number, no issue date, due date as payment term or days after issue). The schedule (name, interval, dates, active) is a shadcn `Sheet` on the Recurring page.
11. **Delete** uses 014's pattern: delete at once, Undo toast re-creates the doc (`RECURRING_RESTORE`). Created invoices stay.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current` | record the current branch; keep it |
| 012: Switch | `ls ui/components/ui/switch.jsx` | listed |
| 013: toast + dialog | `grep -n "export" ui/components/ui/toast.jsx \| grep toast; ls ui/lib/dialog.js` | exported `toast`; file listed |
| 013: shell | `ls app/components/layout/{AppSidebar,CommandPalette,TitleBar}.jsx` | 3 files |
| 014: helpers | `grep -nE "getDisplayStatus\|withStatus\|getInvoiceNumber\|getIssuedAt\|getDueDate" app/helpers/invoice.js \| grep export` | all 5 exported |
| 014: bulk DB helpers | `grep -nE "removeDocs\|restoreDocs\|updateDocs" app/helpers/pouchDB.js \| tail -1` | export line lists them |
| 014: tabs + undo | `grep -rn "INVOICE_TABS\|UNDO_TIMEOUT_MS" app/helpers app/constants` | both found; `INVOICE_TABS` contains `'draft'` |
| 014: row menu | `ls app/components/invoices/InvoiceRowActions.jsx` | listed |
| 015: numbering | `grep -nE "export (function\|const) (formatInvoiceNumber\|advanceNumbering\|normalizeNumbering)" app/helpers/numbering.js` | 3 hits |
| 015: form helpers | `grep -nE "export (function\|const) (getFormErrors\|pickInvoiceFields\|getInvoiceData)" app/helpers/form.js; grep -n "formToPreviewInvoice" app/helpers/preview.js` | 3 hits; 1+ hit |
| 015: editor parts | `ls app/components/form/editor/{DetailsCard,TotalsFooter,DatePickerField}.jsx; grep -n "FORM_LOAD_DUPLICATE" app/constants/actions.jsx` | 3 files; 1 hit |
| 016: backup | `grep -nE "BACKUP_VERSION\|planMerge\|bulkSaveDocs" app/helpers/backup.js app/helpers/pouchDB.js; grep -n "serializeBackup" main/backup-files.js` | all found (note the live `BACKUP_VERSION`) |
| 019: DB pattern | `grep -n "'items'" app/helpers/pouchDB.js` | the `items` DB line (copy its pattern) |
| 022: doc type | `grep -rn "export.*getDocType" app/helpers` | 1 hit |
| moment | `node -p "require('moment/package.json').version"` | `2.31.x` |
| Tests pass | `npm test && npm run lint` | exit 0 |

## Current state

### (a) At 3e89104 — code that 012–023 do not change in the parts used here

`app/helpers/pouchDB.js:5-8` — one PouchDB instance per database, `idb` adapter:
```js
// Keep the 'idb' adapter: existing user data was written by it.
const contactsDB = new PouchDB('contacts', { adapter: 'idb' });
const invoicesDB = new PouchDB('invoices', { adapter: 'idb' });
```
`:122-137` `setDB(dbName)` resolves by name (`'contacts'` directly, `'invoices'` after the migration queue). `:167-183` `saveDoc` / `updateDoc` call `db.put` and resolve to `getAllDocs(dbName)`. `:185` `export { getAllDocs, getSingleDoc, deleteDoc, saveDoc, updateDoc };`.

`app/App.jsx:29-34` — startup data load (013 converts this to a function component with one `useEffect`; the calls stay):
```js
componentDidMount() {
  const { dispatch } = this.props;
  dispatch(ContactsActions.getAllContacts());
  dispatch(InvoicesActions.getInvoices());
  dispatch(SettingsActions.getInitalSettings());
```
`app/store/index.jsx:16` — `const middlewares = [FormMW, ContactsMW, InvoicesMW, SettingsMW, UIMiddleware];`. `app/reducers/index.jsx:8-14` — `combineReducers({ ui, form, invoices, contacts, settings })`.

`app.js:78-114` — main window. On macOS, `close` only hides it (`:105-113`), so the renderer and its timers keep running. Hidden pages get throttled timers (see Facts). `:362-371` `loadMainProcessFiles()` requires `./main/*` modules after `app` `ready` (`:426-438`). `:91` `appConfig.set('mainWindowID', parseInt(mainWindow.id))`.

`preload/index.js:3-48` — `CHANNELS` allow-list; `ipc.on(channel, …)` throws for unknown channels (`:50-53`).

`vitest.config.mjs:7-9` — `env: { TZ: 'UTC' }` for all tests. `package.json:47` — `"moment": "^2.31.0"`.

### (b) Expected after 012–023 (expectations — Preconditions check them)

- 013 Step 6: `UIReducer` state `{ activeTab, checkUpdatesMessage, sidebarCollapsed, commandPaletteOpen, shortcutsOpen }`; `toast` from `@/components/ui/toast` with `toast.add({ title, type, timeout, actionProps })`. 013 Step 9: `AppSidebar.jsx` menu items with `isActive`, `tooltip`, `onClick → changeActiveTab(tab)`. 013 Step 11: `CommandPalette.jsx` "Go to" group.
- 014 Step 2: `withStatus(doc, status, now)`, `getInvoiceNumber(invoice)` → `invoice.invoiceID || invoice._id.slice(0, 8)`, `UNDO_TIMEOUT_MS = 6000`. 014 Step 3: `INVOICE_TABS = ['all', 'draft', 'outstanding', 'overdue', 'paid', 'closed']`. 014 Step 4: `removeDocs(dbName, ids) → { removed, failed, docs }`, `restoreDocs(dbName, docs)` (409 → skip). 014 Step 7: `Invoices.jsx` keeps `tab` in component state only; `InvoiceRowActions.jsx` menu items; 014 Step 5: `INVOICE_SET_STATUS` accepts one id or an array and uses `withStatus`.
- 015 Decisions 4, 7, 9 and Steps 2, 5, 6: `invoice.numbering = { prefix, next, padding }`; `advanceNumbering(n, savedID)`; "edits never advance"; `getFormErrors(form, mode)` with modes `'final' | 'draft'`; `pickInvoiceFields(form, defaultCurrency)`; `FormMW` `handleSave(store, mode)`; `FORM_LOAD_DUPLICATE` = populate + edit mode off; `formToPreviewInvoice(form, {…})` in `app/helpers/preview.js`; editor files in `app/components/form/editor/`.
- 016 Steps 9–12: `app/helpers/backup.js` (`BACKUP_VERSION`, `sanitizeDoc`, `buildBackup`, `parseBackup`, `planMerge`), `backupFlow.js` (`collectBackup`, `previewImport`, `runImport`), `main/backup-files.js` `serializeBackup` (lists the top-level keys one by one), `bulkSaveDocs` in `pouchDB.js`.
- BRIEF for 019: `items` DB added with the same pattern and the backup version bumped. 022: `docType` field, `getDocType(doc)`; lists filter `docType === 'invoice'`. 020: `payments` array on invoices. 021: per-line tax snapshot on rows.

## Reference facts (recheck versions and APIs at execution)

- Electron `powerMonitor` (main process only). Event `resume`: "Emitted when system is resuming." No platform restriction is listed. `suspend` is also all platforms; `unlock-screen` is macOS/Windows only (not used). https://www.electronjs.org/docs/latest/api/power-monitor . The page does not say if `powerMonitor` works before `ready`. This plan requires it inside `loadMainProcessFiles()`, which runs after `ready`.
- `webPreferences.backgroundThrottling`: "Whether to throttle animations and timers when the page becomes background." Default `true`. https://www.electronjs.org/docs/latest/api/structures/web-preferences . A 1-hour interval still fires (late at most by the throttle). Timers do not fire during sleep, so the `resume` trigger is needed.
- moment 2.31.0, verified locally: `moment('2026-01-31').add(1,'month')` → `2026-02-28`; adding again gives `2026-03-28` (drift — this is why Decision 3 recomputes from `anchorDay`). `moment('2028-02-29').add(1,'year')` → `2029-02-28`. Docs: https://momentjs.com/docs/#/manipulating/add/
- Node 24.22.1, verified locally: assigning `process.env.TZ = 'America/New_York'` at run time changes `Date` offsets at once (`new Date(2026,2,8,12).getTimezoneOffset()` → `240`, January → `300`). US DST 2026: starts 2026-03-08, ends 2026-11-01. `moment('2018-11-04','YYYY-MM-DD',true)` in `America/Sao_Paulo` (midnight does not exist) → valid, `01:00`, same calendar day.
- Vitest 5.0.5: `vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync(ms)`, `vi.useRealTimers()`: https://vitest.dev/api/vi.html#vi-usefaketimers . The config `env.TZ` overrides a shell `TZ`, so set the zone inside the spec.
- PouchDB `put` of an existing `_id` without `_rev` rejects with status 409: https://pouchdb.com/api.html#create_document
- shadcn Base UI Switch / Sheet / Table: https://ui.shadcn.com/docs/components/base/switch , https://ui.shadcn.com/docs/components/base/sheet , https://ui.shadcn.com/docs/components/base/table ; Toast `actionProps`: https://ui.shadcn.com/docs/components/base/toast
- NN/g undo over confirmation: https://www.nngroup.com/articles/confirmation-dialog/ ; empty states: https://www.nngroup.com/articles/empty-state-interface-design/
- lucide icons used: `Repeat`, `Pause`, `Play`, `CalendarClock`, `Pencil`, `Trash2`, `MoreHorizontal`, `Plus`. Check: `node -e "const l=require('lucide-react');console.log(['Repeat','Pause','Play','CalendarClock','Pencil','Trash2','MoreHorizontal','Plus'].filter(n=>!l[n]))"` → `[]`.
- Confirm installed versions with `npm view <pkg> version` only if you add a package. This plan adds no package.

## Commands you will need

- One spec: `npx vitest run <path>` · All: `npm test` · Lint: `npm run lint` · E2E: `npm run test:e2e`
- shadcn (only missing files): `npx shadcn@latest add <names> --dry-run`, then without `--dry-run`
- Safe manual run: `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy`, then `MANTA_USER_DATA=/tmp/manta-profile-copy npm run dev`

## Scope

**In scope**
- Create: `app/helpers/recurringSchedule.js`, `app/helpers/recurring.js`, `app/helpers/recurringRunner.js`, `app/helpers/singleFlight.js`, `app/helpers/recurringScheduler.js`; `app/actions/recurring.jsx`, `app/reducers/RecurringReducer.jsx`, `app/middlewares/RecurringMW.jsx`; `app/containers/Recurring.jsx`; `app/components/recurring/{RecurringTable,RecurringRowActions,RecurringSheet,RecurringEmpty}.jsx`; `main/power-events.js`; `i18n/en/recurring.json`; specs listed in "Test plan".
- Change: `app/helpers/pouchDB.js` (+ mock), `app/helpers/numbering.js`, `app/helpers/invoice.js` (`getInvoiceNumber`), `app/helpers/form.js`, `app/helpers/preview.js`, `app/helpers/backup.js`, `app/helpers/backupFlow.js`, `main/backup-files.js`, `app/constants/actions.jsx`, `app/actions/{ui,form}.jsx`, `app/reducers/{index,UIReducer,FormReducer}.jsx`, `app/middlewares/{FormMW,InvoicesMW}.jsx`, `app/store/index.jsx`, `app/App.jsx`, `app/components/layout/{AppMain,AppSidebar,CommandPalette,TitleBar}.jsx`, `app/containers/Invoices.jsx`, `app/components/invoices/InvoiceRowActions.jsx`, number cell in `app/components/invoices/columns.jsx`, `app/components/form/editor/{DetailsCard,TotalsFooter,EditorLayout}.jsx`, `preload/index.js`, `app.js` (one `require`), `i18n/en/index.js`, `i18n/en/{invoices,form}.json`, `e2e/app.e2e.mjs`.
- Delete: nothing.

**Out of scope**: auto-send, auto-email, background job or OS scheduler, running while the app is closed, a "create now" button, a dashboard "Upcoming recurring" card (later candidate), recurring estimates or credit notes, translations other than English.

## Git workflow

Continue on the current branch. Do not create a worktree or switch branches unless the user explicitly asks. Use short imperative commit subjects, with no attribution lines. Do not push or create a PR unless asked.

## Steps

### Step 1: Run the checks

Run the drift check and every Preconditions row. Read the live `withStatus`, `getInvoiceNumber`, `pickInvoiceFields`, `getFormErrors`, `handleSave`, `INVOICE_SET_STATUS`, `buildBackup`, `parseBackup`, `serializeBackup`. Confirm the live `BACKUP_VERSION` is 5 (023); stop if it is not. For the backward-compatibility tests, `V = 5`. Run `grep -rn "withStatus(" app --include='*.js' --include='*.jsx' | grep -v __tests__` and list every call site that can move a doc out of `draft` (014 set status, 020 record payment, others).

**Verify**: all Preconditions rows match; the call-site list is written in your notes.

### Step 2: Schedule math (pure)

Create `app/helpers/recurringSchedule.js`. Use only `moment`. Never use `Date.now()` inside; take `now` as an argument.

```js
export const INTERVALS = ['weekly', 'monthly', 'quarterly', 'yearly'];
export const MAX_PERIODS_PER_RUN = 12;
export const DATE_KEY = 'YYYY-MM-DD';
export function toDateKey(ms)                 // moment(ms).format(DATE_KEY), local zone
export function dateKeyToMs(key)              // moment(key, DATE_KEY, true).startOf('day').valueOf()
export function isDateKey(value)              // string and moment(value, DATE_KEY, true).isValid()
export function nextDateAfter(dateKey, interval, every, anchorDay)
  // weekly: add every*7 days. monthly/quarterly/yearly: add every*1/3/12 months,
  // then set day = Math.min(anchorDay, daysInMonth). Returns a DATE_KEY.
export function firstPeriodOnOrAfter(profile, dateKey)
  // first date d in the series startDate, nextDateAfter(startDate), … with d >= dateKey.
  // Returns startDate if startDate >= dateKey. Loop guard: 10000 steps, then throw.
export function getDuePeriods(profile, now, maxPerRun = MAX_PERIODS_PER_RUN)
  // → { periods: DATE_KEY[], nextDate: DATE_KEY, capped: boolean }
```

Rules for `getDuePeriods`:
- `today = toDateKey(now)`. Inactive profile, invalid `nextDate`, or unknown `interval` → `{ periods: [], nextDate: profile.nextDate, capped: false }`.
- Loop: `d = profile.nextDate`. While `d <= today` and (`endDate == null` or `d <= endDate`): if `periods.length === maxPerRun`, set `capped = true` and stop; else push `d` and set `d = nextDateAfter(d, …)`.
- Return `nextDate = d`. String comparison is safe for `YYYY-MM-DD`.
- `every` must be an integer ≥ 1; otherwise treat the profile as invalid (no periods).

Write `app/helpers/__tests__/recurringSchedule.spec.js` (cases in "Test plan", group A).

**Verify**: `npx vitest run app/helpers/__tests__/recurringSchedule.spec.js` → all pass.

### Step 3: Profile, template and invoice builders (pure)

Create `app/helpers/recurring.js`:

```js
export const TEMPLATE_OMIT = ['_id','_rev','status','paidAt','issuedAt','created_at','invoiceID','payments',
  'recurringId','periodKey','sourceEstimateId','convertedInvoiceId','creditedInvoiceId',
  'creditedInvoice','sentAt','remindedAt'];
export function buildTemplateFromInvoice(invoice)
  // omit TEMPLATE_OMIT, docType: 'invoice', deep copy (structuredClone).
  // dueDate.useCustom with a valid selectedDate → { useCustom: true, offsetDays: max(0, days from issue day to due day), paymentTerm: null }
export function buildProfileFromInvoice(invoice, now)
  // name = client name (fullname || company || ''), interval 'monthly', every 1,
  // startDate = nextDateAfter(toDateKey(getIssuedAt(invoice) ?? now), 'monthly', 1, day of that date),
  // anchorDay from startDate, endDate null, active true, template, sourceInvoiceId = invoice._id.
  // No _id yet (RecurringMW sets it).
export function materializeDueDate(dueDate, issuedAtMs)
  // no dueDate → undefined; offsetDays → { useCustom: true, selectedDate: moment(issuedAtMs).add(n,'days').toObject(), paymentTerm: null }
  // anything else → copy as is
export function buildInvoiceFromProfile(profile, periodKey, now, makeId = () => crypto.randomUUID())
  // Decision 5. Totals with the live totals helper (getInvoiceValue in 015; use 021's helper if it replaced it).
export function getRecurringErrors(profile)     // { [field]: i18nKey } — name, every (1–99), interval, startDate, endDate >= startDate, template.rows non-empty, template.recipient
export function getRecurringStatus(profile, now) // 'paused' (active false) | 'ended' (endDate && nextDate > endDate) | 'active'
export function applyScheduleOnSave(previous, edited, now)
  // Decision 8. anchorDay = day of edited.startDate.
  // new (no previous) → nextDate = firstPeriodOnOrAfter(edited, max(today, startDate))
  // interval, every or startDate changed → same formula
  // previous.active false and edited.active true and previous.nextDate < today → same formula
  // else keep previous.nextDate
export function normalizeImportedRecurring(doc, now)
  // nextDate invalid or < today → firstPeriodOnOrAfter(doc, today); else unchanged.
```

Write `app/helpers/__tests__/recurring.spec.js` (group B).

**Verify**: `npx vitest run app/helpers/__tests__/recurring.spec.js` → all pass. Commit.

### Step 4: Number on first save (Decision 4)

1. `app/helpers/numbering.js`: add `assignNumberIfMissing(doc, nextStatus, numbering)` → `{ doc, numbering }`. When `doc.status === 'draft'`, `!doc.invoiceID` and `nextStatus !== 'draft'`: `doc = { ...doc, invoiceID: formatInvoiceNumber(numbering) }` and `numbering = advanceNumbering(numbering, doc.invoiceID)`. Else return both unchanged.
2. Reuse the numbering write queue from 015/022 for all number allocation paths; if none exists, add one shared queue and include it in scope. Within it, reconcile the next candidate against persisted document numbers before allocation (including after a restart). Never promise atomicity across PouchDB and Settings. For a partially successful bulk write, advance only past numbers actually persisted, keep failed documents unchanged, and show failures. Persist/reconcile counter failures before allowing another allocation. `InvoicesMW.jsx` `INVOICE_SET_STATUS` (single and array): read `normalizeNumbering(appConfig.get('invoice.numbering'))` once. Run each doc through `assignNumberIfMissing` in order, threading `numbering`. Then apply `withStatus`. After the write succeeds, `appConfig.set('invoice.numbering', numbering)` only if it changed. Apply the same to every other call site from Step 1 that can leave `draft`.
3. `FormMW.jsx`: after `INVOICE_EDIT` passes through, if `editMode.data.status === 'draft'` and `!editMode.data.invoiceID`, dispatch `updateFieldData('invoiceID', formatInvoiceNumber(…))`. In `handleSave`, advance numbering when the save is new **or** when `editMode.data.invoiceID` is empty and `data.invoiceID` is not empty.
4. `form.js` `getFormErrors`: an edited doc with `status === 'draft'` and no saved `invoiceID` needs a number in `'final'` mode (same rule as a new invoice).
5. `invoice.js` `getInvoiceNumber`: return `''` when `!invoice.invoiceID && invoice.recurringId`. In `columns.jsx`, show an empty number as muted text `invoices:number:none` ("No number yet").
6. Extend `numbering.spec.js`, `FormMW.spec.js`, `InvoicesMW.spec.js` (group C).

**Verify**: `npx vitest run app/helpers/__tests__/numbering.spec.js app/middlewares` → pass.

### Step 5: PouchDB database `recurring`

1. In `app/helpers/pouchDB.js` add `const recurringDB = new PouchDB('recurring', { adapter: 'idb' });` next to the others, and add `if (dbName === 'recurring') { return resolve(recurringDB); }` in `setDB` before the `invoices` branch (019 Step 5 pattern for `items`). 019 also adds an "Unknown database" reject at the end of `setDB`: add `'recurring'` to its list of known names, or `getAllDocs('recurring')` rejects. Do not touch the invoice migration queue.
2. `app/helpers/__mocks__/pouchDB.js`: add `recurringRecords: []` to `mockData` and a `'recurring'` branch to `getAllDocs`, `saveDoc`, `updateDoc`, `getSingleDoc`; `removeDocs`/`restoreDocs` return `mockData['recurringRecords']` for `docs` (follow the `items` mock from 019).
3. Add one test to `app/helpers/__tests__/pouchDB.spec.js`: `saveDoc('recurring', { _id: 'r1', name: 'A' })` then `getAllDocs('recurring')` contains `r1`, and `getAllDocs('invoices')` does not.

**Verify**: `npx vitest run app/helpers/__tests__/pouchDB.spec.js` → pass.

### Step 6: Runner and single-flight lock

1. `app/helpers/singleFlight.js`: `createSingleFlight(fn)` → `run(...args)`. If a run is in progress, return the same promise. Else start `fn`, store the promise, and clear it in `finally` (also on rejection).
2. `app/helpers/recurringRunner.js`: `runRecurringOnce({ now, db, makeId })`. `db` = `{ getAllDocs, saveDoc, getSingleDoc, updateDoc }` (default: the pouchDB helpers).
   - `profiles = await db.getAllDocs('recurring')`; `invoices = await db.getAllDocs('invoices')`; `existing = new Set(invoices.filter(i => i.recurringId).map(i => i.recurringId + '|' + i.periodKey))`.
   - For each profile: `{ periods, nextDate, capped } = getDuePeriods(profile, now)`. If `periods` is empty and `nextDate === profile.nextDate`, continue.
   - For each period not in `existing`: `saveDoc('invoices', buildInvoiceFromProfile(…))`. 409 → `skipped++`. Other error → push `{ profileId, error }` and stop this profile (do not advance `nextDate` past a failed period: set `nextDate` to the failed period).
   - Then `fresh = await db.getSingleDoc('recurring', profile._id)` and `updateDoc('recurring', { ...fresh, nextDate, lastRunAt: now })`. Reason: the user may have edited the profile during the run. If `fresh.nextDate` differs from `profile.nextDate` (the user changed the schedule), keep `fresh.nextDate`.
   - Return `{ created, skipped, capped: [profile names], errors }`.
3. Serialize runner execution with recurring profile save/pause/delete/template-update and backup import writes in this renderer. Re-read the profile before each period. If it was deleted, paused, or its schedule/template revision changed, stop that profile and recompute on the next trigger; do not create from stale data. Do not blindly merge an old `nextDate` into a fresh profile. On checkpoint 409, re-read and recompute with a bounded retry; report other errors, retain created drafts, and stop this profile. Treat a deterministic invoice 409 as skipped only after confirming the stored document (or tombstone) belongs to that profile/period; do not swallow unrelated conflicts. Deleting a generated invoice must not make the runner recreate that period. Backups must preserve the profile checkpoint; document the tombstone behavior in a real PouchDB test.
4. Write `singleFlight.spec.js` and `recurringRunner.spec.js` (groups D and E). The runner tests use an in-memory `db` object (arrays + a 409 on duplicate `_id`) and check the stored docs, not the calls.

**Verify**: `npx vitest run app/helpers/__tests__/singleFlight.spec.js app/helpers/__tests__/recurringRunner.spec.js` → pass. Commit.

### Step 7: Redux state, actions and middleware

1. `app/constants/actions.jsx`: add `RECURRING_GET_ALL`, `RECURRING_SAVE`, `RECURRING_SET_ACTIVE`, `RECURRING_DELETE`, `RECURRING_RESTORE`, `RECURRING_TEMPLATE_UPDATE`, `RECURRING_RUN`, `UI_RECURRING_SHEET_SET`, `UI_INVOICES_TAB_REQUEST`, `FORM_LOAD_TEMPLATE`. Rename nothing.
2. `app/actions/recurring.jsx`: one `createAction` per `RECURRING_*` type. `app/actions/ui.jsx`: `setRecurringSheet(v)` (`null | { mode: 'new', profile } | { mode: 'edit', id }`), `openInvoicesTab(tab)`.
3. `RecurringReducer.jsx`: `handleActions` → `action.payload` for get/save/set-active/delete/restore/template-update (same as `InvoicesReducer`). Register as `recurring` in `app/reducers/index.jsx`.
4. `UIReducer.jsx`: add `recurringSheet: null`, `invoicesTabRequest: null`. `UI_INVOICES_TAB_REQUEST` sets `activeTab: 'invoices'` and `invoicesTabRequest: payload` (`null` clears it).
5. `RecurringMW.jsx` (`({ dispatch, getState }) => next => action`), registered in `app/store/index.jsx` after `InvoicesMW`:
   - `RECURRING_GET_ALL`: `getAllDocs('recurring')` → `next`.
   - `RECURRING_SAVE` (payload: profile, maybe without `_id`): `previous = getState().recurring.find(p => p._id === payload._id)`; `doc = { ...payload, ...applyScheduleOnSave(previous, payload, Date.now()) }`; new → `_id: crypto.randomUUID()`, `created_at`, `lastRunAt: null`. `saveDoc`/`updateDoc` → `next`, success toast, close the sheet, then `dispatch(runRecurring())`.
   - `RECURRING_SET_ACTIVE` (`{ id, active }`): same path as save with the changed flag; run after resume.
   - `RECURRING_TEMPLATE_UPDATE` (`{ id, template }`): `getSingleDoc` → `updateDoc` with the new template → `next`.
   - `RECURRING_DELETE` / `RECURRING_RESTORE`: copy 014's `INVOICE_DELETE` / `INVOICE_RESTORE` (`removeDocs('recurring', ids)`, Undo toast for `UNDO_TIMEOUT_MS`, `restoreDocs`).
   - `RECURRING_RUN`: module-level `const runLocked = createSingleFlight(() => runRecurringOnce({ now: Date.now() }))`. `return runLocked().then(result => …)`: if `created > 0` → `dispatch(getInvoices())` and `toast.add({ title: t('recurring:toast:created', { count }), actionProps: { children: t('recurring:toast:viewDrafts'), onClick: () => dispatch(openInvoicesTab('draft')) } })`; always `dispatch(getRecurring())` when anything changed; `capped.length` → warning toast `recurring:toast:capped` with the names; `errors.length` → warning toast with the first message. Errors never throw out of the middleware.
6. Tests: `RecurringMW.spec.js`, `UIReducer.spec.js` (group F).

**Verify**: `npx vitest run app/middlewares/__tests__/RecurringMW.spec.js app/reducers` → pass.

### Step 8: Triggers — startup, hourly, resume

1. `app/helpers/recurringScheduler.js`: `startRecurringScheduler({ trigger, intervalMs = 3_600_000, subscribeResume })` → returns `stop()`. It calls `trigger()` once at once, then `setInterval(trigger, intervalMs)`, and `subscribeResume(trigger)` (which returns an unsubscribe function). `stop()` clears the interval and unsubscribes.
2. `main/power-events.js` (CommonJS):
   ```js
   const { powerMonitor, BrowserWindow } = require('electron');
   const appConfig = require('./settings');
   powerMonitor.on('resume', () => {
     const win = BrowserWindow.fromId(appConfig.get('mainWindowID'));
     if (win && !win.isDestroyed()) win.webContents.send('system-resumed');
   });
   ```
   In `app.js` `loadMainProcessFiles()`, add `require('./main/power-events');`.
3. `preload/index.js`: add `'system-resumed'` to `CHANNELS` (keep alphabetical order).
4. `app/App.jsx` startup `useEffect`: after the data loads, `const stop = startRecurringScheduler({ trigger: () => dispatch(RecurringActions.runRecurring()), subscribeResume: fn => { ipc.on('system-resumed', fn); return () => ipc.removeAllListeners('system-resumed'); } })`. Also `dispatch(RecurringActions.getRecurring())`. Call `stop()` in the cleanup.
5. `recurringScheduler.spec.js` with fake timers (group D).

**Verify**: `npx vitest run app/helpers/__tests__/recurringScheduler.spec.js` → pass; `npm run build` → exit 0; `grep -c "system-resumed" preload/index.js` → `1`. Commit.

### Step 9: Invoices page — Drafts link and "Make recurring"

1. `Invoices.jsx`: `const request = useSelector(s => s.ui.invoicesTabRequest)`. In a `useEffect` on `request`: if it is in `INVOICE_TABS`, `setTab(request)` and `setQuery('')`; then `dispatch(openInvoicesTab(null))` with `activeTab` unchanged (dispatch a clear action or make the reducer keep `activeTab` when the payload is `null`).
2. `InvoiceRowActions.jsx`: add "Make recurring" (lucide `Repeat`) after "Duplicate". Hide it when `getDocType(invoice) !== 'invoice'` (022 is required). Click → `dispatch(setRecurringSheet({ mode: 'new', profile: buildProfileFromInvoice(invoice, Date.now()) }))` and `dispatch(changeActiveTab('recurring'))`. Add the same button to the 014 detail sheet footer.

**Verify**: `npm run build` → exit 0. Manual: row menu shows "Make recurring" and opens the Recurring page with the sheet.

### Step 10: Editor template mode

1. `FormReducer.jsx`: add `templateTarget: null` (`{ profileId: string | null }` in template mode). `FORM_LOAD_TEMPLATE` (payload `{ template, profileId, contacts }`) = 015's populate helper + `editMode: { active: false }`, `invoiceID: ''`, `issuedAt: null`, `templateTarget: { profileId }`. `dueDate.offsetDays` survives populate. `FORM_CLEAR` sets `templateTarget: null`.
2. `form.js` `getFormErrors(form, 'template')` = `'final'` rules without `invoiceID`; due date in offset mode needs an integer `offsetDays` 0–365 (`form:errors:offsetDays`).
3. `preview.js` `formToPreviewInvoice`: in template mode, set `dueDate = materializeDueDate(form.dueDate, issuedAt)`.
4. `DetailsCard.jsx`: in template mode hide the number and issue date fields. The due-date toggle shows "Days after issue | Payment terms"; days mode = `Input type="number" min=0` bound to `dueDate.offsetDays` (`useCustom: true`, `selectedDate: null`).
5. `TotalsFooter.jsx`: in template mode show "Cancel" (ghost: `clearForm(null, true)` + `changeActiveTab('recurring')`) and "Save template" (primary: `saveFormData('template')`). `EditorLayout.jsx` title: `form:header:template`.
6. `FormMW.jsx` `handleSave` with mode `'template'`: errors as usual. `template = buildTemplateFromInvoice({ ...pickInvoiceFields(form, defaultCurrency), dueDate: form.dueDate })`. Save the new contact with the 015 rule. `profileId` → `dispatch(updateRecurringTemplate({ id, template }))`; `null` → `dispatch(setRecurringSheet({ mode: 'new', profile: { …defaults from buildProfileFromInvoice with startDate = today, template } }))`. Await the template update result; on rejection keep the editor and typed values. Only after success use `clearForm(null, true)` and `changeActiveTab('recurring')`. Never touch numbering. `saveFormData` payload creator must keep `'template'` (today it maps all non-`'draft'` values to `'final'`).
7. Tests (group G).

**Verify**: `npx vitest run app/reducers/__tests__/FormReducer.spec.js app/middlewares/__tests__/FormMW.spec.js app/helpers/__tests__/form.spec.js app/helpers/__tests__/preview.spec.js` → pass. Commit.

### Step 11: Recurring page, sidebar and palette

1. Add missing shadcn files only: `ls ui/components/ui/{table,sheet,dropdown-menu,select,switch,field,empty,input}.jsx`; run `npx shadcn@latest add <missing> --dry-run`, then without it. Answer "No" to overwrite prompts.
2. `app/containers/Recurring.jsx` (function component): header `<h1>` `recurring:header:name`, button "New recurring invoice" (lucide `Plus`) → `dispatch({ type: FORM_LOAD_TEMPLATE, payload: { template: {}, profileId: null, contacts } })` + `changeActiveTab('form')`. Rows sorted by `nextDate`. `RecurringEmpty` when there are no profiles: lucide `Repeat`, title, one sentence "Manta creates drafts while the app is open. Nothing is sent automatically.", and the same button.
3. `RecurringTable.jsx` (shadcn `Table`, no TanStack): columns Name (button → edit sheet), Client, Amount (`formatInvoiceAmount(template)`, `tabular-nums text-end`), Interval (`recurring:interval:<interval>` with `{ count: every }`, for example "Every 2 months"), Next draft (`moment(dateKeyToMs(nextDate)).format(dateFormat)`; "Paused" / "Ended" from `getRecurringStatus` as text, not color only), Active (`Switch`, `aria-label` with the name → `setRecurringActive`), actions.
4. `RecurringRowActions.jsx` (`DropdownMenu`, trigger `MoreHorizontal` with `aria-label`): Edit schedule (`Pencil`), Edit template (`FORM_LOAD_TEMPLATE` with the profile's template and id, then tab `form`), Pause/Resume (`Pause`/`Play`), separator, Delete (`Trash2`, destructive) → `deleteRecurring([id])`.
5. `RecurringSheet.jsx` (right `Sheet`, open when `ui.recurringSheet` is set): fields with shadcn `Field` — Name, Repeat every (`Input type=number min=1 max=99`) + interval `Select`, Start date and End date (015 `DatePickerField`, end clearable), Active `Switch`. Read-only summary: client, item count, total, and "Next drafts:" with the next 3 dates from `firstPeriodOnOrAfter` + `nextDateAfter` (stop at `endDate`). Inline errors from `getRecurringErrors`. Footer: Cancel, Save → `saveRecurring(profile)`. Hint text when the first date is today: `recurring:sheet:createsToday`.
6. `AppMain.jsx`: `{activeTab === 'recurring' && <Recurring />}`. `AppSidebar.jsx`: item "Recurring" (lucide `Repeat`, tab `recurring`) in the order Dashboard, Invoices, Estimates, Recurring, Clients, Items. `TitleBar.jsx`: title `app:nav:recurring`. `CommandPalette.jsx`: "Go to › Recurring" (`keywords: ['subscription', 'repeat', 'retainer']`).

**Verify**: `npm run build` → exit 0; `npm run lint` → exit 0.

### Step 12: Backup includes `recurring`

1. `backup.js`: `BACKUP_VERSION = 6` (019 = 2, 021 = 3, 022 = 4, 023 = 5). Accept supported versions 1–6; reject newer versions. Preserve every database and settings section from 019–023. `buildBackup({ …, recurring = [] })` adds `recurring: recurring.map(sanitizeDoc)`. `parseBackup`: `recurring` missing (any version) → `[]`; present but not an array → `invalid-format`. Valid recurring doc: plain object, `_id` rule as today, and all `getRecurringErrors` rules pass, including finite integer `every` 1–99, valid `startDate`/`endDate`, valid `anchorDay`, recipient and rows. Invalid persisted profiles are reported and skipped; they must not cause an unbounded loop. Count invalid and duplicate docs like the others.
2. `backupFlow.js`: `collectBackup` reads `getAllDocs('recurring')`. `previewImport` and `runImport` plan and write `recurring` after invoices; each incoming recurring doc goes through `normalizeImportedRecurring(doc, Date.now())` before `planMerge`. After import, dispatch `getRecurring()` and include recurring counts in the summary.
3. `main/backup-files.js` `serializeBackup`: add `recurring: payload.recurring ?? []`; throw if it is present and not an array.
4. Tests (group H).

**Verify**: `npx vitest run app/helpers/__tests__/backup.spec.js app/helpers/__tests__/backupFlow.spec.js main/__tests__/backup-files.spec.js` → pass. Commit.

### Step 13: Strings

Create `i18n/en/recurring.json` and register it in `i18n/en/index.js` (other locales fall back to English). Keys: `header.name`, `header.new`, `empty.{title,description}`, `columns.{name,client,amount,interval,nextDate,active,actions}`, `interval.{weekly,monthly,quarterly,yearly}` with `_one`/`_other` ("Weekly" / "Every {{count}} weeks"), `status.{paused,ended}`, `actions.{open,editSchedule,editTemplate,pause,resume,delete}`, `sheet.{titleNew,titleEdit,name,every,interval,startDate,endDate,active,summary,nextDates,createsToday,save,cancel}`, `errors.{name,every,interval,startDate,endDate,template}`, `toast.{created_one,created_other,viewDrafts,capped,runFailed,saved,deleted_one,deleted_other,undo,restored}`. Add `invoices.json` `actions.makeRecurring`, `number.none`; `form.json` `header.template`, `footer.saveTemplate`, `fields.dueDate.modeOffset`, `fields.dueDate.offsetDays`, `errors.offsetDays`; `app:nav:recurring` in the namespace 013 used for nav labels. Toast text: "{{count}} recurring invoice created as a draft" / "{{count}} recurring invoices created as drafts".

**Verify**: `grep -rn ">[A-Z][a-z]" app/components/recurring app/containers/Recurring.jsx | grep -v "{t("` → no output.

### Step 14: E2E, full checks and manual smoke

1. Add one test to `e2e/app.e2e.mjs`: show the main window if hidden (015 Step 13 pattern). Click sidebar "Recurring" → "New recurring invoice" → fill client name, email, one item → "Save template" → in the sheet type a name, keep start date today → Save. Click the toast action "View drafts" (or open Invoices › Draft) and expect 1 row. Then `await app.evaluate(({ powerMonitor }) => powerMonitor.emit('resume'))`, wait 2 s, and expect still 1 draft row. Use `getByRole` with the English labels.
2. Run `npm test`, `npm run lint`, `npm run test:e2e`.
3. Manual smoke list in "Test plan", in light and dark mode, on `/tmp/manta-profile-copy`. Take screenshots of the Recurring page and the sheet.

**Verify**: all three commands exit 0; smoke list done; screenshots saved outside the repo. Commit.

## Test plan

All new tests check behavior that can break silently. No markup or snapshot tests.

**A. `recurringSchedule.spec.js`** — run the whole suite three times with `describe.each(['UTC', 'America/New_York', 'America/Sao_Paulo'])`. In `beforeAll` set `process.env.TZ`; restore it in `afterAll`. First assert the zone took effect (`new Date(2026, 0, 15).getTimezoneOffset()` → `0` / `300` / `180`).
- `nextDateAfter` monthly anchor 31: `2026-01-31 → 2026-02-28 → 2026-03-31 → 2026-04-30`; anchor 30 in February → `02-28`; leap year `2028-01-31 → 2028-02-29`.
- Yearly anchor Feb 29: `2028-02-29 → 2029-02-28 → 2030-02-28 → 2031-02-28 → 2032-02-29`.
- Quarterly anchor 31: `2026-01-31 → 2026-04-30 → 2026-07-31`; `every: 2` monthly: `2026-01-15 → 2026-03-15`.
- Weekly across DST: `2026-03-07 → 2026-03-14`, `2026-10-31 → 2026-11-07` (NY DST change dates), `dateKeyToMs` of each formats back to the same key; `2018-11-04` in Sao_Paulo formats back to `2018-11-04`.
- `getDuePeriods`: `now` 1 ms before local midnight of `nextDate` → none; `now` at 00:00 and 23:59 local on `nextDate` → one; inactive → none; `endDate` inclusive (period on `endDate` created, next not); `endDate` before `nextDate` → none; 30 missed months → 12 periods, `capped: true`, `nextDate` = 13th period; second call with the returned `nextDate` → next 12; `every: 0` / `1.5` / unknown interval → none.
- Idempotency: calling twice with the same profile and `now` returns equal results (pure).
- `firstPeriodOnOrAfter`: start in the future → start; start 2025-01-31 monthly, date 2026-11-01 → `2026-11-30`; date equals a period → that date.

**B. `recurring.spec.js`**
- `buildTemplateFromInvoice` drops every `TEMPLATE_OMIT` key, sets `docType: 'invoice'`, does not share row objects with the input, converts a custom due date 14 days after issue to `offsetDays: 14`, keeps `paymentTerm`.
- `buildInvoiceFromProfile`: deterministic `_id`, `status: 'draft'`, no `invoiceID`, `issuedAt` = local midnight of the period, `recurringId` + `periodKey`, `offsetDays` → `selectedDate` at period + n days, payment term copied, numeric totals, new row ids.
- `applyScheduleOnSave`: new profile with past start → first period ≥ today (no back-fill); name-only edit keeps `nextDate`; interval change recomputes; resume with old `nextDate` skips paused periods; resume with future `nextDate` keeps it.
- `getRecurringErrors` (each rule), `getRecurringStatus` (3 values), `normalizeImportedRecurring` (old date fast-forwards; future date unchanged; invalid date fixed).

**C. Numbering** — `assignNumberIfMissing`: draft without number → pending gets `INV-000N`, counter +1; two docs in one bulk call get consecutive numbers; doc with number unchanged; old pending doc without number unchanged; `draft → draft` unchanged. `FormMW`: editing an unnumbered draft pre-fills the number; its first save advances the counter once; editing a numbered doc never advances. `InvoicesMW`: bulk "Mark as paid" on two recurring drafts stores two numbers and writes the counter once.

**D. Timing** (`vi.useFakeTimers()`; `vi.useRealTimers()` in `afterEach`)
- `singleFlight.spec.js`: two calls while the first is pending → `fn` runs once and both get the same result; a call after it settles runs again; a rejection clears the lock.
- `recurringScheduler.spec.js`: start → `trigger` once; `advanceTimersByTimeAsync(3_600_000)` → twice; the resume callback → three times; `stop()` → no more calls after another hour and the resume unsubscribe ran.

**E. `recurringRunner.spec.js`** (in-memory `db`): 3 missed monthly periods → 3 drafts and `nextDate` advanced; run again → 0 created; stale profile (nextDate not saved) + existing drafts → 0 created, `skipped` counted; a 409 on save → skipped, not an error; a failed save → `nextDate` stops at that period; profile edited during the run → its new `nextDate` is kept; paused profile → nothing.

**F. Redux** — `RecurringMW.spec.js`: two `RECURRING_RUN` dispatches at once → the runner runs once (mock `recurringRunner`); `created > 0` → `getInvoices` dispatched and the toast action dispatches `openInvoicesTab('draft')`; delete then the Undo action → `restoreDocs('recurring', removed)`. `UIReducer.spec.js`: `UI_INVOICES_TAB_REQUEST` sets tab + request; `null` clears the request only.

**G. Editor** — `FormReducer.spec.js`: `FORM_LOAD_TEMPLATE` sets `templateTarget`, empties `invoiceID`, keeps `offsetDays`; `FORM_CLEAR` resets it. `form.spec.js`: `'template'` mode ignores `invoiceID`, checks `offsetDays`. `FormMW.spec.js`: template save with `profileId` dispatches `RECURRING_TEMPLATE_UPDATE`, never writes numbering, never dispatches `INVOICE_SAVE`. `preview.spec.js`: offset due date is materialized.

**H. Backup** — `backup.spec.js`: version `V` file without `recurring` parses with `[]`; `recurring: {}` → `invalid-format`; invalid recurring doc dropped and counted; round trip keeps profiles without `_rev`. `backupFlow.spec.js`: imported profile with an old `nextDate` is written with a fast-forwarded `nextDate`; the safety snapshot includes `recurring`. `backup-files.spec.js`: `serializeBackup` writes `recurring`.

**Additional recovery tests**: runner checkpoint failure after one successful draft, restart, and retry create no duplicate; pause/delete/edit during a delayed period write stops later periods; deleting a generated draft does not recreate it; a bulk write with one failed document consumes only persisted numbers; a Settings write failure and restart cannot reuse a number; failed template save retains typed work; invalid imported `every`, `anchorDay`, `endDate`, recipient or rows cannot enter the runner.

**E2E**: Step 14.1. Replace the fixed 2-second wait with an observable completed run (test hook or run result), then assert one persisted draft.

**Manual smoke** (profile copy, light and dark): "Make recurring" on an invoice → sheet shows next month as start → Save → no draft today. New profile starting today → one draft appears at once with toast; "View drafts" opens Invoices › Draft. The draft shows "No number yet"; open it → number pre-filled; Save draft → counter +1. Catch-up: create a monthly profile that starts today, quit Manta, use a test-only injected `now` three months forward (do not change the host clock), start Manta → 3 new drafts (one per missed month), one toast; quit and start again → no new drafts. Pause → no drafts; resume → no back-fill. Delete profile → Undo brings it back. Close the window on macOS (hide), sleep the Mac, wake → no error toast, no duplicate. Export a backup → file has `recurring`. Remove the injected clock after the check.

## Done criteria

- [ ] `npx vitest run app/helpers/__tests__/recurringSchedule.spec.js app/helpers/__tests__/recurring.spec.js app/helpers/__tests__/recurringRunner.spec.js app/helpers/__tests__/singleFlight.spec.js app/helpers/__tests__/recurringScheduler.spec.js` → pass
- [ ] `grep -n "'recurring'" app/helpers/pouchDB.js` → DB line + `setDB` branch, adapter `idb`
- [ ] `grep -n "system-resumed" preload/index.js main/power-events.js app/App.jsx` → 1 hit each
- [ ] `grep -rn "Date.now()" app/helpers/recurringSchedule.js app/helpers/recurring.js` → no output
- [ ] `grep -rn "invoiceID" app/helpers/recurring.js` → only in `TEMPLATE_OMIT`
- [ ] `npm test` → exit 0 · `npm run lint` → exit 0 · `npm run test:e2e` → exit 0
- [ ] Manual smoke done in light and dark mode; screenshots taken
- [ ] `git log --format=%B <base>..HEAD | grep -i "co-authored\|generated with"` → no output

## STOP conditions

- A precondition fails (missing 014 Drafts tab, 015 numbering helpers, 016 backup, or 013 toast).
- Setting `process.env.TZ` inside a spec does not change `getTimezoneOffset()` (the zone sanity assert fails). Do not weaken the DST tests; report.
- Any test or manual run creates two drafts for one `recurringId` + `periodKey`.
- A step needs to change or delete existing invoices, contacts or settings keys, or to drop the `idb` adapter.
- `powerMonitor.on('resume', …)` throws when required from `loadMainProcessFiles()`.
- 015's editor cannot run in template mode without changing its save path for normal invoices (a regression in `FormMW.spec.js` existing cases).
- A call site outside the Step 1 list moves invoices out of `draft` and you cannot apply `assignNumberIfMissing` there.

## Maintenance notes

- Profile dates are `YYYY-MM-DD` local strings. Never store them as ms. Convert with `dateKeyToMs` only when you build an invoice or show a date.
- Always compute the next period with `nextDateAfter(…, anchorDay)`. Never chain `moment.add(1, 'month')`: it drifts after a short month.
- Recurring drafts have no number until a save or a status change. Any new code that moves a doc out of `draft` must call `assignNumberIfMissing` (020 payments, 022 conversions, future bulk actions).
- The deterministic `_id` (`rec-<profileId>-<periodKey>`) is part of the idempotency guarantee. Do not change its format without a plan for existing docs.
- The runner only runs in the main window renderer. Do not start it in the preview window: two renderers would race (the `_id` guard prevents duplicates, but toasts would show twice).
- Catch-up is capped at 12 per profile per run; later runs (hourly) continue. If users complain about many drafts after a long break, add a "skip missed periods" choice in the toast.
- Later candidates: dashboard (017) "Upcoming recurring" card, a "Create now" action, a "Recurring" badge in the invoice list (filter on `recurringId`).
- No AI or tool attribution in commits or PRs (AGENTS.md).
