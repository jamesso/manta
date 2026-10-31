# Plan 005: Move Redux, i18n and styled-components to current versions and drop recompose and redux-logger

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- i18n/i18n.js app/store app/reducers preview/index.jsx preview/reducers preview/Viewer.jsx tour/Tour.jsx app/containers app/components/form/ItemsList.jsx app/components/form/Recipient.jsx app/components/form/ItemRow.jsx app/components/shared app/index.jsx modal/index.jsx tour/index.jsx package.json`
> Plans 001–004 change some of these files on purpose (see "Preconditions").
> Compare the live code with the "Current state" excerpts. If a difference is
> NOT explained by the preconditions, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/004-react18-testing-library.md
- **Category**: migration
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

The state, translation and styling libraries are 5–8 major versions old and
declare React 16 as their only supported peer. They work on React 18 only with
warnings and `legacy-peer-deps`, and they will not work on React 19 (plan 008):
`react-redux` 5 and `styled-components` 3 use the legacy context API that
React 19 removed. `recompose` is deprecated and the app only uses its
`compose` function, which `redux` already exports. `redux-logger` is
unmaintained and only prints actions in the console.

After this plan, the only React-16-only libraries left are `react-motion` and
`react-dates`, which plan 006 replaces.

## Preconditions (verify, STOP if missing)

| Precondition | Verify command | Expected |
|---|---|---|
| React 18.3 | `npm ls react` | `react@18.3.1` |
| Enzyme gone, Testing Library in | `npm ls enzyme @testing-library/react` | enzyme `(empty)`, RTL `16.x` |
| Temporary `.npmrc` | `cat .npmrc` | contains `legacy-peer-deps=true` |
| Entry files use `createRoot` | `grep -c createRoot app/index.jsx preview/index.jsx modal/index.jsx tour/index.jsx` | `2` per file |
| Tests pass | `npm test` | exit 0 |
| Build works | `npm run build` | exit 0 |

## Current state

Versions at `c530133` (`package.json`): `redux ^3.7.2`, `react-redux ^5.0.7`,
`reselect ^3.0.1`, `redux-actions ^2.3.0`, `recompose ^0.26.0`,
`i18next ^10.5.0`, `react-i18next ^7.5.0`, `styled-components ^3.2.1`,
`redux-logger ^3.0.6` (dev). `lodash` (19 files) and `prop-types` (68 files)
are imported but **not declared** in `package.json` — they only install today
as transitive dependencies.

Target versions (from `npm view <pkg> version`, 2026-10-31 — re-check at
execution time): `redux 5.0.1`, `react-redux 9.3.1`, `reselect 5.3.0`,
`redux-actions 3.0.3` (ESM-only, `"type": "module"`), `i18next 26.5.12`,
`react-i18next 17.1.9` (peer: `i18next >=26.2.0`, `react >=16.8`),
`styled-components 6.6.0`, `lodash 4.18.1`, `prop-types 15.8.1`.

### recompose — only `compose` is used (9 files)

```
app/components/form/ItemsList.jsx:7:import { compose } from 'recompose';
app/components/form/Recipient.jsx:4:import { compose } from 'recompose';
app/components/form/ItemRow.jsx:4:import { compose } from 'recompose';
app/containers/Form.jsx:4:import { compose } from 'recompose';
app/containers/Contacts.jsx:4:import { compose } from 'recompose';
app/containers/Invoices.jsx:4:import { compose } from 'recompose';
app/containers/Settings.jsx:4:import { compose } from 'recompose';
preview/Viewer.jsx:7:import { compose } from 'recompose';
tour/Tour.jsx:3:import { compose } from 'recompose';
```

`redux`'s `compose` has the same right-to-left semantics.

### react-i18next `translate()` HOC (8 call sites) and init

```
app/components/form/Recipient.jsx:176:  translate(),
app/components/form/ItemsList.jsx:128:  translate(),
app/containers/Form.jsx:187:  translate(),
app/containers/Settings.jsx:150:  translate(),
app/containers/Contacts.jsx:127:  translate(),
app/containers/Invoices.jsx:171:  translate(),
preview/Viewer.jsx:110:  translate()
tour/Tour.jsx:58:export default compose(translate(['common', 'tour']))(Tour);
```

Each of those files also has `import { translate } from 'react-i18next';`.
Typical use, `app/containers/Settings.jsx:148-152` (at `c530133`):
```jsx
export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  translate(),
  _withFadeInAnimation
)(Settings);
```

`i18n/i18n.js` (at `c530133`; plans 002/003 changed the settings and `isDev`
lines — the i18next lines below are unchanged):
```js
import i18n from 'i18next';
import { reactI18nextModule } from 'react-i18next';
...
i18n.use(reactI18nextModule).init({
  lng: defaultLanguage,
  fallbackLng: 'en',
  debug: isDev,
  defaultNS: 'form',
  resources: { de, en, fr, id, it, sk, "ur-PK": urPK, vi, "zh-CN": zhCN },
  interpolation: {
    function(value, format, lng) {
      if (value instanceof Date) return moment(value).format(format);
      return value;
    },
  },
  react: {
    wait: false,
    bindI18n: false,
    bindStore: false,
    nsMode: false,
  },
});
```

Translation keys use colons for both namespace and nesting, e.g.
`t('form:fields:items:name')`, `i18n.t('dialog:appUpdate:available:title')`.
Language is changed at runtime in `app/middlewares/SettingsMW.jsx:46`:
`i18n.changeLanguage(newLang);`. No `<Trans>`, `<I18n>` or `withNamespaces`
is used anywhere.

### reselect — identity selectors

reselect 5 prints a dev-mode warning when a result function returns its input
unchanged (`identityFunctionCheck`). Three selectors do that:

`app/reducers/InvoicesReducer.jsx:22-26`:
```js
const getInvoicesState = state => state.invoices;
export const getInvoices = createSelector(
  getInvoicesState,
  invoices => invoices
);
```
`app/reducers/ContactsReducer.jsx:19-23` — same shape for `getContacts`.
`app/reducers/FormReducer.jsx:207-210`:
```js
export const getCurrentInvoice = createSelector(
  getFormState,
  formState => formState
);
```
Other selectors (`SettingsReducer.jsx:26-39`, `preview/reducers/index.jsx:74-76`,
`FormReducer.jsx` `getRows` etc.) select a sub-field and are fine.

### redux-actions usage

Only `createAction` (6 files), `handleActions` (5 files) and `combineActions`
(1 file) are imported. All action type constants in
`app/constants/actions.jsx` are strings (Redux 5 requires string types).

### redux-logger (2 stores)

`app/store/index.jsx` (at `c530133`):
```js
// 3rd Party MWs
import Logger from 'redux-logger';
...
// Dev Mode Middlewares
if (isDev) {
  middlewares.unshift(MeasureMW);
  middlewares.push(Logger);
}
```
`preview/index.jsx:19-27` (at `c530133`):
```js
// Middleware
import Logger from 'redux-logger';
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

// Create Store
const store = createStore(
  combineReducers,
  composeEnhancers(applyMiddleware(Logger))
);
```

### styled-components — props passed to DOM elements

styled-components 6 no longer filters unknown props: every prop given to a
styled DOM element is passed to the DOM, and React warns
(`React does not recognize the 'primary' prop on a DOM element`). 20 `.jsx`
files use prop interpolations. Example, `app/components/shared/Button.jsx`
(at `c530133`):
```jsx
const ButtonStyle = styled.button`
  ...
  // Block Level Button
  ${props => props.block && `width: 100%;`}
  // Color
  ${props => props.primary &&  `
    background: #469fe5;
    color: white;
  `}
...
function Button(props) {
  return props.link ? (
    <ButtonLinkStyle {...props}>{props.children}</ButtonLinkStyle>
  ) : (
    <ButtonStyle {...props}>{props.children}</ButtonStyle>
  );
}
```

The fix that the styled-components v6 migration FAQ documents for exactly
this case is a root `StyleSheetManager` with a `shouldForwardProp` that uses
`@emotion/is-prop-valid` — one helper plus 4 root wrappers, instead of renaming
props to `$transient` names in 20 files.

Also note the **`//` line comments inside CSS template literals**. Known
locations (at `c530133`): `app/components/shared/Button.jsx:22,24,37,42,46`,
`app/components/shared/Layout.jsx:57,58`, `app/components/shared/Section.jsx:22`,
`app/components/shared/SplitButton.jsx:21,34`. CSS has no `//` comment syntax;
the CSS parser changed between styled-components 3 and 6, so convert them to
`/* */` to make the result parser-independent.

`keyframes` in `app/components/layout/AppUpdate.jsx:12-27` is interpolated
directly inside a `styled.div` template (`animation: ${breathing} 1s ...`).
That form is valid in v6 — **no change needed**. (The `css` helper is only
required when keyframes are interpolated inside a plain string returned from a
function; this repo has no such case.) No `injectGlobal`, `.extend`,
`withComponent`, `innerRef` (styled), `.attrs`, `ThemeProvider` or
`createGlobalStyle` is used. (`provided.innerRef` in
`app/components/form/hoc/_withDragNDrop.jsx` and `_withDraggable.jsx` belongs
to react-beautiful-dnd, not styled-components — leave it.)

### Cross-window import convention

Other windows already import shared components from `app/`:
`preview/index.jsx` has `import ErrorBoundary from '../app/components/shared/ErrorBoundary';`.
Follow that convention for the new shared root component.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install from lockfile | `npm ci` | exit 0 |
| Tests | `npm test` | exit 0 |
| Reducer/action tests only | `npx vitest run app/reducers app/actions preview` | all pass |
| Build | `npm run build` | exit 0 |
| Removed packages | `npm ls recompose redux-logger` | `(empty)` |
| Smoke run on data copy | see Step 8 | app works |

## Suggested executor toolkit

- styled-components v6 migration FAQ: https://styled-components.com/docs/faqs#what-do-i-need-to-do-to-migrate-to-v6
- react-i18next HOC migration (translate → withTranslation): https://react.i18next.com/latest/migrating-v9-to-v10
- Redux 5 / React-Redux 9 / Reselect 5 migration: https://redux.js.org/usage/migrations/migrating-rtk-2

## Scope

**In scope** (the only files you should modify):
- `package.json`, `package-lock.json`
- The 9 files that import `recompose` (listed above)
- `i18n/i18n.js`
- `app/reducers/InvoicesReducer.jsx`, `app/reducers/ContactsReducer.jsx`, `app/reducers/FormReducer.jsx` (selectors only)
- `app/store/index.jsx`, `preview/index.jsx` (logger removal + root wrapper)
- `app/index.jsx`, `modal/index.jsx`, `tour/index.jsx` (root wrapper only)
- `app/components/shared/StyledRoot.jsx` (create)
- `app/components/shared/Button.jsx`, `Layout.jsx`, `Section.jsx`, `SplitButton.jsx` (CSS comment syntax only), plus any other `.jsx` where you find a `//` comment inside a styled template (Step 6)
- Test files under `app/**/__tests__`, `app/**/_tests_`, `preview/**/__test__` only if a test breaks because of a library API change (record each change)

**Out of scope** (do NOT touch, even though they look related):
- `react-addons-shallow-compare` — it **looks** unused, but `react-dates` 12 declares it as a peer dependency. Plan 006 removes it together with `react-dates`.
- `react-motion`, `react-dates`, `react-dnd`, `react-beautiful-dnd`, `react-color`, `rc-progress`, `uuid`, `moment` — plan 006.
- Do not remove `prop-types` usage or `defaultProps` — plan 008.
- Do not convert components to hooks or class components to functions.
- Do not change translation JSON/JS files under `i18n/<lang>/`.
- Do not change `createStore` to `configureStore` (Redux Toolkit). `createStore` still works in Redux 5; moving to RTK is a separate refactor nobody asked for.
- The `interpolation.function` key in `i18n/i18n.js` is dead config (i18next never reads a key named `function`). Leave it; removing it is unrelated cleanup.

## Git workflow

- Branch: `upgrade/electron-45` (stay on it).
- One commit per step. Short imperative subject, no prefix, no AI attribution (e.g. `Replace recompose compose with redux compose`).
- Do NOT push.

## Steps

### Step 1: Declare lodash and prop-types

```bash
npm install lodash@^4.18.1 prop-types@^15.8.1
```

**Verify**: `node -p "const p=require('./package.json').dependencies; [p.lodash, p['prop-types']]"` → two version ranges, not `undefined`. `npm test` → exit 0.

### Step 2: Upgrade Redux, react-redux, reselect, redux-actions

```bash
npm install redux@^5 react-redux@^9 reselect@^5 redux-actions@^3.0.3
```

Then replace the 3 identity selectors with plain input selectors (same name,
same export, no `createSelector`):

```js
// app/reducers/InvoicesReducer.jsx
export const getInvoices = state => state.invoices;
// app/reducers/ContactsReducer.jsx
export const getContacts = state => state.contacts;
// app/reducers/FormReducer.jsx
export const getCurrentInvoice = state => state.form;
```

Remove the now-unused `getInvoicesState` / `getContactsState` constants only
if nothing else in the file uses them (`grep -n getInvoicesState app/reducers/InvoicesReducer.jsx`).
Keep `getFormState` — other selectors in `FormReducer.jsx` use it.

**Verify**:
- `npm ls redux react-redux reselect redux-actions` → `5.x`, `9.x`, `5.x`, `3.0.x`, no `invalid`.
- `npx vitest run app/reducers app/actions app/middlewares preview` → all pass.
- `npm run build` → exit 0.

### Step 3: Replace recompose `compose` with redux `compose`

In each of the 9 files, change `import { compose } from 'recompose';` to
`import { compose } from 'redux';`. If the file already imports from `redux`
(e.g. `import { bindActionCreators } from 'redux';`), merge into one import:
`import { bindActionCreators, compose } from 'redux';`.

Then `npm uninstall recompose`.

**Verify**:
- `grep -rn "recompose" app preview tour modal package.json` → no output.
- `npm ls recompose` → `(empty)`.
- `npm test` → exit 0.

### Step 4: Upgrade i18next and react-i18next

```bash
npm install i18next@^26 react-i18next@^17
```

In `i18n/i18n.js`:
1. `import { reactI18nextModule } from 'react-i18next';` → `import { initReactI18next } from 'react-i18next';`
2. `i18n.use(reactI18nextModule).init({` → `i18n.use(initReactI18next).init({`
3. Add `initAsync: false,` as the first option (resources are inline; this makes `i18n.t` usable synchronously right after `init`, as the code assumes).
4. Replace the whole `react: { wait: false, bindI18n: false, bindStore: false, nsMode: false }` block with `react: { useSuspense: false },`. (`wait` was renamed `useSuspense`. The other three keys are v7-only; the v17 defaults re-render translated components when `changeLanguage` is called, which is what the language switch in Settings needs.)
5. Change nothing else in the file.

In the 8 `translate` files:
- `import { translate } from 'react-i18next';` → `import { withTranslation } from 'react-i18next';`
- `translate()` → `withTranslation()`
- `tour/Tour.jsx`: `translate(['common', 'tour'])` → `withTranslation(['common', 'tour'])`

`withTranslation` injects the same `t` and `i18n` props.

**Verify**:
- `grep -rn "translate()\|translate(\[\|reactI18nextModule\|from 'react-i18next'.*translate" app preview tour i18n` → no output.
- `npm ls i18next react-i18next` → `26.x`, `17.x`, no `invalid`.
- `npm test` → exit 0.
- `npm run build` → exit 0.

### Step 5: Remove redux-logger

1. `app/store/index.jsx`: delete the `import Logger from 'redux-logger';` line and the `middlewares.push(Logger);` line. Keep `middlewares.unshift(MeasureMW);` inside the dev check.
2. `preview/index.jsx`: delete the `import Logger from 'redux-logger';` line and change `composeEnhancers(applyMiddleware(Logger))` to `composeEnhancers(applyMiddleware())`.
3. `npm uninstall redux-logger`

**Verify**: `grep -rn "redux-logger\|Logger" app/store preview/index.jsx package.json` → no output. `npm run build` → exit 0.

### Step 6: Upgrade styled-components to v6

```bash
npm install styled-components@^6 @emotion/is-prop-valid
```

1. Create `app/components/shared/StyledRoot.jsx`:
   ```jsx
   // Restores styled-components v5 behavior: only valid HTML attributes
   // reach DOM elements. See https://styled-components.com/docs/faqs#what-do-i-need-to-do-to-migrate-to-v6
   import React from 'react';
   import isPropValid from '@emotion/is-prop-valid';
   import { StyleSheetManager } from 'styled-components';

   function shouldForwardProp(propName, target) {
     if (typeof target === 'string') return isPropValid(propName);
     return true;
   }

   export default function StyledRoot({ children }) {
     return (
       <StyleSheetManager shouldForwardProp={shouldForwardProp}>
         {children}
       </StyleSheetManager>
     );
   }
   ```
2. In the 4 entry files, wrap the outermost element passed to `.render(...)` with `<StyledRoot>…</StyledRoot>` and import it:
   - `app/index.jsx`: `import StyledRoot from './components/shared/StyledRoot';`
   - `preview/index.jsx`, `modal/index.jsx`, `tour/index.jsx`: `import StyledRoot from '../app/components/shared/StyledRoot';`
3. Convert `//` comments inside styled CSS templates to `/* … */`. Known lines: `app/components/shared/Button.jsx:22,24,37,42,46`, `Layout.jsx:57,58`, `Section.jsx:22`, `SplitButton.jsx:21,34` (line numbers at `c530133`). Example: `  // Block Level Button` → `  /* Block Level Button */`. Then list other candidates with `grep -rn "^\s\+//" --include='*.jsx' app preview tour modal` and convert **only** lines that sit between a ``styled.x` `` / ``styled(X)` `` / ``css` `` / ``keyframes` `` opening line and its closing backtick. Do not touch JavaScript comments.

**Verify**:
- `npm ls styled-components` → `6.x`, no `invalid`.
- `grep -c "StyledRoot" app/index.jsx preview/index.jsx modal/index.jsx tour/index.jsx` → at least `3` per file (import + open + close tag).
- `grep -n "^\s*//" app/components/shared/Button.jsx` → only line 1 (`// Libraries`) and line 5 (`// Styles`) remain.
- `npm test` → exit 0.
- `npm run build` → exit 0.

### Step 7: Check peer dependency state

Run `npm ls 2>&1 | grep -i "invalid\|ERESOLVE\|peer" | head -20`.

Expected: only lines for `react-motion` and `react-dates` (and
`react-addons-shallow-compare` if listed) — the libraries plan 006 replaces.
Write the output into your report.

**Verify**: no line mentions `react-redux`, `recompose`, `react-i18next` or `styled-components`.

### Step 8: Smoke-test on a COPY of user data

Never point the app at `~/Library/Application Support/Manta`.

```bash
rm -rf /tmp/manta-copy && cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-copy
MANTA_USER_DATA=/tmp/manta-copy npm run dev
```

1. Invoices list shows the existing invoices; Contacts list shows contacts (Redux state loads).
2. Buttons look as before: primary buttons blue, danger buttons red, block buttons full width (styled-components + comment fix).
3. Settings → General → change Language to Deutsch → menu labels and form labels change to German **without a restart** → change back to English.
4. Create tab: fill a recipient, add an item, save → the invoice appears in the list.
5. Preview window opens and shows the invoice with translated labels.
6. Tour: Help menu → "Show Tutorial" → tour shows text, not raw keys → finish it.
7. DevTools Console in each window: no red errors; no `React does not recognize the '…' prop on a DOM element` warnings; no `styled-components: it looks like an unknown prop` warnings; no reselect `identity function` warnings.

**Verify**: all 7 points hold; report pass/fail per point.

## Test plan

- No new behavior → no new test files. The existing action, reducer and middleware specs (pure Redux) are the regression net for Steps 2–3; the Testing Library component specs from plan 004 cover Steps 3–4 and 6.
- If a spec breaks only because of a library API change (e.g. a reducer test that asserted `getInvoices` was a memoized selector), update the spec to the new API and list it in the commit body. Never change an expected value to make a test pass without explaining why in the commit body.
- Verification: `npm test` → all pass.

## Done criteria

ALL must hold:

- [ ] `npm ls redux react-redux reselect redux-actions i18next react-i18next styled-components` → `5.x`, `9.x`, `5.x`, `3.0.x`, `26.x`, `17.x`, `6.x`, no `invalid`
- [ ] `npm ls recompose redux-logger` → `(empty)`
- [ ] `grep -rn "recompose\|redux-logger\|reactI18nextModule\|translate()" app preview tour modal i18n` → no output
- [ ] `node -p "Object.keys(require('./package.json').dependencies).filter(k=>['lodash','prop-types','@emotion/is-prop-valid'].includes(k)).length"` → `3`
- [ ] `npm test` exits 0
- [ ] `npm run build` exits 0
- [ ] Smoke test (Step 8) passes on a data copy
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any precondition fails.
- After Step 4 the UI shows raw keys (e.g. `form:fields:items:name`) instead of text. That means i18next 26 resolves colon-separated nested keys differently; report the exact key and the i18next version. Do not change `nsSeparator` / `keySeparator` or translation files on your own.
- `redux-actions` 3 fails to import (ESM error) in the build or in Vitest.
- A reducer/action/middleware test fails and the cause is not a pure API rename.
- After Step 6, a screen looks visibly different (missing borders, wrong colors, broken layout) and converting `//` comments does not fix it.
- Language switch in Step 8.3 needs an app restart to take effect after you made the Step 4 change (report — this would mean the `react` options mapping is wrong).
- Any smoke step shows fewer invoices or contacts than before.

## Maintenance notes

- `StyledRoot` must wrap every new window root. A window rendered without it will forward unknown props to the DOM and spam warnings.
- New styled components may use transient props (`$primary`) instead of relying on `StyledRoot`; that is the v6-native style. A later cleanup could convert the 20 prop-interpolating files and delete `StyledRoot` + `@emotion/is-prop-valid`. Deferred: high churn, no user value now.
- `react-redux` 9 still supports `connect`. Moving to hooks (`useSelector`) is optional and deferred.
- After this plan, `.npmrc` `legacy-peer-deps=true` is still needed only for `react-motion` and `react-dates`. Plan 006 removes both and deletes `.npmrc`.
- Reviewer focus: the `react` block in `i18n/i18n.js`, the 3 selector rewrites (must return the same object as before), and that no JavaScript comment was converted in Step 6.
