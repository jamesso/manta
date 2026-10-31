# Plan 006: Replace the dead UI libraries (drag and drop, animation, date picker, color picker, progress, uuid, faker)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- app/components/form/hoc app/components/form/ItemsList.jsx app/components/settings/_partials/profile app/components/shared/TransitionList.jsx app/components/shared/hoc/_withFadeInAnimation.jsx app/components/form/Settings.jsx app/components/layout/AppNav.jsx app/components/layout/AppUpdate.jsx app/components/form/DueDatePicker.jsx preview/components/sidebar/AccentColor.jsx app/middlewares app/helpers tour/components/Actions.jsx static/css/date-picker.css app/index.html __mocks__ package.json`
> Plans 001–005 change some of these files on purpose (see "Preconditions").
> Compare the live code with the "Current state" excerpts. If a difference is
> NOT explained by the preconditions, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/005-state-i18n-styling-libraries.md
- **Category**: migration
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

Seven UI and utility libraries in Manta are deprecated or unmaintained since
2017–2022 and block React 19 (plan 008): `react-beautiful-dnd` 2.4
(deprecated by its owner), `react-dnd` 2.5, `react-motion` 0.5, `react-dates`
12, `react-color` 2, `rc-progress` 2 and `uuid` 3. `faker` must go too: the
`faker` 6.6.6 release on npm was sabotaged by its author, and the maintained
fork is `@faker-js/faker`. One real bug is also fixed here: logo drag-and-drop
reads `File.path`, which Electron removed (Electron 32); on Electron 45 the
dropped logo is silently ignored.

When this plan is done, no dependency declares React 16 as its only peer, so
the temporary `.npmrc` (`legacy-peer-deps=true`) from plan 004 is deleted.

## Preconditions (verify, STOP if missing)

| Precondition | Verify command | Expected |
|---|---|---|
| React 18.3 | `npm ls react` | `react@18.3.1` |
| Plan 005 done | `npm ls styled-components react-redux recompose` | `6.x`, `9.x`, recompose `(empty)` |
| Temporary `.npmrc` | `cat .npmrc` | contains `legacy-peer-deps=true` |
| Tests pass | `npm test` | exit 0 |
| Build works | `npm run build` | exit 0 |
| Renderer reaches Electron through the plan-002 shim (`electron` is aliased to `libs/electron-renderer.js`) | `grep -n "webUtils" libs/electron-renderer.js` | 1 line (if missing, add `webUtils` to the destructured export list in that file — this is the only allowed edit to it) |

Find the Vitest setup file and config (needed in Steps 7–8):
`grep -n "setupFiles\|alias" vitest.config.* electron.vite.config.* 2>/dev/null`.

## Current state

Versions at `c530133`: `react-beautiful-dnd ^2.4.1`, `react-dnd ^2.5.3`,
`react-dnd-html5-backend ^2.5.3`, `react-motion ^0.5.1`, `react-dates ^12.6.0`,
`react-addons-shallow-compare ^15.6.2` (only a peer of `react-dates`),
`react-color ^2.13.8`, `rc-progress ^2.2.5`, `uuid ^3.2.1`, `moment ^2.21.0`,
`faker ^4.1.0` (dev).

Targets (`npm view <pkg> version`, 2026-10-31 — re-check at execution time):
`@hello-pangea/dnd 18.0.1` (peer react `^18 || ^19`), `motion 14.9.0` (peer
react `^18 || ^19`; import from `motion/react`), `react-day-picker 10.0.2`
(peer react `>=16.8`), `react-colorful 5.8.1`, `moment 2.31.0`,
`@faker-js/faker 10.6.0`.

### A. Row reordering — react-beautiful-dnd 2.4

`app/components/form/hoc/_withDragNDrop.jsx:19-31`:
```jsx
  render() {
    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="droppableList">
          {(provided, snapshot) => (
            <div ref={provided.innerRef}>
              {this.props.children}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }
```
`onDragEnd` calls `moveRow(result.source.index, result.destination.index)`.

`app/components/form/hoc/_withDraggable.jsx:5-50` (abridged):
```jsx
const _withDraggable = ComposedComponent => props => (
  <Draggable draggableId={props.item.id}>
    {(provided, snapshot) => {
      // Patched onMouseDown, make inputs selectable
      const onMouseDown = event => {
        if (event.target.nodeName === 'INPUT') { return; }
        provided.dragHandleProps.onMouseDown(event);
      };
      // Patched onKeyDown handler ...
      const onKeyDown = event => { ... provided.dragHandleProps.onKeyDown(event); };
      const patched = { ...provided.dragHandleProps, onMouseDown, onKeyDown };
      const draggableStyle = { ...provided.draggableStyle, margin: '0 0 14px 0' };
      return (
        <div>
          <div ref={provided.innerRef} style={draggableStyle}
               {...provided.dragHandleProps} {...patched}>
            <ComposedComponent {...props} />
          </div>
          {provided.placeholder}
        </div>
      );
    }}
  </Draggable>
);
```

`app/components/form/ItemsList.jsx:75-86` — rows are rendered **without** an
`index` prop:
```jsx
    const rowsComponent = rows.map((item, index) => (
      <ItemRow
        key={item.id}
        item={item}
        t={t}
        hasHandler={rows.length > 1}
        actions={index !== 0}
        updateRow={updateItem}
        removeRow={removeItem}
        addItem={addItem}
      />
    ));
```
`ItemRow.jsx:195`: `export default compose(_withDraggable)(ItemRow);`. `ItemRow`
does not use a prop named `index` today.

API differences in the current library (`@hello-pangea/dnd`, the maintained
fork of react-beautiful-dnd 13): `Draggable` **requires** a numeric `index`;
you must spread `provided.draggableProps` (it carries the style) and
`provided.dragHandleProps` (can be `null`); `Droppable` needs
`{...provided.droppableProps}`; `Draggable` has no `placeholder` (only
`Droppable` has). Drag-start from interactive elements (`input`, `textarea`,
`select`, `button`) is **blocked by default**, which is exactly what the
`onMouseDown`/`onKeyDown` patch did by hand — so the patch is deleted.
Docs: https://github.com/hello-pangea/dnd/blob/main/docs/api/draggable.md

### B. Logo drop — react-dnd 2.5 + `File.path`

`app/components/settings/_partials/profile/TargetBox.jsx` (55 lines) is a
`react-dnd` `DropTarget` that shows `'Release to drop'` / `'Drag file here'`
and calls `props.onDrop(props, monitor)`. Its inline style (lines 5-15) has a
typo, `border: '2px dashed #469FE5k'` (invalid color → no border is drawn).

`app/components/settings/_partials/profile/Logo.jsx:111-117, 127-149, 164`:
```jsx
  handleFileDrop(item, monitor) {
    if (monitor) {
      const droppedFiles = monitor.getItem().files;
      const filePath = droppedFiles[0].path;
      this.handleFileUpload(filePath);
    }
  }
...
  render() {
    const { FILE } = NativeTypes;
    ...
          <LogoDropzone>
            <TargetBox
              accepts={[FILE]}
              selectLogo={this.selectLogo}
              onDrop={this.handleFileDrop}
            />
...
export default DragDropContext(HTML5Backend)(Logo);
```
`droppedFiles[0].path` uses `File.path`, removed from Electron in favor of
`webUtils.getPathForFile(file)`
(https://www.electronjs.org/docs/latest/api/web-utils). While renderer Node
integration is on (until plan 009), the renderer can call
`webUtils.getPathForFile(file)` with `import { webUtils } from 'electron';` (plan 002 aliases `electron` to the shim `libs/electron-renderer.js`, which re-exports `webUtils`).

`libs/dragNdrop.js:1-3` blocks the window from navigating to a dropped file;
it must keep working:
```js
// Prevent window to open dropped file
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());
```

### C. Animations — react-motion 0.5 (5 files), decision per file

| File | What it animates | Replacement (smallest code) |
|---|---|---|
| `app/components/form/hoc/_withAnimation.jsx` | Absolute `top` per row | **Delete** — not imported anywhere (`grep -rn "_withAnimation'" app` → only `_withFadeInAnimation` matches) |
| `app/components/shared/hoc/_withFadeInAnimation.jsx` | Opacity 0→1 on mount (`spring(1, presets.gentle)`); used by 17 components | CSS keyframes via styled-components |
| `app/components/form/Settings.jsx:111-197` | Panel height 45↔180px and arrow rotate 0↔180° on `open` | CSS `transition` |
| `app/components/layout/AppNav.jsx:108-119` | Active-tab indicator `top` % with a bouncy spring | CSS `transition` |
| `app/components/shared/TransitionList.jsx` | List items: enter (height 0→N, fade in) **and exit** (height→0, fade out) | `motion` `AnimatePresence` — the only case that needs exit animation |

`_withFadeInAnimation.jsx:40-60` (at `c530133`):
```jsx
const _withFadeInTransition = ComposedComponent => props => {
  const wrapperStyle = { height: '100%' };
  return (
    <TransitionMotion willEnter={() => willEnter()} willLeave={() => willLeave()}
      defaultStyles={getDefaultStyles()} styles={getStyles()}>
      {values => (
        <div style={wrapperStyle}>
          {values.map(({ key, style }) => (
            <div key={key} style={{ ...style, ...wrapperStyle }}>
              <ComposedComponent {...props} />
            </div>
          ))}
        </div>
      )}
    </TransitionMotion>
  );
};
```
(There is only one fixed key, so `willLeave` never runs; it is a mount fade-in.)

`app/components/form/Settings.jsx:107-125` (at `c530133`):
```jsx
    return (
      <Motion
        style={{
          height: spring(open ? 180 : 45),
          rotate: spring(open ? 180 : 0),
        }}
      >
        {({ height, rotate }) => (
          <Wrapper style={{ height: `${height}px` }}>
            <SettingsHeader href="#" onClick={toggleFormSettings}>
              <Label>{t('form:settings:name')}</Label>
              <div
                style={{
                  transform: `rotate(${rotate}deg)`,
                }}
              >
```
…and closes at lines 195-197 with `</Wrapper>` / `)}` / `</Motion>`.

`app/components/layout/AppNav.jsx:9-13, 108-119` (at `c530133`):
```jsx
const springConfig = { stiffness: 350, damping: 18, precision: 0.01 };
...
        <Motion style={{ marginTop: spring(marginTopValue, springConfig) }}>
          {({ marginTop }) => (
            <ActiveIndicator>
              <div
                style={{
                  height: `${100 / allTabs.length}%`,
                  top: `${marginTop}%`,
                }}
              />
            </ActiveIndicator>
          )}
        </Motion>
```

`app/components/shared/TransitionList.jsx` (85 lines): `TransitionMotion` with
default style `{height: componentHeight, opacity: 0}`, target
`{height: spring(componentHeight), opacity: spring(1)}`, `willEnter`
`{height: 0, opacity: 0}`, `willLeave` `{height: spring(0), opacity: spring(0)}`.
Each child is wrapped in `<div key={key} style={style}>`. Props:
`children` (array of keyed elements), `componentHeight` (number). Used by
`app/components/form/ItemsList.jsx` (`componentHeight={50}`) and
`app/components/layout/AppNoti.jsx` (`componentHeight={90}`).

### D. Due date — react-dates 12

`app/components/form/DueDatePicker.jsx:27-64` (at `c530133`):
```jsx
  onFocusChange() {
    this.setState({ focused: !this.state.focused });
  }

  onDateChange(date) {
    const selectedDate = date === null ? null : moment(date).toObject();
    this.props.updateCustomDate(selectedDate);
  }
  ...
  render() {
    const { t, selectedDate } = this.props;
    const dueDate = selectedDate === null ? null : moment(selectedDate);
    return (
      <Container>
        <SingleDatePicker
          id="invoice-duedate"
          placeholder={t('form:fields:dueDate:placeHolder')}
          firstDayOfWeek={1}
          withFullScreenPortal
          displayFormat="DD/MM/YYYY"
          hideKeyboardShortcutsPanel
          date={dueDate}
          focused={this.state.focused}
          onFocusChange={this.onFocusChange}
          onDateChange={newDate => this.onDateChange(newDate)}
        />
        {selectedDate !== null && (
          <a className="clearDateBtn active" href="#" onClick={this.clearDate}>
            <i className="ion-close-circled" />
          </a>
        )}
      </Container>
    );
  }
```

**Data contract (must not change):** the stored due date is
`moment(date).toObject()` — `{ years, months, date, hours, minutes, seconds, milliseconds }`.
Saved invoices in PouchDB hold this shape; the invoice list, preview templates
and `app/helpers` read it back with `moment(obj)`.

`static/css/date-picker.css` (964 lines) is react-dates' stylesheet (lines
1–942) plus app rules at lines 943–964 (`.dueDateContent`, `.clearDateBtn`,
`.clearDateBtn:hover`, `.clearDateBtn.active`). It is linked from
`app/index.html:14`: `<link rel="stylesheet" href="../static/css/date-picker.css"></link>`
(plan 002 may have moved this link — find it with `grep -rn "date-picker.css" app`).
The old theme colored the selected day `#469fe5` (lines 937-941).

The app language is in i18next (`i18n/i18n.js` default export, `i18n.language`).
react-dates used moment's locale for month names; react-day-picker uses
date-fns locales exported from `react-day-picker/locale`.

### E. Accent color — react-color

`preview/components/sidebar/AccentColor.jsx:13-15, 28-38`:
```jsx
  handleChange(color) {
    this.props.handleAccentColorChange(color.hex);
  }
  ...
        <BlockPicker
          width="100%"
          colors={defaultColors}
          color={accentColor}
          onChange={this.handleChange}
          triangle="hide"
        />
```
`defaultColors` is an 8-item array of hex strings (lines 18-27). `BlockPicker`
= a big swatch of the current color + 8 small swatches + a hex text input.

### F. Update progress — rc-progress

`app/components/layout/AppUpdate.jsx:4, 177-185`:
```jsx
import { Circle } from 'rc-progress';
...
        {this.state.downloading && (
          <Circle
            percent={this.state.progress}
            strokeWidth={16}
            trailWidth={16}
            trailColor="#4F555C"
            strokeColor="#469FE5"
          />
        )}
```
The `Indicator` styled div (lines 17-31) sizes `svg` to 24×24.

### G. IDs — uuid 3 (`uuid/v4`)

Source imports (`import uuidv4 from 'uuid/v4';`): `app/middlewares/UIMiddleware.jsx:3`,
`app/middlewares/InvoicesMW.jsx:2`, `app/middlewares/ContactsMW.jsx:2` (imported,
not called), `app/middlewares/FormMW.jsx:3`, `app/helpers/form.js:6`,
`tour/components/Actions.jsx:3`. Test-side: `app/helpers/__mocks__/pouchDB.js:2`,
`app/middlewares/__tests__/InvoicesMW.spec.js`, `app/helpers/__tests__/form.spec.js`,
`app/reducers/__tests__/FormReducer.spec.js`, `ContactsReducer.spec.js`,
`InvoicesReducer.spec.js`, `preview/reducers/__test__/index.spec.js`.

Tests depend on a fixed id: `__mocks__/uuid/v4.js` is
`module.exports = jest.fn(() => 'id-string');` and
`app/middlewares/__tests__/UIMiddleware.spec.js:53,70` expect `id: 'id-string'`.

`tour/components/Actions.jsx:38-41` uses a new random uuid as a React key on
every render (forces remounts):
```jsx
  for (let i = 0; i < totalSlide; i++) {
    indicators.push(<Dot key={uuidv4()} active={i + 1 === currentSlide} />);
  }
```

`crypto.randomUUID()` is built into Chromium (Electron renderer, `file://`
is a secure context) and Node 24.

### H. faker 4 (tests only)

Imported as `import faker from 'faker';` in 8 files:
`app/middlewares/__tests__/InvoicesMW.spec.js`, `ContactsMW.spec.js`,
`app/helpers/__mocks__/pouchDB.js`, `app/reducers/__tests__/FormReducer.spec.js`,
`ContactsReducer.spec.js`, `InvoicesReducer.spec.js`,
`preview/reducers/__test__/index.spec.js`, `app/helpers/__tests__/form.spec.js`.

| faker 4 call (count) | @faker-js/faker 10 |
|---|---|
| `faker.name.findName()` (31) | `faker.person.fullName()` |
| `faker.internet.email()` (25) | same |
| `faker.commerce.productName()` (12) | same |
| `faker.company.companyName()` (12) | `faker.company.name()` |
| `faker.commerce.price()` (11) | same (returns a string, as before) |
| `faker.phone.phoneNumber()` (11) | `faker.phone.number()` |
| `faker.random.number(10 \| 20 \| 100)` (11) | `faker.number.int({ max: N })` |
| `faker.lorem.paragraph()` (3) | same |
| `faker.date.future()` (2) | same |

Import: `import { faker } from '@faker-js/faker';`

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install from lockfile | `npm ci` | exit 0 |
| Tests | `npm test` | exit 0 |
| One file | `npx vitest run app/components/form/__tests__/DueDatePicker.spec.jsx` | all pass |
| Build | `npm run build` | exit 0 |
| Removed packages | `npm ls react-beautiful-dnd react-dnd react-dnd-html5-backend react-motion react-dates react-addons-shallow-compare react-color rc-progress uuid faker` | `(empty)` |
| Smoke run on data copy | see Step 10 | all flows work |

## Suggested executor toolkit

- @hello-pangea/dnd Draggable/Droppable API: https://github.com/hello-pangea/dnd/tree/main/docs/api
- Motion for React (`AnimatePresence`): https://motion.dev/docs/react-animate-presence
- react-day-picker: https://daypicker.dev (single mode, `weekStartsOn`, `locale`, styling with `react-day-picker/style.css` and `--rdp-accent-color`)
- react-colorful: https://github.com/omgovich/react-colorful (`HexColorInput`)
- Electron `webUtils.getPathForFile`: https://www.electronjs.org/docs/latest/api/web-utils

## Scope

**In scope** (the only files you should modify):
- `package.json`, `package-lock.json`, `.npmrc` (delete in Step 9)
- A: `app/components/form/hoc/_withDragNDrop.jsx`, `app/components/form/hoc/_withDraggable.jsx`, `app/components/form/ItemsList.jsx` (add `index` prop only)
- B: `app/components/settings/_partials/profile/TargetBox.jsx`, `app/components/settings/_partials/profile/Logo.jsx`
- C: `app/components/form/hoc/_withAnimation.jsx` (delete), `app/components/shared/hoc/_withFadeInAnimation.jsx`, `app/components/form/Settings.jsx`, `app/components/layout/AppNav.jsx`, `app/components/shared/TransitionList.jsx`
- D: `app/components/form/DueDatePicker.jsx`, `static/css/date-picker.css`, the HTML/CSS link to it, `app/components/form/__tests__/DueDatePicker.spec.jsx`, `app/components/form/__tests__/DueDate.spec.jsx` (remove the `react-dates` import only)
- E: `preview/components/sidebar/AccentColor.jsx`
- F: `app/components/layout/AppUpdate.jsx` (progress element only)
- G: the 6 source files and 7 test-side files listed in section G, `__mocks__/uuid/` (delete), the Vitest config alias for `uuid/v4` and the Vitest setup file
- H: the 8 faker files listed in section H
- New tests: `app/components/settings/_partials/profile/__tests__/Logo.spec.jsx`, `preview/components/sidebar/__tests__/AccentColor.spec.jsx` (create)

**Out of scope** (do NOT touch, even though they look related):
- `moment` usage anywhere. Only bump its version. Saved settings store moment format tokens (`invoice.dateFormat: 'MM/DD/YYYY'`) and saved invoices store `moment().toObject()` dates; replacing moment would need a data migration.
- `app/helpers/image.js` / `processImg` (jimp) — plan 009 moves image processing to the main process.
- `libs/dragNdrop.js` — keep as is.
- The logo IPC flow (`open-file-dialog` / `file-selected`) — plan 009.
- Legacy React APIs in the touched files (string refs, `defaultProps`, `componentWillReceiveProps`) — plan 008. Do not convert class components to hooks.
- Visual redesign. Match current look and timing as closely as stated in each step.

## Git workflow

- Branch: `upgrade/electron-45` (stay on it).
- One commit per lettered section (A–H) plus one for Step 9. Short imperative subject, no prefix, no AI attribution (e.g. `Replace react-beautiful-dnd with @hello-pangea/dnd`).
- Do NOT push.

## Steps

### Step 1 (A): Row reordering with @hello-pangea/dnd

```bash
npm install @hello-pangea/dnd@^18
npm uninstall react-beautiful-dnd
```

1. `_withDragNDrop.jsx`: change the import to `from '@hello-pangea/dnd'`. In the `Droppable` render function use:
   ```jsx
   {provided => (
     <div ref={provided.innerRef} {...provided.droppableProps}>
       {this.props.children}
       {provided.placeholder}
     </div>
   )}
   ```
2. `_withDraggable.jsx`: replace the whole HOC with:
   ```jsx
   import React from 'react';
   import { Draggable } from '@hello-pangea/dnd';

   // Inputs inside a row stay usable: the library does not start a drag
   // from input/textarea/select/button elements.
   const _withDraggable = ComposedComponent => props => (
     <Draggable draggableId={props.item.id} index={props.index}>
       {provided => (
         <div
           ref={provided.innerRef}
           {...provided.draggableProps}
           {...(provided.dragHandleProps || {})}
           style={{ ...provided.draggableProps.style, margin: '0 0 14px 0' }}
         >
           <ComposedComponent {...props} />
         </div>
       )}
     </Draggable>
   );

   export default _withDraggable;
   ```
3. `ItemsList.jsx`: add `index={index}` to the `<ItemRow …>` props (inside the existing `rows.map((item, index) => …)`). Change nothing else in this file.

**Verify**:
- `grep -rn "react-beautiful-dnd" app package.json` → no output.
- `npx vitest run app/components/form` → all pass.
- `npm run build` → exit 0.

### Step 2 (B): Logo drop without react-dnd, with `webUtils.getPathForFile`

```bash
npm uninstall react-dnd react-dnd-html5-backend
```

1. Rewrite `TargetBox.jsx` as a plain component (keep the file name and default export):
   ```jsx
   import React, { Component } from 'react';
   import PropTypes from 'prop-types';

   const style = {
     flex: '1',
     background: '#F9FAFA',
     border: '2px dashed #469FE5',
     borderRadius: '4px',
     marginBottom: '20px',
     display: 'flex',
     alignItems: 'center',
     justifyContent: 'center',
     margin: '-20px',
   };

   class TargetBox extends Component {
     constructor(props) {
       super(props);
       this.state = { isOver: false };
       this.onDragOver = this.onDragOver.bind(this);
       this.onDragLeave = this.onDragLeave.bind(this);
       this.onDrop = this.onDrop.bind(this);
     }

     onDragOver(event) {
       event.preventDefault();
       if (!this.state.isOver) this.setState({ isOver: true });
     }

     onDragLeave() {
       this.setState({ isOver: false });
     }

     onDrop(event) {
       event.preventDefault();
       this.setState({ isOver: false });
       const file = event.dataTransfer.files[0];
       if (file && this.props.onDrop) this.props.onDrop(file);
     }

     render() {
       return (
         <div style={style} onDragOver={this.onDragOver}
              onDragLeave={this.onDragLeave} onDrop={this.onDrop}>
           {this.state.isOver ? 'Release to drop' : 'Drag file here'}
         </div>
       );
     }
   }

   TargetBox.propTypes = { onDrop: PropTypes.func };

   export default TargetBox;
   ```
   (The `'#469FE5k'` typo is fixed to `'#469FE5'` on purpose — the dashed border was never drawn.)
2. In `Logo.jsx`:
   - Delete the two `react-dnd` imports (lines 5-7 at `c530133`) and `const { FILE } = NativeTypes;`.
   - Replace `handleFileDrop` with:
     ```jsx
     handleFileDrop(file) {
       this.handleFileUpload(webUtils.getPathForFile(file));
     }
     ```
     and add `webUtils` to the file's existing `import { … } from 'electron';` line (add `import { webUtils } from 'electron';` if the file has none).
   - Change `<TargetBox accepts={[FILE]} selectLogo={this.selectLogo} onDrop={this.handleFileDrop} />` to `<TargetBox onDrop={this.handleFileDrop} />`.
   - Change the last line to `export default Logo;`.

**Verify**:
- `grep -rn "react-dnd\|NativeTypes\|\.path\b" app/components/settings` → no output.
- `npm run build` → exit 0.

### Step 3 (C): Animations without react-motion

```bash
npm install motion@^14
```

1. Delete `app/components/form/hoc/_withAnimation.jsx` after confirming `grep -rn "hoc/_withAnimation" app` → no output.
2. `_withFadeInAnimation.jsx` — replace the file body with a styled-components fade-in. Keep the default export and the HOC signature:
   ```jsx
   import React from 'react';
   import styled, { keyframes } from 'styled-components';

   const fadeIn = keyframes`
     from { opacity: 0; }
     to { opacity: 1; }
   `;

   const FadeIn = styled.div`
     height: 100%;
     animation: ${fadeIn} 400ms ease-out;
   `;

   const _withFadeInTransition = ComposedComponent => props => (
     <FadeIn>
       <ComposedComponent {...props} />
     </FadeIn>
   );

   export default _withFadeInTransition;
   ```
3. `app/components/form/Settings.jsx`: remove the `react-motion` import, remove the `<Motion …>{({ height, rotate }) => (` wrapper and its closing `)}</Motion>`, and use:
   - `<Wrapper style={{ height: open ? '180px' : '45px', transition: 'height 300ms ease' }}>`
   - on the arrow `div`: `style={{ transform: \`rotate(${open ? 180 : 0}deg)\`, transition: 'transform 300ms ease' }}`
   Keep every child element unchanged.
4. `app/components/layout/AppNav.jsx`: remove the `react-motion` import and `springConfig`. Replace the `<Motion …>…</Motion>` block with:
   ```jsx
   <ActiveIndicator>
     <div
       style={{
         height: `${100 / allTabs.length}%`,
         top: `${marginTopValue}%`,
         transition: 'top 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
       }}
     />
   </ActiveIndicator>
   ```
   (The cubic-bezier overshoots slightly, like the old under-damped spring.)
5. `app/components/shared/TransitionList.jsx`: replace with `motion`:
   ```jsx
   import React from 'react';
   import PropTypes from 'prop-types';
   import { AnimatePresence, motion } from 'motion/react';

   function TransitionList({ children, componentHeight }) {
     return (
       <div>
         <AnimatePresence>
           {React.Children.map(children, child => (
             <motion.div
               key={child.key}
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: componentHeight, opacity: 1 }}
               exit={{ height: 0, opacity: 0 }}
             >
               {child}
             </motion.div>
           ))}
         </AnimatePresence>
       </div>
     );
   }

   TransitionList.propTypes = {
     children: PropTypes.arrayOf(PropTypes.element).isRequired,
     componentHeight: PropTypes.number.isRequired,
   };

   export default TransitionList;
   ```
   Note: `React.Children.map` prefixes keys (e.g. `.$abc`); that is fine because the keys stay stable between renders.
6. `npm uninstall react-motion`

**Verify**:
- `grep -rn "react-motion" app preview tour package.json` → no output.
- `npm test` → exit 0 (component specs from plan 004 render these HOCs).
- `npm run build` → exit 0.

### Step 4 (D): Due date with react-day-picker

```bash
npm install react-day-picker@^10
npm uninstall react-dates react-addons-shallow-compare
node --input-type=module -e "import('react-day-picker/locale').then(m => console.log(['de','enUS','fr','id','it','sk','ur','vi','zhCN'].every(k => k in m)))"
```
The last command must print `true`. If it prints `false` or errors, do the step
without the `locale` prop and report which names are missing.

1. Rewrite `DueDatePicker.jsx` render and handlers. Keep the class, the named export `DueDatePicker`, `propTypes`, `defaultProps`, `onDateChange`, `clearDate`, and the default export `_withFadeInAnimation(DueDatePicker)`:
   ```jsx
   import { DayPicker } from 'react-day-picker';
   import { de, enUS, fr, id, it, sk, ur, vi, zhCN } from 'react-day-picker/locale';
   import 'react-day-picker/style.css';
   import i18n from '../../../i18n/i18n';

   const LOCALES = { de, en: enUS, fr, id, it, sk, 'ur-PK': ur, vi, 'zh-CN': zhCN };

   const Overlay = styled.div`
     position: fixed;
     inset: 0;
     z-index: 1000;
     display: flex;
     align-items: center;
     justify-content: center;
     background: rgba(255, 255, 255, 0.95);
     --rdp-accent-color: #469fe5;
   `;

   const DateButton = styled.button`
     flex: 1;
     text-align: left;
     padding: 6px 12px;
     border: 1px solid #e0e1e1;
     border-radius: 4px;
     background: #fff;
     color: #292b2c;
   `;
   ```
   In the class:
   - `onFocusChange()` stays (toggles `focused`).
   - Add `onSelect(date)`: `this.onDateChange(date || null); this.setState({ focused: false });` (bind it in the constructor).
   - `onDateChange(date)` stays **exactly** as it is (`moment(date).toObject()` contract).
   - `render()`:
     ```jsx
     const { t, selectedDate } = this.props;
     const dueDate = selectedDate === null ? null : moment(selectedDate);
     return (
       <Container>
         <DateButton type="button" id="invoice-duedate" onClick={this.onFocusChange}>
           {dueDate ? dueDate.format('DD/MM/YYYY') : t('form:fields:dueDate:placeHolder')}
         </DateButton>
         {this.state.focused && (
           <Overlay onClick={this.onFocusChange}>
             <div onClick={e => e.stopPropagation()}>
               <DayPicker
                 mode="single"
                 weekStartsOn={1}
                 locale={LOCALES[i18n.language] || enUS}
                 selected={dueDate ? dueDate.toDate() : undefined}
                 defaultMonth={dueDate ? dueDate.toDate() : undefined}
                 onSelect={this.onSelect}
               />
             </div>
           </Overlay>
         )}
         {selectedDate !== null && (
           <a className="clearDateBtn active" href="#" onClick={this.clearDate}>
             <i className="ion-close-circled" />
           </a>
         )}
       </Container>
     );
     ```
   - Add Escape-to-close: in `componentDidUpdate`, when `focused` turns true add a `keydown` listener on `document` that calls `this.setState({ focused: false })` on `Escape`; remove it when `focused` turns false and in `componentWillUnmount`.
2. `static/css/date-picker.css`: delete lines 1–942 (react-dates styles). Keep only the app rules `.dueDateContent`, `.clearDateBtn`, `.clearDateBtn:hover`, `.clearDateBtn.active` (lines 943–964 at `c530133`). Keep the file name and its `<link>` so nothing else changes.
3. `app/components/form/__tests__/DueDate.spec.jsx`: delete the `import { SingleDatePicker } from 'react-dates';` line (its assertions are already commented out).
4. Update `DueDatePicker.spec.jsx` (see Test plan).

**Verify**:
- `grep -rn "react-dates\|SingleDatePicker\|shallow-compare" app package.json` → no output.
- `grep -c "CalendarDay\|DateInput" static/css/date-picker.css` → `0`.
- `npx vitest run app/components/form/__tests__/DueDatePicker.spec.jsx app/components/form/__tests__/DueDate.spec.jsx` → all pass.
- `npm run build` → exit 0.

### Step 5 (E): Accent color with react-colorful

```bash
npm install react-colorful@^5.8
npm uninstall react-color
```

In `AccentColor.jsx`:
- `import { HexColorInput } from 'react-colorful';` (remove the `react-color` import).
- `handleChange(color)` receives a hex **string** now: `this.props.handleAccentColorChange(color);`
- Replace `<BlockPicker …/>` with: a 100%-wide block showing the current color (`div` with `background: accentColor`, height 60px, border-radius 4px), a row of 8 swatch `<button type="button">`s (one per `defaultColors` entry, 22×22px, `background` = the color, `aria-label` = the hex, `onClick={() => this.handleChange(color)}`), and `<HexColorInput color={accentColor} onChange={this.handleChange} prefixed />`. Use styled-components in this file for the three pieces, following the existing styled style of the file's imports (`Section`, `Label` from `../shared`).

**Verify**:
- `grep -rn "react-color'" preview package.json` → no output.
- `npm run build` → exit 0.

### Step 6 (F): Update progress with `<progress>`

```bash
npm uninstall rc-progress
```

In `AppUpdate.jsx`: remove `import { Circle } from 'rc-progress';` and replace
the `<Circle …/>` element with
`<progress max="100" value={this.state.progress || 0} />`. In the `Indicator`
styled block, replace the `svg { width: 24px; height: 24px; }` rule with
`progress { width: 36px; height: 6px; accent-color: #469FE5; }`.
Change nothing else in the file.

**Verify**: `grep -rn "rc-progress\|Circle" app/components/layout/AppUpdate.jsx package.json` → no output. `npm run build` → exit 0.

### Step 7 (G): IDs with `crypto.randomUUID()`

1. In the 4 source files that call `uuidv4()` (`UIMiddleware.jsx`, `InvoicesMW.jsx`, `FormMW.jsx`, `app/helpers/form.js`): delete the import and replace `uuidv4()` with `crypto.randomUUID()`.
2. `ContactsMW.jsx`: delete the unused import line.
3. `tour/components/Actions.jsx`: delete the import; change `key={uuidv4()}` to `key={i}` (the dots are a fixed-length, never-reordered list).
4. Test side: in the 7 test-side files, delete `import uuidv4 from 'uuid/v4';` and replace `uuidv4()` with `crypto.randomUUID()`.
5. In the Vitest setup file add (keeps the old fixed-id behavior that tests expect):
   ```js
   import { beforeEach, vi } from 'vitest';
   beforeEach(() => {
     vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('id-string');
   });
   ```
   If the setup file already imports from `vitest`, merge the imports.
6. Delete `__mocks__/uuid/` and remove the `uuid/v4` alias from the Vitest config.
7. `npm uninstall uuid` — then run `npm ls uuid`. A nested `uuid` under another package is fine; only the top-level entry must be gone.

**Verify**:
- `grep -rn "uuid/v4\|uuidv4" app preview tour __mocks__ vitest.config.* 2>/dev/null` → no output.
- `node -p "require('./package.json').dependencies.uuid"` → `undefined`.
- `npm test` → exit 0 (UIMiddleware spec still gets `id: 'id-string'`).

### Step 8 (H): Test data with @faker-js/faker

```bash
npm install -D @faker-js/faker@^10
npm uninstall faker
```

In the 8 files: `import faker from 'faker';` → `import { faker } from '@faker-js/faker';`,
then apply the mapping table in section H. `faker.random.number(N)` →
`faker.number.int({ max: N })`.

**Verify**:
- `grep -rn "from 'faker'\|faker\.name\.\|faker\.random\.\|companyName\|phoneNumber" app preview` → no output.
- `npm test` → exit 0.

### Step 9: Bump moment and remove the temporary `.npmrc`

```bash
npm install moment@^2.31
git rm .npmrc
rm -rf node_modules
npm install
npm ci
```

**Verify**:
- `npm install` printed no `ERESOLVE` and no `peer dep` warning naming `react` (`npm install 2>&1 | grep -i "ERESOLVE\|peer"` → no output).
- `npm ls 2>&1 | grep -i invalid` → no output.
- `npm ls react-beautiful-dnd react-dnd react-dnd-html5-backend react-motion react-dates react-addons-shallow-compare react-color rc-progress faker` → `(empty)`.
- `npm test` → exit 0. `npm run build` → exit 0.

### Step 10: Smoke-test on a COPY of user data

Never point the app at `~/Library/Application Support/Manta`.

```bash
rm -rf /tmp/manta-copy && cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-copy
MANTA_USER_DATA=/tmp/manta-copy npm run dev
```

1. **Reorder rows**: Create tab → add 3 items with different names → drag item 3 by its row background (not by an input) above item 1 → order changes and stays after Save. Typing a space in an item's name input types a space (does not start a keyboard drag).
2. **Row animations**: adding an item grows the row in; removing an item shrinks it out.
3. **Form settings panel**: click the form "Settings" header → panel opens to full height and the arrow rotates; click again → closes.
4. **Tab indicator**: click each side-nav tab → the blue indicator slides to it.
5. **Logo**: Settings → Profile → remove the current logo (red ✕) → drag a PNG from Finder onto "Drag file here" → text changes to "Release to drop" while over it → drop → the logo appears. Then remove it again and use "Or Select Photo" → pick a PNG → logo appears. Dropping a file anywhere else in the window does **not** navigate away (libs/dragNdrop.js still works).
6. **Due date**: Create tab → enable Due Date in form settings → choose custom date → click the date field → calendar opens full-screen, weeks start on Monday → pick a day → field shows `DD/MM/YYYY` → Save invoice → open the invoice again (edit) → same date shown. Escape closes the calendar. ✕ clears the date. Switch app language to Deutsch → calendar month names are German.
7. **Existing invoices**: an invoice that already had a due date (from the copied data) shows the same due date in the list and in Preview as before the change.
8. **Accent color**: Preview window → sidebar Accent Color → click a swatch → template accent changes; type `#ff0000` in the hex input → accent turns red.
9. **Notifications**: create and delete a contact → notification slides in and out.
10. **Tour**: Help → Show Tutorial → slide dots render and move with "Next".
11. DevTools Console in each window: no red errors.

The update-progress `<progress>` cannot be triggered locally (needs a
published release). Review it by reading `AppUpdate.jsx` instead.

**Verify**: all 11 points hold; report pass/fail per point.

## Test plan

- `app/components/form/__tests__/DueDatePicker.spec.jsx` (update the plan-004 version). Model after the other Testing Library form specs. Cases:
  1. With `selectedDate = null`, the button shows the placeholder (`t` returns the key) and no `.clearDateBtn`.
  2. With the existing fixture `{ years: 2017, months: 10, date: 20, hours: 12, … }`, the button text is `20/11/2017`.
  3. Clicking the button opens the calendar (`screen.getByRole('grid')` present); clicking day `15` calls `updateCustomDate` with an object whose `years === 2017`, `months === 10`, `date === 15` (shape from `moment().toObject()`), and the calendar closes.
  4. Clicking `.clearDateBtn` calls `updateCustomDate(null)`.
  5. Pressing Escape while open closes the calendar.
- `app/components/settings/_partials/profile/__tests__/Logo.spec.jsx` (create). Tests alias `electron` to `__mocks__/electron.js`: add `webUtils: { getPathForFile: vi.fn(() => '/tmp/logo.png') }` to that mock (keep its existing exports); mock `../../../../helpers/image` `processImg` with `vi.mock` to call its callback with `'data:image/png;base64,AAA'`. Cases:
  1. `fireEvent.drop(screen.getByText('Drag file here'), { dataTransfer: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] } })` → `processImg` called with `'/tmp/logo.png'` and `handleLogoChange` called with the data URL.
  2. `fireEvent.dragOver` on the box → text becomes `Release to drop`; `fireEvent.dragLeave` → back to `Drag file here`.
  3. Drop with an empty `files` list → `processImg` not called.
- `preview/components/sidebar/__tests__/AccentColor.spec.jsx` (create). Cases:
  1. Clicking the swatch with `aria-label="#F47373"` calls `handleAccentColorChange('#F47373')`.
  2. Typing a valid hex in the input calls `handleAccentColorChange` with a `#`-prefixed string.
- Existing middleware/reducer specs cover Steps 7–8 (ids and faker data).
- Verification: `npm test` → all pass, including the new cases above.

## Done criteria

ALL must hold:

- [ ] `npm ls react-beautiful-dnd react-dnd react-dnd-html5-backend react-motion react-dates react-addons-shallow-compare react-color rc-progress faker` → `(empty)`
- [ ] `node -p "require('./package.json').dependencies.uuid"` → `undefined`
- [ ] `npm ls @hello-pangea/dnd motion react-day-picker react-colorful moment` → `18.x`, `14.x`, `10.x`, `5.x`, `2.31.x`
- [ ] `ls .npmrc` → `No such file or directory`
- [ ] `npm install 2>&1 | grep -i "ERESOLVE"` → no output
- [ ] `grep -rn "react-beautiful-dnd\|react-dnd\|react-motion\|react-dates\|react-color'\|rc-progress\|uuid/v4\|from 'faker'" app preview tour modal libs helpers` → no output
- [ ] `grep -rn "\.path\b" app/components/settings` → no output
- [ ] `npm test` exits 0; the new Logo, AccentColor and DueDatePicker cases exist and pass
- [ ] `npm run build` exits 0
- [ ] Smoke test (Step 10) passes on a data copy
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any precondition fails.
- After Step 1, dragging does not start at all, or typing in an item input starts a drag. Report — do not re-add the manual `onMouseDown` patch (modern dnd versions do not expose `onMouseDown` in `dragHandleProps`).
- `webUtils` imported from `electron` is `undefined` in the running renderer (means the plan-002 shim or Node integration differs from what this plan expects).
- After Step 4, an existing invoice's due date shows a different day than before, or `updateCustomDate` receives anything other than the `moment().toObject()` shape. This is a data-contract break — stop immediately.
- `react-day-picker` 10's API differs from the props used in Step 4 (`mode`, `selected`, `onSelect`, `weekStartsOn`, `locale`, `defaultMonth`) — check https://daypicker.dev and report the difference instead of guessing.
- Step 9 `npm install` (without `.npmrc`) still reports `ERESOLVE`. Report the package named in the error; do not re-add `.npmrc`.
- Any smoke step shows fewer invoices or contacts than before.

## Maintenance notes

- `Logo.jsx` now calls `webUtils.getPathForFile` through the `electron` shim. Plan 009 (contextIsolation + preload) must expose `getPathForFile` through the preload bridge and replace this call.
- `TransitionList` is the only `motion` user. If a future change drops the exit animation, `motion` can be removed and replaced by CSS.
- `DueDatePicker` writes `moment(date).toObject()`. Any future date-library change must keep reading and writing that shape (or ship a PouchDB migration in `app/helpers/pouchDB.js`).
- The `LOCALES` map in `DueDatePicker.jsx` must get a new entry when a language is added under `i18n/`.
- Reviewer focus: the `DueDatePicker` data contract, that no `onMouseDown` patch remains in `_withDraggable.jsx`, that `.npmrc` is gone, and that the uuid spy lives in the setup file (not in individual specs).
