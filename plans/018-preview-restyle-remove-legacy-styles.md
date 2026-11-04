# Plan 018: Restyle the preview window, delete the modal window, and remove Bootstrap, Ionicons, old CSS and styled-components outside the invoice templates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before you go to the
> next step. If anything in "STOP conditions" occurs, stop and report. Do not
> improvise. When done, update the status row for this plan in
> `plans/README.md`, unless a reviewer dispatched you and told you that they
> maintain the index. Do NOT add `Co-authored-by` trailers or any AI/tool
> attribution to commits or PR text. Pass this rule to any subagent.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- preview/ modal/ main/modal-window.js main/save-pdf.js main/print-options.js main/__tests__/print-options.spec.js app/renderers/ preload/index.js electron.vite.config.mjs static/ app/components/shared/ libs/dragNdrop.js helpers/center-on-primary-display.js app.js package.json README.md e2e/`
>
> Plans 012–017 change some of these files on purpose. Read the live content of these files, not the excerpts: `preview/index.html` and `preview/index.jsx` (012: `<link>` tags removed, `globals.css` import added), `preview/templates/**` (015: `issuedAt` fallback), `preload/index.js` (012 `set-theme`, 013, 016, 017 `start-tour` removed), `electron.vite.config.mjs` (012 Tailwind + `@` alias, 017 `tour` input removed), `app.js` (012 theme, 013 window chrome, 017 tour removed), `package.json`, `app/components/shared/**` (013–016), `static/css/general.css` (012 outline rule, 013 body drag region), `e2e/app.e2e.mjs` (017), `README.md`.
> Earlier plans intentionally change `main/save-pdf.js` (017 onboarding flag), `preview/containers/MainContent.jsx` and `preview/reducers/index.jsx` (015 shared defaults/template selection), and `main/modal-window.js` (012 theme). Read their live content. These remaining files should match the cited state: `main/print-options.js`, `static/css/preview/*`, `preview/components/**`, `preview/actions/*`, `modal/**`. If one of them changed, compare it with "Current state". On a mismatch, STOP.

## Execution checks added by review (2026-11-01)

- Record the execution start commit and starting changes. Scope checks compare this plan's changes with that baseline, not with a clean-tree requirement. Earlier plans can change the listed files; check the required behavior before treating expected changes as drift.
- Before a live app check, use Jean `get_run_environments`; use its running environment or `start_run_environment`. Do not start a second dev server by hand. Confirm that the environment uses a disposable `MANTA_USER_DATA` profile. Record the exact URL or Electron entry and profile used. If no Run command is configured, report that limit.
- Use the narrow tests listed for each changed behavior. Reuse passing results when the covered code has not changed. Run broad tests once at the final integration gate for shared state, persistence or IPC changes. Visual checks require the running app; do not replace them with markup assertions.
- Do not copy a profile while Manta is running. Close it first. Use a new temporary destination, or confirm the existing destination is disposable; repeated `cp -R` into an existing folder can create a nested profile.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED. The exported PDF must not change, not even by one pixel row.
- **Depends on**: 013, 014, 015, 016, 017 (all screens migrated; 012 transitively).
- **Category**: ui-redesign
- **Planned at**: commit `3e89104`, 2026-11-01

## Why this matters

After 013–017, every screen of the main window uses shadcn/ui and Tailwind. But the preview window still has the 2018 look: grey sidebar, native `<select>`, raw checkboxes, no dark mode. The app also still ships four legacy style systems: Bootstrap 4.0.0-beta (in the `legacy` CSS layer), the Ionicons v2 font, eight global CSS files, and styled-components outside the templates. These add bundle size and specificity conflicts, and two design languages. styled-components has been in maintenance mode since March 2025. The modal window (`modal/`, `main/modal-window.js`) has no callers after 013, so it is dead code with its own BrowserWindow and IPC channels.

The invoice templates are the product. Users send these PDFs to clients. So this plan keeps the templates' styled-components code as it is. It isolates the paper from the new global CSS, and it proves with a pixel diff that the PDF output is identical before and after.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| On the redesign branch | `git branch --show-current` | current branch; record its name, do not switch |
| Tests green | `npm test` | exit 0 |
| Build works | `npm run build` | exit 0 |
| 012 globals | `test -f ui/styles/globals.css && grep -n "legacy" ui/styles/globals.css` | file exists; one `@layer` order line with `legacy` and one Bootstrap `@import … layer(legacy)` |
| 012 Preflight decision | `grep -n -i "preflight" plans/012-*.md` (read its Maintenance notes) | you know if Preflight is ON or OFF. Write it down: it selects Case A or Case B in Step 2 |
| 012 theme IPC | `grep -rn "set-theme" main app.js preload` | at least one hit in main code and one in the preload allow-list |
| shadcn config | `node -p "require('./components.json').style"` | `base-nova` |
| 013 dialog API | `test -f ui/lib/dialog.js && echo ok` | `ok` |
| 013 removed `openDialog` callers | `grep -rn "renderers/dialog" app preview ui --include='*.js' --include='*.jsx' \| grep -v "app/renderers/"` | no output |
| 013 window chrome | `grep -rn "hiddenInset" app.js main helpers` | at least one hit |
| 014 status helper | `grep -n "getDisplayStatus" app/helpers/invoice.js` | one or more hits |
| 015 templates use `issuedAt` | `grep -rln "issuedAt" preview/templates` | at least one file |
| 017 tour removed | `test ! -d tour && test ! -f main/tour.js && echo ok` | `ok` |
| PDF tools | `pdftoppm -v 2>&1 \| head -1; magick -version \| head -1` | poppler and ImageMagick 7 versions. If missing: macOS `brew install poppler imagemagick`; Debian/Ubuntu `sudo apt install poppler-utils imagemagick` (on IM 6, use `compare` instead of `magick compare`) |

If a check fails, STOP. Do not do the work of an earlier plan.

## Current state (at `3e89104`)

**Preview entry** `preview/index.jsx:1-5,15-16,30-38`. Global CSS, the shared ErrorBoundary and StyledRoot:

```jsx
import '../static/css/bootstrap.min.css';
import '../static/css/ionicons.min.css';
import '../static/css/general.css';
import '../static/css/preview/font.css';
import '../static/css/preview/print.css';
...
import ErrorBoundary from '../app/components/shared/ErrorBoundary';
import StyledRoot from '../app/components/shared/StyledRoot';
...
  <StyledRoot><Provider store={store}><ErrorBoundary><Viewer /></ErrorBoundary></Provider></StyledRoot>
```

`preview/index.html:6` has `<title>Previewer</title>`. The e2e tests find the window by this title. Keep it.

**StyledRoot** `app/components/shared/StyledRoot.jsx:4-16`. Templates pass non-`$` props (`baseFontSize`, `accentColor`, `customAccentColor`, `logoSize`, `alignItems`, `left`, `right`) to DOM styled components. StyledRoot stops these props from reaching the DOM:

```jsx
import isPropValid from '@emotion/is-prop-valid';
import { StyleSheetManager } from 'styled-components';
function shouldForwardProp(propName, target) {
  if (typeof target === 'string') return isPropValid(propName);
  return true;
}
```

**Viewer** `preview/Viewer.jsx` is a class component. It has IPC listeners in `componentDidMount` (lines 34-53: `update-preview`, `change-preview-window-language`, `change-preview-window-profile`, `pfd-exported` → native `Notify` + `reveal-file`). It renders `<SideBar>` and `<MainContent>` in a styled flex `Wrapper` (lines 12-15).

**SideBar** `preview/containers/SideBar.jsx` is a class component. Lines 52-74 hold the logic you must keep:

```jsx
handleInputChange(event) {
  const value = target.type === 'checkbox' ? target.checked : target.value;
  this.props.updateConfigs({ name, value });
}
handleAccentColorChange(color) { this.props.updateConfigs({ name: 'accentColor', value: color }); }
savePDF() { ipc.send('save-pdf', invoiceID); this.saveConfigs(); }
saveConfigs() { ipc.send('save-configs-to-invoice', invoiceID, configs); }
```

The sidebar shows `LogoSize` only when `showLogo` is true (line 123). It shows `AccentColor` only when `customAccentColor` is true (line 137).

**Config value types** `preview/reducers/index.jsx:19-28`. `fontSize` and `logoSize` are **strings**:

```js
accentColor: '#2CCCE4', logoSize: '20', fontSize: '200', alignItems: 'middle',
showLogo: true, useSymbol: true, customAccentColor: true, showRecipient: true,
```

`preview/helper/index.js:1-25`. `setBaseFontSize(level)` switches on `'500'|'400'|'300'|'200'`, and any other value falls back to `.875em`. A number `300` silently gives the smallest font. The shadcn Slider returns numbers, so Step 4 must convert them back to strings.

**Sidebar controls** (`preview/components/sidebar/*.jsx`). `Template` is a native select (`minimal`, `business`; labels not translated). `Language` is a select over 9 codes, each label translated in its own language. `DateFormat` is a select over 8 moment formats. `Alignment` is a select (`top|middle|bottom`). `FontSize` is a range from 100 to 500, step 100. `LogoSize` is a range from 5 to 50, step 2.5. `Toggler` has 4 checkboxes (`showLogo`, `useSymbol`, `showRecipient`, `customAccentColor`). `AccentColor` has 8 swatches (`#D9E3F0 #F47373 #697689 #37D67A #2CCCE4 #555555 #dce775 #ff8a65`) plus a react-colorful `HexColorInput`. `Actions` uses the shared `Button`. `preview/components/shared/index.js` holds styled `Section`, `Label`, `Range`.

**Paper box** `preview/containers/MainContent.jsx:28-40,62-66`:

```jsx
const Page = styled.div`
  position: relative; width: 21cm; height: 29.7cm; min-height: 29.7cm; min-width: 21cm;
  margin-left: auto; margin-right: auto; background: #ffffff;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); display: flex; border-radius: 4px;
`;
...
<div className="print-area"><Page>{this.renderTemplate()}</Page></div>
```

`MainContent.renderTemplate()` (lines 47-56) returns `<Business>` for `'business'` and `<Minimal>` for anything else. The stored default `'default'` therefore means Minimal.

**Print CSS** `static/css/preview/print.css` (keep it). It sets `@page { size: A4; margin: 0 }` and, under `@media print`, `body * { visibility: hidden }`, `.print-area, .print-area * { visibility: visible }`, and `.print-area { position: absolute; left: 0; top: 0 }`. The `.print-area` box is positioned against the initial containing block. **No ancestor of `.print-area` may be positioned or transformed, or have `filter`, `contain` or `zoom` set**, or the PDF moves.

**PDF export** `main/save-pdf.js:13-15` calls `win.webContents.printToPDF(getPrintOptions(appConfig.get('general.printOptions')))`. `main/print-options.js:10-15` returns `{ landscape: false, printBackground: true (default), margins: { marginType }, preferCSSPageSize: true }`. `printBackground` is true, so the `body` background prints at the 4 px rounded paper corners. A dark body in dark mode would show in the PDF.

**What the templates get from Bootstrap** (read from `static/css/bootstrap.min.css`, Bootstrap v4.0.0-beta). The templates (`preview/templates/{business,minimal}/**`) set most values themselves, but they inherit these:
- `html { box-sizing: border-box }` and `*, ::before, ::after { box-sizing: inherit }`.
- `body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; font-size:1rem; font-weight:400; line-height:1.5; color:#212529; background-color:#fff }`. The Minimal root sets no `font-family`, and Minimal item rows inherit `line-height: 1.5`.
- `h1,h2,h3,h4,h5,h6 { margin-top:0; margin-bottom:.5rem; font-family:inherit; font-weight:500; line-height:1.1; color:inherit }`, plus `h1 {font-size:2.5rem}` … `h4 {font-size:1.5rem}`. Business `h4` and `h1` never set `line-height`, so they use 1.1.
- `p { margin-top:0; margin-bottom:1rem }`, `img { vertical-align:middle; border-style:none }`, `table { border-collapse:collapse }`, `th { text-align:left }`.
- Print only: `*, ::after, ::before { text-shadow:none!important; box-shadow:none!important }`. This removes the paper shadow from the PDF. Also `thead { display:table-header-group }`, `img, tr { page-break-inside:avoid }`, `h2, h3, p { orphans:3; widows:3 }`.

**Modal window** (delete it). `app.js:363` has `require('./main/modal-window');`. `main/modal-window.js` handles `show-modal` (creates a frameless 450×220 window, `loadPage(modalWin, 'modal')`) and `modal-response` (forwards to the main window on `returnChannel`). `modal/{index.html,index.jsx,Dialog.jsx}` is the renderer (styled-components + `ion-*` icons). `app/renderers/dialog.js` (`ipc.send('show-modal', …)` + `sounds.play('DIALOG')`) and `app/renderers/__mocks__/dialog.js` are the caller side. `electron.vite.config.mjs:50` has `modal: root('./modal/index.html'),`. The preload allow-list (`preload/index.js:3-48`) has `show-modal`, `modal-response`, `update-modal`. It also has the modal return channels `confirmed-delete-invoice`, `confirmed-delete-contact`, `update-download-confirmed`, `upgrade-confirmed`, `upgade-confirmed`. **Keep** `no-access-directory` and `confirmed-export-directory`: `main/select-export-directory.js:18-20` sends them, not the modal. The main process uses native `dialog.showOpenDialog` only (`main/select-export-directory.js`, `main/select-logo-file.js`). Keep those.

**Legacy styles.** The files in `static/css/` are `bootstrap.min.css`, `ionicons.min.css`, `general.css`, `layout.css`, `form.css`, `contact.css`, `items.css`, `date-picker.css`, plus `preview/{font,print}.css` (keep both). The fonts in `static/fonts/` are `ionicons.{eot,svg,ttf,woff}` (delete) plus `Lora/`, `Montserrat/`, `SourceSerifPro/` (keep: `font.css` uses them). `libs/dragNdrop.js:6-11` adds the class `non-draggable` to `body,#root,.appWrapper` on Linux/Windows. That is a workaround for the old body drag region, and 013 removed that region.

**Dependencies** (`package.json`): `styled-components ^6.6.0`, `@emotion/is-prop-valid ^1.4.0` (StyledRoot only), `react-colorful ^5.8.1` (preview AccentColor only), `motion ^14.9.0` (only `app/components/shared/TransitionList.jsx`).

**Shared components at `3e89104`** (`app/components/shared/`): `Button`, `Card`, `ErrorBoundary`, `Layout`, `Message`, `Notification`, `Part`, `Section`, `SplitButton`, `StyledRoot`, `Switch`, `Table`, `Tabs`, `TransitionList`, `hoc/_withFadeInAnimation`. Tests in `_tests_/`: `Button.spec.jsx`, `Layout.spec.jsx`, `Message.spec.jsx`, `SplitButton.spec.jsx`. These tests check rendered markup and style only. 013–016 removed most of the callers. Step 8 deletes each component that has no importer.

**README** `README.md:38` ("styled-components 6"), `:126-134` (Technologies), `:179-185` (FAQ: "Some layout still uses Bootstrap", icons from Ionicons).

## Reference facts (recheck versions and APIs at execution)

- Tailwind v4 Preflight sets `*{margin:0;padding:0;border:0 solid;box-sizing:border-box}`, `h1–h6{font-size:inherit;font-weight:inherit}`, `img{display:block;max-width:100%;height:auto}`, `table{border-collapse:collapse;border-color:inherit;text-indent:0}`, and `html{line-height:1.5;font-family:…}`. It is in `@layer base`. https://tailwindcss.com/docs/preflight
- Unlayered styles beat all layered styles, whatever the specificity. A later layer beats an earlier one. https://developer.mozilla.org/en-US/docs/Web/CSS/@layer . styled-components injects unlayered `<style>` tags, so template rules always win over any layered reset. Only the properties that a template does not set fall through to the reset.
- `revert` rolls a property back to the user-agent value. https://developer.mozilla.org/en-US/docs/Web/CSS/revert
- Base UI Slider: `value: number | number[]`, `onValueChange(value: number | number[], eventDetails)`. https://base-ui.com/react/components/slider
- Base UI ToggleGroup: `value: string[]`, `onValueChange(groupValue: string[], …)`, single-select by default (`multiple` false). The docs do not say whether the last pressed item can be unpressed, so always guard against `[]`. https://base-ui.com/react/components/toggle-group
- Base UI Select: `<Select.Value>` shows the raw value unless `Select.Root` gets an `items` prop (array of `{ value, label }`). `onValueChange(value | null, …)`. https://base-ui.com/react/components/select
- react-colorful 5.8.1 (`HexColorPicker`, `HexColorInput`). It injects a `<style>` tag at runtime, which CSP `style-src 'unsafe-inline'` allows. https://github.com/omgovich/react-colorful
- styled-components 6.6.0. v6 forwards all props to the DOM unless `StyleSheetManager shouldForwardProp` is set (https://styled-components.com/docs/faqs#what-do-i-need-to-do-to-migrate-to-v6). Maintenance mode: https://opencollective.com/styled-components/updates/thank-you . `@emotion/is-prop-valid` 1.4.0.
- Electron `webContents.printToPDF(options)` returns `Promise<Buffer>`: https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions . Custom title bar (`hiddenInset`, `titleBarOverlay`, `app-region`): https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
- ImageMagick 7.1.2: `magick compare -metric AE a.png b.png diff.png` prints `N (fraction)` to **stderr**. It exits 0 when the images are equal and 1 when they differ (checked locally). https://imagemagick.org/script/compare.php . poppler `pdftoppm -r 150 -png in.pdf prefix` writes `prefix-1.png`, one file per page. https://poppler.freedesktop.org/
- shadcn Base UI components and RTL: https://ui.shadcn.com/docs/components , https://ui.shadcn.com/docs/rtl . lucide-react 1.x: https://lucide.dev/guide/version-1
- Confirm versions before you install anything: `npm view react-colorful version`, `npm view styled-components version`, `npm view @emotion/is-prop-valid version`.

## Commands you will need

```sh
npm run build                                   # needed before the snapshot script and e2e
node scripts/pdf-snapshot.mjs /tmp/manta-pdf-baseline   # Step 0 (new script)
node scripts/pdf-snapshot.mjs /tmp/manta-pdf-after
sh scripts/pdf-compare.sh /tmp/manta-pdf-baseline /tmp/manta-pdf-after
npx vitest run preview/helper/__test__/index.spec.js
npm test && npm run lint && npm run test:e2e
npx electron-builder --dir --publish never      # packaged smoke build into dist/
cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy
MANTA_USER_DATA=/tmp/manta-profile-copy npm start
npx shadcn@latest add slider toggle-group popover --dry-run   # then without --dry-run
```

## Scope

**In scope**
- Create: `scripts/pdf-snapshot.mjs`, `scripts/pdf-compare.sh`, `preview/templates/StyledRoot.jsx` (moved), `preview/templates/index.js` (extend the 015 entry with InvoiceTemplate; do not add a second index file), `ui/styles/paper.css`, `preview/helper/__test__/index.spec.js`, any missing shadcn components in `ui/components/ui/` (`slider`, `toggle-group`, `popover`, and others only if missing).
- Change: `preview/index.html`, `preview/index.jsx`, `preview/Viewer.jsx`, `preview/containers/{SideBar,MainContent}.jsx`, `preview/components/sidebar/*.jsx`, `preview/helper/index.js`, `ui/styles/globals.css`, `app.js` (preview window chrome, modal require), `electron.vite.config.mjs`, `preload/index.js`, `libs/dragNdrop.js`, `app/index.jsx` (CSS imports, StyledRoot), the 015 live-preview component (template switch + `paper` class), `i18n/en/preview.json`, `e2e/app.e2e.mjs` (one new test), `package.json`, `README.md`.
- Delete: `modal/`, `main/modal-window.js`, `app/renderers/dialog.js`, `app/renderers/__mocks__/dialog.js`, `preview/components/shared/index.js`, `static/css/{bootstrap.min,ionicons.min,general,layout,form,contact,items,date-picker}.css`, `static/fonts/ionicons.*`, `app/components/shared/StyledRoot.jsx` (moved), and every unused shared component and its test (Step 8). Also `helpers/center-on-primary-display.js` if it has no caller.

**Out of scope**: rewriting templates to Tailwind; new templates; RTL layout of the invoice paper (the paper stays LTR, as at baseline); changing `main/save-pdf.js` or `main/print-options.js`; changing stored config shapes.

## Git workflow

- Stay on the current branch. Do not switch branches, create a worktree or push.
- One commit per step. Use short imperative subjects with no prefix and no attribution. Examples: `Add PDF snapshot and compare scripts`, `Isolate the invoice paper from global CSS`, `Restyle the preview sidebar with shadcn controls`, `Delete the modal window`, `Remove Bootstrap, Ionicons and old global CSS`, `Remove styled-components outside the invoice templates`.

## Steps

### Step 0: Baseline PDFs before any change

1. Before capture, add `data-invoice-id={invoice?._id}` to `.print-area` in `preview/containers/MainContent.jsx`; this marker has no visual effect and is present for both baseline and after capture. Create `scripts/pdf-snapshot.mjs`. It launches the **built** app on a new temp profile (never real data), sends fixed invoices to the preview window, and writes one PDF plus one computed-style JSON per case and theme:

```js
// Usage: node scripts/pdf-snapshot.mjs <outDir>   (run `npm run build` first)
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] || '/tmp/manta-pdf-snapshot');
fs.mkdirSync(outDir, { recursive: true });
// Must equal getPrintOptions(undefined) in main/print-options.js.
const PRINT = { landscape: false, printBackground: true, margins: { marginType: 'default' }, preferCSSPageSize: true };
const T = Date.UTC(2026, 0, 15, 12);
const BASE = {
  _id: 'pdf-snapshot-0001', invoiceID: 'INV-0042', created_at: T, issuedAt: T, status: 'pending',
  recipient: { fullname: 'Ada Lovelace', company: 'Analytical Engines Ltd', email: 'ada@example.com', phone: '+44 20 7946 0000' },
  rows: [
    { id: 'r1', description: 'Design work', quantity: 10, price: 120, subtotal: 1200 },
    { id: 'r2', description: 'Development', quantity: 24.5, price: 95, subtotal: 2327.5 },
    { id: 'r3', description: 'Hosting (annual)', quantity: 1, price: 240, subtotal: 240 },
  ],
  currency: { code: 'USD', placement: 'before', separator: 'commaDot', fraction: 2 },
  tax: { tin: '123-456-789', method: 'default', amount: 10 },
  discount: { type: 'percentage', amount: 5 },
  dueDate: { useCustom: false, paymentTerm: 'net30' },
  note: 'Thank you for your business. Payment by bank transfer within 30 days.',
  subtotal: 3767.5, grandTotal: 3937.0375,
};
const DEF = { dateFormat: 'MM/DD/YYYY', language: 'en', accentColor: '#2CCCE4', logoSize: '20', fontSize: '200',
  alignItems: 'middle', showLogo: true, useSymbol: true, customAccentColor: true, showRecipient: true };
const OFF = { showLogo: false, customAccentColor: false, showRecipient: false, useSymbol: false };
const CASES = {};
for (const template of ['minimal', 'business']) {
  CASES[`${template}-default`] = { template };
  CASES[`${template}-off-top`] = { template, ...OFF, alignItems: 'top' };
  CASES[`${template}-off-bottom`] = { template, ...OFF, alignItems: 'bottom' };
  CASES[`${template}-large`] = { template, fontSize: '500', logoSize: '40', accentColor: '#F47373', dateFormat: 'dddd, MMMM Do, YYYY' };
  CASES[`${template}-small`] = { template, fontSize: '100', logoSize: '7.5', accentColor: '#37D67A', dateFormat: 'DD/MM/YY' };
  CASES[`${template}-ur-PK`] = { template, language: 'ur-PK' };
  CASES[`${template}-zh-CN`] = { template, language: 'zh-CN' };
}
const PROPS = ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'margin-top', 'margin-right',
  'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top', 'border-bottom',
  'border-left', 'border-right', 'display', 'box-sizing', 'text-align', 'vertical-align', 'width', 'height', 'max-width',
  'letter-spacing', 'text-transform', 'direction', 'box-shadow', 'border-collapse', 'border-radius'];

const userData = process.env.SNAPSHOT_USER_DATA || fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
const app = await electron.launch({
  args: ['out/main/index.js', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
  env: { ...process.env, MANTA_USER_DATA: userData, NODE_ENV: 'production', TZ: 'UTC' },
});
try {
const findPreview = async () => { for (const p of app.windows()) if ((await p.title()) === 'Previewer') return p; };
let page;
for (let i = 0; i < 60 && !page; i++) { page = await findPreview(); if (!page) await new Promise(r => setTimeout(r, 500)); }
if (!page) throw new Error('Preview window not found');
await page.waitForLoadState('load');
for (const theme of ['light', 'dark']) {
  await app.evaluate(({ nativeTheme }, t) => { nativeTheme.themeSource = t; }, theme);
  for (const [name, cfg] of Object.entries(CASES)) {
    const invoice = { ...BASE, _id: `pdf-${name}-${theme}`, configs: { ...DEF, ...cfg } };
    await app.evaluate(({ BrowserWindow }, inv) => {
      BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Previewer').webContents.send('update-preview', inv);
    }, invoice);
    await page.waitForFunction(id => document.querySelector('.print-area')?.dataset.invoiceId === id, invoice._id, { timeout: 10000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
      // Do not wait on requestAnimationFrame in this hidden window.
      await new Promise(r => setTimeout(r, 50));
    });
    await page.waitForTimeout(300);
    const b64 = await app.evaluate(async ({ BrowserWindow }, opts) => {
      const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'Previewer');
      return (await w.webContents.printToPDF(opts)).toString('base64');
    }, PRINT);
    fs.writeFileSync(path.join(outDir, `${name}-${theme}.pdf`), Buffer.from(b64, 'base64'));
    const styles = await page.evaluate(props => {
      const root = document.querySelector('.print-area');
      return [root, ...root.querySelectorAll('*')].map(el => {
        const cs = getComputedStyle(el);
        return [el.tagName, ...props.map(p => `${p}: ${cs.getPropertyValue(p)}`)];
      });
    }, PROPS);
    fs.writeFileSync(path.join(outDir, `${name}-${theme}.styles.json`), JSON.stringify(styles, null, 1));
  }
}
} finally {
  await app.close();
  if (!process.env.SNAPSHOT_USER_DATA) fs.rmSync(userData, { recursive: true, force: true });
}
console.log(`Wrote ${Object.keys(CASES).length * 2} PDFs to ${outDir}`);
```

2. Create `scripts/pdf-compare.sh`. It compares every baseline PDF with the PDF of the same name, or with the `-light` baseline when the second argument is `--light-ref`. It checks page count, text, fonts, and pixels:

```sh
#!/bin/sh
# Usage: sh scripts/pdf-compare.sh <baselineDir> <afterDir> [--light-ref]
set -eu
A="$1"; B="$2"; REF="${3:-}"; W=$(mktemp -d); FAIL=0
trap 'rm -rf "$W"' EXIT HUP INT TERM
# Baseline and after must contain the same non-empty case set.
find "$A" -type f -name '*.pdf' -exec basename {} \; | sort > "$W/a-files"
find "$B" -type f -name '*.pdf' -exec basename {} \; | sort > "$W/b-files"
[ -s "$W/a-files" ] && [ -s "$W/b-files" ] || { echo "EMPTY PDF SET"; exit 1; }
cmp -s "$W/a-files" "$W/b-files" || { echo "MISSING OR EXTRA PDF CASE"; exit 1; }
for b in "$B"/*.pdf; do
  n=$(basename "$b" .pdf); r="$n"
  [ "$REF" = "--light-ref" ] && r=$(echo "$n" | sed 's/-dark$/-light/')
  a="$A/$r.pdf"; [ -f "$a" ] || { echo "MISSING baseline $r"; FAIL=1; continue; }
  pdfinfo "$a" > "$W/info-a"; pdfinfo "$b" > "$W/info-b"
  pa=$(awk '/^Pages/{print $2}' "$W/info-a"); pb=$(awk '/^Pages/{print $2}' "$W/info-b")
  case "$pa:$pb" in *[!0-9:]*|:*) echo "INVALID PAGE COUNT"; exit 1;; esac
  [ "${pa:-0}" -gt 0 ] && [ "${pb:-0}" -gt 0 ] || { echo "INVALID PAGE COUNT"; exit 1; }
  [ "$pa" = "$pb" ] || { echo "PAGES $n: $pa vs $pb"; FAIL=1; }
  pdftotext -layout "$a" "$W/a.txt"; pdftotext -layout "$b" "$W/b.txt"
  cmp -s "$W/a.txt" "$W/b.txt" || { echo "TEXT $n differs"; FAIL=1; }
  pdffonts "$a" > "$W/font-a"; pdffonts "$b" > "$W/font-b"
  tail -n +3 "$W/font-a" | awk '{print $1}' | sed 's/^[A-Z]\{6\}+//' | sort > "$W/fa"
  tail -n +3 "$W/font-b" | awk '{print $1}' | sed 's/^[A-Z]\{6\}+//' | sort > "$W/fb"
  cmp -s "$W/fa" "$W/fb" || { echo "FONTS $n differ"; FAIL=1; }
  pdftoppm -r 150 -png "$a" "$W/$n-a"; pdftoppm -r 150 -png "$b" "$W/$n-b"
  for pa_png in "$W/$n-a"-*.png; do
    [ -f "$pa_png" ] || { echo "MISSING RENDERED PAGE"; exit 1; }
    pb_png=$(echo "$pa_png" | sed 's/-a-\([0-9]*\)\.png$/-b-\1.png/')
    [ -f "$pb_png" ] || { echo "MISSING PAGE $pb_png"; FAIL=1; continue; }
    page=$(basename "$pa_png" .png)
    metric="$W/metric"
    status=0
    magick compare -metric AE "$pa_png" "$pb_png" "$B/$page-diff.png" > /dev/null 2> "$metric" || status=$?
    [ "$status" -le 1 ] || { cat "$metric"; echo "COMPARE ERROR"; exit 1; }
    ae=$(awk '{print $1}' "$metric")
    echo "$n $(basename "$pa_png") AE=$ae"
    [ "$ae" = "0" ] || FAIL=1
  done
done
rm -rf "$W"; [ $FAIL -eq 0 ] && echo "ALL IDENTICAL" || { echo "DIFFERENCES FOUND"; exit 1; }
```

3. Run `npm run build`, then `node scripts/pdf-snapshot.mjs /tmp/manta-pdf-baseline`.
4. Determinism check: run `node scripts/pdf-snapshot.mjs /tmp/manta-pdf-baseline-2`, then `sh scripts/pdf-compare.sh /tmp/manta-pdf-baseline /tmp/manta-pdf-baseline-2`.
5. Dark/light check (information only): `sh scripts/pdf-compare.sh /tmp/manta-pdf-baseline /tmp/manta-pdf-baseline --light-ref`. Write the result in your report. If dark already differs from light at baseline, that is a bug from 012–017, and this plan fixes it with Step 2. From now on, the target for **both** themes is the `-light` baseline.
6. Open 2 baseline PDFs (`minimal-default-light.pdf`, `business-default-light.pdf`). Confirm by eye that they look like a normal invoice: logo, accent color, totals.

**Verify**: step 3 prints `Wrote 28 PDFs`. Step 4 prints `ALL IDENTICAL`. If step 4 fails, STOP: rendering is not deterministic, so a comparison means nothing. Commit the two scripts.

### Step 1: One template entry, and StyledRoot next to the templates

1. Move the file: `git mv app/components/shared/StyledRoot.jsx preview/templates/StyledRoot.jsx`. Keep the content.
2. Extend 015's `preview/templates/index.js` (rename it to `.jsx` only if required and remove the old file). It exports `InvoiceTemplate(props)`. It renders `<StyledRoot>` around `<Business {...props}/>` when `props.configs.template === 'business'`, and around `<Minimal {...props}/>` otherwise (same rule as `MainContent.jsx:47-56`).
3. In `MainContent.jsx`, replace `renderTemplate()` with `<InvoiceTemplate {...props} />`.
4. Find the 015 live preview: `grep -rln "preview/templates" app ui`. Make it use `InvoiceTemplate` too. If 015 already built its own switch, replace that switch with `InvoiceTemplate`.
5. Remove the `StyledRoot` wrapper and import from `preview/index.jsx` and `app/index.jsx`. Only the templates need it now.

**Verify**: `grep -rn "StyledRoot" app preview ui` shows only `preview/templates/StyledRoot.jsx` and the single template index. `npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-after && sh scripts/pdf-compare.sh /tmp/manta-pdf-baseline /tmp/manta-pdf-after --light-ref` prints `ALL IDENTICAL`, or only dark differences that were already present in Step 0.5. Also check the browser console of the preview window (run `npm start` on the copy profile and open DevTools with `--force-devtools`): it must show no React warning about unknown props such as `baseFontSize`.

### Step 2: Isolate the paper from global CSS

1. Create `ui/styles/paper.css`. It reproduces the Bootstrap rules that the templates depend on, and it keeps the PDF background white:

```css
/* Invoice paper. Reproduces the Bootstrap 4 reboot rules the templates relied on.
   Layer `paper` beats Tailwind base; unlayered styled-components still beat it. */
.paper {
  position: relative; display: flex; width: 21cm; min-width: 21cm; height: 29.7cm; min-height: 29.7cm;
  margin-left: auto; margin-right: auto; border-radius: 4px; background-color: #fff;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  color-scheme: light; direction: ltr;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 1rem; font-weight: 400; line-height: 1.5; color: #212529; -webkit-text-size-adjust: 100%;
}
.paper, .paper::before, .paper::after, .paper *, .paper *::before, .paper *::after { box-sizing: border-box; }
.paper :is(h1, h2, h3, h4, h5, h6) { margin-top: 0; margin-bottom: .5rem; font-family: inherit; font-weight: 500; line-height: 1.1; color: inherit; }
.paper h1 { font-size: 2.5rem; } .paper h2 { font-size: 2rem; } .paper h3 { font-size: 1.75rem; }
.paper h4 { font-size: 1.5rem; } .paper h5 { font-size: 1.25rem; } .paper h6 { font-size: 1rem; }
.paper p { margin-top: 0; margin-bottom: 1rem; }
.paper img { vertical-align: middle; border-style: none; }
.paper table { border-collapse: collapse; }
.paper th { text-align: left; }
@media screen and (prefers-color-scheme: dark) {
  .paper { box-shadow: 0 0 0 1px rgb(255 255 255 / 0.06), 0 8px 24px rgb(0 0 0 / 0.5); }
}
@media print {
  html, body { background: #fff !important; }
  .print-area, .print-area *, .print-area *::before, .print-area *::after { text-shadow: none !important; box-shadow: none !important; }
  .paper thead { display: table-header-group; }
  .paper img, .paper tr { page-break-inside: avoid; }
  .paper :is(h2, h3, p) { orphans: 3; widows: 3; }
}
```

   **Case B only** (012 had Preflight OFF): Preflight will be ON after Step 3. Its rules were not present at baseline, so undo them inside the paper. Insert this block right after the `.paper *` box-sizing rule:

```css
.paper :where(*), .paper :where(*)::before, .paper :where(*)::after { margin: revert; padding: revert; border: revert; }
.paper img { display: inline; max-width: none; height: revert; }
.paper table { text-indent: revert; border-color: revert; }
.paper { font-feature-settings: normal; font-variation-settings: normal; tab-size: 8; }
```

2. In `ui/styles/globals.css`, change the layer order line from `theme, base, legacy, components, utilities` to `theme, base, legacy, paper, components, utilities`. Add `@import "./paper.css" layer(paper);` after the Tailwind import.
3. In `MainContent.jsx`, keep the `data-invoice-id` marker on `.print-area` and replace the styled `Page` with `<div className="paper" dir="ltr">`. Keep `<div className="print-area">` as its direct parent. Do the same for the page box of the 015 live preview: add the `paper` class to the box that holds the template, and keep 015's scaling on an **outer** wrapper.

**Verify**: `npm run build`, snapshot to `/tmp/manta-pdf-after`, then `sh scripts/pdf-compare.sh /tmp/manta-pdf-baseline /tmp/manta-pdf-after --light-ref` prints `ALL IDENTICAL` (dark included). `diff /tmp/manta-pdf-baseline/business-default-light.styles.json /tmp/manta-pdf-after/business-default-light.styles.json` shows no difference. Only the root page div may differ: in dark styles, `box-shadow` and `color-scheme` differences are expected. If a pixel or style difference remains, find the property in the styles diff. Add a rule to `paper.css` that restores the baseline value. Never edit template files for this.

### Step 3: Remove Bootstrap (and turn Preflight on)

1. In `ui/styles/globals.css`, delete the Bootstrap `@import … layer(legacy)`. Keep `legacy` in the layer order while the `general.css` import remains; remove it at Step 7 after deleting the last legacy import.
2. If Preflight was off (Case B), turn it on now: import the full `tailwindcss` (or add back `@import "tailwindcss/preflight.css" layer(base);`, matching how 012 split it).
3. Delete the file: `git rm static/css/bootstrap.min.css`. Remove any remaining import of it: `grep -rn "bootstrap" app preview ui electron.vite.config.mjs`.
4. Search for Bootstrap class names in migrated code: `grep -rnE "className=\"[^\"]*\b(btn|form-control|form-group|row|col-[a-z0-9-]+|input-group|d-flex|text-muted|badge)\b" app preview ui`. Replace each hit with Tailwind/shadcn markup.

**Verify**: build, snapshot, compare (`--light-ref`) → `ALL IDENTICAL`. Manual pass on the copy profile (light + dark): Dashboard, Invoices, editor, Clients, Settings. No layout breaks.

### Step 4: Restyle the preview sidebar

1. Add the missing shadcn components: `npx shadcn@latest add slider toggle-group popover --dry-run`, then run the same command without `--dry-run`. Do not overwrite components that already exist (answer "no" to overwrite).
2. In `preview/helper/index.js`, add and export these pure helpers:

```js
// Store the same types as the old <input>: fontSize/logoSize are strings.
export function toConfigValue(name, raw) {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (name === 'fontSize' || name === 'logoSize') return String(v);
  return v;
}
// ToggleGroup gives string[]; empty means "no change".
export function firstOrNull(groupValue) {
  return Array.isArray(groupValue) && groupValue.length ? groupValue[0] : null;
}
```

3. Convert `Viewer.jsx`, `SideBar.jsx`, `MainContent.jsx` and each sidebar component to function components. Use `useSelector`/`useDispatch`, `useTranslation`, and `useEffect` with cleanup that calls `ipc.removeAllListeners([...all 4 channels])`. Keep every IPC channel name and payload from "Current state". `savePDF` still sends `save-pdf` and then `save-configs-to-invoice`.
4. Layout (`Viewer.jsx`): `div.flex.h-screen.flex-col.bg-background.text-foreground` contains:
   - A header strip `h-10 shrink-0 border-b` with `[-webkit-app-region:drag]`. Copy the platform padding for traffic lights and title-bar overlay from the 013 main-window header. It shows the invoice number, or `preview:common:chooseInvoiceToPreview` when no invoice is loaded. Interactive children need `[-webkit-app-region:no-drag]`.
   - A body row `flex min-h-0 flex-1`.
5. Sidebar (`SideBar.jsx`): `<aside className="flex w-72 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground">`. It has a scrolling section list (`flex-1 overflow-y-auto p-4 space-y-6`) and a sticky footer (`border-t p-4 flex flex-col gap-2`). Use logical utilities only (`ms-`, `ps-`, `border-e`, `start-`) so RTL works. Each section uses shadcn `Field` + `FieldLabel`. The controls:
   - Template: `ToggleGroup` with items `minimal` = "Minimal" and `business` = "Business". Show `business` as pressed when `template === 'business'`, otherwise `minimal`. On change: `const v = firstOrNull(g); if (v) update('template', v)`.
   - Language: `Select` with `items` = the 9 codes (`de en fr id it sk ur-PK vi zh-CN`), labels `t('settings:fields:language:<code>', { lng: code })`.
   - Date format: `Select` with `items` = the 8 formats from `DateFormat.jsx:14-41`, label `` `${moment().locale(language).format(f)} (${f})` ``.
   - Alignment: `ToggleGroup` with `top|middle|bottom`. Each item has a lucide icon (`AlignVerticalJustifyStart`, `AlignVerticalJustifyCenter`, `AlignVerticalJustifyEnd`) **and** a visible text label.
   - Font size: `Slider` min 100, max 500, step 100, `value={[Number(fontSize)]}`, `onValueChange={v => update('fontSize', toConfigValue('fontSize', v))}`. Show the level `Number(fontSize) / 100` next to the label.
   - Logo size: only when `showLogo`. `Slider` min 5, max 50, step 2.5, same pattern. Show `${logoSize}%`.
   - Toggles: 4 shadcn `Switch` rows with labels (`toggle:logo`, `toggle:symbol`, `toggle:recipient`, `accentColor:name`), `onCheckedChange={c => update(name, c)}`.
   - Accent color: only when `customAccentColor`. 8 swatch `<button type="button">` elements, each `size-6` (24 px target) with `aria-label={hex}`, `aria-pressed`, and a ring when selected. Add one "Custom color" button (lucide `Pipette`) that opens a `Popover` with react-colorful `HexColorPicker` + `HexColorInput prefixed` (Tailwind-styled input). Both call `update('accentColor', hex)`.
   - Footer: `Button` "Export PDF" (default variant, lucide `FileDown`) and `Button variant="outline"` "Save settings" (lucide `Save`). Both are `w-full` and disabled when `!invoice._id`.
6. `MainContent.jsx`: `<main className="min-w-0 flex-1 overflow-auto bg-muted/40 pt-8 pb-8">`. Inside it, put `<div className="print-area">`, then `<div className="paper" dir="ltr"><InvoiceTemplate …/></div>`. Do **not** put `relative`, `transform`, `filter`, `contain` or `zoom` on `main` or any ancestor of `.print-area`. Optional zoom control: skip it unless the rest is done. If you add one, scale only the screen view of `.paper` (`@media screen` rule with a CSS variable), and re-run the PDF compare at a non-100% zoom.
7. Delete `preview/components/shared/index.js`. Remove `styled-components` from all preview files outside `preview/templates/`.
8. `i18n/en/preview.json`: change `sidebar.actions.saveConfigs` to `"Save settings"`. Add `sidebar.accentColor.custom: "Custom color"`. Do not edit other locales.
9. Create `preview/helper/__test__/index.spec.js` with these tests: `toConfigValue('fontSize', [300])` is `'300'`, `toConfigValue('logoSize', 22.5)` is `'22.5'`, `setBaseFontSize(toConfigValue('fontSize', [300]))` is `'1.025em'` (regression: a number falls back to `.875em`), `toConfigValue('language', 'de')` is `'de'`, `firstOrNull([])` is `null`, `firstOrNull(['business'])` is `'business'`.

**Verify**: `npx vitest run preview/helper/__test__/index.spec.js preview/reducers preview/actions` passes. Build, snapshot, compare (`--light-ref`) → `ALL IDENTICAL`. Manual check on the copy profile, light and dark: every control changes the paper live; Export PDF writes a file and shows the native notification; Save settings persists (close and reopen the preview of the same invoice). Change the UI language to `ur-PK`: the sidebar mirrors (labels right-aligned, border on the left), and the paper does not mirror.

### Step 5: Preview window chrome and theme

1. In `app.js` `createPreviewWindow()` (`app.js:116-148` at `3e89104`), apply the same title-bar options and theme-based `backgroundColor` that 013/012 apply to the main window. Reuse their helper (find it with `grep -rn "shouldUseDarkColors\|titleBarOverlay" app.js main helpers`). Add the same `nativeTheme.on('updated')` background update. Keep `minWidth: 1024`, `minHeight: 800`, `show: false`, and the hide-on-close behavior.

**Verify**: `npm run test:e2e` passes (the preview window test checks resizable/movable). Manual check on macOS: the traffic lights sit in the header strip, and the window drags only by the header. On Windows/Linux (or CI screenshots): the overlay buttons do not cover the sidebar or the Export button.

### Step 6: Delete the modal window

1. Confirm that nothing calls it: `grep -rnE "renderers/dialog|show-modal|modal-response|update-modal" app preview ui main helpers app.js` lists only `app/renderers/dialog.js`, `app/renderers/__mocks__/dialog.js`, `main/modal-window.js`, `modal/`, and `preload/index.js`. If any other file appears, STOP.
2. Run `git rm -r modal main/modal-window.js app/renderers/dialog.js app/renderers/__mocks__/dialog.js`. Remove `require('./main/modal-window');` from `app.js`. Remove `modal: root('./modal/index.html'),` from `electron.vite.config.mjs`. Remove `vi.mock('../../renderers/dialog')` from any spec that still has it.
3. In `preload/index.js`, remove `show-modal`, `modal-response`, `update-modal`. For each of `confirmed-delete-invoice`, `confirmed-delete-contact`, `update-download-confirmed`, `upgrade-confirmed`, `upgade-confirmed`, run `grep -rn "<channel>" app preview ui main app.js`. Remove the channel when the preload file is the only hit. Keep `no-access-directory` and `confirmed-export-directory`.
4. If `grep -rn "center-on-primary-display" app.js main` has no output, delete `helpers/center-on-primary-display.js` and the `require` line in `app.js`.

**Verify**: first rewrite 012's theme e2e test to cover exactly Manta and Previewer: remove its `show-modal` send and Dialog wait, keep media-query/theme persistence checks. `npm run build && ls out/renderer` shows no `modal` folder. Run that focused e2e and the preload tests; both pass.

### Step 7: Remove Ionicons and the old global CSS

1. Run `git rm static/css/ionicons.min.css static/fonts/ionicons.eot static/fonts/ionicons.svg static/fonts/ionicons.ttf static/fonts/ionicons.woff`. Remove its imports.
2. Find icon usages: `grep -rnE "[\"' ]ion-[a-z]" app preview ui --include='*.js' --include='*.jsx'`. Replace each with a lucide icon and a visible or `aria-label` text. The `ErrorBoundary` bug icon becomes lucide `Bug`. In test files, delete or update assertions on `ion-` classes.
3. For each of `general.css layout.css form.css contact.css items.css date-picker.css`, list its class selectors (`grep -oE "\.[a-zA-Z][a-zA-Z0-9_-]+" static/css/<file> | sort -u`). Grep each class in `app preview ui libs`. Move a rule into `ui/styles/globals.css` (as Tailwind `@layer components` or `@utility`) only if a class still has a user. Then `git rm` the six files and remove their imports from `app/index.jsx`, `preview/index.jsx` and any `index.html`.
4. In `libs/dragNdrop.js`, delete lines 5-11 (the `non-draggable` patch). Keep the `dragover`/`drop` prevention.
5. Confirm that `static/css` now contains only `preview/font.css` and `preview/print.css`. Remove the final `general.css` legacy import and the `legacy` name from the layer order together.

**Verify**: `ls -R static/css` lists only `preview`, `font.css`, `print.css`. The `ion-` grep from item 2 has no output. Build, snapshot, compare (`--light-ref`) → `ALL IDENTICAL`. Manual smoke of all pages, light + dark.

### Step 8: Remove styled-components outside the templates and unused shared components

1. Run `grep -rln "styled-components" app preview ui libs helpers | grep -v "^preview/templates/"`. Convert each hit to Tailwind/shadcn (function component if it is a class component you touch).
2. For each file in `app/components/shared/` (and `hoc/_withFadeInAnimation.jsx`): `grep -rn "shared/<Name>" app preview ui`. If only its own test imports it, `git rm` the component and its `_tests_` spec. Expected deletions (verify each): `Button`, `Card`, `Layout`, `Message`, `Notification`, `Part`, `Section`, `SplitButton`, `Switch`, `Table`, `Tabs`, `TransitionList`, `hoc/_withFadeInAnimation`, and the specs `Button.spec.jsx`, `Layout.spec.jsx`, `Message.spec.jsx`, `SplitButton.spec.jsx` (markup-only tests). Keep `ErrorBoundary`: convert its styled container to Tailwind, and route its error report through `ui/lib/dialog.js` if 013 has not done so already.
3. Dependencies: if `grep -rn "from 'motion" app preview ui` has no output, run `npm uninstall motion`. Keep `styled-components`, `@emotion/is-prop-valid` (StyledRoot under templates) and `react-colorful`.

**Verify**: the grep from item 1 has no output. `grep -rn "is-prop-valid" app preview ui` shows only `preview/templates/StyledRoot.jsx`. `npm test` passes.

### Step 9: README

Edit `README.md` as follows. Line 38: replace "styled-components 6" with "shadcn/ui, Tailwind CSS 4". In Technologies (lines 126-134), replace the styled-components mention with "[shadcn/ui](https://ui.shadcn.com/) on [Base UI](https://base-ui.com/), [Tailwind CSS](https://tailwindcss.com/) and [Lucide](https://lucide.dev/) icons; styled-components only inside the invoice templates", and drop "Motion" if it was uninstalled. In Features, add "🌗 Light and dark mode (follows the system or your choice)". In the FAQ (lines 179-185), the UI framework answer becomes shadcn/ui + Tailwind CSS, and the icons answer becomes Lucide.

**Verify**: `grep -n "Bootstrap\|Ionicons" README.md` has no output.

### Step 10: Final checks

1. Add one e2e test to `e2e/app.e2e.mjs`: "preview renders an invoice and exports a PDF". It sends the Step 0 `BASE` invoice through `update-preview` (as in the script), waits for `.paper`, calls `printToPDF` through `app.evaluate`, and expects that the buffer starts with `%PDF` and that `errors` is empty.
2. Run `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`.
3. Run `npx electron-builder --dir --publish never`. Start the packaged app with `MANTA_USER_DATA=/tmp/manta-profile-copy` (macOS: `dist/mac-universal/Manta.app/Contents/MacOS/Manta`, or the folder that `ls dist` shows). Open an invoice preview and export a PDF.
4. Final PDF diff: `node scripts/pdf-snapshot.mjs /tmp/manta-pdf-after && sh scripts/pdf-compare.sh /tmp/manta-pdf-baseline /tmp/manta-pdf-after --light-ref`.
5. Take screenshots (light + dark) of Dashboard, Invoices, editor, Clients, client sheet, every Settings section, the preview window, and an AlertDialog. Save them to `/tmp/manta-018-screens/`.
6. RTL: set the UI language to `ur-PK`. Check the preview sidebar and the invoice editor form: they mirror and nothing overlaps. Check that the PDF for `ur-PK` matches its baseline (the compare in item 4 covers this).

**Verify**: every command exits 0. Item 4 prints `ALL IDENTICAL`.

## Test plan

- New unit test: `preview/helper/__test__/index.spec.js`. It covers the slider-value → stored-string conversion (a silent font-size regression) and the empty ToggleGroup guard.
- New e2e test: preview renders an invoice and `printToPDF` returns a PDF without page errors. This catches a missing CSS import, a missing StyledRoot, or a crash in the new sidebar.
- PDF identity: `scripts/pdf-snapshot.mjs` + `scripts/pdf-compare.sh` after Steps 1, 2, 3, 4, 7 and 10. There are 14 cases × 2 themes, all compared with the light baseline. The scripts check page count, text, fonts, and pixels (AE must be 0).
- Kept: `preview/reducers/__test__/index.spec.js`, `preview/actions/__test__/index.spec.js`, `main/__tests__/print-options.spec.js` (unchanged).
- Deleted (markup-only, component removed): `app/components/shared/_tests_/{Button,Layout,Message,SplitButton}.spec.jsx`, plus `ion-` assertions in the `Invoice.spec.jsx`/`Contact.spec.jsx` files that 014/016 left (if any).
- Manual: copy profile, light + dark, all pages, preview window, RTL `ur-PK`. Do not add tests for markup or classes.

## Done criteria

- [ ] `sh scripts/pdf-compare.sh /tmp/manta-pdf-baseline /tmp/manta-pdf-after --light-ref` → `ALL IDENTICAL`
- [ ] `grep -rln "styled-components" app preview ui libs helpers | grep -v "^preview/templates/"` → no output
- [ ] `grep -rnE "[\"' ]ion-[a-z]" app preview ui` → no output; `ls static/fonts | grep -c ionicons` → `0`
- [ ] `ls static/css` → only `preview`; `grep -rn "bootstrap" app preview ui` → no output
- [ ] `test ! -d modal && test ! -f main/modal-window.js && test ! -f app/renderers/dialog.js && echo ok` → `ok`
- [ ] `grep -nE "show-modal|modal-response|update-modal" preload/index.js electron.vite.config.mjs app.js` → no output
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e` → exit 0
- [ ] `npx electron-builder --dir --publish never` → exit 0; packaged app exports a PDF
- [ ] Screenshots light + dark saved; RTL check done
- [ ] `README.md` has no Bootstrap/Ionicons mention
- [ ] `plans/README.md` status row updated (unless a reviewer maintains it)

## STOP conditions

- A precondition fails, or the drift check shows unexpected changes in `main/save-pdf.js`, `main/print-options.js` or `static/css/preview/*`.
- Step 0.4 (baseline vs. baseline-2) is not `ALL IDENTICAL`.
- After any step, the PDF compare reports a page-count, text or font difference. Any AE > 0 that you cannot fix with a `paper.css` rule within 2 tries also stops you. Report the case name, the styles-JSON diff and the `*-diff.png`. Do not change template files to hide a difference.
- The Step 6.1 grep finds a modal caller outside the listed files (013 is not complete).
- Fixing the paper would need a change to `main/save-pdf.js`, `main/print-options.js` or the stored config shape.
- Deleting a shared component breaks a test that checks behavior (not markup). Report it; do not delete that test.
- A Base UI component API differs from "Facts checked" (Slider/ToggleGroup/Select signatures).

## Review acceptance checks

- Capture uses a unique case/theme invoice id and waits for the corresponding React-committed DOM marker before fonts/images. Keep this marker during restyling. Plan 026 needs an equivalent generation-specific ready protocol for email export; an invoice id alone is insufficient for repeat renders of an edited invoice.
- Put Electron close and temporary-profile removal in `finally`. Restrict `SNAPSHOT_USER_DATA` to disposable profiles; never accept the real Manta profile. Run capture/comparison on the same OS, Electron build, font set and display scale.
- Make the PDF compare fail on empty directories, missing/extra cases, failed Poppler commands, missing pages and ImageMagick errors. Keep the non-empty filename-set check before the loop so missing after cases cannot pass silently. Save each page diff under a unique page number. Add scratch fixtures to prove these failure cases before trusting the script.
- Before removing modal IPC, rewrite 012's theme e2e test to cover exactly Manta and Previewer. Remove the `show-modal` call and Dialog wait; keep the cross-window media-query and saved-theme assertions.
- `paper.css` sets border-box on descendants but not the paper root. Add the root and its pseudo-elements to the box-sizing rule. Verify root dimensions and overflow in the PDF matrix.
- Do not rename the printed Created label to Issued in this plan: 015's maintenance note suggests it, but this plan requires identical text. Defer that copy change explicitly.
- The imported `general.css` legacy layer cannot be removed from the layer declaration while its import remains. Remove both legacy imports together at the final cleanup, or keep the layer until then. Confirm computed paper styles after cleanup.
- Do not convert unchanged class components merely to remove styling. Keep their lifecycle and IPC logic unless conversion is required for the new controls; this reduces the chance of lost listeners during visual work.

## Maintenance notes

- `scripts/pdf-snapshot.mjs` and `scripts/pdf-compare.sh` are the regression tool for any future change to CSS, fonts, Electron or the templates. Make a baseline before the change and compare after it. Keep `PRINT` in sync with `getPrintOptions(undefined)`. Pixel output depends on the OS and its fonts, so always compare runs from the same machine.
- `ui/styles/paper.css` is the contract between the global CSS and the templates. Templates may rely only on the rules in it. If a template change needs a new base rule, put it in the template's styled component, not in `paper.css`.
- Keep `.print-area` free of positioned, transformed, filtered, contained or zoomed ancestors. `print.css` positions it against the initial containing block.
- styled-components (maintenance mode) and `@emotion/is-prop-valid` now live only under `preview/templates/**`. A future plan can rewrite the templates (for example with plain CSS modules) and remove both packages. Use the same PDF compare for that.
- The paper is always LTR (`dir="ltr"`). True RTL invoices for `ur-PK` are a separate feature: they need template changes and a new baseline.
- The preview stores `fontSize`/`logoSize` as strings. Always pass slider values through `toConfigValue`.
- Reviewer focus: the PDF compare output, `paper.css` vs. the Bootstrap rules listed in "Current state", that no ancestor of `.print-area` became positioned, the IPC channel removals in `preload/index.js`, and that the preview `<title>` is still `Previewer`.
