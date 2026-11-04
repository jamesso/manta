# Plan 017: Add a dashboard with outstanding, overdue and paid totals and an onboarding checklist, and remove the tour window

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index. Do NOT add `Co-authored-by` trailers or any AI/tool
> attribution to commits; pass this rule to any subagent you start.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- main/tour.js tour/ i18n/*/tour.json main/save-pdf.js helpers/formatNumber.js app/reducers/UIReducer.jsx app/reducers/__tests__/UIReducer.spec.js app/reducers/InvoicesReducer.jsx app/middlewares/UIMiddleware.jsx`
> Earlier plans intentionally change `UIReducer`, its tests, `InvoicesReducer` and `UIMiddleware` (013/014), plus the tour HTML/entry CSS and `main/modal-window.js` (012). Read those live contracts. The remaining paths should match their cited state. On any other change, compare
> with "Current state" and STOP on a mismatch.
> These files are changed on purpose by earlier plans. Read their live content
> instead of the excerpts: `app.js` (012 theme `backgroundColor`, 013 title bar),
> `main/menu.js` (013), `preload/index.js` (012 `set-theme`, 016 backup
> channels), `electron.vite.config.mjs` (012 Tailwind, alias), `ui/styles/globals.css`
> (012), `app/App.jsx`, `app/components/layout/*` (013), `app/helpers/invoice.js`,
> `app/middlewares/InvoicesMW.jsx` (014), `app/helpers/form.js` (013, 015),
> `app/middlewares/SettingsMW.jsx`, `app/reducers/SettingsReducer.jsx` (016),
> `e2e/app.e2e.mjs` (012–016 may add tests), `i18n/en/*.json` (all).

## Execution checks added by review (2026-11-01)

- Record the execution start commit and starting changes. Scope checks compare this plan's changes with that baseline, not with a clean-tree requirement. Earlier plans can change the listed files; check the required behavior before treating expected changes as drift.
- Before a live app check, use Jean `get_run_environments`; use its running environment or `start_run_environment`. Do not start a second dev server by hand. Confirm that the environment uses a disposable `MANTA_USER_DATA` profile. Record the exact URL or Electron entry and profile used. If no Run command is configured, report that limit.
- Use the narrow tests listed for each changed behavior. Reuse passing results when the covered code has not changed. Run broad tests once at the final integration gate for shared state, persistence or IPC changes. Visual checks require the running app; do not replace them with markup assertions.
- Do not copy a profile while Manta is running. Close it first. Use a new temporary destination, or confirm the existing destination is disposable; repeated `cp -R` into an existing folder can create a nested profile.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (removes a window; changes first-run behavior; e2e changes)
- **Depends on**: plans/016-*.md (and transitively 012–015). Requires the final editor, client and Settings section contracts.
- **Category**: ui-redesign
- **Planned at**: commit `3e89104`, 2026-11-01

## Why this matters

The app opens on an empty invoice form. A user cannot see what is owed, what is late, or what came in this month. Today a new user gets a 5-slide carousel in a separate frameless window. NN/g finds that carousel tutorials are skipped and forgotten (https://www.nngroup.com/articles/mobile-app-onboarding/). The tour also costs a fourth renderer entry, a main-process module, a preload channel and 9 translation files. After this plan, the app opens on a Dashboard. It shows money per currency, a monthly paid chart, a "Needs attention" list and recent invoices. A new user sees a checklist of real tasks with links. The tour window is gone.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current` | current branch; record its name, do not switch |
| 012 Tailwind/shadcn | `test -f components.json && test -f ui/styles/globals.css && echo ok` | `ok` |
| 012 chart and status tokens | `grep -c -e "--chart-1" -e "--status-overdue" ui/styles/globals.css` | `2` or more |
| 013 sidebar | `test -f app/components/layout/AppSidebar.jsx && echo ok` | `ok`. If not, find the sidebar: `grep -rln "SidebarMenu" app ui` and use that file. |
| 013 toast API | `grep -rln "toast.add\|createToastManager" ui app \| head` | at least one hit |
| 014 helpers | `grep -n "export.*getDisplayStatus\|export.*getDueDate\|getDisplayStatus,\|getDueDate," app/helpers/invoice.js` | both names exported |
| 014 invoice sheet | `grep -rln "Sheet" app/components/invoices app/containers` | at least one hit (the invoice detail sheet) |
| 015 issued date | `grep -rn "issuedAt" app/helpers/form.js \| head -3` | at least one hit; otherwise finish 015 first |
| Unit tests green | `npm test` | exit 0 |
| e2e green | `npm run test:e2e` | all pass |

## Current state

`app/reducers/UIReducer.jsx:4-8` — default tab is the form:

```js
const initialState = {
  activeTab: 'form',
  notifications: [],
  checkUpdatesMessage: {},
};
```

`app/reducers/__tests__/UIReducer.spec.js:4-12` repeats `activeTab: 'form'` and asserts `UIReducer(undefined, {})` equals it.

`app/components/layout/AppMain.jsx:19-29` (013 may have restyled it; the switch on `activeTab` stays):

```js
  render() {
    const { activeTab } = this.props;
    return (
      <AppMainContent>
        {activeTab === 'form' && <Form />}
        {activeTab === 'invoices' && <Invoices />}
        {activeTab === 'contacts' && <Contacts />}
        {activeTab === 'settings' && <Settings />}
      </AppMainContent>
    );
  }
```

`app/components/layout/AppNav.jsx:12-33` held the tab list (`form`, `invoices`, `contacts`, `settings`). Plan 013 replaces it with `app/components/layout/AppSidebar.jsx`. Check the live sidebar file.

`app/reducers/InvoicesReducer.jsx:20-21`: `export const getInvoices = state => state.invoices;`. `app/reducers/ContactsReducer.jsx:18`: `export const getContacts = state => state.contacts;`.

`app/helpers/form.js:77-86` — invoice metadata on save. Edit mode copies only these fields from the old doc, so any new field (like `paidAt`) is lost on edit unless you add it here:

```js
  return Object.assign({}, invoiceData, {
    // Metadata
    _id: editMode.active ? editMode.data._id : crypto.randomUUID(),
    _rev: editMode.active ? editMode.data._rev : null,
    created_at: editMode.active ? editMode.data.created_at : Date.now(),
    status: editMode.active ? editMode.data.status : 'pending',
    // Alway calculate subtotal & grandTotal
    subtotal: getInvoiceValue(invoiceData).subtotal,
    grandTotal: getInvoiceValue(invoiceData).grandTotal,
  });
```

`app/helpers/form.js:64-68` — `invoice.currency` is an object `{ code, placement, separator, fraction }`. It falls back to `appConfig.get('invoice.currency')`.

`app/middlewares/InvoicesMW.jsx:148-153` (duplicate copies every field) and `:206-214` (status change):

```js
      case ACTION_TYPES.INVOICE_DUPLICATE: {
        const duplicateInvoice = Object.assign({}, action.payload, {
          created_at: Date.now(),
          _id: crypto.randomUUID(),
          _rev: null,
        });
...
      case ACTION_TYPES.INVOICE_SET_STATUS: {
        const { invoiceID, status } = action.payload;
        return getSingleDoc('invoices', invoiceID)
          .then(doc => {
            dispatch({
              type: ACTION_TYPES.INVOICE_UPDATE,
              payload: Object.assign({}, doc, { status }),
            });
```

`app/middlewares/__tests__/InvoicesMW.spec.js:515-528` asserts that payload is exactly `Object.assign({}, doc, { status })`.

`app/middlewares/SettingsMW.jsx:18-31` — the renderer loads only three settings groups:

```js
      case ACTION_TYPES.SETTINGS_GET_INITIAL: {
        const savedSettings = {
          profile: appConfig.get('profile'),
          invoice: appConfig.get('invoice'),
          general: appConfig.get('general'),
        };
        return next(
          Object.assign({}, action, {
            payload: { current: savedSettings, saved: savedSettings },
```

`helpers/formatNumber.js:30` — `formatNumber(number, fraction, separator)` returns a string. `app/components/invoices/Invoice.jsx:274-318` shows the money pattern: `currency.placement === 'before'` puts `currency.code` before the number.

`app.js` — tour window and first-run logic:
- `:37` `let tourWindow = null;` and `:41-76` `createTourWindow()` (700×600, `frame: false`, `resizable: false`, `movable: false`, `appConfig.set('tourWindowID', …)`, `loadPage(tourWindow, 'tour')`).
- `:169-177` defaults `tour: { isActive: false, hasBeenTaken: false }` and `winsLastVisibleState: { isMainWinVisible: true, isPreviewWinVisible: false }`.
- `:178-186` default `profile` has placeholder values: `fullname: 'Manta Ray'`, `company: 'Oceanic Preservation Society'`, and `logo` = `'data:image/svg+xml;base64,' + base64(static/imgs/default_logo.svg)`.
- `:221-240` `setInitialValues()` adds missing level-1 and level-2 keys only.
- `:353` `tourWindow.destroy();` in `quit-and-install`; `:369` `require('./main/tour');`; `:427` `createTourWindow();`; `:436-437` and `:441-442` `require('./main/tour').showWindow('startup' | 'activate')`; `:448` `if (tourWindow !== null) tourWindow.destroy();`.

`main/tour.js:53-77` — first run is detected from `tour.isActive` / `tour.hasBeenTaken`. A fresh profile calls `startTour()`, which hides main + preview and shows the tour. `showWhenReady(win)` (`:43-51`) waits for `ready-to-show`. `restoreWindows()` (`:79-90`) reads `winsLastVisibleState`.

`main/menu.js:121-146` — Go menu: Invoices `CmdOrCtrl+Shift+A`, Contacts `CmdOrCtrl+Shift+D`, Settings `CmdOrCtrl+Shift+S` (013 changes Settings to `CmdOrCtrl+,`), each `mainWindow.webContents.send('menu-change-tab', '<tab>')`. `:181-187` Help › "Show Tutorial", `CmdOrCtrl+T`, `ipcMain.emit('start-tour')`. No `CmdOrCtrl+<digit>` accelerator exists at HEAD.

`preload/index.js:10` `'end-tour',` and `:34` `'start-tour',` in `CHANNELS`. `preload/__tests__/index.spec.js:59,68,70` uses `'end-tour'` as a sample allowed channel.

`main/save-pdf.js:16-25` — PDF success path (runs in main; `win` is the preview window):

```js
    await fs.promises.writeFile(pdfPath, data);
    if (appConfig.get('general.previewPDF')) {
      // Open the PDF with the default reader
      await shell.openPath(pdfPath);
    }
    win.webContents.send('pfd-exported', {
```

`electron.vite.config.mjs:51` `tour: root('./tour/index.html'),` in renderer inputs. 012 also adds `@source "../../tour";` in `ui/styles/globals.css`.

`tour/` files (all deleted by this plan): `tour/Tour.jsx`, `tour/index.html`, `tour/index.jsx`, `tour/components/Actions.jsx`, `tour/components/Slide.jsx`, `tour/components/slides/{Create,Preview,Save,Success,Welcome}.jsx`, `tour/containers/Slider.jsx`, `tour/imgs/{Create,Preview,Save,Success,Templates,Welcome}.svg`.

`i18n/{de,en,fr,id,it,sk,ur-PK,vi,zh-CN}/tour.json` (9 files). Each `i18n/<lng>/index.js` has `import tour from './tour.json';` (line 9) and `tour,` (line 20). No code outside `tour/` uses the `tour:` namespace.

`e2e/app.e2e.mjs`: `:6` `const TOUR_TITLE = 'Tour';`; `:29-39` waits for `>= 3` windows; `:73-79` test `creates the Tour, Manta and Previewer windows`; `:81-106` test `fresh profile shows the tour window` (tour visible 700×600, main and preview hidden); `:108-124` test `tour next control is on screen and advances`. The modal window is created on demand only (`main/modal-window.js:6`), so a fresh start has 2 windows after this plan.

`.github/CONTRIBUTING.md:44` mentions "(windows, startup, tour)".

`vitest.config.mjs:7-9` runs tests with `TZ: 'UTC'`.

## Reference facts (recheck versions and APIs at execution)

- Recharts 3.10.1 (`npm view recharts version`). Peer deps: `react`, `react-dom` and `react-is` `^16.8 || … || ^19.0.0`. Install `react-is` at the same major as `react` (19). Recharts 3 ships its own `react-redux` 9 store in a private React context; the app store is not affected.
- shadcn Chart (Base UI): install `npx shadcn@latest add chart`. Exports `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`. `ChartContainer` needs a height, `min-h-*` or `aspect-*`. With Recharts v3 use `var(--chart-1)` (not `hsl(var(--chart-1))`). Inside the chart use `var(--color-<key>)`. `accessibilityLayer` adds keyboard and screen-reader support. Source: https://ui.shadcn.com/docs/components/base/chart
- shadcn components list (card, select, empty, sheet, badge, button, chart): https://ui.shadcn.com/docs/components ; theming and `chart-1..5` tokens: https://ui.shadcn.com/docs/theming
- lucide-react 1.66.0 (`npm view lucide-react version`); icon `LayoutDashboard` exists. https://lucide.dev/guide/version-1
- Empty states guidance: https://www.nngroup.com/articles/empty-state-interface-design/ ; undo over confirmation: https://www.nngroup.com/articles/confirmation-dialog/ ; no carousel tutorials: https://www.nngroup.com/articles/mobile-app-onboarding/
- `static/imgs/default_logo.svg` is ASCII only (1765 bytes, no trailing newline). So `'data:image/svg+xml;base64,' + btoa(rawSvg)` in the renderer equals the main-process value from `app.js:164-167`. Checked with Node on 2026-11-01.
- electron-store `store.delete(key)` accepts dot paths.
- Confirm versions at execution time with `npm view <pkg> version`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| One spec | `npx vitest run <path>` | exit 0 |
| All unit tests | `npm test` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| e2e | `npm run test:e2e` | all pass |
| Build | `npm run build` | exit 0 |
| Run on a data copy | `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy && MANTA_USER_DATA=/tmp/manta-profile-copy npm start` | app opens on Dashboard |
| Fresh profile | `MANTA_USER_DATA="$(mktemp -d)" npm start` | app opens on Dashboard with checklist |

## Scope

**In scope — create:**
- `app/helpers/dashboard.js` + `app/helpers/__tests__/dashboard.spec.js`
- `app/helpers/onboarding.js` + `app/helpers/__tests__/onboarding.spec.js`
- `app/containers/Dashboard.jsx`
- `app/components/dashboard/{KpiCards,PaidChart,NeedsAttention,RecentInvoices,OnboardingChecklist}.jsx`
- `i18n/en/dashboard.json`
- `ui/components/ui/chart.jsx` (and `card`, `empty`, `select` if not present) via the shadcn CLI

**In scope — change:** `app/reducers/UIReducer.jsx` + spec, `app/components/layout/AppMain.jsx`, `app/components/layout/AppSidebar.jsx`, the 013 command palette and shortcuts list files, `app/App.jsx`, `app/helpers/invoice.js` (+ spec), `app/helpers/form.js` (+ spec), `app/middlewares/InvoicesMW.jsx` (+ spec), `app/middlewares/SettingsMW.jsx` (+ spec), `app/reducers/SettingsReducer.jsx` (+ spec), `app/actions/settings.jsx`, `app/constants/actions.jsx`, `app.js`, `helpers/windows.js`, `main/menu.js`, `main/save-pdf.js`, `preload/index.js` + `preload/__tests__/index.spec.js`, `electron.vite.config.mjs`, `ui/styles/globals.css` (only the `@source` tour line), `i18n/*/index.js`, the i18n file that holds 013 nav labels, `e2e/app.e2e.mjs`, `.github/CONTRIBUTING.md:44`, `package.json`, `package-lock.json`.

**In scope — delete:** `main/tour.js`, the whole `tour/` folder, `i18n/*/tour.json` (9 files).

**Out of scope:** reports and aging tables, recurring invoices, CSV/backup (016), invoice editor (015), any data migration of invoices (no backfill of `paidAt`), translations into other locales (they fall back to English).

## Git workflow

- Stay on the current branch. Do not switch branches, create a worktree or push.
- Commit subjects: short, imperative, no prefix, no attribution. Suggested commits:
  `Record the paid date when an invoice is marked paid`, `Add dashboard selectors`, `Add onboarding checklist state`, `Add the Dashboard page`, `Start on the Dashboard`, `Record the first PDF export`, `Remove the tour window`, `Update e2e tests for the Dashboard start`.

## Steps

### Step 1: Confirm preconditions

Run every check in "Preconditions". Read the live `getDisplayStatus` and `getDueDate` in `app/helpers/invoice.js`. Write down their signatures. This plan assumes `getDisplayStatus(invoice, now) → 'draft'|'pending'|'overdue'|'paid'|'refunded'|'cancelled'` and `getDueDate(invoice) → ms timestamp | null`. If they differ, adapt the calls in Steps 2–4.

**Verify**: all checks pass; `npx vitest run app/helpers/__tests__/invoice.spec.js` → exit 0.

### Step 2: Use the `paidAt` field from 014 and keep it on edit

Plan 014 already records `paidAt`. Its helper `withStatus(doc, status, now)` in `app/helpers/invoice.js` sets `paidAt` when an invoice becomes paid, keeps it when the invoice is already paid, and removes it when the status changes away from paid. 014 also removes `paidAt` from duplicates. Do not add a second status helper.

1. Run `grep -n "withStatus" app/helpers/invoice.js app/middlewares/InvoicesMW.jsx`. Expected: the export in `invoice.js` and at least one call in `InvoicesMW.jsx`. If there is no hit, STOP (014 is not done).
2. Find every other place that writes `status`: `grep -rn "status:" app/middlewares app/helpers app/containers app/components | grep -v __tests__`. Each user status change must go through `withStatus`. If one does not, route it through `withStatus`.
3. In `app/helpers/invoice.js` add and export `getPaidDate(invoice)`. It returns `invoice.paidAt ?? invoice.issuedAt ?? invoice.created_at ?? null`. Add a JSDoc comment: "Invoices marked paid before plan 014 have no `paidAt`. They fall back to the issue date, then the creation date. No backfill is done."
4. In `app/helpers/form.js` (the metadata block at `:77-86` at HEAD; 015 may have moved it), keep `paidAt` in edit mode: `paidAt: editMode.active ? editMode.data.paidAt : undefined`. PouchDB drops `undefined` keys. First check if 015 already does this (`grep -n "paidAt" app/helpers/form.js`). If it does, skip this item.
5. Tests:
   - `app/helpers/__tests__/invoice.spec.js`: `getPaidDate` fallbacks (paidAt, then issuedAt, then created_at, then null).
   - `form.spec.js`: edit mode keeps `paidAt` from `editMode.data` (skip if 015 added this test).

**Verify**: `npx vitest run app/helpers/__tests__/invoice.spec.js app/middlewares/__tests__/InvoicesMW.spec.js app/helpers/__tests__/form.spec.js` → exit 0.

### Step 3: Dashboard selectors (`app/helpers/dashboard.js`)

Pure functions. No React, no `window`, no i18n. `now` is a ms timestamp. All day and month boundaries use **local time** (`new Date(y, m, d)`), the same rule as 014's "start of today". Never add amounts of different currencies.

Shared private helpers:
- `amountOf(inv)`: `Number.isFinite(inv.grandTotal) ? inv.grandTotal : Array.isArray(inv.rows) ? getInvoiceValue(inv).grandTotal : 0`.
- `currencyOf(inv, fallback)`: `inv.currency?.code ?? (typeof inv.currency === 'string' ? inv.currency : fallback.code)`.
- Sum raw numbers. Round only at display.

Export:
1. `getDashboardStats(invoices, now, fallbackCurrency)` → `{ currencies, byCurrency, counts }`.
   - `byCurrency[code] = { outstanding, overdue, paidThisMonth, draftCount, overdueCount, outstandingCount, currency }`.
   - outstanding = sum of invoices whose `getDisplayStatus` is `pending` or `overdue` (overdue is part of outstanding).
   - overdue / overdueCount = display status `overdue`.
   - paidThisMonth = `status === 'paid'` and `getPaidDate` in `[start of month(now), start of next month)`.
   - draftCount = `status === 'draft'`.
   - `currency` = the currency object (`code`, `placement`, `separator`, `fraction`) from the newest invoice in that code, else `fallbackCurrency`. Used for display only.
   - `refunded` and `cancelled` count nowhere.
   - `currencies` = codes sorted by number of invoices, descending; ties by code.
   - `counts = { draft, overdue }` = totals across currencies (counts may be added; money may not).
2. `getMonthlyPaid(invoices, now, months = 6, fallbackCurrency)` → `{ [code]: [{ key: 'YYYY-MM', start: ms, total }] }`. Exactly `months` entries per currency, oldest first, last = current month, empty months have `total: 0`. Only `status === 'paid'`, bucketed by `getPaidDate`. Paid dates outside the window are ignored.
3. `getNeedsAttention(invoices, now, days = 7)` → array of invoices: first all display-status `overdue` sorted by due date ascending, then `pending` invoices with `getDueDate` in `[start of today, start of today + days + 1 days)` sorted ascending. Invoices without a due date are excluded.
4. `getRecentInvoices(invoices, limit = 5)` → newest first by `issuedAt ?? created_at`.
5. `formatMoney(amount, currency)`: `formatNumber(amount, currency.fraction, currency.separator)` with `currency.code` before or after per `currency.placement` (same as `Invoice.jsx:274-318`). If 014–016 already added a money formatter (`grep -rn "formatMoney\|formatCurrency\|formatAmount" app ui`), reuse it instead and do not add this one.

Tests in `app/helpers/__tests__/dashboard.spec.js` (build docs with a small `inv({...})` factory; set `now` explicitly):
- USD 100 + EUR 50 pending → two entries; no field equals 150.
- Overdue pending counts in both outstanding and overdue; due-today is not overdue.
- Paid at `2026-10-31T23:59:59.999Z` → October bucket; `2026-11-01T00:00:00.000Z` → November and `paidThisMonth` for `now = 2026-11-15`.
- `getMonthlyPaid` with `now = 2026-02-10` returns keys `2025-09 … 2026-02` (year boundary), zeros included.
- Old doc: no `status` → counted as pending; no `paidAt` but `issuedAt` → bucket by `issuedAt`; neither → `created_at`; no `grandTotal` but `rows` → computed total; no `currency` → fallback code.
- Draft, refunded, cancelled excluded from money; draft counted in `draftCount`.
- `getNeedsAttention`: overdue first, then due within 7 days; day 8 excluded; no-due-date excluded.
- Float sums: use `toBeCloseTo`.

**Verify**: `npx vitest run app/helpers/__tests__/dashboard.spec.js` → exit 0.

### Step 4: Checklist state (`app/helpers/onboarding.js`)

1. Export `PLACEHOLDER_PROFILE = { fullname: 'Manta Ray', company: 'Oceanic Preservation Society' }`. Add a comment: "Keep in sync with the defaults in `app.js` `setInitialValues()`". (If 016 changed those defaults, copy the live values.)
2. Export `isDefaultLogo(logo, defaultLogoDataUrl)`: true when `logo === defaultLogoDataUrl`.
3. Export `getChecklistState({ profile, onboarding }, invoices, contacts, defaultLogoDataUrl)` → `{ items, doneCount, total, allDone, dismissed }`. `items` in this order, each `{ id, done }`:
   - `profile`: `fullname` or `company` is a non-empty trimmed string that differs from its placeholder.
   - `logo`: `profile.logo` is a non-empty string and not `isDefaultLogo`.
   - `client`: `contacts.length > 0`.
   - `invoice`: `invoices.length > 0` (drafts count).
   - `pdf`: `onboarding?.exportedPdf === true`.
   - `dismissed`: `onboarding?.dismissed === true`. Missing `onboarding` → both false.
4. In the renderer, build `defaultLogoDataUrl` once in `app/containers/Dashboard.jsx`: `import rawLogo from '../../static/imgs/default_logo.svg?raw';` then `'data:image/svg+xml;base64,' + btoa(rawLogo)`. Pass it in. The helper stays pure.
5. Tests in `app/helpers/__tests__/onboarding.spec.js`: fresh defaults → 0 done; changed company only → profile done; empty strings → not done; custom logo vs default logo; contacts/invoices present; `exportedPdf` true; dismissed true; `onboarding` missing (old settings file) → no crash, both false; all five → `allDone`.

Known limit (write it in the JSDoc): profiles installed before commit `9ae5798` may store an older default logo, so "Add logo" shows as done for them. Existing users never had `exportedPdf`; that item stays open until their next export. Both are acceptable; the user can dismiss.

**Verify**: `npx vitest run app/helpers/__tests__/onboarding.spec.js` → exit 0.

### Step 5: Store the onboarding flags

1. `app.js` `setInitialValues()` defaults: add `onboarding: { dismissed: false, exportedPdf: false }`. The existing level-1/level-2 loop adds it to old Settings files without touching other keys.
2. `app/constants/actions.jsx`: add `SETTINGS_ONBOARDING_UPDATE`. `app/actions/settings.jsx`: add `updateOnboarding = createAction(SETTINGS_ONBOARDING_UPDATE, patch => patch)`.
3. `SettingsMW.jsx`: in `SETTINGS_GET_INITIAL` add `onboarding: appConfig.get('onboarding') ?? { dismissed: false, exportedPdf: false }` to the loaded object (read the live middleware; 016 may have changed its shape). Add a case for `SETTINGS_ONBOARDING_UPDATE`: for each key in the patch call `appConfig.set('onboarding.<key>', value)`, then `next(action)`. Do not write `onboarding` in any other save path.
4. `SettingsReducer.jsx`: on `SETTINGS_ONBOARDING_UPDATE`, merge the patch into `current.onboarding` **and** `saved.onboarding`.
5. `main/save-pdf.js`: after `writeFile` succeeds, add:
   ```js
   if (!appConfig.get('onboarding.exportedPdf')) {
     appConfig.set('onboarding.exportedPdf', true);
     const main = BrowserWindow.fromId(appConfig.get('mainWindowID'));
     if (main && !main.isDestroyed())
       main.webContents.send('onboarding-updated', { exportedPdf: true });
   }
   ```
   Keep it inside the `try` so a failed export never sets the flag.
6. `preload/index.js`: add `'onboarding-updated'` to `CHANNELS` (alphabetical).
7. `app/App.jsx`: `ipc.on('onboarding-updated', (e, patch) => dispatch(SettingsActions.updateOnboarding(patch)))`; add the channel to the `removeAllListeners` list. (Writing the same value again in the middleware is harmless.)
8. Tests: `SettingsReducer.spec.js` — the update merges into both `current` and `saved` and keeps other keys. `SettingsMW.spec.js` — after the action, the mocked settings store holds `onboarding.dismissed === true` (assert on the stored value in a fake Map-backed store, not only that `set` was called); `SETTINGS_GET_INITIAL` with no `onboarding` key returns the defaults.

**Verify**: `npx vitest run app/reducers/__tests__/SettingsReducer.spec.js app/middlewares/__tests__/SettingsMW.spec.js preload/__tests__/index.spec.js` → exit 0.

### Step 6: Build the Dashboard page

1. `npm install recharts@^3.10.1 react-is@^19` then `npx shadcn@latest add chart card empty select` (skip components that already exist; answer "no" to overwrite prompts). Check `ui/components/ui/chart.jsx` exists and is JSX.
2. `app/containers/Dashboard.jsx` (function component, `useSelector` / `useDispatch`): reads `getInvoices`, `getContacts`, `getCurrentSettings`. Wait for explicit initial-load completion of settings/invoices/contacts before showing empty states or checklist results; add load-completion flags at the existing initial-load actions if none exist (include their actions/reducers/middleware in Scope and tests). Computes stats with `useMemo` and `now` from 014's `useNow()` hook (focus refresh plus a cleaned-up minute timer). Layout top to bottom: page heading "Dashboard" (`<h1>`), `OnboardingChecklist` (only when `!dismissed`), currency switcher, `KpiCards`, `PaidChart`, then a two-column grid (`lg:grid-cols-2`, stacked on narrow windows) with `NeedsAttention` and `RecentInvoices`.
3. Currency switcher: shadcn `Select`, shown only when `currencies.length > 1`. Default = `settings.invoice.currency.code` if that code is in `currencies`, else `currencies[0]`. Component state only; do not persist. Reconcile it whenever available codes change; if the selected code disappears, choose the configured code when present or the first available code.
4. `KpiCards.jsx`: 4 shadcn `Card`s in a responsive grid: Outstanding (amount + "N invoices"), Overdue (amount + count; icon + text in `--status-overdue` color, never color alone), Paid this month, Drafts (`counts.draft`). Amounts use `formatMoney` and the `tabular-nums` class. When there are no invoices, show `—` and no fake zero amounts.
5. `PaidChart.jsx`: `ChartContainer` with `className="h-56 w-full"` and `config={{ total: { label: t('dashboard:chart.paid'), color: 'var(--chart-1)' } }}`. `BarChart accessibilityLayer data={rows}`; `XAxis dataKey="label"` where `label = new Intl.DateTimeFormat(i18n.language, { month: 'short' }).format(start)`; `Bar dataKey="total" fill="var(--color-total)" radius={4}`; `ChartTooltip content={<ChartTooltipContent />}` with values via `formatMoney`. If the document direction is `rtl`, set `reversed` on `XAxis`. If every total is 0, render shadcn `Empty` ("No payments in the last 6 months") instead of the chart.
6. `NeedsAttention.jsx`: list from `getNeedsAttention` (max 8 rows). Each row is a `<button>`: client name, invoice number, due date, amount, and 014's status badge. Click opens 014's invoice detail sheet. Find how 014 opens it: `grep -rn "Sheet" app/containers/Invoices.jsx app/components/invoices`. If 014 exposes a Redux action, dispatch it. If the sheet is local state of the Invoices page, render the same sheet component in `Dashboard.jsx` with local `selectedId` state. Empty state: "Nothing needs attention".
7. `RecentInvoices.jsx`: 5 rows from `getRecentInvoices`, same row button and sheet. Footer link "View all invoices" → `changeActiveTab('invoices')`. Empty state: `Empty` with a "New invoice" button that runs the same action as 013's "New invoice".
8. `OnboardingChecklist.jsx`: a `Card` with heading "Get started with Manta", text "{{done}} of {{total}} done", and an `<ol aria-label="Setup steps">` of 5 items. Each item: check icon (`CircleCheck` done / `Circle` open) + label + a link button. Targets:
   - profile, logo → `changeActiveTab('settings')` and 016's Business profile section (check how 016 selects a section; if it has no API, open the Settings tab only).
   - client → `changeActiveTab('contacts')` (016's "New client" action if one exists).
   - invoice → 013's "New invoice" action.
   - pdf → when an invoice exists, `ipc.send('preview-invoice', newestInvoice)` (existing channel, see `InvoicesMW.jsx:76`); otherwise disabled with hint "Create an invoice first".
   - Done items show no link. When `allDone`, show "You're all set" and keep the Dismiss button.
   - Dismiss: a ghost icon button `X` with `aria-label` "Dismiss checklist". It dispatches `updateOnboarding({ dismissed: true })` and shows a 013 toast "Checklist hidden" with an "Undo" action that dispatches `updateOnboarding({ dismissed: false })`.
9. Strings: create `i18n/en/dashboard.json` with every visible string (heading, 4 KPI titles, "{{count}} invoices", chart title/empty, "Needs attention" + empty, "Recent invoices" + empty + "View all invoices", checklist heading, progress, 5 item labels, 5 link labels, hint, all-set text, dismiss label, toast text, undo). Register it in `i18n/en/index.js`. Other locales fall back to English.
10. No styled-components and no Bootstrap classes in these files. Use real `<button>` elements; targets ≥ 24×24 px.

**Verify**: `npm run lint` → exit 0; `npm run build` → exit 0.

### Step 7: Make Dashboard the first page and the start page

Decision: **always start on the Dashboard.** Reason: the checklist serves new users and the KPIs serve existing users. A data-based rule would need the async invoice load and would flicker from one tab to another.

1. `UIReducer.jsx:5`: `activeTab: 'dashboard'`. Update `UIReducer.spec.js` (`initialState` and the `'form'` literal at `:48` if it is the initial state) and add `'dashboard'` to the `UI_TAB_CHANGE` cases. `UIMiddleware.spec.js:15` uses `'form'` as a current tab; leave it.
2. `AppMain.jsx`: add `{activeTab === 'dashboard' && <Dashboard />}`. Add Dashboard to `TitleBar.jsx`'s title map as well.
3. `AppSidebar.jsx`: add the first item `{ id: 'dashboard', icon: LayoutDashboard, label: t('<013 nav ns>:dashboard') }`. Add the label to the i18n file 013 uses for nav labels.
4. 013 command palette: add "Go to Dashboard". 013 shortcuts dialog list: add Dashboard `⌘1` / `Ctrl+1`.
5. `main/menu.js` Go menu: add as the first item `{ label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click() { mainWindow.webContents.send('menu-change-tab', 'dashboard'); } }`. Before that, check conflicts: `grep -rn "CmdOrCtrl+1\|mod+1\|Meta+1\|Mod-1\|key === '1'" main ui app --include='*.js' --include='*.jsx' | grep -v __tests__` → no accelerator or key handler uses it. If 013 already uses digit shortcuts for pages, follow 013's scheme and renumber.

**Verify**: `npx vitest run app/reducers/__tests__/UIReducer.spec.js` → exit 0. Smoke: `MANTA_USER_DATA="$(mktemp -d)" npm start` → main window opens on Dashboard; `CmdOrCtrl+1` from the Invoices page returns to Dashboard.

### Step 8: Remove the tour

1. `app.js`:
   - Delete `let tourWindow = null;` and `createTourWindow()`. Remove the tour window from any 012/013 code that loops over windows or sets `backgroundColor` / title bar colors.
   - Delete the `tour` and `winsLastVisibleState` defaults from `setInitialValues()`.
   - Delete `tourWindow.destroy();` in `quit-and-install`, `require('./main/tour');` in `loadMainProcessFiles()`, `createTourWindow();` in `ready`, and the `tourWindow` line in `before-quit`.
   - Move `showWhenReady(win)` from `main/tour.js:43-51` to `helpers/windows.js` and export it.
   - In `ready`: replace the `showWindow('startup')` call with `showWhenReady(mainWindow);`. Register the ready/show hook before loading the page, or handle an already-ready window; a fast load must not leave the app hidden.
   - In `activate`: show and focus the main window only when no app window is visible: `if (!mainWindow.isVisible() && !previewWindow.isVisible()) { mainWindow.show(); mainWindow.focus(); }`. If the preview is visible, do nothing.
   - After `migrateData()`, add `removeObsoleteKeys()`: `['tour', 'tourWindowID', 'winsLastVisibleState'].forEach(k => appConfig.delete(k));`. These are UI-state keys only; no user data is lost.
2. `git rm main/tour.js` and `git rm -r tour`.
3. `main/menu.js`: delete the "Show Tutorial" item. If 013 put a "Keyboard Shortcuts" item in Help, do nothing more. If not, and 013 opens its shortcuts dialog over an IPC channel, add `{ label: 'Keyboard Shortcuts', click() { mainWindow.webContents.send('<that channel>'); } }`. Otherwise add nothing. Leave `CmdOrCtrl+T` unused.
4. `preload/index.js`: delete `'end-tour'` and `'start-tour'`. In `preload/__tests__/index.spec.js:59,68,70` replace `'end-tour'` with another allowed channel, for example `'menu-change-tab'`.
5. `electron.vite.config.mjs`: delete `tour: root('./tour/index.html'),`. `ui/styles/globals.css`: delete the `@source "../../tour";` line.
6. `git rm i18n/*/tour.json`. In each of the 9 `i18n/<lng>/index.js`, delete `import tour from './tour.json';` and `tour,`.
7. `.github/CONTRIBUTING.md:44`: change "(windows, startup, tour)" to "(windows, startup, dashboard)".

**Verify**:
- `grep -rn "tour" --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.css' --include='*.html' . --exclude-dir=node_modules --exclude-dir=out --exclude-dir=dist --exclude-dir=plans -i | grep -iv "detour\|contour"` → no output.
- `test ! -e tour && test ! -e main/tour.js && ls i18n/*/tour.json 2>/dev/null | wc -l` → `0`.
- `npm run build && ls out/renderer` → `app modal preview` (plus assets), no `tour`.
- `npx vitest run preload/__tests__/index.spec.js` → exit 0.

### Step 9: Update the e2e tests

In `e2e/app.e2e.mjs`:
1. Delete `TOUR_TITLE`. In `beforeAll` change `.toBeGreaterThanOrEqual(3)` to `.toBeGreaterThanOrEqual(2)`.
2. Replace test `creates the Tour, Manta and Previewer windows` with `creates only the Manta and Previewer windows`: titles sorted equal `['Manta', 'Previewer']`.
3. Delete tests `fresh profile shows the tour window` and `tour next control is on screen and advances`.
4. Add `fresh profile opens main window on Dashboard with the checklist`:
   - Poll `windowInfo()` until Manta `visible === true` (30 s). Previewer `visible === false`. Manta `devTools === false`.
   - Get the Manta page (loop over `app.windows()` as in the existing test).
   - `await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();`
   - `await expect(page.getByRole('list', { name: 'Setup steps' }).getByRole('listitem')).toHaveCount(5);`
5. Update every earlier e2e assumption affected by visible startup and tour removal, including 012's theme test (three windows while modal exists), 013's palette test, and 015's editor entry. Navigate explicitly to the required page before each interaction; do not depend on a prior test's page state.

**Verify**: `npm run test:e2e` → 5 passed (plus any tests added by 012–016), 0 failed.

### Step 10: Manual smoke on a data copy (light and dark)

1. `rm -rf /tmp/manta-profile-copy && cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy && MANTA_USER_DATA=/tmp/manta-profile-copy npm start`.
2. Check: Dashboard opens; the totals match the Invoices list for each currency; the currency switcher appears only with more than 1 currency; the chart has 6 bars and readable labels; a "Needs attention" row opens the invoice sheet; no console errors.
3. Mark one pending invoice paid. Return to Dashboard. "Paid this month" grows by its amount; Outstanding shrinks by the same amount.
4. Open an invoice preview and export a PDF. Return to the main window. "Export first PDF" is checked. `grep -o '"exportedPdf":true' /tmp/manta-profile-copy/Settings` → one hit.
5. Dismiss the checklist; press Undo; dismiss again; quit and restart → checklist stays hidden.
6. Switch theme (Settings › Appearance) to dark and repeat step 2 visually. Take screenshots of both themes if possible.
7. Fresh profile: `MANTA_USER_DATA="$(mktemp -d)" npm start` → Dashboard with empty states and the checklist at 0 of 5; no tour window.

**Verify**: every check above holds. Report any failure instead of patching unrelated code.

## Test plan

- New unit tests: `app/helpers/__tests__/dashboard.spec.js` (stats per currency, overdue, month buckets and boundaries in UTC, 6-month window across a year, old docs, needs-attention window), `app/helpers/__tests__/onboarding.spec.js` (each checklist rule, placeholders, default logo, missing `onboarding`).
- Changed unit tests: `invoice.spec.js` (`getPaidDate`), `form.spec.js` (edit keeps `paidAt`), `SettingsReducer.spec.js` and `SettingsMW.spec.js` (onboarding persist and load), `UIReducer.spec.js` (default `'dashboard'`), `preload/__tests__/index.spec.js` (sample channel).
- Not tested on purpose: Dashboard markup, chart rendering, card layout (DOM/markup only).
- e2e: window set is Manta + Previewer; fresh profile starts on Dashboard with the 5-step checklist.
- Run once at the end: `npm test`, `npm run lint`, `npm run test:e2e`.

## Done criteria

- [ ] `npm test` exits 0; `npm run lint` exits 0; `npm run test:e2e` all pass.
- [ ] `grep -n "activeTab: 'dashboard'" app/reducers/UIReducer.jsx` → one hit.
- [ ] `test ! -e tour && test ! -e main/tour.js && echo ok` → `ok`; `ls i18n/*/tour.json 2>/dev/null | wc -l` → `0`.
- [ ] `grep -n "start-tour\|end-tour" preload/index.js main/menu.js` → no output.
- [ ] `grep -n "tour" electron.vite.config.mjs ui/styles/globals.css app.js` → no output.
- [ ] `grep -n "onboarding-updated" preload/index.js app/App.jsx main/save-pdf.js | wc -l` → `3` or more.
- [ ] `grep -n "withStatus" app/middlewares/InvoicesMW.jsx` → at least one hit (from 014); `grep -n "getPaidDate" app/helpers/invoice.js` → one export.
- [ ] `npm ls recharts react-is` → `recharts@3.x`, one `react-is@19.x`.
- [ ] Manual smoke (Step 10) done in light and dark mode on a data copy; result in your report.
- [ ] `git status` clean; only Scope files changed.
- [ ] `plans/README.md` row for 017 updated (unless a reviewer maintains it).

## STOP conditions

- 014's `getDisplayStatus` or `getDueDate` is missing, or its "overdue" rule differs from "pending and due before start of today".
- 013's sidebar, toast API, or "New invoice" action cannot be found.
- Any step would write to or delete invoice or contact documents other than through 014's `withStatus` on a user status change (no migrations, no backfill).
- Totals on the data copy do not match the Invoices list for a currency, and the cause is not in this plan's code.
- After removing the tour, a fresh profile starts with no visible window, or `activate` on macOS shows no window.
- Recharts 3 fails to install with React 19 or the chart throws in the app; report the error. Do not downgrade React or switch chart libraries.
- `npm run test:e2e` fails in a test this plan did not touch.

## Review acceptance checks

- Use a loading state until settings, contacts and invoices have finished their initial loads. Do not show a completed/fresh checklist or empty financial state from the temporary empty Redux arrays.
- Reconcile the selected dashboard currency after import/deletion or data reload. If its code disappears, select an available code; the page must not read `byCurrency[oldCode]` as if it exists.
- Add local-time month-boundary and DST tests, plus an idle-midnight check. Tests only in UTC do not prove local business-date behavior.
- Route each onboarding link to a concrete target. Add a minimal selected-settings-section request where needed so Business profile does not reopen an unrelated previous section. Keep invoice history read-only.
- Include TitleBar's page-name map in the new Dashboard navigation changes; otherwise the new default page has no title.
- The old `showWhenReady` helper observes `ready-to-show` conditionally on loading. Register startup visibility before loading or handle an already-ready window so a fast load cannot leave the app hidden. Verify fresh profile and macOS activate independently.

## Maintenance notes

- `paidAt` comes from 014's `withStatus`: it is set on the transition into `paid`, kept while the invoice stays paid, and removed when the status leaves `paid`. Plan 020 then sets it to the date of the payment that clears the balance. Dashboard money counts only `status === 'paid'`. Old paid invoices fall back to `issuedAt`, then `created_at`, so their payment month may be early. Do not backfill.
- Overdue and outstanding come from 014's `getDisplayStatus`. If that rule changes, `dashboard.spec.js` must change with it.
- Month and day boundaries use local time. Tests run in UTC (`vitest.config.mjs`). Keep `now` as an explicit parameter so tests stay deterministic.
- `PLACEHOLDER_PROFILE` in `app/helpers/onboarding.js` duplicates the `app.js` defaults. Change both together. If the default logo file changes, profiles with the old default logo show "Add logo" as done.
- The checklist can be brought back only with Undo or by editing `onboarding.dismissed` in Settings. A "Show getting started" command in the command palette is a possible follow-up.
- Settings keys added: `onboarding.dismissed`, `onboarding.exportedPdf`. Keys removed at startup: `tour`, `tourWindowID`, `winsLastVisibleState`. Keep 016's backup contract: it exports/imports only profile, invoice and general settings. Onboarding flags are local UI state and remain outside the portable backup.
- `CmdOrCtrl+T` is free after this plan.
- Reviewers: check that no amount is ever summed across currencies, that a failed PDF export does not set the flag, that duplicate drops `paidAt`, that edit keeps `paidAt`, and that the fresh-profile start shows the main window.
- Deferred: aging report, per-client revenue, recurring invoices, chart period picker.
