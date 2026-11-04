# Plan 013: Replace the icon-only nav with a labeled sidebar, add a command palette, a frameless title bar, in-app dialogs and toasts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before you go to the
> next step. If a "STOP conditions" item occurs, stop and report. Do not
> improvise. When done, update the status row for this plan in
> `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index. Do NOT add `Co-authored-by` trailers or any AI/tool
> attribution to commits or PR text (AGENTS.md). Pass this rule to any subagent.
>
> **Drift check (run first)**:
> `git diff --stat 3e89104..HEAD -- app/App.jsx app/index.jsx app/components/layout/ app/components/shared/Layout.jsx app/components/shared/Notification.jsx app/components/shared/ErrorBoundary.jsx app/components/shared/_tests_/Layout.spec.jsx app/components/settings/Invoice.jsx app/containers/Invoices.jsx app/containers/Contacts.jsx app/containers/__tests__/ app/helpers/form.js app/helpers/image.js app/helpers/__tests__/form.spec.js app/reducers/UIReducer.jsx app/reducers/SettingsReducer.jsx app/reducers/__tests__/ app/actions/ui.jsx app/actions/settings.jsx app/constants/actions.jsx app/middlewares/UIMiddleware.jsx app/middlewares/__tests__/UIMiddleware.spec.js main/menu.js app.js preload/index.js static/css/general.css i18n/en/ e2e/app.e2e.mjs`
>
> Plan 012 changes some of these files on purpose: `app/index.jsx` (imports
> `ui/styles/globals.css`), `app.js` (window `backgroundColor` from
> `nativeTheme`, theme startup), `preload/index.js` (adds `set-theme`),
> `static/css/general.css` (removes the `outline: none` rule; the file is now
> imported from `ui/styles/globals.css` in layer `legacy`),
> `app/components/settings/General.jsx`, `app/middlewares/SettingsMW.jsx`
> (sends `set-theme` on save), `i18n/en/settings.json` (theme select) and
> `e2e/app.e2e.mjs` (two new tests, 8 in total). 012 also creates
> `main/theme.js`. For these files, read the live content and not the excerpts below.
> Any other file in the list that changed since `3e89104`: compare it with
> "Current state". On a mismatch that this plan does not expect, STOP.

## Execution checks added by review (2026-11-01)

- Record the execution start commit and starting changes. Scope checks compare this plan's changes with that baseline, not with a clean-tree requirement. Earlier plans can change the listed files; check the required behavior before treating expected changes as drift.
- Before a live app check, use Jean `get_run_environments`; use its running environment or `start_run_environment`. Do not start a second dev server by hand. Confirm that the environment uses a disposable `MANTA_USER_DATA` profile. Record the exact URL or Electron entry and profile used. If no Run command is configured, report that limit.
- Use the narrow tests listed for each changed behavior. Reuse passing results when the covered code has not changed. Run broad tests once at the final integration gate for shared state, persistence or IPC changes. Visual checks require the running app; do not replace them with markup assertions.
- Do not copy a profile while Manta is running. Close it first. Use a new temporary destination, or confirm the existing destination is disposable; repeated `cp -R` into an existing folder can create a nested profile.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/012-*.md (Tailwind v4, shadcn/Base UI in `ui/`, `@` alias, theme setting `general.theme` + IPC `set-theme`)
- **Category**: ui-redesign
- **Planned at**: commit `3e89104`, 2026-11-01

## Why this matters

The main window navigation is a column of four unlabeled Ionicons (`app/components/layout/AppNav.jsx`). Users must guess what each icon does. NN/g research shows that icons without visible labels are not recognized reliably ([icon usability](https://www.nngroup.com/articles/icon-usability/), [vertical nav](https://www.nngroup.com/articles/vertical-nav/)). Every warning, validation error and delete confirmation opens a separate frameless BrowserWindow (`main/modal-window.js`). That window is slow, it ignores dark mode, and it returns the result over an IPC round trip (`confirmed-delete-invoice` and others). Notifications use a custom stack (`AppNoti`) with Bootstrap-era styles. The whole `<body>` is a window drag region, so text in the window cannot be selected and clicks on empty areas move the window.

After this plan: a labeled, collapsible shadcn sidebar with the business name and logo, a "New invoice" button, a command palette (⌘/Ctrl+K), a frameless title bar that matches the theme, an in-app `AlertDialog` for confirm/alert, and Base UI toasts. The modal window stays in the code base with no caller in `app/` (plan 018 deletes it).

## Preconditions

| Check | Command | Expected |
|---|---|---|
| On the redesign branch | `git branch --show-current` | current branch; record its name, do not switch |
| 012 done: shadcn config | `node -p "require('./components.json').style"` | `base-nova` |
| 012 done: `@` alias in Vitest | `grep -n "'@'" vitest.config.mjs` | one hit that points to `./ui` |
| 012 done: shadcn Button | `ls ui/components/ui/button.jsx ui/lib/utils.js` | both files exist |
| 012 done: global stylesheet | `grep -n "globals.css" app/index.jsx` | one hit |
| 012 done: theme IPC | `grep -n "'set-theme'" preload/index.js` | one hit |
| 012 done: theme module | `grep -n "export function getBackgroundColor\|export function setupTheme\|WINDOW_BACKGROUND" main/theme.js` | 3 hits (ES module; functions receive `nativeTheme` as an argument) |
| Base UI installed | `node -p "require('@base-ui/react/package.json').version"` | `1.x.y` |
| Tests green before you start | `npm test` | exit 0 |
| e2e green before you start | `npm run test:e2e` | 8 passed |

If a 012 check fails, STOP: this plan builds on 012.

## Current state

All excerpts are from commit `3e89104`.

`app/App.jsx:99-108` renders the shell. `AppNoti` shows notifications. `AppUpdate` is imported but rendered inside `AppNav`.

```jsx
  render() {
    const { activeTab, notifications, checkUpdatesMessage } = this.props.ui;
    return (
      <AppWrapper>
        <AppNav activeTab={activeTab} changeTab={this.changeTab} />
        <AppMain activeTab={activeTab} />
        <AppNoti notifications={notifications} removeNoti={this.removeNoti} />
      </AppWrapper>
    );
  }
```

`app/App.jsx:36-38` the menu changes tabs over IPC (`menu-change-tab`). Lines 39-69 add 11 more `menu-form-*` and `save-configs-to-invoice` listeners. Keep all of them.

`app/components/layout/AppNav.jsx:12-33,89-95` icon-only tabs `form`, `invoices`, `contacts`, `settings`, rendered as `<a href="#">` with an `<i className="ion-…">` and no text. `AppUpdate` sits at the bottom (`:110`).

`app/components/layout/AppUpdate.jsx` (class component, keep the IPC logic):
- `:50-61` `update-available` → `openDialog({type:'info', …, buttons:[yes, noThanks]}, 'update-download-confirmed')`.
- `:63-79` `update-not-available` and `update-error` → simple `openDialog` messages.
- `:81-96` `update-download-confirmed` handler: index `0` → `ipc.send('update-download-started')`, index `1` → hide indicator.
- `:104-130` `update-downloaded` → `Notify(...)` + `openDialog(…, 'upgrade-confirmed')`; `upgrade-confirmed` index `0` → `ipc.send('quit-and-install')`.
- `:142` bug: `removeAllListeners` lists `'upgade-confirmed'` (typo), so the real `upgrade-confirmed` listener is never removed.

`app/renderers/dialog.js` (whole file) — the modal-window API:

```js
function showModalWindow(dialogOptions, returnChannel = '', ...rest) {
  ipc.send('show-modal', dialogOptions, returnChannel, ...rest);
  sounds.play('DIALOG');
}
```

`main/modal-window.js:38-43` sends the clicked button index back to the **main window** on `returnChannel`.

`openDialog` callers in `app/` (all of them; `grep -rn "openDialog(" app --include='*.js' --include='*.jsx'`):

| File:line | Kind | Notes |
|---|---|---|
| `app/containers/Invoices.jsx:44-48,57-69` | **confirm** over IPC | `'confirmed-delete-invoice'`, index `0` = yes → `dispatch(Actions.deleteInvoice(invoiceId))` |
| `app/containers/Contacts.jsx:38-42,54-66` | **confirm** over IPC | `'confirmed-delete-contact'`, index `0` → `dispatch(ContactsActions.deleteContact(contactId))` |
| `app/components/layout/AppUpdate.jsx:52,111` | **confirm** over IPC | `'update-download-confirmed'`, `'upgrade-confirmed'` |
| `app/components/layout/AppUpdate.jsx:64,73` | info / warning | no update; update error |
| `app/components/settings/Invoice.jsx:28-34` | warning | on IPC `no-access-directory` |
| `app/helpers/image.js:19-25` | warning | logo file error |
| `app/components/shared/ErrorBoundary.jsx:37-44` | warning | in `componentDidCatch`, message = `info.componentStack` |
| `app/helpers/form.js:94,108,119,137,147,157,175,192,208,224,240,255` | warning (12×) | validation; every call has the shape `{ type: 'warning', title: i18n.t('dialog:validation:…:title'), message: i18n.t('dialog:validation:…:message') }` and the function then returns `false` |

`app/helpers/__tests__/form.spec.js:21-22` mocks the module and asserts the exact object, for example `:452`:

```js
    expect(openDialog).toBeCalledWith({
      type: 'warning',
      title: i18n.t('dialog:validation:recipient:empty:title'),
      message: i18n.t('dialog:validation:recipient:empty:message'),
    });
```

`app/index.jsx:28-36` mounts `ErrorBoundary` around `App` (so anything mounted inside `App` disappears when the boundary catches):

```jsx
createRoot(document.getElementById('root')).render(
  <StyledRoot>
    <Provider store={store}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Provider>
  </StyledRoot>
);
```

`app/reducers/UIReducer.jsx:4-8` state, plus handlers for `UI_NOTIFICATION_NEW` (prepend) and `UI_NOTIFICATION_REMOVE` (filter by id):

```js
const initialState = {
  activeTab: 'form',
  notifications: [],
  checkUpdatesMessage: {},
};
```

`app/middlewares/UIMiddleware.jsx:3-6,19-40` signature is `({ getState }) => next => action`. `UI_NOTIFICATION_NEW` plays `SUCCESS`/`WARNING` and calls `next` with `payload.id = crypto.randomUUID()`. The store order is `[FormMW, ContactsMW, InvoicesMW, SettingsMW, UIMiddleware]` (`app/store/index.jsx`), so UIMiddleware is last and every notification passes through it, also the ones the other middlewares send with `next(...)`.

`UI_NOTIFICATION_NEW` is sent 17 times from `ContactsMW.jsx`, `InvoicesMW.jsx`, `FormMW.jsx`, `SettingsMW.jsx`, and their specs assert it (for example `InvoicesMW.spec.js:74`). Payload shape: `{ type: 'success' | 'warning', message }`.

`app/components/shared/Layout.jsx:27-38,60-71` page headers are `position: fixed; width: 100%; padding: 10px 120px 10px 40px` and page content has `margin: 90px 40px 40px 40px`. These values assume the 80 px nav. With a 256 px sidebar, the header actions move off screen.

`app.js:82-93` main window:

```js
  mainWindow = new BrowserWindow({
    x: mainWindownStateKeeper.x,
    y: mainWindownStateKeeper.y,
    width: mainWindownStateKeeper.width,
    height: mainWindownStateKeeper.height,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#2e2c29',
    show: false,
    title: 'Main Window',
    webPreferences: SECURE_WEB_PREFERENCES,
  });
```

(012 replaced `backgroundColor`. Read the live lines.) `app.js:169-219` `setInitialValues()` adds missing level-1 and level-2 setting keys from `defaultOptions` (`tour`, `winsLastVisibleState`, `profile`, `general`, `invoice`). No `ui` key exists yet.

`static/css/general.css:7-14` makes the whole page a drag region (this file is loaded by all four windows):

```css
body,
#root,
.appWrapper {
  height: 100vh;
  -webkit-user-select: none;
  -webkit-app-region: drag;
  animation: fadein 0.5s;
}
```

`main/menu.js:8-9` `label: 'My App'`; `:41-47` Invoice › New `CmdOrCtrl+N` sends `menu-change-tab 'form'`; `:138-144` Go › Settings `CmdOrCtrl+Shift+S`. Other accelerators in use: `CmdOrCtrl+U/Q/S/R/I/T`, `Alt+S/T/C/V/D/N`, `CmdOrCtrl+Shift+A/D`. `CmdOrCtrl+,`, `CmdOrCtrl+K`, `CmdOrCtrl+/` and `CmdOrCtrl+B` are free. `CmdOrCtrl+Shift+S` has no other user.

`preload/index.js:3-48` channel allow-list. It contains the IPC return channels `'confirmed-delete-contact'`, `'confirmed-delete-invoice'`, `'update-download-confirmed'`, `'upgade-confirmed'`, `'upgrade-confirmed'`. It also contains `'show-modal'`, `'modal-response'` and `'update-modal'`, which the modal window uses.

`app/middlewares/SettingsMW.jsx` `SETTINGS_SAVE` writes the whole `general` object from Redux: `appConfig.set('general', action.payload.general)`. If the theme changes outside Redux, a later Settings save writes the old theme back.

Settings profile for the sidebar header: `state.settings.saved.profile` has `company`, `fullname`, `logo` (data URL). `state.settings` is `{}` until `getInitalSettings()` runs.

Invoice docs: `_id` (UUID), optional `invoiceID`, `recipient { fullname, company, email }`, `created_at`, `status`. The list shows `invoice.invoiceID` or a truncated `_id` (`app/components/invoices/Invoice.jsx:301-303`). Contacts: `_id`, `fullname`, `company`, `email`. Preview: `ipc.send('preview-invoice', invoice)` (`Invoice.jsx:192`).

Edit mode: `state.form.settings.editMode.active` (`app/reducers/FormReducer.jsx:32`). `FormActions.clearForm(event, muted)` resets the form and exits edit mode.

Tests that check only removed markup: `app/components/shared/_tests_/Layout.spec.jsx` cases "AppWrapper renders its children" and "AppMainContent renders its children". No spec exists for `AppNav`, `AppNoti`, `AppUpdate`, `Notification` or `ErrorBoundary`. `app/containers/__tests__/Contacts.spec.js` is a placeholder (`it('placeholder')`).

## Reference facts (recheck versions and APIs at execution)

Confirm versions with `npm view <pkg> version` before you install.

- shadcn uses Base UI by default; CLI v4 is `shadcn@4.x` (4.23.0 today): https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default , https://ui.shadcn.com/docs/changelog/2026-03-cli-v4 .
- **Sidebar** (base-nova registry source): `SidebarProvider({ defaultOpen = true, open, onOpenChange })`; it writes `document.cookie = "sidebar_state=…"` on every change; `SIDEBAR_WIDTH = "16rem"`, `SIDEBAR_WIDTH_ICON = "3rem"`, `SIDEBAR_KEYBOARD_SHORTCUT = "b"` (⌘/Ctrl+B toggles); `useIsMobile()` uses `MOBILE_BREAKPOINT = 768` (below it the sidebar is a Sheet). `SidebarMenuButton` has `isActive`, `tooltip` (hidden unless `state === "collapsed"`) and the Base UI `render` prop (no `asChild`). Registry deps: button, input, separator, sheet, skeleton, tooltip, use-mobile. https://ui.shadcn.com/docs/components/base/sidebar
- **Command** uses `cmdk` (1.1.1) inside the shadcn `Dialog`; `CommandDialog` passes its props to `Dialog` (`open`, `onOpenChange`), with default `title="Command Palette"`. Filtering is cmdk's; `shouldFilter={false}` turns it off. https://ui.shadcn.com/docs/components/base/command , https://github.com/pacocoursey/cmdk
- **Alert dialog** exports `AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel`. `AlertDialogAction` is a plain `Button` and does not close the dialog. `AlertDialogCancel` is a Base UI `Close`. https://ui.shadcn.com/docs/components/base/alert-dialog
- **Toast**: the shadcn file exports `toast` (a module-level `Toast.createToastManager()`), and `Toaster` (Provider + Portal + Viewport, default `toastManager = toast`). `toast.add({ title, description, type, timeout, priority, actionProps, onClose })` returns an id. `type` gets an icon for `success | info | warning | error | loading`. Default timeout is 5000 ms. Provider `limit` defaults to 3. https://ui.shadcn.com/docs/components/base/toast , https://base-ui.com/react/components/toast
- `@base-ui/react` 1.9.0; `lucide-react` 1.66.0 (no brand icons in v1): https://base-ui.com/react/overview/releases , https://lucide.dev/guide/version-1
- Electron custom title bar: macOS `titleBarStyle: 'hidden' | 'hiddenInset'` and `trafficLightPosition: { x, y }`; Windows/Linux `titleBarOverlay: { color, symbolColor, height }` (needs a `titleBarStyle` other than `default`; `symbolColor` is Windows only, Linux computes it); renderer reads the overlay area with `env(titlebar-area-x | -width | -height)`; drag with CSS `app-region: drag`. https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
- `win.setTitleBarOverlay({ color, symbolColor, height })` updates the overlay at runtime (Windows, Linux). `win.setWindowButtonPosition(point)` (macOS). https://www.electronjs.org/docs/latest/api/browser-window
- `MenuItem.registerAccelerator: false` works on Linux and Windows only. On macOS a menu accelerator always fires the menu item, and the page does not get the keydown. https://www.electronjs.org/docs/latest/api/menu-item
- Not verified: whether menu accelerators keep working on Windows/Linux when `titleBarStyle: 'hidden'` hides the menu bar. Step 9 tests it by hand.
- Playwright `page.keyboard.press('ControlOrMeta+K')` sends the key over CDP to the page. Native menu accelerators do not see it, so the renderer listener is necessary for e2e. https://playwright.dev/docs/api/class-keyboard
- NN/g: undo is better than confirmation for frequent actions (014 uses undo for invoice delete): https://www.nngroup.com/articles/confirmation-dialog/

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Add shadcn components | `npx shadcn@latest add sidebar command dialog alert-dialog toast dropdown-menu sheet avatar kbd` | files in `ui/components/ui/*.jsx`, `ui/hooks/use-mobile.js`; `cmdk` in `package.json` |
| Dry run first | same command with `--dry-run` | lists files, writes nothing |
| One spec | `npx vitest run <path>` | pass |
| All unit tests | `npm test` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| e2e | `npm run test:e2e` | 9 passed |
| Manual run on a data copy | `rm -rf /tmp/manta-profile-copy && cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy && MANTA_USER_DATA=/tmp/manta-profile-copy npm start` | app opens on the copy |

Never run the app against the real user-data folder.

## Scope

**In scope — create:**
- `ui/components/ui/{sidebar,command,dialog,alert-dialog,toast,dropdown-menu,sheet,avatar,kbd,tooltip,input,separator,skeleton,input-group}.jsx` (generated; some may exist from 012), `ui/hooks/use-mobile.js` (generated)
- `ui/lib/dialog.js` — imperative `confirm` / `alert` queue
- `ui/hooks/use-media-query.js`
- `app/components/layout/AppSidebar.jsx`, `TitleBar.jsx`, `CommandPalette.jsx`, `ShortcutsDialog.jsx`, `DialogHost.jsx`
- `app/constants/shortcuts.js`
- `app/helpers/commandSearch.js`, `app/helpers/theme.js` (or extend the file if 012 created it)
- `i18n/en/app.json`
- Tests: `ui/lib/__tests__/dialog.spec.js`, `app/helpers/__tests__/commandSearch.spec.js`, `app/helpers/__tests__/theme.spec.js`

**In scope — change:** `app/App.jsx`, `app/index.jsx`, `app/components/layout/AppMain.jsx`, `app/components/layout/AppUpdate.jsx`, `app/components/shared/Layout.jsx`, `app/components/shared/ErrorBoundary.jsx`, `app/components/settings/Invoice.jsx`, `app/containers/Invoices.jsx`, `app/containers/Contacts.jsx`, `app/helpers/form.js`, `app/helpers/image.js`, `app/actions/ui.jsx`, `app/actions/settings.jsx`, `app/constants/actions.jsx`, `app/reducers/UIReducer.jsx`, `app/reducers/SettingsReducer.jsx`, `app/middlewares/UIMiddleware.jsx`, `app/middlewares/SettingsMW.jsx` (theme action only), `main/menu.js`, `app.js` (main window options, one `nativeTheme` listener and `setInitialValues` only), `main/theme.js` and `main/__tests__/theme.spec.js` (title bar helpers only), `preload/index.js`, `static/css/general.css` (drag rule only), `ui/styles/globals.css` (drag utilities only), `i18n/en/index.js`, `i18n/en/common.json`, `e2e/app.e2e.mjs`, and these specs: `app/helpers/__tests__/form.spec.js`, `app/reducers/__tests__/UIReducer.spec.js`, `app/reducers/__tests__/SettingsReducer.spec.js`, `app/middlewares/__tests__/UIMiddleware.spec.js`, `app/actions/__tests__/ui.spec.js`, `app/containers/__tests__/Invoices.spec.jsx`, `app/containers/__tests__/Contacts.spec.js`, `app/components/shared/_tests_/Layout.spec.jsx`.

**In scope — delete:** `app/components/layout/AppNav.jsx`, `app/components/layout/AppNoti.jsx`, `app/components/shared/Notification.jsx`.

**Out of scope:**
- Page content redesign (Invoices list 014, editor 015, Clients/Settings 016) and the dashboard (017). Only the `Layout.jsx` header fix in Step 8 touches pages.
- `modal/`, `main/modal-window.js`, `app/renderers/dialog.js`, the `vitest.setup.js` mock of `app/renderers/dialog.js`. They stay. Plan 018 deletes them.
- The `UI_NOTIFICATION_NEW` dispatches in `ContactsMW`, `InvoicesMW`, `FormMW`, `SettingsMW` and their specs. They stay unchanged.
- `TransitionList.jsx` (still used by `ItemsList.jsx`), `helpers/notify.js` (used by preview).
- Tour window and the "Show Tutorial" menu item (017 removes them). Preview window (018).
- Translations other than `en` (other locales fall back to English).
- `productName`, `appId`, `file://` loading, the PouchDB adapter.

## Decisions (fixed for this plan)

1. **"New invoice"** (sidebar button, ⌘N, palette) dispatches a new action `UI_NEW_INVOICE`. UIMiddleware handles it:
   - Not in edit mode: change the tab to `form` only. An unsaved new draft stays (this matches today's ⌘N; the user clears it with Reset ⌘R). Reason: clearing without asking would silently delete typed work.
   - In edit mode: `await confirm({ title: 'Stop editing this invoice?', … })`. On `true`: `clearForm(null, true)` and change the tab to `form`. On `false`: do nothing. Reason: the user asked for a *new* invoice, but must not lose edits by surprise. The saved invoice in the database does not change in either case.
2. **Sidebar collapse** is a user preference in electron-store key `ui.sidebarCollapsed` (default `false`), mirrored in Redux `ui.sidebarCollapsed`. Below 900 px window width, the sidebar collapses automatically. In that narrow state the user can still expand it, and this is session-only (it is not saved). Remove the `document.cookie` line from the generated `sidebar.jsx` (cookies have no use under `file://`).
3. **Main window** `minWidth: 800`, `minHeight: 560`. Check the CSS viewport under zoom/display scaling; do not assume these native dimensions prevent the Sidebar mobile breakpoint.
4. **Title bar**: one 40 px strip on top of both columns (sidebar part + content part). It is the only drag region. macOS: `hiddenInset` with `trafficLightPosition: { x: 14, y: 13 }` (lights centred in the 40 px strip; tune in Step 9). Windows/Linux: `titleBarStyle: 'hidden'` + `titleBarOverlay` height 40 with colors that follow `nativeTheme`.
5. **Dialogs**: `ui/lib/dialog.js` keeps a FIFO queue. One `<DialogHost/>` shows the first request. `DialogHost` and `<Toaster/>` mount in `app/index.jsx` **next to** `ErrorBoundary` (not inside it), so they still work after a crash. `ErrorBoundary` no longer opens a dialog; it shows the error inline with a Reload button.
6. **Notifications**: keep the action type `UI_NOTIFICATION_NEW` and `newNoti` (17 middleware call sites and their specs use it). UIMiddleware maps it to `toast.add(...)` and does **not** call `next` (the reducer no longer stores notifications). Remove `UI_NOTIFICATION_REMOVE`, `removeNoti` and `ui.notifications`.
7. **Update messages**: "update available" and "update downloaded" become `confirm`. "No update" becomes an `info` toast. "Update error" becomes an `alert` of type `warning`.
8. **Command palette** filters with our own pure helper (`shouldFilter={false}` on cmdk). Invoice result → opens the preview (`ipc.send('preview-invoice', invoice)`). Client result → goes to the Clients page (016 adds a client detail sheet). Theme toggle cycles `system → light → dark → system`.
9. **Menu**: ⌘K and ⌘/ are menu items with accelerators that open the palette and the shortcuts dialog. The renderer also listens for ⌘/Ctrl+K. Both paths call "open", never "toggle", so a double trigger is harmless.

## Git workflow

- Stay on the current branch. Do not switch branches or create a worktree.
- Commit subjects: short, imperative, no prefix, no attribution. Suggested commits:
  `Add shadcn sidebar, command, dialog and toast components`, `Add in-app confirm and alert dialogs`, `Show notifications as toasts`, `Replace modal window dialogs in the main window`, `Replace icon nav with a labeled sidebar`, `Add command palette and shortcuts dialog`, `Use a frameless title bar on the main window`, `Add e2e check for sidebar and command palette`.
- Do NOT push.

## Steps

### Step 1: Check preconditions and install components

1. Run every check in "Preconditions".
2. `npx shadcn@latest add sidebar command dialog alert-dialog toast dropdown-menu sheet avatar kbd --dry-run`. Confirm all target paths are under `ui/components/ui/` or `ui/hooks/` and the extension is `.jsx`/`.js`.
3. Run the same command without `--dry-run`. If it asks to overwrite a file from 012 (for example `button.jsx`), answer **no**.
4. In `ui/components/ui/sidebar.jsx`, delete the line `document.cookie = \`${SIDEBAR_COOKIE_NAME}=…\`` and the two now-unused cookie constants. Add the comment `// Collapse state is saved in electron-store (ui.sidebarCollapsed).`
5. Do not install `scroll-area` (Base UI injects `<style>` there; not needed).

**Verify**: `ls ui/components/ui/{sidebar,command,dialog,alert-dialog,toast,dropdown-menu,sheet,avatar,kbd,tooltip}.jsx` → all exist; `node -p "require('cmdk/package.json').version"` → `1.x`; `grep -c "document.cookie" ui/components/ui/sidebar.jsx` → `0`; `npm run build` → exit 0.

### Step 2: Write the dialog API `ui/lib/dialog.js`

Write a framework-free module (no React import). Required API:

```js
// Each request: { id, kind: 'confirm' | 'alert', title, message,
//   confirmLabel?, cancelLabel?, destructive?, type? , resolve }
export function confirm({ title, message, confirmLabel, cancelLabel, destructive = false }) // → Promise<boolean>
export function alert({ title, message, type = 'info' })   // type: 'info' | 'warning' | 'error' → Promise<void>
export function getCurrent()          // first queued request or null (same object until it changes)
export function resolveCurrent(value, expectedId) // resolve only if the current request id matches expectedId
export function subscribe(listener)   // → unsubscribe; for useSyncExternalStore
export function _reset()              // test helper: resolve nothing, clear queue and listeners
```

Rules: requests run one at a time, first in first out. `resolveCurrent` ignores an explicit `expectedId` that no longer matches the current request. Host callbacks must pass that id; tests may omit it to resolve the active request. `resolveCurrent` on a `confirm` passes `value === true` (anything else → `false`). On an `alert` it resolves `undefined`. `getCurrent` must return the same object between changes (required by `useSyncExternalStore`). Labels may be `undefined`; `DialogHost` fills in translated defaults.

**Verify**: `npx vitest run ui/lib/__tests__/dialog.spec.js` (write the spec now; see Test plan) → all pass.

### Step 3: Add `DialogHost` and `Toaster`, fix `ErrorBoundary`

1. Create `app/components/layout/DialogHost.jsx` (function component):
   - `const current = useSyncExternalStore(subscribe, getCurrent)`.
   - When `current?.id` changes to a non-null value, call `sounds.play('DIALOG')` (keeps today's sound from `app/renderers/dialog.js`).
   - Render `<AlertDialog open={!!current} onOpenChange={open => { if (!open) resolveCurrent(false, current.id); }}>` with `key={current?.id}`.
   - Content: `AlertDialogMedia` icon from lucide (`Info` for info/confirm, `TriangleAlert` for warning, `CircleX` for error), `AlertDialogTitle` = `current.title`, `AlertDialogDescription` = `current.message` (use `whitespace-pre-wrap` and `max-h-60 overflow-auto` for long text).
   - Footer for `confirm`: `AlertDialogCancel` (label `cancelLabel ?? t('common:cancel')`) and `AlertDialogAction onClick={() => resolveCurrent(true, current.id)}` (label `confirmLabel ?? t('common:ok')`, `variant="destructive"` when `destructive`). Footer for `alert`: one `AlertDialogAction onClick={() => resolveCurrent(undefined, current.id)}` with `t('common:ok')`.
   - Escape and Cancel close the dialog → `resolveCurrent(false)`.
2. In `app/index.jsx`, render `<DialogHost />` and `<Toaster />` (from `@/components/ui/toast`) as siblings **after** `<ErrorBoundary>…</ErrorBoundary>` and inside `<Provider>`.
3. Rewrite `ErrorBoundary.jsx` without `openDialog`, styled-components or Ionicons: keep `hasError` state, also store `error` and `info.componentStack`. Render a centred panel with Tailwind classes: lucide `Bug` icon, title `t('app:error:title')`, text `t('app:error:message')` with the link `https://github.com/jamesso/manta/issues`, a `<details>` that shows the component stack, and a shadcn `Button` "Reload" that calls `window.location.reload()`. Use `i18n.t` (the boundary is a class outside the translation HOC).
4. Add to `i18n/en/common.json`: `"ok": "OK"`, `"cancel": "Cancel"`, `"delete": "Delete"`. Create `i18n/en/app.json` (keys listed in Step 12) and add `import app from './app.json';` plus `app,` to `i18n/en/index.js`.

**Verify**: `npm run build` → exit 0; `grep -n "openDialog" app/components/shared/ErrorBoundary.jsx` → no output.

### Step 4: Replace the IPC confirm flows and the simple messages

Use `import * as dialog from '@/lib/dialog';` everywhere (avoids shadowing the global `alert`).

1. `app/containers/Invoices.jsx`: delete `componentDidMount`, `componentWillUnmount` and `confirmedDeleteInvoice`. Make `deleteInvoice` async:

   ```js
   async deleteInvoice(invoiceId) {
     const { t, dispatch } = this.props;
     const ok = await dialog.confirm({
       title: t('dialog:deleteInvoice:title'),
       message: t('dialog:deleteInvoice:message'),
       confirmLabel: t('common:delete'),
       cancelLabel: t('common:cancel'),
       destructive: true,
     });
     if (ok) dispatch(Actions.deleteInvoice(invoiceId));
   }
   ```

   Remove the `openDialog` import and, if now unused, `const ipc = window.manta.ipc;`.
2. `app/containers/Contacts.jsx`: same change with `dialog:deleteContact:*` and `ContactsActions.deleteContact(contactId)`.
3. `app/components/settings/Invoice.jsx:28-34`: replace `openDialog({...})` with `dialog.alert({ type: 'warning', title: …, message: … })` (same strings). Keep the IPC listener for `no-access-directory`.
4. `app/helpers/image.js`: `dialog.alert({ type: 'warning', title: i18n.t('dialog:fileTypeErr:title'), message: err.message })`.
5. `app/helpers/form.js`: replace `import openDialog from '../renderers/dialog';` with `import * as dialog from '@/lib/dialog';` and every `openDialog(` with `dialog.alert(`. The object argument stays identical. Do not await (validation stays synchronous; the dialog shows after the function returns `false`).
6. `app/helpers/__tests__/form.spec.js`: replace lines 21-22 with `vi.mock('@/lib/dialog');` and `import * as dialog from '@/lib/dialog';`. Replace every `expect(openDialog)` with `expect(dialog.alert)`. If a test uses `openDialog.mockClear()` or similar, rename it the same way.

**Verify**: `grep -rn "openDialog\|renderers/dialog" app --include='*.js' --include='*.jsx' | grep -v __tests__ | grep -v "app/renderers/dialog.js"` → no output; `npx vitest run app/helpers/__tests__/form.spec.js` → pass.

### Step 5: Rework `AppUpdate` as a sidebar status entry

Keep it a class component with the same IPC events. Change:

1. `update-available`: `this.hideIndicator()`, then `const ok = await dialog.confirm({ title: i18n.t('dialog:appUpdate:available:title'), message: i18n.t('dialog:appUpdate:available:message'), confirmLabel: i18n.t('common:yes'), cancelLabel: i18n.t('common:noThanks') })`. On `ok`: `this.setState({ downloading: true }); ipc.send('update-download-started');`.
2. `update-not-available`: `toast.add({ type: 'info', title: i18n.t('dialog:appUpdate:noUpdate:title'), description: i18n.t('dialog:appUpdate:noUpdate:message') })`; then `hideIndicator()`.
3. `update-error`: `dialog.alert({ type: 'warning', title: i18n.t('dialog:appUpdate:error:title'), message: error })`; then `hideIndicator()`.
4. `update-downloaded`: keep `Notify(...)`; `hideIndicator()`; `const ok = await dialog.confirm({ …downloaded title/message, confirmLabel: quitNow, cancelLabel: later })`; on `ok`: `ipc.send('quit-and-install')`.
5. Delete the `update-download-confirmed` and `upgrade-confirmed` listeners. Fix `componentWillUnmount` to list exactly the channels that remain.
6. Render a `SidebarMenuItem` + `SidebarMenuButton` (import from `@/components/ui/sidebar`):
   - idle: icon `RefreshCw`, label `t('app:update:check')`, `tooltip` same label, `onClick={() => ipc.send('check-for-updates')}`;
   - checking: icon `RefreshCw` with `animate-spin`, label `t('app:update:checking')`, `disabled`;
   - downloading: icon `Download`, label `t('app:update:downloading', { percent: Math.round(progress || 0) })`, plus a 4 px bar (`<div className="h-1 rounded bg-sidebar-accent"><div className="h-1 rounded bg-primary" style={{ width: \`${progress||0}%\` }} /></div>`) that hides when the sidebar is collapsed (`group-data-[collapsible=icon]:hidden`).
   - Use `withTranslation()` or `i18n.t` consistently (the file uses `i18n.t` today).
7. In `preload/index.js` remove `'confirmed-delete-contact'`, `'confirmed-delete-invoice'`, `'update-download-confirmed'`, `'upgade-confirmed'`, `'upgrade-confirmed'`. Keep `'show-modal'`, `'modal-response'`, `'update-modal'` (modal code stays until 018).

**Verify**: `grep -rn "confirmed-delete\|update-download-confirmed\|upgrade-confirmed\|upgade-confirmed" app preload --include='*.js' --include='*.jsx'` → no output; `npx vitest run preload` → pass.

### Step 6: Notifications become toasts; UI state changes

1. `app/constants/actions.jsx`: delete `UI_NOTIFICATION_REMOVE`. Add `UI_NEW_INVOICE`, `UI_SIDEBAR_COLLAPSED_SET`, `UI_COMMAND_PALETTE_SET`, `UI_SHORTCUTS_SET`, `SETTINGS_THEME_SET` (skip the last one if 012 already added an equivalent action; reuse it).
2. `app/actions/ui.jsx`: delete `removeNoti`. Add `newInvoice = createAction(UI_NEW_INVOICE)`, `setSidebarCollapsed = createAction(UI_SIDEBAR_COLLAPSED_SET, v => v)`, `setCommandPalette = createAction(UI_COMMAND_PALETTE_SET, v => v)`, `setShortcutsDialog = createAction(UI_SHORTCUTS_SET, v => v)`. Keep `newNoti`, `changeActiveTab`, `checkUpdatesMessage`.
3. `app/reducers/UIReducer.jsx`: initial state

   ```js
   const initialState = {
     activeTab: 'form',
     checkUpdatesMessage: {},
     sidebarCollapsed: window.manta.settings.get('ui.sidebarCollapsed') === true,
     commandPaletteOpen: false,
     shortcutsOpen: false,
   };
   ```

   Delete the two notification handlers. Add handlers that set `sidebarCollapsed`, `commandPaletteOpen`, `shortcutsOpen` to `Boolean(action.payload)`. Opening the palette sets `shortcutsOpen: false`, and the reverse (only one overlay at a time).
4. `app/middlewares/UIMiddleware.jsx`: change the signature to `({ dispatch, getState }) => next => action`. Then:
   - `UI_NOTIFICATION_NEW`: keep the sounds; then `toast.add({ title: action.payload.message, type: TOAST_TYPE[action.payload.type] ?? 'info' })` with `const TOAST_TYPE = { success: 'success', warning: 'warning', danger: 'error', error: 'error', info: 'info' }`. Do not call `next`. Return `undefined`. Import `toast` from `@/components/ui/toast`.
   - `UI_SIDEBAR_COLLAPSED_SET`: `window.manta.settings.set('ui.sidebarCollapsed', Boolean(action.payload))`, then `return next(action)`.
   - `UI_NEW_INVOICE`: implement Decision 1. Read `getState().form?.settings?.editMode?.active`. Not active → `dispatch(UIActions.changeActiveTab('form'))`. Active → `return dialog.confirm({ title: i18n.t('app:newInvoice:confirmTitle'), message: i18n.t('app:newInvoice:confirmMessage'), confirmLabel: i18n.t('app:newInvoice:confirm'), cancelLabel: i18n.t('app:newInvoice:cancel') }).then(ok => { if (!ok) return; dispatch(FormActions.clearForm(null, true)); dispatch(UIActions.changeActiveTab('form')); });`. Never call `next` for this action.
5. `app.js` `setInitialValues()`: add `ui: { sidebarCollapsed: false }` to `defaultOptions`. (Existing users get the key from the level-2 loop; no migration.)
6. Theme action: in `app/reducers/SettingsReducer.jsx` add a handler for `SETTINGS_THEME_SET` that sets `current.general.theme` **and** `saved.general.theme` to the payload (guard: if `state.current` is missing, return state). In `app/actions/settings.jsx` add `setTheme = createAction(SETTINGS_THEME_SET, theme => theme)`. In `SettingsMW` handle `SETTINGS_THEME_SET`: `ipc.send('set-theme', theme)` (012's main handler applies and saves it), then `return next(action)`. Reason: `SETTINGS_SAVE` writes the whole `general` object, so Redux must hold the new theme. 012's "send `set-theme` only when the theme changes" check in `SETTINGS_SAVE` then sees no change.
7. `app/helpers/theme.js`: `export function nextTheme(current)` → `'system' → 'light' → 'dark' → 'system'`; any other value (also `undefined`) → `'light'` (treated as `system`). If 012 already created this file, add the function to it.
8. Update specs: see Test plan (UIReducer, UIMiddleware, SettingsReducer, ui actions).

**Verify**: `npx vitest run app/reducers app/middlewares app/actions app/helpers/__tests__/theme.spec.js` → pass; `grep -rn "removeNoti\|UI_NOTIFICATION_REMOVE\|notifications" app --include='*.js' --include='*.jsx'` → no output.

### Step 7: Build the sidebar and the title bar

1. Create `ui/hooks/use-media-query.js`: `useMediaQuery(query)` with `useState(() => window.matchMedia(query).matches)` and a `change` listener in `useEffect`.
2. Convert `app/App.jsx` to a function component. Keep every IPC listener from `:36-69` in one `useEffect` with the same cleanup list. Change `menu-change-tab` to `dispatch(UIActions.changeActiveTab(tabName))`. Add listeners (and add the channels to `preload/index.js`): `menu-new-invoice` → `dispatch(UIActions.newInvoice())`, `menu-open-command-palette` → `dispatch(UIActions.setCommandPalette(true))`, `menu-show-shortcuts` → `dispatch(UIActions.setShortcutsDialog(true))`. Remove the `AppNav`, `AppNoti`, `AppWrapper` imports.
3. Sidebar open state in `App` (Decision 2):

   ```js
   const collapsedPref = useSelector(s => s.ui.sidebarCollapsed);
   const isNarrow = useMediaQuery('(max-width: 899px)');
   const [narrowOpen, setNarrowOpen] = useState(false);
   useEffect(() => { if (isNarrow) setNarrowOpen(false); }, [isNarrow]);
   const open = isNarrow ? narrowOpen : !collapsedPref;
   const onOpenChange = next =>
     isNarrow ? setNarrowOpen(next) : dispatch(UIActions.setSidebarCollapsed(!next));
   ```

4. Render:

   ```jsx
   <SidebarProvider open={open} onOpenChange={onOpenChange} className="h-svh overflow-hidden">
     <AppSidebar activeTab={activeTab} />
     <SidebarInset className="min-w-0 overflow-hidden">
       <TitleBar activeTab={activeTab} />
       <div className="min-h-0 flex-1"><AppMain activeTab={activeTab} /></div>
     </SidebarInset>
     <CommandPalette />
     <ShortcutsDialog />
   </SidebarProvider>
   ```

   In `AppMain.jsx`, replace `<AppMainContent>` with `<div className="h-full overflow-auto bg-background">`. Keep `shouldComponentUpdate`.
5. `app/components/layout/AppSidebar.jsx` — `<Sidebar collapsible="icon">`:
   - Top: `<div className="titlebar drag-region h-10 shrink-0" />` (traffic lights sit here on macOS).
   - `SidebarHeader`: a `DropdownMenu` whose trigger is `SidebarMenuButton size="lg"` with `Avatar` (`AvatarImage src={profile.logo}`, `AvatarFallback` = first letter of the name) and the name `profile.company || profile.fullname || 'Manta'` (read `useSelector(s => s.settings.saved?.profile)`; guard against `undefined`). Menu items: "Business profile" → `changeActiveTab('settings')`; "Keyboard shortcuts" → `setShortcutsDialog(true)`.
   - Under it: `SidebarMenuButton` "New invoice" (icon `Plus`, `isActive={activeTab === 'form'}`, `tooltip`, a `Kbd` "⌘N"/"Ctrl+N" hidden when collapsed) → `dispatch(UIActions.newInvoice())`. Then `SidebarMenuButton` "Search" (icon `Search`, `Kbd` "⌘K") → `setCommandPalette(true)`.
   - `SidebarContent` › `SidebarGroup` › `SidebarMenu`: "Invoices" (icon `FileText`, tab `invoices`), "Clients" (icon `Users`, tab `contacts`). Each: `isActive`, `tooltip` = label, `onClick` → `changeActiveTab(tab)`.
   - `SidebarFooter` › `SidebarMenu`: `<AppUpdate />`; "Help" (icon `CircleHelp`) as a `DropdownMenu` with "Keyboard shortcuts", "Show tutorial" (`ipc.send('start-tour')`), "Learn more" (`<a href="https://github.com/jamesso/manta" target="_blank" rel="noreferrer">`; check that the main process opens external links in the browser — if a click opens a new Electron window, use the existing `shell.openExternal` path instead, or drop the item and report); "Settings" (icon `Settings`, tab `settings`).
   - `<SidebarRail />`.
   - Platform key labels: `window.manta.platform === 'darwin'` → `⌘`, else `Ctrl+`.
6. `app/components/layout/TitleBar.jsx`: `<header className="titlebar titlebar-inset drag-region flex h-10 shrink-0 items-center gap-2 border-b bg-background px-2">` with `<SidebarTrigger />` and the page title (`form`: `t('app:titles:newInvoice')` or `t('app:titles:editInvoice')` in edit mode; `invoices`: `t('app:nav:invoices')`; `contacts`: `t('app:nav:clients')`; `settings`: `t('app:nav:settings')`).
7. In `app/index.jsx` (before render) set `document.documentElement.dataset.platform = window.manta.platform;`.
8. Add to `ui/styles/globals.css` (in `@layer components`):

   ```css
   .drag-region { -webkit-app-region: drag; app-region: drag; }
   .drag-region :is(button, a, input, select, textarea, [role='button']) { -webkit-app-region: no-drag; app-region: no-drag; }
   /* Windows/Linux: keep content clear of the window controls overlay. */
   .titlebar-inset { padding-right: calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 0.5rem); }
   /* macOS: traffic lights overflow a collapsed (3rem) sidebar. */
   html[data-platform='darwin'] [data-slot='sidebar-wrapper']:has([data-state='collapsed']) .titlebar-inset { padding-left: 2.5rem; }
   ```

   Check the real attribute names in `ui/components/ui/sidebar.jsx` (`data-slot="sidebar-wrapper"`, `data-state`) and adjust the selector if they differ.
9. `static/css/general.css`: delete the line `-webkit-app-region: drag;` from the `body, #root, .appWrapper` rule. Keep everything else.
10. Delete `app/components/layout/AppNav.jsx`, `app/components/layout/AppNoti.jsx`, `app/components/shared/Notification.jsx`.

**Verify**: `npm run build` → exit 0; `grep -rn "AppNav\|AppNoti\|shared/Notification" app --include='*.js' --include='*.jsx'` → no output; `grep -n "app-region: drag" static/css/general.css` → only the `.draggable` rule.

### Step 8: Fix the page header layout for the wider sidebar

In `app/components/shared/Layout.jsx`:
- `PageHeaderStyle`: replace `position: fixed; width: 100%;` with `position: sticky; top: 0;` and the padding with `10px 40px`.
- `PageContentStyle`: change `margin: 90px 40px 40px 40px` to `margin: 40px`.
- `AppMainContentStyle`: change `background: #f9fafa;` to `background: var(--background);`. Delete `AppWrapper` and `AppMainContent` (and their styles) if nothing imports them: `grep -rn "AppWrapper\|AppMainContent" app --include='*.jsx'`.
- In `app/components/shared/_tests_/Layout.spec.jsx` delete the two cases for `AppWrapper` and `AppMainContent` and remove them from the import.

**Verify**: `npx vitest run app/components/shared` → pass. Manual (Step 13): on every page the header actions are fully visible with the sidebar expanded and collapsed.

### Step 9: Frameless main window and title bar overlay

1. In `main/theme.js` (ES module from 012; keep it free of `require('electron')`) add:

   ```js
   export const TITLEBAR_HEIGHT = 40;
   // Same values as --foreground in ui/styles/globals.css.
   const TITLEBAR_SYMBOL = { light: '#0a0a0a', dark: '#fafafa' };

   export function titleBarOverlayFor(nativeTheme) {
     const mode = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
     return { color: WINDOW_BACKGROUND[mode], symbolColor: TITLEBAR_SYMBOL[mode], height: TITLEBAR_HEIGHT };
   }

   export function titleBarOptions(platform, nativeTheme) {
     if (platform === 'darwin') {
       return { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 13 } };
     }
     return { titleBarStyle: 'hidden', titleBarOverlay: titleBarOverlayFor(nativeTheme) };
   }
   ```

   First compare `TITLEBAR_SYMBOL` with the `--foreground` tokens in `ui/styles/globals.css` (light and dark) and use their hex form. `WINDOW_BACKGROUND` already equals `--background`.
2. `app.js`: import `titleBarOptions` and `titleBarOverlayFor` next to `setupTheme`. In `createMainWindow()` spread `...titleBarOptions(process.platform, nativeTheme)` into the options and set `minWidth: 800`, `minHeight: 560`. After the window is created, add (only the main window has an overlay; do not touch 012's all-windows loop):

   ```js
   if (process.platform !== 'darwin') {
     nativeTheme.on('updated', () => {
       if (!mainWindow.isDestroyed()) mainWindow.setTitleBarOverlay(titleBarOverlayFor(nativeTheme));
     });
   }
   ```

3. Do not change any other window.
4. Manual checks (on a data copy):
   - macOS: the traffic lights sit centred in the 40 px strip, over the sidebar, and do not cover the avatar or the trigger, with the sidebar expanded and collapsed. If not, tune `trafficLightPosition`. If `trafficLightPosition` has no effect with `hiddenInset`, use `titleBarStyle: 'hidden'` with the same position and record it in Maintenance notes.
   - Drag the window by the strip (both halves). The window moves. Drag on page content: the window does not move, text selection works in inputs.
   - Double-click the strip: macOS zooms the window (system behavior).
   - Windows/Linux (CI machine or VM if no local one): controls show at the top right in the strip; switch theme (Settings or palette) → the overlay colors follow. `Ctrl+N`, `Ctrl+S`, `Ctrl+,` still work. If menu accelerators do not work with the hidden title bar, STOP and report.
   - Linux: if the overlay controls do not render, use `titleBarStyle: 'default'` on Linux only and record it in Maintenance notes.

**Verify**: `npx vitest run main/__tests__/theme.spec.js` → pass (with the new cases from Test plan); `npm run build` → exit 0; `npm run test:e2e` → the 8 existing tests pass (the main window keeps title `Manta`, stays resizable and movable).

### Step 10: Native menu

In `main/menu.js`:
1. `aboutMenu.label`: `'My App'` → `'Manta'`.
2. Invoice › New: `click() { mainWindow.webContents.send('menu-new-invoice'); }` (accelerator stays `CmdOrCtrl+N`).
3. Go › Settings: accelerator `CmdOrCtrl+Shift+S` → `CmdOrCtrl+,`.
4. Go: add `{ type: 'separator' }` and `{ label: 'Command Palette…', accelerator: 'CmdOrCtrl+K', click() { mainWindow.webContents.send('menu-open-command-palette'); } }`.
5. Help: add `{ label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click() { mainWindow.webContents.send('menu-show-shortcuts'); } }` before "Learn More". Keep "Show Tutorial".
6. Confirm `preload/index.js` has `'menu-new-invoice'`, `'menu-open-command-palette'`, `'menu-show-shortcuts'` (Step 7.2). Keep `'menu-change-tab'` (Go menu items still use it).
7. Native menu labels stay English (they are not translated today).

**Verify**: `grep -n "My App\|CmdOrCtrl+Shift+S" main/menu.js` → no output; `grep -c "CmdOrCtrl+," main/menu.js` → `1`; `grep -c "CmdOrCtrl+K" main/menu.js` → `1`.

### Step 11: Command palette and shortcuts dialog

1. `app/helpers/commandSearch.js` (pure, no imports from React or `window`):

   ```js
   export function normalize(text)   // String(text ?? ''), NFD, strip /\p{Diacritic}/gu, lower case, trim
   export function filterCommands(commands, query) // commands: [{ id, label, keywords: [] }]; empty query → all
   export function searchRecords({ query, invoices = [], contacts = [], limit = 5 })
   //  → { invoices: [...], contacts: [...] }; empty query → both []
   //  invoice matches: invoiceID, first 8 chars of _id, recipient.fullname, recipient.company, recipient.email
   //  contact matches: fullname, company, email
   //  every whitespace-separated term must match one of the fields (AND)
   //  invoices sorted by created_at desc; missing fields never throw (old docs)
   ```

2. `app/components/layout/CommandPalette.jsx` (function component):
   - `open` = `useSelector(s => s.ui.commandPaletteOpen)`; `onOpenChange={v => dispatch(setCommandPalette(v))}`. Reset the query to `''` when it opens.
   - Keyboard: `useEffect` adds a `keydown` listener on `window`: `key.toLowerCase() === 'k'` and (`metaKey` on macOS, `ctrlKey` elsewhere) and no `altKey`/`shiftKey` → `preventDefault()` and `dispatch(setCommandPalette(true))`.
   - `<CommandDialog open onOpenChange title={t('app:palette:title')} description={t('app:palette:description')}>` → `<Command shouldFilter={false}>` → `CommandInput` (placeholder `t('app:palette:placeholder')`, controlled `value`/`onValueChange`) → `CommandList` → `CommandEmpty`.
   - Groups: "Go to" (Invoices, Clients, Settings), "Actions" (New invoice ⌘N, Toggle theme with the current theme in the label, Keyboard shortcuts ⌘/, Check for updates), "Invoices" and "Clients" from `searchRecords` with `useSelector(s => s.invoices)` and `useSelector(s => s.contacts)`. Pass each command's `keywords` (for example Clients: `['contacts', 'customers']`).
   - Every `CommandItem` gets a unique `value` (for example `nav-invoices`, `invoice-<_id>`) and an `onSelect` that closes the palette first, then acts: tabs → `changeActiveTab`; New invoice → `newInvoice()`; theme → `const next = nextTheme(currentTheme); dispatch(SettingsActions.setTheme(next)); toast.add({ title: t('app:palette:themeChanged', { theme: t(\`app:theme:${next}\`) }) })` (`currentTheme` = `useSelector(s => s.settings.saved?.general?.theme) ?? 'system'`); shortcuts → `setShortcutsDialog(true)`; updates → `ipc.send('check-for-updates')`; invoice → `ipc.send('preview-invoice', invoice)`; client → `changeActiveTab('contacts')`.
3. `app/constants/shortcuts.js`: an array of groups that mirrors `main/menu.js` plus the renderer shortcuts: `{ group: 'app:shortcuts:groups:general', items: [{ label: 'app:shortcuts:items:palette', mac: '⌘K', other: 'Ctrl+K' }, …] }`. Include: palette ⌘K, toggle sidebar ⌘B, settings ⌘,, shortcuts ⌘/, check updates ⌘U, quit ⌘Q; invoice: new ⌘N, save ⌘S, reset ⌘R, add item ⌘I, toggle form settings ⌥S, due date ⌥T, currency ⌥C, VAT ⌥V, discount ⌥D, note ⌥N; go: invoices ⌘⇧A, clients ⌘⇧D; help: tutorial ⌘T. Non-mac: `Ctrl+…`, `Alt+…`, `Ctrl+Shift+…`. Add a comment: `// Keep in sync with main/menu.js accelerators.`
4. `app/components/layout/ShortcutsDialog.jsx`: shadcn `Dialog` bound to `ui.shortcutsOpen`; title `t('app:shortcuts:title')`; one section per group; each row = label + `Kbd`. Body scrolls (`max-h-[70vh] overflow-auto`).

**Verify**: `npx vitest run app/helpers/__tests__/commandSearch.spec.js` → pass; `npm run build` → exit 0.

### Step 12: Strings

Put every new UI string in `i18n/en/app.json` (namespace `app`, keys with `:` like the rest of the app, for example `t('app:nav:invoices')`). Minimum keys:
`nav: { newInvoice, search, invoices, clients, settings, help, businessProfile, shortcuts, tutorial, learnMore }`, `titles: { newInvoice, editInvoice }`, `update: { check, checking, downloading }` (`"Downloading update {{percent}}%"`), `palette: { title, description, placeholder, empty, goTo, actions, invoices, clients, toggleTheme, themeChanged }`, `theme: { system, light, dark }`, `shortcuts: { title, groups: {…}, items: {…} }`, `newInvoice: { confirmTitle: "Stop editing this invoice?", confirmMessage: "Unsaved changes to this invoice will be lost. The saved invoice does not change.", confirm: "Start new invoice", cancel: "Keep editing" }`, `error: { title: "Something went wrong", message, reload: "Reload", details: "Details" }`.
Use "Clients" in the UI. Keep the internal names `contacts`. Do not edit other locales.

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('i18n/en/app.json','utf8'));console.log('ok')"` → `ok`; with the app running, no raw key such as `app:nav:invoices` is visible.

### Step 13: e2e check and full run

1. Append this test at the **end** of `e2e/app.e2e.mjs` (the file runs in order; earlier tests expect a hidden main window):

   ```js
   test('sidebar shows labels and Ctrl/Cmd+K opens the command palette', async () => {
     await app.evaluate(({ BrowserWindow }) => {
       const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'Manta');
       w.show();
       w.focus();
     });
     let page;
     for (const p of app.windows()) if ((await p.title()) === MAIN_TITLE) page = p;
     for (const name of ['New invoice', 'Invoices', 'Clients', 'Settings']) {
       await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
     }
     await page.keyboard.press('ControlOrMeta+K');
     const palette = page.getByRole('dialog');
     await expect(palette).toBeVisible();
     await page.keyboard.type('clients');
     await palette.getByRole('option', { name: 'Clients' }).click();
     await expect(palette).toBeHidden();
     await expect(page.getByText('All Contacts')).toBeVisible();
   });
   ```

   If an accessible name differs (for example the button includes the `Kbd` text), fix the component so the visible label is the accessible name (put `aria-hidden` on `Kbd`), not the test.
2. Run `npm test`, `npm run lint`, `npm run test:e2e`.
3. Manual smoke on a data copy (see "Commands you will need"), in **light and dark** mode (switch with the palette). Take screenshots of: expanded sidebar, collapsed sidebar, palette with a search result, a delete confirm, a toast.
   - Each nav item changes the page; active item is highlighted; collapsed state shows tooltips.
   - Collapse, quit, restart → still collapsed. Resize below 900 px → collapses; above → returns to the saved state.
   - Delete an invoice: Cancel/Escape keeps it; Delete removes it. Same for a client.
   - Save an invoice → success toast. Save with an empty item description → warning dialog.
   - Edit an invoice, click New invoice → confirm; "Keep editing" keeps the edit; "Start new invoice" shows an empty form; the saved invoice is unchanged in the list.
   - ⌘K from the menu and from the keyboard; search an invoice number and a client email; select invoice → preview window opens.
   - Keyboard shortcuts dialog lists the menu accelerators.

**Verify**: `npm test` → exit 0; `npm run lint` → exit 0; `npm run test:e2e` → 9 passed.

## Test plan

New unit tests (behavior that can break silently):
- `ui/lib/__tests__/dialog.spec.js` (call `_reset()` in `beforeEach`):
  - `confirm` resolves `true` after `resolveCurrent(true)`; resolves `false` after `resolveCurrent(false)` and after `resolveCurrent()`.
  - `alert` resolves `undefined`; `getCurrent().kind === 'alert'` and `type` defaults to `'info'`.
  - Queue: call `confirm` twice. `getCurrent()` is the first. After resolving it, the first promise settles, `getCurrent()` is the second, and the second promise is still pending (check with a flag after `await Promise.resolve()`). After resolving the second, `getCurrent()` is `null`.
  - `subscribe` listener runs on enqueue and on resolve; the returned function unsubscribes. `getCurrent()` returns the same object on two calls without a change.
- `app/helpers/__tests__/commandSearch.spec.js`: empty query → no records and all commands; matches `invoiceID`; matches the `_id` prefix when `invoiceID` is missing; matches client name case- and accent-insensitively (`"jose"` finds `"José"`); matches contact email; two terms use AND; `limit` caps each list; invoices sorted newest first; docs without `recipient` or `email` do not throw; `filterCommands` matches `keywords` (`"customers"` → Clients).
- `app/helpers/__tests__/theme.spec.js`: `nextTheme` cycle and fallback for `undefined`/unknown values.
- `main/__tests__/theme.spec.js` (012's file; add cases): `titleBarOptions('darwin', fake)` → `titleBarStyle: 'hiddenInset'` and no `titleBarOverlay`; `titleBarOptions('win32', { shouldUseDarkColors: true })` → overlay `color === WINDOW_BACKGROUND.dark` and `height === 40`; the light case gives the light colors.
- `app/reducers/__tests__/UIReducer.spec.js`: replace the `initialState` constant with the new shape (`window.manta.settings.get` returns `'someSettings'` in `vitest.setup.js` → `sidebarCollapsed: false`); delete the two notification tests; add tests for `UI_SIDEBAR_COLLAPSED_SET`, `UI_COMMAND_PALETTE_SET` (opening closes shortcuts), `UI_SHORTCUTS_SET` (opening closes the palette). Add one test with `vi.resetModules()` + `window.manta.settings.get.mockReturnValueOnce(true)` + dynamic import → initial `sidebarCollapsed === true`.
- `app/reducers/__tests__/SettingsReducer.spec.js`: `SETTINGS_THEME_SET` updates both `current.general.theme` and `saved.general.theme` and keeps the other `general` keys.
- `app/middlewares/__tests__/UIMiddleware.spec.js`: create the middleware with `{ dispatch, getState }`. Replace the two `UI_NOTIFICATION_NEW` tests: sound still plays, `next` is **not** called, and `toast.add` gets `{ title: message, type: 'success' }` / `'warning'` (mock `@/components/ui/toast`). Add: `UI_SIDEBAR_COLLAPSED_SET` calls `window.manta.settings.set('ui.sidebarCollapsed', true)` and `next`. `UI_NEW_INVOICE` (mock `@/lib/dialog`): not in edit mode → dispatches only `changeActiveTab('form')` and never calls `confirm`; edit mode + confirm `false` → no dispatch; edit mode + confirm `true` → dispatches `clearForm` with muted payload, then `changeActiveTab('form')`.
- `app/containers/__tests__/Invoices.spec.jsx`: add "delete waits for confirmation": mock `@/lib/dialog`; `confirm` resolves `false` → `dispatch` not called; resolves `true` → `dispatch` called with `Actions.deleteInvoice('first-invoice')`. Call `deleteInvoice` on the instance or through the mocked `Invoice` props. This guards against `if (dialog.confirm(...))` (a Promise is always truthy).
- `app/containers/__tests__/Contacts.spec.js`: replace the placeholder with the same two cases for `deleteContact`. Import the named class if it is exported; if not, export it (`export class Contacts`) like `Invoices`.

Changed existing tests: `form.spec.js` (mock swap only, Step 4.6); `ui.spec.js` (delete the `removeNoti` test); `Layout.spec.jsx` (delete the `AppWrapper` and `AppMainContent` cases). Middleware specs that assert `UI_NOTIFICATION_NEW` stay unchanged.

Deleted components without tests: `AppNav.jsx`, `AppNoti.jsx`, `Notification.jsx`.

Do not add tests for markup, CSS classes, the shortcuts list, sidebar rendering or action creators.

e2e: the 8 existing tests (6 from 011, 2 from 012) plus the new sidebar/palette test (9 total).

## Done criteria

- [ ] `grep -rn "openDialog\|renderers/dialog" app --include='*.js' --include='*.jsx' | grep -v "app/renderers/dialog.js"` → only `app/middlewares/__tests__/SettingsMW.spec.js` (unused import, left as is) or nothing
- [ ] `grep -rn "show-modal" app --include='*.js' --include='*.jsx'` → only `app/renderers/dialog.js` (no importer — `grep -rln "renderers/dialog" app | grep -v __tests__` → no output)
- [ ] `ls app/components/layout` → `AppMain.jsx AppSidebar.jsx AppUpdate.jsx CommandPalette.jsx DialogHost.jsx ShortcutsDialog.jsx TitleBar.jsx`
- [ ] `test ! -f app/components/shared/Notification.jsx && echo ok` → `ok`
- [ ] `grep -n "My App" main/menu.js` → no output; `grep -c "CmdOrCtrl+," main/menu.js` → `1`
- [ ] `grep -n "app-region: drag" static/css/general.css` → only `.draggable`
- [ ] `grep -n "titleBarStyle\|minWidth: 800" app.js` → both present (titleBarStyle may come from `titleBarOptions()`)
- [ ] `grep -n "sidebarCollapsed" app.js app/reducers/UIReducer.jsx app/middlewares/UIMiddleware.jsx` → hits in all three
- [ ] `npm test` exits 0; `npm run lint` exits 0; `npm run test:e2e` → 9 passed
- [ ] Manual smoke (Step 13.3) done in light and dark mode on a data copy; screenshots attached to the report
- [ ] Windows/Linux title bar result (checked or not checked, and any Linux fallback) stated in the report
- [ ] `git status` clean; commits follow "Git workflow"; no attribution lines
- [ ] `plans/README.md` status row for 013 updated

## STOP conditions

Stop and report (do not improvise) if:
- A 012 precondition fails (no `ui/`, no `@` alias, no `set-theme`, no `main/theme.js`).
- `shadcn add` wants to write outside `ui/`, writes `.tsx`, or overwrites a 012 file you cannot decline.
- The shadcn base-nova `toast.jsx` does not export a module-level `toast` manager (then the middleware cannot add toasts outside React; report the exports).
- On Windows or Linux, menu accelerators (`Ctrl+N`, `Ctrl+S`) stop working with the hidden title bar.
- The main window title is no longer `Manta`, or an existing e2e test fails for a reason in this plan's code that you cannot fix inside Scope.
- Any step needs a change to saved invoice/contact documents or to existing settings keys other than adding `ui.sidebarCollapsed`.
- Base UI or cmdk logs a CSP violation in the built app (`npm start`, DevTools console).

## Review acceptance checks

- Queue safety: a Cancel/Action and the resulting close event can both fire. Guard resolution with the request id so the second event cannot dismiss the next queued dialog. Add a regression test that resolves request A twice with A's id and proves request B stays open.
- Keep dialog cleanup local. Capture the request id in event callbacks; do not resolve whatever happens to be current when an old callback runs.
- The 800 px window minimum does not guarantee an 800 px CSS viewport under display scaling or browser zoom. Verify the Sidebar mobile breakpoint and `openMobile` behavior below 768 CSS px. Either wire the mobile state and trigger or set one shared breakpoint; do not rely on `open` alone when the generated Sidebar uses a separate mobile state.
- Keep Decision 1: New invoice preserves an unsaved new draft and only opens its tab. Add a regression test so later entry points cannot clear that draft without an explicit confirmation.
- Unmount must remove only listeners owned by the component when a channel has multiple consumers. If the preload cannot unsubscribe one listener, add a subscription cleanup API and test it before sharing a channel; do not remove another component's listener.

## Maintenance notes

- `app/constants/shortcuts.js` duplicates the accelerators in `main/menu.js`. Change both together. 017 removes "Show tutorial" (⌘T) from both.
- The overlay colors in `main/theme.js` (`WINDOW_BACKGROUND`, `TITLEBAR_SYMBOL`) copy the `--background`/`--foreground` tokens as hex. If 012/018 change the tokens, update the hex values.
- `trafficLightPosition` `{ x: 14, y: 13 }` assumes the 40 px title strip (`h-10`). Change both together. Record here any fallback used in Step 9 (`hidden` instead of `hiddenInset`, Linux default frame).
- With `titleBarStyle: 'hidden'` on Windows/Linux, the native menu bar is not visible. Menu actions stay reachable through accelerators, the sidebar and the command palette. A later plan can add an app menu button if users ask for it.
- `UI_NOTIFICATION_NEW` now only means "show a toast". New code can call `toast.add()` directly; the action stays for the existing middlewares.
- 014 replaces the invoice delete confirm with immediate delete + Undo toast. It must keep `ui/lib/dialog.js` (other callers remain). 016 changes the client result in the palette to open the client detail sheet. 017 adds Dashboard as the first sidebar item and palette "Go to" entry.
- 018 deletes `modal/`, `main/modal-window.js`, `app/renderers/dialog.js`, the `vitest.setup.js` mock line for it, the unused `openDialog` import in `SettingsMW.spec.js`, and the allow-list entries `show-modal`, `modal-response`, `update-modal`. After 013 these have no caller in `app/`.
- The e2e test depends on the page header text `All Contacts` (`contacts:header`). If 016 changes that text, update the test.
- Reviewers: check that `confirm` is awaited at every call site, that `DialogHost`/`Toaster` are outside `ErrorBoundary`, that only the 40 px strip is a drag region, and that no IPC return channel for dialogs remains in `preload/index.js`.
