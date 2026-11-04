# Plan 012: Add Tailwind v4, shadcn/ui (Base UI) and Lucide next to the old styles, with System/Light/Dark theme

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before you go to the
> next step. If a "STOP conditions" item occurs, stop and report. Do not
> improvise. When you finish, do NOT edit `plans/README.md`. The orchestrator
> keeps the index. Do NOT add `Co-authored-by` trailers or AI/tool attribution
> to commits (rule in `AGENTS.md`). Give this rule to each subagent you start.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- package.json electron.vite.config.mjs vitest.config.mjs vitest.setup.js app/index.html preview/index.html modal/index.html tour/index.html app/index.jsx preview/index.jsx modal/index.jsx tour/index.jsx static/css/general.css app.js main/modal-window.js preload/index.js app/components/settings/General.jsx app/middlewares/SettingsMW.jsx app/middlewares/__tests__/SettingsMW.spec.js i18n/en/settings.json e2e/app.e2e.mjs`
> This plan is the first plan of the redesign series (012–018). No earlier
> plan of the series changes these files. The expected output is empty. If a
> file changed, compare it with the "Current state" excerpts. If a difference
> touches a line that this plan edits, STOP.

## Execution checks added by review (2026-11-01)

- Record the execution start commit and starting changes. Scope checks compare this plan's changes with that baseline, not with a clean-tree requirement. Earlier plans can change the listed files; check the required behavior before treating expected changes as drift.
- Before a live app check, use Jean `get_run_environments`; use its running environment or `start_run_environment`. Do not start a second dev server by hand. Confirm that the environment uses a disposable `MANTA_USER_DATA` profile. Record the exact URL or Electron entry and profile used. If no Run command is configured, report that limit.
- Use the narrow tests listed for each changed behavior. Reuse passing results when the covered code has not changed. Run broad tests once at the final integration gate for shared state, persistence or IPC changes. Visual checks require the running app; do not replace them with markup assertions.
- Do not copy a profile while Manta is running. Close it first. Use a new temporary destination, or confirm the existing destination is disposable; repeated `cp -R` into an existing folder can create a nested profile.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/011-packaging-ci-e2e.md (DONE)
- **Category**: ui-redesign
- **Planned at**: commit `3e89104`, 2026-11-01

## Why this matters

Plans 013–018 rebuild the Manta UI with Tailwind CSS v4, shadcn/ui (Base UI primitives) and Lucide icons. This plan installs that stack next to the old Bootstrap 4 beta styles. Old screens must look the same. New components must not get broken by old CSS. To do this, Bootstrap and `general.css` go into a low CSS cascade layer (`legacy`), so Tailwind utilities always win over them.

The plan also adds the theme foundation. The setting `general.theme` (`system | light | dark`) sets `nativeTheme.themeSource` in the main process, so all windows follow `prefers-color-scheme`. The plan removes the global rule that hides every focus outline (`static/css/general.css:1-5`). Today keyboard users cannot see focus (WCAG 2.4.7). Plan 012 changes no layout. A temporary theme select in Settings › General is the only visible new control.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Plan 011 done (Playwright e2e) | `test -f e2e/app.e2e.mjs && test -f playwright.config.mjs && echo ok` | `ok` |
| CI workflow | `test -f .github/workflows/ci.yml && echo ok` | `ok` |
| Node 24 | `node -v` | starts with `v24` |
| Vite 8, React 19, Electron 45 | `npm ls vite react electron --depth=0` | `vite@8.x`, `react@19.x`, `electron@45.x` |
| No Tailwind yet | `npm ls tailwindcss @base-ui/react --depth=0` | `(empty)` |
| No `ui/` folder yet | `test ! -e ui && test ! -e components.json && test ! -e jsconfig.json && echo ok` | `ok` |
| Unit tests pass | `npm test` | exit 0 |
| e2e passes | `npm run test:e2e` | `6 passed` |
| Starting changes | `git status --short` | record existing changes; preserve them |

## Current state

The CSS loads twice in each window: once from `<link>` tags in `index.html` and once from `import` lines in `index.jsx`.

`app/index.html:7-14`:
```html
    <link rel="stylesheet" href="../static/css/bootstrap.min.css">
    <link rel="stylesheet" href="../static/css/ionicons.min.css">
    <link rel="stylesheet" href="../static/css/general.css">
    <link rel="stylesheet" href="../static/css/layout.css">
    ...
    <link rel="stylesheet" href="../static/css/date-picker.css">
```
`preview/index.html:7-11`, `modal/index.html:7-9`, `tour/index.html:7-9` have the same first three `<link>` lines (`bootstrap.min.css`, `ionicons.min.css`, `general.css`). `preview/index.html` also links `preview/font.css` and `preview/print.css`.

`app/index.jsx:1-8` (the other three entries start with the same first three lines):
```js
import '../static/css/bootstrap.min.css';
import '../static/css/ionicons.min.css';
import '../static/css/general.css';
import '../static/css/layout.css';
...
```
`preview/index.jsx:1-5`, `modal/index.jsx:1-3`, `tour/index.jsx:1-3`.

`static/css/general.css:1-5` and `:76-83`:
```css
*:focus,
*:active {
  outline: none !important;
  box-shadow: none !important;
}
...
textarea:focus,
input:focus {
  outline: none;
}

input:disabled {
  background: #f2f3f4 !important;
}
```
`general.css` also has element rules that would override new components if it stays unlayered: `select, input[type="text"], input[type="number"] { height: 36px; background: white; ... }` (`:43-57`) and `label { display: flex; font-size: 14px; }` (`:146-150`). The other files (`layout.css`, `form.css`, `contact.css`, `items.css`, `date-picker.css`) use only class selectors. They stay unchanged and unlayered.

`electron.vite.config.mjs:33-44` (renderer block):
```js
  renderer: {
    root: root('.'),
    plugins: [react(), cspPlugin],
    resolve: {
      alias: [
        // PouchDB still imports the Node events module.
        {
          find: /^events$/,
          replacement: root('./node_modules/events/events.js'),
        },
      ],
    },
```
`electron.vite.config.mjs:7-8` CSP: `style-src 'self' 'unsafe-inline'`. Keep it.

`vitest.config.mjs` has no `resolve` block (whole `test` block at `:4-13`).

`app.js:10`: `const { app, BrowserWindow, ipcMain } = require('electron');`
Hard-coded window colors: `app.js:59` tour `backgroundColor: '#F9FAFA'`, `app.js:89` main `'#2e2c29'`, `app.js:127` preview `'#2e2c29'`, `main/modal-window.js:17` modal `'#282828'`.

`app.js:187-194` (inside `setInitialValues()`; it adds a level-2 key only when it is missing, `:221-240`):
```js
    general: {
      language: 'en',
      sound: 'default',
      muted: false,
      previewPDF: true,
      checkUpdate: 'daily',
      lastCheck: Date.now(),
    },
```
`app.js:426-433`: the `ready` handler creates the windows BEFORE `setInitialValues()`:
```js
  app.on('ready', () => {
    createTourWindow();
    createMainWindow();
    createPreviewWindow();
    setInitialValues();
    migrateData();
    ...
```
`main/settings.js` exports the electron-store instance (`get`, `set`, `has`). `main/print-options.js` is an ES module (`export function`) that `main/save-pdf.js:6` loads with `require()`. The new `main/theme.js` uses the same pattern.

`preload/index.js:3-48`: `const CHANNELS = new Set([ 'change-preview-window-language', ... 'upgrade-confirmed', ]);` — sorted list; `ipc.send` throws for other channels.

`app/components/settings/General.jsx:16-23` (class component; every change goes to Redux, the user clicks Save):
```js
  handleInputChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;
    this.setState({ [name]: value }, () => {
      this.props.updateSettings('general', this.state);
    });
  }
```
The markup is Bootstrap rows: `<div className="row"><div className="col-md-6"><div className="pageItem"><label className="itemLabel">…` (`:58-115`).

`app/middlewares/SettingsMW.jsx:44-56` (SETTINGS_SAVE):
```js
        // Change UI language
        const { language } = appConfig.get('general');
        const newLang = action.payload.general.language;
        if (language !== newLang) {
          // Change the language
          i18n.changeLanguage(newLang);
          // Notify previewWindow to update
          ipc.send('change-preview-window-language', newLang);
        }
        // Save Settings
        appConfig.set('profile', action.payload.profile);
        appConfig.set('invoice', action.payload.invoice);
        appConfig.set('general', action.payload.general);
```
`app/middlewares/__tests__/SettingsMW.spec.js:87-101` expects exactly 2 `ipc.send` calls for a save that changes profile and language. The new code must keep that count when the theme does not change.

`i18n/en/settings.json` → `fields` has `sound`, `mute`, `language`, `openPDFReader`. The keys are read as `t('settings:fields:language:name')`.

`e2e/app.e2e.mjs:25-28` registers `pageerror` listeners on every window. 6 tests. The modal window has the page title `Dialog` and opens on IPC `show-modal`.

## Reference facts (recheck versions and APIs at execution)

- Versions (`npm view <pkg> version`; confirm again at execution time): `tailwindcss` 4.3.3, `@tailwindcss/vite` 4.3.3 (peer `vite ^5.2.0 || ^6 || ^7 || ^8`), `tw-animate-css` 1.4.0, `@base-ui/react` 1.9.0 (peer react `^17 || ^18 || ^19`; `date-fns` peers optional; https://base-ui.com/react/overview/releases), `lucide-react` 1.66.0 (https://lucide.dev/guide/version-1), `cn` 0.5.1, `shadcn` 4.23.0, `class-variance-authority` 0.7.1.
- `cn` is now its own npm package. It replaces `clsx` + `tailwind-merge`. `lib/utils` only does `export { cn } from "cn"`. Do NOT install `clsx` or `tailwind-merge`. Source: https://ui.shadcn.com/docs/changelog/2026-09-cn and https://ui.shadcn.com/docs/installation/manual (install line: `npm install shadcn class-variance-authority cn lucide-react tw-animate-css`).
- The `shadcn` package exports `shadcn/tailwind.css` (custom variants `data-open`, `data-checked`, … and accordion keyframes). globals.css imports it. This is a build-time import. Put `shadcn` in devDependencies, because electron-builder packs all production `dependencies` into the app (shadcn has 32 dependencies).
- Base UI is the default shadcn primitive set since July 2026; style `base-nova`: https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default. CLI v4 has `--dry-run`, `--diff`, `shadcn info`: https://ui.shadcn.com/docs/changelog/2026-03-cli-v4.
- `components.json` schema properties (from https://ui.shadcn.com/schema.json): `style`, `tailwind`, `rsc`, `tsx`, `iconLibrary`, `aliases`, `menuColor`, `menuAccent`, `rtl`, `registries`. Required: `style`, `tailwind`, `rsc`, `aliases`. `tsx: false` → the CLI writes `.jsx` files. `rtl: true` → the CLI converts `left-*/right-*` to `start-*/end-*`: https://ui.shadcn.com/docs/rtl. `style` and `cssVariables` cannot change after init: https://ui.shadcn.com/docs/components-json.
- `shadcn init` can fail on electron-vite with "unsupported framework" (https://dev.to/nedwize/how-to-add-shadcn-to-an-electron-vite-project-dn). Init also rewrites the CSS file. This plan does NOT run `init`. It writes `components.json` by hand.
- Tailwind: to remove Preflight, import `theme.css` and `utilities.css` without `preflight.css`. With split imports, `source(none)` goes on the `utilities.css` import: https://tailwindcss.com/docs/preflight. Source detection: https://tailwindcss.com/docs/detecting-classes-in-source-files. Dark variant with a media query: https://tailwindcss.com/docs/dark-mode. `@layer` order is fixed by the first statement that names the layers; unlayered styles beat all layers; for `!important` the order reverses: https://developer.mozilla.org/en-US/docs/Web/CSS/@layer.
- shadcn token list (oklch, `@theme inline`, sidebar-*, chart-1..5, radius scale): https://ui.shadcn.com/docs/theming and the manual install page above. The neutral values in Step 3 are copied from there.
- Base UI Select controlled API: `<Select items={items} value={v} onValueChange={fn}>`; source https://ui.shadcn.com/docs/components/base/select. Base UI injects `<style>` tags in Select/ScrollArea (https://base-ui.com/react/utils/csp-provider). The CSP allows `'unsafe-inline'` styles, so no `CSPProvider` is needed. Keep `'unsafe-inline'` in `style-src`.
- Electron `nativeTheme.themeSource` accepts `system | light | dark`. It makes the `prefers-color-scheme` CSS query match. `shouldUseDarkColors` gives the current result. The `updated` event fires when it changes. `win.setBackgroundColor()` changes a live window: https://www.electronjs.org/docs/latest/api/native-theme , https://www.electronjs.org/docs/latest/tutorial/dark-mode , https://www.electronjs.org/docs/latest/api/browser-window. The docs do NOT say that themeSource applies to all windows. Step 11 proves it with an e2e test.
- Manta blue `#469fe5` = `oklch(0.68 0.134 245.45)`. White text on it has contrast 2.86:1, which fails WCAG AA. For light mode, this plan uses the same hue at `oklch(0.55 0.134 245.5)` (`#1177ba`, white text 4.81:1). For dark mode it uses `#469fe5` with text `oklch(0.145 0 0)` (6.93:1). The exact `#469fe5` stays available as `--brand` for decoration that has no text.
- Status token pairs in Step 3 were computed on 2026-11-01. Text color on badge background: light 6.25–6.83:1, dark 8.81–9.28:1 (all ≥ 4.5:1).
- Class name check (2026-11-01): the old JSX uses no class name that is also a Tailwind utility (`container`, `collapse`, `table`, `border`, `rounded`, `shadow`, `hidden` are not used). Classes in use: `row`, `col-md-6`, `pageItem`, `itemLabel`, `switch`, `slider`, `round`, `form-control`, `ion-*`, `flex1`, `w5/w10/w15`, and similar.

## Commands you will need

```bash
cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-base   # macOS; Linux: ~/.config/Manta
npm run build                       # electron-vite build (CSP added to built pages)
MANTA_USER_DATA=/tmp/manta-profile-copy npm start                           # built app on a data copy
MANTA_USER_DATA=/tmp/manta-profile-copy npx electron out/main/index.js --force-devtools
npx vitest run <path>               # one spec file
npm test && npm run lint && npm run format:check && npm run test:e2e
npx shadcn@latest info              # shows what the CLI reads from components.json
npx shadcn@latest add <names> --dry-run
```

Never run the app on the real user-data folder. Always use a copy and `MANTA_USER_DATA`.

The code blocks in this plan are not Prettier-formatted. After you edit a JS/JSX/MJS file, run `npx prettier --write <file>`.

## Scope

**In scope**
- Create: `ui/styles/globals.css`, `ui/lib/utils.js`, `ui/components/ui/{button,badge,card,input,label,select,switch,separator,tooltip,kbd}.jsx` (CLI output), `components.json`, `jsconfig.json`, `main/theme.js`, `main/__tests__/theme.spec.js`.
- Change: `package.json`, `package-lock.json`, `electron.vite.config.mjs`, `vitest.config.mjs`, the 4 `index.html` and 4 `index.jsx` files, `static/css/general.css`, `app.js`, `main/modal-window.js`, `preload/index.js`, `app/components/settings/General.jsx`, `app/middlewares/SettingsMW.jsx`, `app/middlewares/__tests__/SettingsMW.spec.js`, `i18n/en/settings.json`, `e2e/app.e2e.mjs`. Only if Step 10 needs it: `vitest.setup.js`.
- Record the Preflight decision in "Maintenance notes" of this plan file.

**Out of scope**
- Any layout change, sidebar, title bar, window chrome, command palette, toasts (plan 013).
- Dark styles for old screens. Old screens stay light in dark mode until each one is migrated (013–018).
- Removing Bootstrap, Ionicons, the other `static/css/*.css` files, or styled-components (plan 018). Removing the duplicate `<link>` tags for files other than `bootstrap.min.css` and `general.css`.
- Translations for locales other than `en` (they fall back to English).
- `color-scheme` CSS property. Do not set it in 012. It would make native scrollbars and form controls dark on old light screens.

## Git workflow

1. Record `git branch --show-current` and `git status --short`. Stay on that branch.
2. Preserve all starting changes, including untracked plans. Do not switch branches, create a worktree, pull, stash or reset the working tree.
3. Commit after each group of steps. Short imperative subject, no prefix, no attribution. Suggested commits: "Add Tailwind, shadcn and Lucide build setup" (Steps 1–3), "Load Bootstrap through a legacy CSS layer" (Step 4), "Show focus rings for keyboard users" (Step 5), "Add first shadcn components" (Step 6), "Add System, Light and Dark theme setting" (Steps 7–11), "Record Preflight decision" (Step 12).
4. Do not push unless the operator says so.

## Steps

### Step 0: Take the "before" baseline

1. Make a data copy: `rm -rf /tmp/manta-profile-base && cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-base`. If the folder does not exist, create an empty folder. A fresh profile shows the tour; that is OK.
2. Create the scratch script `/tmp/manta-shots/shots.mjs` (outside the repo; do not commit it):

```js
// Usage (from the repo root): node /tmp/manta-shots/shots.mjs <outDir> <userDataDir> <light|dark>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { _electron: electron } = require('@playwright/test');
const [out, userData, theme = 'light'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const app = await electron.launch({
  args: ['out/main/index.js'],
  env: { ...process.env, MANTA_USER_DATA: userData, NODE_ENV: 'production' },
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function page(title) {
  for (let i = 0; i < 60; i++) {
    for (const p of app.windows()) if ((await p.title()) === title) return p;
    await sleep(500);
  }
  throw new Error(`No window ${title}`);
}
const show = title =>
  app.evaluate(({ BrowserWindow }, t) => {
    const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === t);
    w.setSize(1200, 850);
    w.show();
  }, title);
await app.evaluate(({ nativeTheme }, t) => (nativeTheme.themeSource = t), theme);
const main = await page('Manta');
await show('Manta');
for (const tab of ['form', 'invoices', 'contacts', 'settings']) {
  await app.evaluate(({ BrowserWindow }, t) => {
    const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'Manta');
    w.webContents.send('menu-change-tab', t);
  }, tab);
  await sleep(1200);
  await main.screenshot({ path: path.join(out, `main-${tab}.png`) });
}
for (const name of ['Invoice', 'General']) {
  await main.getByText(name, { exact: true }).first().click();
  await sleep(800);
  await main.screenshot({ path: path.join(out, `settings-${name}.png`) });
}
const tour = await page('Tour');
await app.evaluate(({ BrowserWindow }) => {
  BrowserWindow.getAllWindows().find(x => x.getTitle() === 'Tour').show();
});
await sleep(800);
await tour.screenshot({ path: path.join(out, 'tour.png') });
await app.close();
```

3. Build and shoot at HEAD `3e89104` (before any change):
   `npm run build && rm -rf /tmp/manta-shots-profile && cp -R /tmp/manta-profile-base /tmp/manta-shots-profile && node /tmp/manta-shots/shots.mjs /tmp/manta-shots/before /tmp/manta-shots-profile light`
4. Preview and PDF baseline (manual): `rm -rf /tmp/manta-profile-copy && cp -R /tmp/manta-profile-base /tmp/manta-profile-copy && MANTA_USER_DATA=/tmp/manta-profile-copy npm start`. Open one invoice in the preview window. Take a screenshot of the preview window (macOS: Cmd+Shift+4, then Space). Export a PDF with the `minimal` template and with the `business` template. Save them as `/tmp/manta-shots/before/minimal.pdf` and `/tmp/manta-shots/before/business.pdf`. If the profile has no invoice, create one in the copy first.

**Verify**: `ls /tmp/manta-shots/before` → `main-form.png main-invoices.png main-contacts.png main-settings.png settings-Invoice.png settings-General.png tour.png` and the two PDFs and the preview screenshot.

### Step 1: Install the packages

```bash
npm install @base-ui/react lucide-react cn class-variance-authority
npm install -D tailwindcss @tailwindcss/vite tw-animate-css shadcn
```

Check each version with `npm view <pkg> version` before you install. If a major version differs from "Facts", STOP.

**Verify**: `npm ls tailwindcss @tailwindcss/vite tw-animate-css @base-ui/react lucide-react cn class-variance-authority shadcn --depth=0` → `tailwindcss@4.x`, `@tailwindcss/vite@4.x`, `@base-ui/react@1.x`, `lucide-react@1.x`, `cn@0.x`, no `ERESOLVE` and no `invalid`. `npm ls clsx tailwind-merge --depth=0` → `(empty)`.

### Step 2: Add the `@` alias and the Tailwind Vite plugin

1. `electron.vite.config.mjs`: add `import tailwindcss from '@tailwindcss/vite';` below the react import. In the `renderer` block, change `plugins: [react(), cspPlugin],` to `plugins: [react(), tailwindcss(), cspPlugin],`. Add this object as the first entry of `renderer.resolve.alias`:
   ```js
        // Shared redesign code (shadcn components, lib, styles).
        { find: '@', replacement: root('./ui') },
   ```
   A string `find` matches only `@` and `@/…`. It does not match scoped packages such as `@base-ui/react`.
2. `vitest.config.mjs`: add `import { fileURLToPath } from 'node:url';` at the top and add a `resolve` key next to `test`:
   ```js
  resolve: {
    alias: { '@': fileURLToPath(new URL('./ui', import.meta.url)) },
  },
   ```
3. Create `jsconfig.json` (the shadcn CLI reads `paths` from it):
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "jsx": "react-jsx",
       "paths": { "@/*": ["./ui/*"] }
     },
     "include": ["ui", "app", "preview", "modal", "tour"]
   }
   ```

**Verify**: `npm run build` → exit 0. `npm test` → exit 0.

### Step 3: Create globals.css, the `cn` helper and components.json

1. Create `ui/lib/utils.js` with one line: `export { cn } from 'cn';`
2. Create `components.json` at the repo root. Do NOT run `shadcn init`.
   ```json
   {
     "$schema": "https://ui.shadcn.com/schema.json",
     "style": "base-nova",
     "rsc": false,
     "tsx": false,
     "rtl": true,
     "tailwind": {
       "config": "",
       "css": "ui/styles/globals.css",
       "baseColor": "neutral",
       "cssVariables": true,
       "prefix": ""
     },
     "aliases": {
       "components": "@/components",
       "utils": "@/lib/utils",
       "ui": "@/components/ui",
       "lib": "@/lib",
       "hooks": "@/hooks"
     },
     "iconLibrary": "lucide"
   }
   ```
3. Create `ui/styles/globals.css` with this content. Copy the `@theme inline` color/radius/sidebar lines and the neutral `:root` / dark values exactly from https://ui.shadcn.com/docs/installation/manual. The lines marked `/* Manta */` replace or add values.

```css
/* Manta global stylesheet. Imported first by app/, preview/, modal/ and tour/ index.jsx. */

/* Layer order: later wins. Unlayered CSS (styled-components, ionicons,
   layout/form/items/contact/date-picker/preview CSS) beats every layer. */
@layer theme, base, legacy, components, utilities;

/* Tailwind, split so that Preflight is one line (decision in Step 12). */
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities) source(none);

/* Old styles. Plan 018 removes them. */
@import "../../static/css/bootstrap.min.css" layer(legacy);
@import "../../static/css/general.css" layer(legacy);

@import "tw-animate-css";
@import "shadcn/tailwind.css";

/* Files that Tailwind scans for class names (paths relative to this file). */
@source "../../app";
@source "../../preview";
@source "../../modal";
@source "../../tour";
@source "..";

/* Dark mode follows the OS or nativeTheme.themeSource. No .dark class, no JS. */
@custom-variant dark (@media (prefers-color-scheme: dark));

@theme inline {
  /* ...all lines of the manual page's @theme inline block, unchanged... */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* (card, popover, primary, secondary, muted, accent, destructive, border,
     input, ring, chart-1..5, radius-sm..4xl, sidebar-*) */

  /* Manta */
  --color-brand: var(--brand);
  --color-status-draft: var(--status-draft);
  --color-status-draft-bg: var(--status-draft-bg);
  --color-status-pending: var(--status-pending);
  --color-status-pending-bg: var(--status-pending-bg);
  --color-status-overdue: var(--status-overdue);
  --color-status-overdue-bg: var(--status-overdue-bg);
  --color-status-paid: var(--status-paid);
  --color-status-paid-bg: var(--status-paid-bg);
  --color-status-refunded: var(--status-refunded);
  --color-status-refunded-bg: var(--status-refunded-bg);
  --color-status-cancelled: var(--status-cancelled);
  --color-status-cancelled-bg: var(--status-cancelled-bg);
}

:root {
  /* ...all neutral light values of the manual page's :root block... */
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);

  /* Manta: primary = Manta blue, darkened for white text (4.81:1) */
  --primary: oklch(0.55 0.134 245.5);
  --primary-foreground: oklch(1 0 0);
  --ring: oklch(0.55 0.134 245.5);
  --sidebar-primary: oklch(0.55 0.134 245.5);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-ring: oklch(0.55 0.134 245.5);
  --brand: oklch(0.68 0.134 245.45); /* #469fe5, decoration only */

  /* Manta: status badges. Text color / badge background. */
  --status-draft: oklch(0.45 0.03 250);
  --status-draft-bg: oklch(0.955 0.01 250);
  --status-pending: oklch(0.45 0.117 70);
  --status-pending-bg: oklch(0.955 0.035 70);
  --status-overdue: oklch(0.45 0.144 25);
  --status-overdue-bg: oklch(0.955 0.035 25);
  --status-paid: oklch(0.45 0.117 150);
  --status-paid-bg: oklch(0.955 0.035 150);
  --status-refunded: oklch(0.45 0.117 295);
  --status-refunded-bg: oklch(0.955 0.035 295);
  --status-cancelled: oklch(0.45 0 0);
  --status-cancelled-bg: oklch(0.955 0 0);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* ...all values of the manual page's .dark block... */
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);

    /* Manta */
    --primary: oklch(0.68 0.134 245.45);
    --primary-foreground: oklch(0.145 0 0);
    --ring: oklch(0.68 0.134 245.45);
    --sidebar-primary: oklch(0.68 0.134 245.45);
    --sidebar-primary-foreground: oklch(0.145 0 0);
    --sidebar-ring: oklch(0.68 0.134 245.45);
    --brand: oklch(0.68 0.134 245.45);

    --status-draft: oklch(0.86 0.02 250);
    --status-draft-bg: oklch(0.29 0.01 250);
    --status-pending: oklch(0.86 0.078 70);
    --status-pending-bg: oklch(0.29 0.06 70);
    --status-overdue: oklch(0.86 0.096 25);
    --status-overdue-bg: oklch(0.29 0.06 25);
    --status-paid: oklch(0.86 0.078 150);
    --status-paid-bg: oklch(0.29 0.06 150);
    --status-refunded: oklch(0.86 0.078 295);
    --status-refunded-bg: oklch(0.29 0.06 295);
    --status-cancelled: oklch(0.86 0 0);
    --status-cancelled-bg: oklch(0.29 0 0);
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  /* Visible keyboard focus everywhere (WCAG 2.4.7). */
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
}

@layer legacy {
  /* Old screens: no ring after a mouse click. This replaces the removed
     `*:focus { outline: none !important }` rule. Keyboard focus keeps a ring. */
  :focus:not(:focus-visible) {
    outline: none;
    box-shadow: none;
  }
}
```

Bootstrap sets `body { background-color: #fff; color: #212529 }` in the `legacy` layer, which beats `base`. Thus old screens stay light in dark mode. This is the intended transition state.

**Verify**: `npx shadcn@latest info` → it shows style `base-nova`, `tsx: false`, the CSS path `ui/styles/globals.css` and the `@/…` aliases, with no error. If the CLI says the framework is unsupported but still reads `components.json`, continue. If it cannot read `components.json`, STOP.

### Step 4: Load globals.css in all four windows

1. In `app/index.jsx`, `preview/index.jsx`, `modal/index.jsx`, `tour/index.jsx`: delete the lines `import '../static/css/bootstrap.min.css';` and `import '../static/css/general.css';`. Add `import '../ui/styles/globals.css';` as the FIRST line of each file. Keep all other CSS imports. Use a relative path here, because the `index.jsx` files are entries.
2. In `app/index.html`, `preview/index.html`, `modal/index.html`, `tour/index.html`: delete the `<link>` lines for `bootstrap.min.css` and `general.css`. Keep the other `<link>` lines.

`general.css` must leave the unlayered `<link>`/import too. If it stays unlayered, its `input`, `select`, `label` and `!important` rules override the Tailwind utilities of every new component.

**Verify**:
- `grep -n "bootstrap.min.css\|general.css" app/index.* preview/index.* modal/index.* tour/index.*` → no output.
- `grep -c "ui/styles/globals.css" app/index.jsx preview/index.jsx modal/index.jsx tour/index.jsx` → `1` for each file.
- `npm run build` → exit 0. Warnings from Bootstrap syntax are OK; an error is a STOP.
- `grep -l "@layer theme,base,legacy" out/renderer/assets/*.css || grep -l "@layer theme, base, legacy" out/renderer/assets/*.css` → at least one file.

### Step 5: Remove the global focus killers in general.css

1. Delete `static/css/general.css:1-5` (`*:focus, *:active { outline: none !important; box-shadow: none !important; }`) and the blank line after it.
2. Delete the rule `textarea:focus, input:focus { outline: none; }` (`:76-79` at HEAD).
3. Change `input:disabled {` to `input:disabled:not([data-slot]) {`. shadcn components set `data-slot`. This keeps the old gray disabled inputs and stops the `!important` from overriding new inputs.

**Verify**: `grep -n "outline: none" static/css/general.css` → no output. `grep -n "input:disabled:not(\[data-slot\])" static/css/general.css` → 1 line. `npm run build` → exit 0.

### Step 6: Add the first shadcn components

1. Dry run: `npx shadcn@latest add button badge card input label select switch separator tooltip kbd --dry-run`.
   Expected: 10 files under `ui/components/ui/` with the `.jsx` extension. Dependencies are already installed. No change to `ui/styles/globals.css` or a small `@theme`/token addition only. If it plans to write to `src/`, `components/` at the repo root, or `.tsx` files, STOP.
2. Run the same command without `--dry-run`. Answer "no" if it asks to overwrite `ui/lib/utils.js`.
3. Run `git diff package.json ui/styles/globals.css`. Undo any change that moves a package between dependency groups or adds `clsx`/`tailwind-merge`. Undo any edit that adds a `.dark { … }` block or a `@custom-variant dark (&:is(.dark *))` line; the media-query version from Step 3 must stay.
4. Format: `npx prettier --write ui`.

**Verify**: `ls ui/components/ui` → `badge.jsx button.jsx card.jsx input.jsx kbd.jsx label.jsx select.jsx separator.jsx switch.jsx tooltip.jsx`. `grep -rln "@base-ui/react" ui/components/ui | wc -l` → at least `5`. `grep -rn "from \"@/lib/utils\"\|from '@/lib/utils'" ui/components/ui | wc -l` → at least `8`. `npm run lint` → exit 0 (fix only lint errors in `ui/`). `npm run build` → exit 0.

### Step 7: Add the theme module (test first)

1. Create `main/__tests__/theme.spec.js`:

```js
import { EventEmitter } from 'node:events';
import { normalizeTheme, setupTheme, WINDOW_BACKGROUND } from '../theme.js';

function setup(saved, { dark = false } = {}) {
  const nativeTheme = Object.assign(new EventEmitter(), {
    themeSource: 'system',
    shouldUseDarkColors: dark,
  });
  const ipcMain = new EventEmitter();
  const data = { 'general.theme': saved };
  const store = { get: k => data[k], set: (k, v) => (data[k] = v) };
  const win = { color: null, setBackgroundColor: c => (win.color = c) };
  const BrowserWindow = { getAllWindows: () => [win] };
  setupTheme({ nativeTheme, ipcMain, BrowserWindow, store });
  return { nativeTheme, ipcMain, data, win };
}

describe('theme', () => {
  it('keeps valid values and maps others to system', () => {
    expect(['system', 'light', 'dark'].map(normalizeTheme)).toEqual(['system', 'light', 'dark']);
    for (const bad of [undefined, null, '', 'blue', 1, {}]) expect(normalizeTheme(bad)).toBe('system');
  });

  it('applies the saved setting at startup', () => {
    expect(setup('dark').nativeTheme.themeSource).toBe('dark');
  });

  it('uses system when the saved value is missing or invalid', () => {
    expect(setup(undefined).nativeTheme.themeSource).toBe('system');
    expect(setup('purple').nativeTheme.themeSource).toBe('system');
  });

  it('set-theme applies and saves the theme', () => {
    const { nativeTheme, ipcMain, data } = setup('system');
    ipcMain.emit('set-theme', {}, 'light');
    expect(nativeTheme.themeSource).toBe('light');
    expect(data['general.theme']).toBe('light');
  });

  it('set-theme with an invalid value saves system', () => {
    const { nativeTheme, ipcMain, data } = setup('dark');
    ipcMain.emit('set-theme', {}, 'neon');
    expect(nativeTheme.themeSource).toBe('system');
    expect(data['general.theme']).toBe('system');
  });

  it('repaints window backgrounds when the theme updates', () => {
    const { nativeTheme, win } = setup('system');
    nativeTheme.shouldUseDarkColors = true;
    nativeTheme.emit('updated');
    expect(win.color).toBe(WINDOW_BACKGROUND.dark);
  });
});
```

2. Run `npx vitest run main/__tests__/theme.spec.js` → it fails (module not found).
3. Create `main/theme.js` (ES module, same pattern as `main/print-options.js`; no `require('electron')`, so the test needs no Electron mock):

```js
// The setting `general.theme` drives nativeTheme.themeSource. Every renderer
// follows it through the prefers-color-scheme media query.
export const THEMES = ['system', 'light', 'dark'];

// Same values as --background in ui/styles/globals.css.
export const WINDOW_BACKGROUND = { light: '#ffffff', dark: '#0a0a0a' };

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : 'system';
}

export function getBackgroundColor(nativeTheme) {
  return nativeTheme.shouldUseDarkColors
    ? WINDOW_BACKGROUND.dark
    : WINDOW_BACKGROUND.light;
}

export function setupTheme({ nativeTheme, ipcMain, BrowserWindow, store }) {
  nativeTheme.themeSource = normalizeTheme(store.get('general.theme'));
  ipcMain.on('set-theme', (_event, value) => {
    const theme = normalizeTheme(value);
    store.set('general.theme', theme);
    nativeTheme.themeSource = theme;
  });
  nativeTheme.on('updated', () => {
    const color = getBackgroundColor(nativeTheme);
    for (const win of BrowserWindow.getAllWindows()) {
      win.setBackgroundColor(color);
    }
  });
}
```

**Verify**: `npx vitest run main/__tests__/theme.spec.js` → 6 passed.

### Step 8: Wire the theme into the main process

1. `app.js:10`: change to `const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');`. Below `require('./main/settings-ipc');` (`app.js:35`) add `const { setupTheme, getBackgroundColor } = require('./main/theme');`.
2. Replace the 3 hard-coded colors with `backgroundColor: getBackgroundColor(nativeTheme),` at `app.js:59` (tour), `:89` (main) and `:127` (preview).
3. In the `ready` handler (`app.js:426`), add this as the first line, before `createTourWindow();`:
   `setupTheme({ nativeTheme, ipcMain, BrowserWindow, store: appConfig });`
   The windows read the theme at creation. The setting may be missing on the first start (defaults come later); `normalizeTheme` then gives `system`.
4. In `setInitialValues()` add `theme: 'system',` to the `general` defaults (`app.js:187-194`), after `previewPDF: true,`. Old settings files get the key on the next start (the loop at `:221-240` adds missing level-2 keys). Do not add a migration.
5. `main/modal-window.js`: change line 1 to `const { BrowserWindow, ipcMain, nativeTheme } = require('electron');`, add `const { getBackgroundColor } = require('./theme');` and replace `backgroundColor: '#282828',` with `backgroundColor: getBackgroundColor(nativeTheme),`.

**Verify**: `grep -n "#2e2c29\|#F9FAFA\|#282828" app.js main/modal-window.js` → no output. `grep -c "getBackgroundColor(nativeTheme)" app.js main/modal-window.js` → `3` and `1`. `npm run build` → exit 0. `grep -c "set-theme" out/main/index.js` → at least `1`.

### Step 9: Allow the `set-theme` channel in the preload

In `preload/index.js`, add `'set-theme',` to `CHANNELS` in sorted order (between `'select-export-directory',` and `'show-modal',`).

**Verify**: `npx vitest run preload/__tests__/index.spec.js` → all pass. `grep -n "'set-theme'" preload/index.js` → 1 line.

### Step 10: Temporary theme select in Settings › General

1. `i18n/en/settings.json`: in `fields`, after `"openPDFReader"`, add:
   ```json
    "theme": {
      "name": "Theme",
      "system": "System",
      "light": "Light",
      "dark": "Dark"
    },
   ```
2. `app/middlewares/SettingsMW.jsx`: after the language block (after `:52`) add:
   ```js
        // Change theme (main process sets nativeTheme for all windows)
        const { theme } = appConfig.get('general') || {};
        const newTheme = action.payload.general.theme;
        if (newTheme && theme !== newTheme) {
          ipc.send('set-theme', newTheme);
        }
   ```
   The theme applies when the user clicks Save, like the language today. Plan 016 changes Settings to apply at once.
3. Add a test to `app/middlewares/__tests__/SettingsMW.spec.js`, inside `describe('should handle SETTINGS_SAVE action')`, so it uses the same validator mocks:
   ```js
    it('sends set-theme only when the theme changes', () => {
      window.manta.settings.get.mockImplementation(key =>
        key === 'general' ? { language: 'fr', theme: 'system' } : 'someSettings'
      );
      const save = theme =>
        middleware(
          Actions.saveSettings({ ...action.payload, general: { language: 'fr', theme } })
        );
      window.manta.ipc.send.mockClear();
      save('dark');
      expect(window.manta.ipc.send).toHaveBeenCalledWith('set-theme', 'dark');
      window.manta.ipc.send.mockClear();
      save('system');
      expect(window.manta.ipc.send.mock.calls.map(c => c[0])).not.toContain('set-theme');
      window.manta.settings.get.mockImplementation(() => 'someSettings');
    });
   ```
4. `app/components/settings/General.jsx`:
   - Add imports:
     ```js
     import {
       Select,
       SelectContent,
       SelectGroup,
       SelectItem,
       SelectTrigger,
       SelectValue,
     } from '@/components/ui/select';
     ```
   - In the constructor add `this.handleThemeChange = this.handleThemeChange.bind(this);`.
   - Add the method:
     ```js
       handleThemeChange(value) {
         this.setState({ theme: value }, () => {
           this.props.updateSettings('general', this.state);
         });
       }
     ```
   - After the second `row` (before the closing `</div>` at `:116`), add a third row with the same Bootstrap wrappers:
     ```jsx
        <div className="row">
          <div className="col-md-6">
            <div className="pageItem">
              <label className="itemLabel" id="settings-theme-label">
                {t('settings:fields:theme:name')}
              </label>
              <Select
                items={themeItems}
                value={this.state.theme || 'system'}
                onValueChange={this.handleThemeChange}
              >
                <SelectTrigger className="w-full" aria-labelledby="settings-theme-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {themeItems.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
     ```
   - At the top of `render()`, after `const { t } = this.props;`, add:
     ```js
         const themeItems = ['system', 'light', 'dark'].map(value => ({
           value,
           label: t(`settings:fields:theme:${value}`),
         }));
     ```
   Check the export names in `ui/components/ui/select.jsx`. If the generated file uses other names, use them.

**Verify**: `npx vitest run app/middlewares/__tests__/SettingsMW.spec.js` → all pass. `npx vitest run app/components/settings/__tests__/General.spec.js` → passes. If it fails only because jsdom lacks an API that Base UI needs (`ResizeObserver`, `matchMedia`, `PointerEvent`, `Element.prototype.getAnimations`), add a minimal stub for that API to `vitest.setup.js` and run again. For any other failure, STOP.

### Step 11: e2e proof that the theme reaches every window, and no CSP errors

Edit `e2e/app.e2e.mjs`:

1. Below `const errors = [];` add `const cspErrors = [];`. Replace the listener lines (`:25-28`) with:
   ```js
  const watch = p => {
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => {
      if (/Content Security Policy/i.test(m.text())) cspErrors.push(m.text());
    });
  };
  for (const p of app.windows()) watch(p);
  app.on('window', watch);
   ```
2. Add at the end of the file:

```js
async function pageByTitle(title) {
  let found;
  await expect
    .poll(
      async () => {
        for (const p of app.windows()) if ((await p.title()) === title) found = p;
        return Boolean(found);
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  return found;
}

test('theme setting reaches every window', async () => {
  const main = await pageByTitle(MAIN_TITLE);
  await main.evaluate(() =>
    window.manta.ipc.send('show-modal', {
      type: 'info',
      title: 'Theme check',
      message: 'Theme check',
      buttons: ['OK'],
    })
  );
  await pageByTitle('Dialog');
  expect(app.windows().length).toBeGreaterThanOrEqual(4);
  for (const theme of ['dark', 'light']) {
    await main.evaluate(t => window.manta.ipc.send('set-theme', t), theme);
    await expect
      .poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
      .toBe(theme);
    for (const p of app.windows()) {
      await expect
        .poll(() => p.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches))
        .toBe(theme === 'dark');
    }
    const expected = theme === 'dark' ? '#0a0a0a' : '#ffffff';
    await expect
      .poll(async () => {
        const colors = await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().map(w => w.getBackgroundColor().toLowerCase())
        );
        return colors.every(c => c === expected);
      })
      .toBe(true);
    await expect
      .poll(() => JSON.parse(fs.readFileSync(path.join(userData, 'Settings'), 'utf8')).general?.theme)
      .toBe(theme);
  }
  await main.evaluate(() => window.manta.ipc.send('set-theme', 'bogus'));
  await expect
    .poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
    .toBe('system');
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Dialog')?.close()
  );
});

test('no window reports a CSP violation', async () => {
  expect(cspErrors).toEqual([]);
});
```

If `getBackgroundColor()` returns a format other than `#rrggbb` on your OS (for example `#ffffffff`), compare only the first 7 characters.

**Verify**: `npm run test:e2e` → `8 passed`. If the `matchMedia` check fails for one window only, STOP (this disproves "themeSource applies to all windows"; report which window).

### Step 12: Visual comparison and Preflight decision

1. Build and shoot "after" on a fresh copy of the same profile:
   `npm run build && rm -rf /tmp/manta-shots-profile && cp -R /tmp/manta-profile-base /tmp/manta-shots-profile && node /tmp/manta-shots/shots.mjs /tmp/manta-shots/after /tmp/manta-shots-profile light`
2. Compare each pair. With ImageMagick: `for f in /tmp/manta-shots/before/*.png; do n=$(basename $f); echo "$n $(compare -metric AE $f /tmp/manta-shots/after/$n null: 2>&1)"; done`. Without ImageMagick, open both images and flip between them at 100 %. Expected: `0` or only a few pixels (anti-aliasing). The only allowed visible difference is the new Theme row on `settings-General.png`.
3. Repeat Step 0.4 on a new copy (`/tmp/manta-profile-copy`). Export both PDFs again to `/tmp/manta-shots/after/`. Compare: `pdftoppm -png -r 100 <file>.pdf <prefix>` for before and after, then `compare -metric AE` per page. Expected: `0`. Without these tools, open the PDFs side by side and check logo position, text wrap and table rows.
4. If there are differences, find the cause. Delete the line `@import "tailwindcss/preflight.css" layer(base);`, rebuild and shoot again.
   - If the difference goes away, Preflight is the cause. Known Preflight effects on old markup: `img` and `svg` become `display: block` with `max-width: 100%` (logos in `app/components/settings/_partials/profile/Logo.jsx`, `preview/templates/business/components/Logo.jsx`, `preview/templates/minimal/components/Header.jsx`), `ul`/`ol` lose bullets and padding, plain `<button>` loses its background. You may fix at most 3 such cases with rules in the `@layer legacy { … }` block of globals.css (for example `img { display: revert; max-width: revert; }`). If more fixes are needed, or a PDF still differs, keep Preflight OFF (the line stays deleted).
   - If the difference stays, the cause is the layer move (styled-components now always beat `general.css`; candidate: `ItemDivInput` in `app/components/form/ItemRow.jsx`) or the shadcn base rule `* { border-color: var(--border) }`. First use a narrowly scoped legacy compatibility rule in globals.css. If a component edit is required outside Scope, STOP and report its path; do not expand Scope silently.
5. Dark mode smoke (manual) on `/tmp/manta-profile-copy`: open Settings › General, select Dark, click Save. Expected: all windows switch (open the preview and the tour from the menu "Show Tutorial"); old screens keep their light look; the Theme select trigger and popup are readable. If the trigger text is not readable on the light page, add `bg-background text-foreground` to its `className`. Select System and Save. Quit, start again: the select still shows System.
6. Keyboard check: press Tab through Settings › General. Expected: each control shows a visible ring. Click a button with the mouse: no ring.
7. CSP check (manual, in addition to the e2e test): `MANTA_USER_DATA=/tmp/manta-profile-copy npx electron out/main/index.js --force-devtools`. Expected: no "Content Security Policy" message in the console of any window.
8. Record the result: replace the "Preflight decision" line in "Maintenance notes" of this file with `ON` or `OFF`, the reason, and the list of compensating rules (if any). Commit "Record Preflight decision".

**Verify**: the comparison result is written in this file. `git diff --stat` shows only Scope files.

## Test plan

- New unit test `main/__tests__/theme.spec.js` (6 tests): setting → themeSource at startup, invalid/missing value → `system`, IPC `set-theme` applies and saves, invalid IPC value saves `system`, `updated` repaints window backgrounds. It uses plain fakes, not an Electron mock.
- New unit test in `SettingsMW.spec.js`: Save sends `set-theme` only when the theme changed. The existing "2 sends" test must still pass.
- New e2e tests (6 → 8): `set-theme` from the main window changes `nativeTheme.themeSource`, `matchMedia('(prefers-color-scheme: dark)')` in main, preview, tour and modal, all window background colors, and the saved `general.theme` in the temp profile; no CSP violation in any window.
- No markup, snapshot or class-name tests for the new components. No existing test is deleted.
- Manual: before/after screenshots (Create, Invoices, Contacts, Settings ×3 tabs, Tour, Preview), PDF comparison for both templates, dark-mode and keyboard smoke. All on a data copy.
- Narrow checks per step; full `npm test`, `npm run lint`, `npm run format:check`, `npm run test:e2e` once at the end.

## Done criteria

- [ ] `npm ls tailwindcss @tailwindcss/vite @base-ui/react lucide-react cn class-variance-authority shadcn tw-animate-css --depth=0` → all present; `npm ls clsx tailwind-merge --depth=0` → `(empty)`
- [ ] `node -p "Object.keys(require('./package.json').devDependencies).filter(k=>['tailwindcss','@tailwindcss/vite','shadcn','tw-animate-css'].includes(k)).length"` → `4`
- [ ] `test -f ui/styles/globals.css && test -f ui/lib/utils.js && test -f components.json && test -f jsconfig.json && echo ok` → `ok`
- [ ] `ls ui/components/ui | wc -l` → `10`
- [ ] `grep -rn "bootstrap.min.css\|general.css" app/index.* preview/index.* modal/index.* tour/index.*` → no output; `grep -n "layer(legacy)" ui/styles/globals.css` → 2 lines
- [ ] `grep -n "outline: none" static/css/general.css` → no output
- [ ] `grep -n "#2e2c29\|#F9FAFA\|#282828" app.js main/modal-window.js` → no output
- [ ] `grep -n "'set-theme'" preload/index.js` → 1 line; `grep -n "theme: 'system'" app.js` → 1 line
- [ ] `npx vitest run main/__tests__/theme.spec.js` → 6 passed
- [ ] `npm test` → exit 0; `npm run lint` → exit 0; `npm run format:check` → exit 0
- [ ] `npm run build` → exit 0; `npm run test:e2e` → 8 passed
- [ ] Screenshot and PDF comparison done; Preflight decision recorded in "Maintenance notes"
- [ ] `git log --format=%B <execution-start-SHA>..HEAD | grep -ci "co-authored\|generated with"` → `0`
- [ ] Compare `git status --short` with the starting inventory; no unrelated change is overwritten

## STOP conditions

Stop and report (do not improvise) if:

- The drift check shows a change on a line this plan edits.
- A package's major version differs from "Facts", or `npm install` reports a peer conflict with React 19 or Vite 8.
- `npm run build` fails after Step 3 or Step 4 with an error from Tailwind or lightningcss (warnings are OK).
- `npx shadcn@latest add` wants to write outside `ui/`, writes `.tsx` files, or cannot read `components.json`.
- The e2e test shows that one window does not follow `themeSource`.
- Old screens or PDFs differ in a way that Step 12 cannot fix within its limits (3 compensating rules or 3 component fixes).
- Any CSP violation appears, or a fix needs a change to the CSP string.
- A step would touch the real user-data folder, or change `productName`, `loadFile`/`file://` loading, or the PouchDB adapter.
- A step would overwrite an unrelated starting change.

## Review acceptance checks

- Check keyboard focus on the native inputs as well as the shadcn Select. A focus rule in `base` can lose to Bootstrap focus rules in `legacy`; place the fallback `:focus-visible` rule in `components` if the live check proves this. Keep the removal of the global `!important` focus rules.
- Give the screenshot script a `try/finally` that closes Electron. Create `/tmp/manta-shots` before writing the script. Wait for visible controls or a known page state instead of increasing fixed sleeps when capture is unstable.
- Check theme persistence failure: a rejected settings write must not report a saved theme. Startup must apply the persisted value before the first window is visible.

## Maintenance notes

- **Preflight decision**: OFF. ImageMagick `compare -metric AE` against `/tmp/manta-shots/before` stayed large with Preflight ON (`main-contacts.png` about 8984). Removing the Preflight import cut that shot to about 819. The rest is the new Theme row, token rules in `@layer base`, and Bootstrap/`general.css` in `legacy`. No compensating rules. Recorded 2026-11-01 from `/tmp/manta-012-report.md`.
- Layer contract for plans 013–018: new components use Tailwind utilities only. They never use Bootstrap classes or styled-components. If a new component looks wrong inside an old screen, an element rule in Bootstrap or `general.css` (layer `legacy`) is the usual cause. Fix it with a utility class on the component. Do not edit `bootstrap.min.css`.
- `!important` inside the `legacy` layer beats normal utilities. Bootstrap utility classes such as `.d-none` and `.text-center` use `!important`; do not put them on new components.
- Old screens stay light in dark mode on purpose: Bootstrap's `body` color/background (layer `legacy`) beats the token rule in `base`. Plan 018 removes Bootstrap; then the token rule takes effect everywhere. Set `color-scheme: light dark` on `:root` only when no old screen remains (plan 018).
- Theme source of truth: `general.theme` in the electron-store file. Only `main/theme.js` writes `nativeTheme.themeSource`. Plan 016 moves the select to Settings › Appearance and may send `set-theme` on change (the handler already saves the value). Plan 013 can use `getBackgroundColor()` for `titleBarOverlay` colors and should also update them in the `updated` listener.
- `WINDOW_BACKGROUND` in `main/theme.js` must match `--background` in `globals.css`. Change both together.
- Focus rings: shadcn components use `focus-visible:ring-ring/50`. The 50 % ring on white is about 2:1. If an audit needs 3:1 (WCAG 2.4.13), raise the opacity in the component, not in the token.
- Status tokens: use `text-status-<name> bg-status-<name>-bg` and always show text and an icon. `overdue` is derived, never stored (plan 014).
- Remaining duplicate CSS loads (`ionicons.min.css`, `layout.css`, etc. in both `<link>` and `import`) are harmless. Plan 018 removes them with the files.
- Reviewers: check that globals.css starts with the `@layer` order line, that `general.css` and Bootstrap load only through globals.css, that `shadcn`/`tailwindcss` are devDependencies, that the CSP string is unchanged, and that no test runs against a real profile.
