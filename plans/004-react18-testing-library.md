# Plan 004: Run Manta on React 18.3 and test components with Testing Library

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- app/index.jsx preview/index.jsx modal/index.jsx tour/index.jsx app/components app/containers package.json`
> Plans 001–003 change some of these files on purpose (see "Preconditions").
> Compare the live code with the "Current state" excerpts. If a difference is
> NOT explained by the preconditions, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/001-npm-node24-vitest-baseline.md, plans/002-electron45-electron-vite-boot.md, plans/003-main-process-api-electron-store.md
- **Category**: migration
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

Manta uses React 16.2 (2017). Every replacement library that later plans need
(`react-redux` 9, `@hello-pangea/dnd`, `motion`, `@testing-library/react` 16)
requires React 18 or newer. React's documented upgrade path is to go to 18.3
first: 18.3 runs all the old APIs but prints a warning for each API that
React 19 removes. That gives plan 008 (React 19) an exact list of what to fix.

The component tests use Enzyme. Enzyme has no adapter for React 17, 18 or 19,
so the tests stop working the moment React changes. This plan moves the
component tests to Testing Library in the same change, so the test suite stays
green and keeps protecting behavior during plans 005–008.

## Preconditions (produced by plans 001–003 — verify, STOP if missing)

| Precondition | Verify command | Expected |
|---|---|---|
| npm with lockfile, no Yarn | `ls package-lock.json yarn.lock` | `package-lock.json` exists, `yarn.lock` does not |
| Vitest is the test runner | `node -p "require('./package.json').scripts.test"` | `vitest run` |
| Tests pass before you start | `npm test` | exit 0 |
| Electron 45 + electron-vite | `node -p "require('./package.json').devDependencies.electron"` | starts with `^45` or `45` |
| Build works | `npm run build` | exit 0 |
| react-hot-loader is gone | `grep -rn "react-hot-loader" app preview modal tour package.json` | no output |
| Renderer reaches Electron through the plan-002 shim (`electron` is aliased to `libs/electron-renderer.js`) | `grep -n "window.require('electron')" libs/electron-renderer.js` | 1 line |

Also find the Vitest setup file and the mock style that plan 001 chose. You
need both later:

```bash
grep -n "setupFiles\|globals\|environment" vitest.config.* electron.vite.config.* 2>/dev/null
grep -rln "vi.fn" app | head -3; grep -rln "jest.fn" app | head -3
```

Write down: (a) the setup file path (the successor of `jest.setup.js` /
`jest.shim.js`), (b) whether `globals: true` is set, (c) whether specs use
`vi.fn()` or `jest.fn()`. Use the same mock style in every test you write.

## Current state

### Render entry points (4 files)

At `c530133`, each window renders with `ReactDOM.render`. Plan 002 removed the
`AppContainer` wrapper and `module.hot` lines, so the live code looks like
these excerpts minus those lines:

`app/index.jsx:16-26` (at `c530133`):
```jsx
// Render
ReactDOM.render(
  <Provider store={store}>
    <AppContainer>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </AppContainer>
  </Provider>,
  document.getElementById('root')
);
```

`modal/index.jsx:1-12`:
```jsx
// Prevent window to open dropped file
require('../libs/dragNdrop.js');

// Libraries
import React from 'react';
import ReactDOM from 'react-dom';
import Dialog from './Dialog';

ReactDOM.render(
  <Dialog />,
  document.getElementById('root')
);
```

`tour/index.jsx:13-18` uses the named import `render` from `react-dom`:
```jsx
render(
  <AppContainer>
    <Tour />
  </AppContainer>,
  document.getElementById('root')
);
```

`preview/index.jsx:29` uses `ReactDOM.render(<Provider store={store}>…`.

### Enzyme-based tests (24 spec files + the setup file)

`grep -rl "from 'enzyme'" --include='*.js' --include='*.jsx' .` (excluding
`node_modules`) lists 24 spec files plus `jest.setup.js` (or its successor).
Plan 001 renamed spec files that contain JSX from `.spec.js` to `.spec.jsx`, so
match them by base name. Counts from `c530133` (`its` = test cases, `snaps` =
snapshot cases, `sim` = interaction calls such as `simulate`/`setProps`):

| Spec (base name) | its | snaps | sim |
|---|---|---|---|
| app/components/contacts/__tests__/Contact.spec | 7 | 1 | 2 |
| app/components/form/__tests__/Currency.spec | 7 | 1 | 4 |
| app/components/form/__tests__/Discount.spec | 6 | 1 | 2 |
| app/components/form/__tests__/DueDate.spec | 1 | 1 | 2 |
| app/components/form/__tests__/DueDatePicker.spec | 6 | 1 | 2 |
| app/components/form/__tests__/DueDateTerms.spec | 5 | 1 | 1 |
| app/components/form/__tests__/InvoiceID.spec | 5 | 1 | 1 |
| app/components/form/__tests__/ItemRow.spec | 9 | 1 | 5 |
| app/components/form/__tests__/ItemsList.spec | 4 | 1 | 1 |
| app/components/form/__tests__/Note.spec | 5 | 1 | 1 |
| app/components/form/__tests__/Recipient.spec | 5 | 1 | 1 |
| app/components/form/__tests__/RecipientForm.spec | 3 | 1 | 1 |
| app/components/form/__tests__/RecipientsList.spec | 5 | 1 | 1 |
| app/components/form/__tests__/Settings.spec | 5 | 1 | 6 |
| app/components/form/__tests__/Tax.spec | 5 | 1 | 3 |
| app/components/invoices/__tests__/Invoice.spec | 12 | 1 | 5 |
| app/components/layout/__tests__/AppMain.spec | 2 | 0 | 0 |
| app/components/layout/__tests__/AppNav.spec | 4 | 0 | 0 |
| app/components/shared/_tests_/Button.spec | 5 | 0 | 3 |
| app/components/shared/_tests_/Layout.spec | 16 | 0 | 0 |
| app/components/shared/_tests_/Message.spec | 10 | 0 | 6 |
| app/components/shared/_tests_/Section.spec | 2 | 0 | 0 |
| app/components/shared/_tests_/SplitButton.spec | 7 | 1 | 7 |
| app/containers/__tests__/Invoices.spec | 8 | 1 | 1 |

Snapshot folders (all to be deleted):
`app/containers/__tests__/__snapshots__`,
`app/components/form/__tests__/__snapshots__`,
`app/components/invoices/__tests__/__snapshots__`,
`app/components/contacts/__tests__/__snapshots__`,
`app/components/shared/_tests_/__snapshots__`.

Example of the current style — `app/components/form/__tests__/Currency.spec.jsx` (at `c530133`):
```jsx
import renderer from 'react-test-renderer';
import { mount } from 'enzyme';
...
  it('handle change code correctly', () => {
    const selectEl = wrapper.find('select').first();
    selectEl.simulate('change', { target: { name: 'code', value: 'VND' } });
    expect(updateFieldData).toHaveBeenCalled();
    expect(updateFieldData).toHaveBeenCalledWith('currency', Object.assign({}, currency, {
      code: 'VND'
    }));
  });
...
  it('matches snapshot', () => {
    const tree = renderer.create(<Currency ... />).toJSON();
    expect(tree).toMatchSnapshot();
  });
```

Note: Enzyme `simulate` passes a **fake** event object. In the test above, the
same first `<select>` is used for `code`, `placement`, `fraction` and
`separator` by faking `target.name`. Testing Library fires **real** DOM events,
so you must select the real element with that `name`.

`app/components/shared/_tests_/Button.spec.js` (at `c530133`) — prop
pass-through checks that the project rules say to delete:
```jsx
  it('set button type as info', () => {
    const button = mount(<Button primary />);
    expect(button.props().primary).toEqual(true);
  });
```

### Old libraries that must keep running on React 18 (not replaced here)

These declare React 16 in `peerDependencies`, so `npm install` with React 18
fails with `ERESOLVE` unless legacy peer resolution is on. Their replacement
belongs to plans 005 and 006:

| Package | Declared React peer | Replaced in |
|---|---|---|
| react-motion 0.5 | `^0.14.9 \|\| ^15.3.0 \|\| ^16.0.0` | 006 |
| recompose 0.26 | `^0.14.0 \|\| ^15.0.0 \|\| ^16.0.0` | 005 |
| react-redux 5 | `^0.14.0 \|\| ^15.0.0-0 \|\| ^16.0.0-0` | 005 |
| react-i18next 7 | `^0.14.0 \|\| ^15.0.0 \|\| ^16.0.0` | 005 |
| styled-components 3 | `>=0.14.0 <17.0.0-0` | 005 |
| jest-styled-components 5 | styled-components `^2 \|\| ^3` | removed here |

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install from lockfile | `npm ci` | exit 0 |
| Tests | `npm test` | exit 0, all pass |
| One test file | `npx vitest run app/components/form/__tests__/Currency.spec.jsx` | all pass |
| Build | `npm run build` | exit 0 |
| Dep check | `npm ls enzyme` | `(empty)` |
| Smoke run on a data copy | see Step 7 | app opens, data visible |

## Suggested executor toolkit

- Testing Library queries guide: https://testing-library.com/docs/queries/about (priority: `getByRole` > `getByLabelText` > `getByText`; use `container.querySelector` only when no accessible query fits).
- React 18 upgrade guide: https://react.dev/blog/2022/03/08/react-18-upgrade-guide
- React 19 upgrade guide (to see which warnings matter later): https://react.dev/blog/2024/04/25/react-19-upgrade-guide

## Scope

**In scope** (the only files you should modify):
- `package.json`, `package-lock.json`
- `.npmrc` (plan 001 created it; create only if missing, see Step 1)
- `app/index.jsx`, `preview/index.jsx`, `modal/index.jsx`, `tour/index.jsx`
- The Vitest setup file found in "Preconditions" (successor of `jest.setup.js` / `jest.shim.js`)
- The 24 spec files listed above
- The 5 `__snapshots__` folders listed above (delete)

**Out of scope** (do NOT touch, even though they look related):
- Any component source under `app/components`, `app/containers`, `preview`, `tour`, `modal` other than the 4 entry files. React 18 runs the legacy APIs (string refs, `defaultProps`, `componentWillReceiveProps`) with warnings only. Plan 008 removes them. Changing them here mixes two risks in one diff.
- Library swaps (`react-dnd`, `react-beautiful-dnd`, `react-motion`, `react-dates`, `recompose`, `react-redux`, `styled-components`, `react-i18next`). Plans 005 and 006 own them.
- Do not add `<React.StrictMode>`. StrictMode double-invokes effects and lifecycles, and the legacy class components here are not ready for that.
- Non-component tests (actions, reducers, middlewares, helpers) — they do not use Enzyme. Leave them unchanged.

## Git workflow

- Branch: `upgrade/electron-45` (already exists from earlier plans; stay on it).
- One commit per step that changes files. Message style: short imperative subject, no prefix, no AI attribution. Examples from this repo's history: `Updated domain & email address`, `Update README.md`. Use e.g. `Upgrade React to 18.3`, `Rewrite form component tests with Testing Library`.
- Do NOT push or open a PR.

## Steps

### Step 1: Allow legacy peer dependencies temporarily

Plan 001 already created `.npmrc` with `legacy-peer-deps=true`. Run `cat .npmrc`. If the line is there, keep the file as it is and replace its content with the 3 lines below only to add the comment. If the file is missing, create it with exactly:

```
# TEMPORARY (plan 004): old React 16 libraries declare React 16 peers.
# Plan 006 removes this file after the last of them is replaced.
legacy-peer-deps=true
```

**Verify**: `cat .npmrc` → contains `legacy-peer-deps=true`.

### Step 2: Upgrade React and swap the test libraries

```bash
npm install react@18.3.1 react-dom@18.3.1
npm uninstall enzyme enzyme-adapter-react-16 react-test-renderer jest-styled-components
npm install -D @testing-library/react@^16 @testing-library/dom@^10 @testing-library/user-event@^14 @testing-library/jest-dom
```

(If `jest-styled-components` or `react-test-renderer` is already absent,
`npm uninstall` prints nothing and exits 0 — that is fine.)

**Verify**:
- `npm ls react react-dom` → both `18.3.1`, no `invalid` text.
- `npm ls enzyme react-test-renderer` → `(empty)`.
- `npm ls @testing-library/react` → `16.x`.

### Step 3: Update the Vitest setup file

In the setup file found in "Preconditions":

1. Remove the Enzyme lines (at `c530133` they were in `jest.setup.js`):
   ```js
   import Enzyme from 'enzyme';
   import Adapter from 'enzyme-adapter-react-16';
   Enzyme.configure({ adapter: new Adapter() });
   ```
2. Add `import '@testing-library/jest-dom/vitest';`
3. If `globals: true` is NOT set in the Vitest config, also add:
   ```js
   import { afterEach } from 'vitest';
   import { cleanup } from '@testing-library/react';
   afterEach(() => cleanup());
   ```
4. Keep the `requestAnimationFrame` shim (from `jest.shim.js`) if it is there — `react-motion` still needs it.

**Verify**: `grep -n "enzyme" <setup file>` → no output. `npx vitest run app/actions` → all pass (non-component tests still work).

### Step 4: Switch the 4 entry files to `createRoot`

In each of `app/index.jsx`, `preview/index.jsx`, `modal/index.jsx`, `tour/index.jsx`:

- Replace the `react-dom` import with `import { createRoot } from 'react-dom/client';`
- Replace `ReactDOM.render(<X/>, document.getElementById('root'))` (or `render(...)` in `tour/index.jsx`) with:
  ```jsx
  createRoot(document.getElementById('root')).render(
    <X />
  );
  ```
  Keep the JSX tree exactly as it is (same `Provider`, `ErrorBoundary`, etc.).
- Do not change any other line (keep `require('../libs/dragNdrop.js')`, i18n import, store creation).

**Verify**:
- `grep -rn "ReactDOM.render\|from 'react-dom'" app/index.jsx preview/index.jsx modal/index.jsx tour/index.jsx` → no output.
- `grep -rn "createRoot" app/index.jsx preview/index.jsx modal/index.jsx tour/index.jsx | wc -l` → `8` (one import + one call per file).
- `npm run build` → exit 0.

### Step 5: Rewrite the 24 Enzyme spec files

Work one folder at a time (shared → form → contacts/invoices/layout →
containers). After each file, run that file alone.

Rules for every test case (`it(...)`):

| Old test case | Action |
|---|---|
| Uses `react-test-renderer` and `toMatchSnapshot()` | **Delete** the case. |
| Empty body (`it('…', () => {})`, marked TODO) | **Delete**. |
| Checks only prop pass-through (`button.props().primary`) or fixed markup counts of static elements (`find('label')).toHaveLength(5)`, "renders 4 TD columns") | **Delete**. Project rule: no tests that only check DOM markup or prop pass-through. |
| Checks that something renders **only under a condition** (e.g. clear button shown only when a date is selected, actions hidden on first row) | **Rewrite**: render with both prop values; assert presence with `getBy…` / absence with `queryBy…` → `toBeNull()` or `not.toBeInTheDocument()`. |
| Simulates user input and asserts a callback / state result (`simulate('change')`, `simulate('click')` + `toHaveBeenCalledWith`) | **Rewrite** with `@testing-library/user-event` (`await user.click(...)`, `await user.selectOptions(...)`, `await user.type(...)`) or `fireEvent.change(el, { target: { value } })`. Keep the same `toHaveBeenCalledWith` expectations. |
| Calls `wrapper.instance().someMethod()` or `wrapper.setState` | **Rewrite** by driving the same behavior through the UI. If the behavior cannot be reached through the UI, delete the case and list it in your final report. |
| Uses `setProps` to test a prop update | **Rewrite** with `const { rerender } = render(<C {...a} />); rerender(<C {...b} />);` then assert the visible result or callback. |

Patterns:

```jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency } from '../Currency';

it('handle change placement correctly', async () => {
  const user = userEvent.setup();
  const { container } = render(<Currency t={t} currency={currency} savedSettings={savedSettings}
    updateFieldData={updateFieldData} updateSavedSettings={updateSavedSettings} />);
  await user.selectOptions(container.querySelector('select[name="placement"]'), 'after');
  expect(updateFieldData).toHaveBeenCalledWith('currency', { ...currency, placement: 'after' });
});
```

Important facts:
- Real DOM events give **string** values. Where an old test passed a number through a fake event (e.g. `fraction: 3`), first check what the component does with the value. Assert what the component really sends (for example `'3'` if it does not convert). Do not change component code to make a test pass. List every such expectation change in the commit message body.
- Mocks are shared between tests in a file. If a file reuses one `fn()` across cases, add `beforeEach(() => { updateFieldData.mockClear(); })` (or `vi.clearAllMocks()`).
- Components wrapped by HOCs (`translate()`, `connect`, `_withFadeInAnimation`, `_withDraggable`): import the **named unconnected export** as the existing test does (e.g. `import { Currency } from '../Currency'`). Pass `t={(k) => k}` or the existing mock `t`.
- `ItemRow` is wrapped by `_withDraggable` (react-beautiful-dnd) in its default export. Test the named export only. If a test needs the default export, it must render it inside `DragDropContext` + `Droppable` — prefer the named export.
- If a component needs a Redux store, it is a container — use the unconnected named export with plain props, as the old test did.

After all files: delete the 5 `__snapshots__` folders.

**Verify** (after each file): `npx vitest run <that file>` → all pass.
**Verify** (end of step):
- `grep -rln "from 'enzyme'\|react-test-renderer\|toMatchSnapshot" app preview tour modal` → no output.
- `find . -path ./node_modules -prune -o -name "__snapshots__" -print` → no output.
- `npm test` → exit 0.

### Step 6: Check React warnings in the test run

Run `npm test 2>&1 | grep -i "warning" | sort | uniq -c | sort -rn | head -40`.

Expected: warnings about `componentWillReceiveProps`, `componentWillMount`,
string refs, `defaultProps`, and legacy context. These are **expected** and are
fixed in plans 005, 006 and 008. Do not fix them.

Save the full unique list (copy the command output) into the commit message
body of the last commit of this plan, under the heading `React 18 warnings
for plan 008:`.

**Verify**: there is no line with `Error:` or `TypeError` in `npm test 2>&1`.

### Step 7: Smoke-test the real app on a COPY of user data

Never point the app at `~/Library/Application Support/Manta` (real invoices).

```bash
rm -rf /tmp/manta-copy && cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-copy
MANTA_USER_DATA=/tmp/manta-copy npm run dev
```

(If the real folder does not exist on this machine, run `npm run dev` with
`MANTA_USER_DATA=/tmp/manta-empty` and create one invoice first.)

In the app (DevTools open automatically in dev mode):
1. Main window shows the Invoices list with the existing invoices.
2. Click the "Create" (form) tab → add 2 item rows → drag the second row above the first (react-beautiful-dnd still in use).
3. Settings tab → General / Invoice / Profile render; switch the language to another one and back.
4. Pick a due date in the form (react-dates still in use).
5. Click "Preview" → the preview window renders the invoice.
6. In the DevTools Console of each window: no red `Uncaught` errors. Yellow React deprecation warnings are expected.

**Verify**: all 6 points hold. Write the result (pass/fail per point) in your report.

## Test plan

- No new behavior is added, so no new test files. The rewritten specs must keep every behavior assertion the Enzyme specs had (callbacks with exact arguments, conditional rendering), minus the deleted snapshot / markup-count / pass-through cases.
- Structural pattern: `app/components/form/__tests__/Currency.spec.jsx` after rewrite (see Step 5 example). Use it as the model for the other form specs.
- Verification: `npm test` → all pass. In your report, give: number of test cases before (`npx vitest run --reporter=verbose 2>&1 | grep -c "✓"` on the commit before Step 5) and after, and the list of deleted cases by category (snapshot / markup / pass-through / unreachable).

## Done criteria

ALL must hold:

- [ ] `npm ls react react-dom` → `18.3.1` for both
- [ ] `npm ls enzyme enzyme-adapter-react-16 react-test-renderer jest-styled-components` → `(empty)`
- [ ] `grep -rn "ReactDOM.render" app preview modal tour` → no output
- [ ] `grep -rln "from 'enzyme'\|react-test-renderer\|toMatchSnapshot" app preview tour modal` → no output
- [ ] `find . -path ./node_modules -prune -o -name "__snapshots__" -print` → no output
- [ ] `npm test` exits 0
- [ ] `npm run build` exits 0
- [ ] `.npmrc` exists and contains `legacy-peer-deps=true`
- [ ] Smoke test (Step 7) passes on a data copy
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any precondition in the table fails (plans 001–003 not done, or done differently).
- `npm install react@18.3.1` fails even with `.npmrc` `legacy-peer-deps=true`.
- One of the old libraries (`react-dnd` 2, `react-beautiful-dnd` 2, `react-motion`, `react-dates` 12, `recompose`, `react-redux` 5, `styled-components` 3, `react-i18next` 7) **throws** at runtime on React 18 (red error, blank window, or a test that crashes inside the library). Report the library, the error text and the stack. Do not swap the library here — plans 005/006 own that.
- A rewritten test can pass only if you change component source code.
- More than 3 test cases fall into the "cannot be reached through the UI" category.
- The smoke test shows fewer invoices or contacts than the original app (possible data problem — do not continue).

## Maintenance notes

- `.npmrc` with `legacy-peer-deps=true` is temporary. Plan 006 deletes it after the last React-16-only library is gone. Do not let it stay: it hides real peer conflicts.
- React 18 batches all state updates automatically (also in `ipc.on` callbacks and timeouts). If a reviewer sees a UI that updates "one step late", look first at class components that read `this.state` right after `setState` in IPC handlers (e.g. `app/components/layout/AppUpdate.jsx`).
- The warning list saved in Step 6 is the input for plan 008 (React 19). Plan 008 must clear all of it.
- Reviewer focus: every deleted test case must fit one of the delete rules in Step 5. Check that interaction tests still assert the same callback arguments.
