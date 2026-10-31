# Plan 007: Upgrade PouchDB 6.2 → 9 without losing or hiding any saved invoice or contact

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- app/helpers/pouchDB.js __mocks__/pouchdb-browser.js app/helpers/__tests__/`
> Plans 001–006 are expected to have touched `package.json` and possibly the
> mock and the `require`/`import` line of `pouchDB.js`. Compare the
> "Current state" excerpts below against the live code. If the *data logic*
> (migrations, `setDB`, `getAllDocs`, `saveDoc`, `deleteDoc`, `updateDoc`)
> differs from the excerpts, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH (user data)
- **Depends on**: plans/003-*.md (Electron 45 runs with `electron-store` settings and the `MANTA_USER_DATA` switch). Recommended to run after plans/006-*.md so the plan order stays linear.
- **Category**: migration
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

All invoices and contacts live in PouchDB (`pouchdb-browser` 6.2.0, from 2017) inside the window's IndexedDB. Version 6.2 is unmaintained and was built for ES5 browsers. The current release is 9.0.0. The upgrade is small in code, but a mistake here makes users think their invoices are gone. Two things can hide data: (1) a different storage adapter (the new `indexeddb` adapter does **not** read databases written by the old `idb` adapter), and (2) a different page origin (data belongs to the `file://` origin). This plan upgrades the library, pins the adapter to `idb`, fixes a save/delete race that newer PouchDB timing could expose, and proves with document counts on a copy of real data that nothing was lost.

## Current state

### Preconditions from earlier plans (verify; STOP if missing)

| Precondition | Check | Expected |
|---|---|---|
| npm + Node 24 | `node -v && test -f package-lock.json && echo ok` | `v24.x` and `ok` |
| Vitest is the test runner | `grep -n '"test"' package.json` | contains `vitest` |
| electron-vite build exists | `ls electron.vite.config.mjs` | file exists |
| Electron 45 | `npm ls electron` | `electron@45.x` |
| User-data switch | `grep -rn "MANTA_USER_DATA" app.js main/` | at least 1 match (calls `app.setPath('userData', …)`) |
| Production windows load over `file://` | `grep -rn "loadFile" app.js main/` | matches for the main/preview/tour windows |

### Files

- `app/helpers/pouchDB.js` — the only module that talks to PouchDB. Creates the two databases, runs its own document migrations, and exports `getAllDocs`, `getSingleDoc`, `deleteDoc`, `saveDoc`, `updateDoc`.
- `__mocks__/pouchdb-browser.js` — test mock of the library (at HEAD: `module.exports = jest.fn(() => ({ name: 'test' }));` — plan 001 converted it for Vitest).
- `app/helpers/__mocks__/pouchDB.js` — test mock of the helper used by middleware tests (do not change).
- Callers (do not change): `app/middlewares/InvoicesMW.jsx`, `app/middlewares/ContactsMW.jsx`, `app/store/enhancer.jsx`.

### Excerpts (HEAD `c530133`)

`app/helpers/pouchDB.js:1-7` — database setup:

```js
// Setup PouchDB
const PouchDB = require('pouchdb-browser');
const contactsDB = new PouchDB('contacts');
const invoicesDB = new PouchDB('invoices');

// Utility
import { omit } from 'lodash';
```

`app/helpers/pouchDB.js:40-43` — the document-migration version is kept in `localStorage` (same origin as the data):

```js
// Run migration for InvoicesDB
let invoiceQueue = [];
let alreadyRunInvoiceMigration = false;
const invoicesVersion = localStorage.invoicesVersion || 0;
```

`app/helpers/pouchDB.js:166-173` — **existing race**: the argument to `.then` is a promise, not a function, so `getAllDocs` starts *before* `db.put` runs. Today it works only because IndexedDB happens to queue the write transaction first. `deleteDoc` (lines 176-191) and `updateDoc` (lines 194-203) have the same pattern.

```js
// Save a Document
const saveDoc = (dbName, doc) =>
  new Promise((resolve, reject) => {
    setDB(dbName)
      .then(db => db.put(doc))
      .then(getAllDocs(dbName).then(newDocs => resolve(newDocs)))
      .catch(err => reject(err));
  });
```

`app/helpers/pouchDB.js:176-191`:

```js
const deleteDoc = (dbName, doc) =>
  new Promise((resolve, reject) => {
    setDB(dbName)
      .then(db =>
        db
          .get(doc)
          .then(record =>
            db
              .remove(record)
              .then(
                getAllDocs(dbName).then(remainingDocs => resolve(remainingDocs))
              )
          )
      )
      .catch(err => reject(err));
  });
```

`app/helpers/pouchDB.js:194-203`:

```js
const updateDoc = (dbName, updatedDoc) =>
  new Promise((resolve, reject) => {
    setDB(dbName)
      .then(db =>
        db
          .put(updatedDoc)
          .then(getAllDocs(dbName).then(allDocs => resolve(allDocs)))
      )
      .catch(err => reject(err));
  });
```

### Facts about the stored data (checked on the maintainer's Mac)

- Real data is at `~/Library/Application Support/Manta/`. Its `IndexedDB/` folder contains `file__0.indexeddb.leveldb` and `file__0.indexeddb.blob`. `file__0` is the `file://` origin. **If production windows ever load from `http://` or a custom protocol, the app will open empty databases.**
- PouchDB's `idb` adapter stores the databases as IndexedDB databases named `_pouch_contacts` and `_pouch_invoices`.

### What changed in PouchDB 7 → 9 that matters here

- 7.0.0: WebSQL removed from default builds; Promise polyfill removed. Manta never used WebSQL (Electron's PouchDB picked `idb`). Source: [PouchDB 6.4.2 post (WebSQL migration notice)](https://pouchdb.com/2018/01/23/pouchdb-6.4.2.html).
- 7.2.1 / 7.3.0: a **new, separate** `indexeddb` adapter was added and later bundled. It is *not* backwards compatible with `idb` data ("data migration is left as an exercise for the reader"). Sources: [7.2.1 release](https://www.github.com/pouchdb/pouchdb/releases/tag/7.2.1), [7.3.0 release](https://www.github.com/pouchdb/pouchdb/releases/tag/7.3.0). → This plan passes `{ adapter: 'idb' }` explicitly.
- 8.0.0: ES classes, no ES5 support. Source: [PouchDB 8.0.0 post](https://pouchdb.com/2022/12/14/pouchdb-8.0.0.html).
- 9.0.0: `.find()` default limit 25 (Manta does not use `pouchdb-find`), no default heartbeat on non-live `changes()`, stricter `_rev` validation. Source: [PouchDB 9.0.0 post](https://pouchdb.com/2024/05/24/pouchdb-9.0.0.html), [releases](https://github.com/pouchdb/pouchdb/releases).
- `pouchdb-browser@9.0.0` ships `main: ./lib/index.js` and `module: ./lib/index.es.js` (checked with `npm view`), so `import PouchDB from 'pouchdb-browser'` works with Vite.

### Conventions

- ES module `import` at the top of renderer files, 2-space indent, single quotes, trailing commas (`es5`), semicolons (Prettier config in `package.json`).
- Tests live in a `__tests__/` folder next to the code, named `<module>.spec.js`. Pattern: `app/helpers/__tests__/form.spec.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Unit tests | `npm test` | all pass |
| One test file | `npx vitest run app/helpers/__tests__/pouchDB.spec.js` | all pass |
| Production build | `npm run build` | exit 0, `out/` written |
| Run built app on a data copy | `MANTA_USER_DATA="$HOME/manta-profile-007" npx electron .` | app opens; DevTools opens automatically (unpackaged = dev, see `app.js` `show` handler) |

`npx electron .` starts `package.json` `main` (the built `out/main/index.js`) and loads the built HTML with `loadFile`, so the page origin is `file://` — the same origin as the real data. Do **not** use `npm run dev` for data checks: the dev server origin is `http://localhost`, which has its own empty IndexedDB.

## Scope

**In scope** (the only files you should modify):
- `package.json`, `package-lock.json` (`pouchdb-browser` → `^9.0.0`; add dev dependency `fake-indexeddb`)
- `app/helpers/pouchDB.js`
- `app/helpers/__tests__/pouchDB.spec.js` (create)
- `__mocks__/pouchdb-browser.js` (only if the default-export change breaks existing tests)

**Out of scope** (do NOT touch):
- `app/helpers/__mocks__/pouchDB.js` and the middleware tests — they mock the helper, not PouchDB.
- The migration functions `invoicesMigrations` 1–4 and the `localStorage.invoicesVersion` mechanism — they already ran on users' data; changing them can re-migrate documents.
- Window loading (`loadFile`, URLs) in `app.js` / `main/` — owned by plan 002.
- Any change to the `indexeddb` adapter or a data migration between adapters.

## Git workflow

- Branch: `upgrade/electron-45` (already exists; do not create another).
- One commit per step that changes files. Short imperative subject, no prefix, no AI attribution. Example: `Upgrade PouchDB to 9 and pin idb adapter`.
- Do NOT push.

## Steps

### Step 1: Make a copy of real data and record baseline counts (still on PouchDB 6.2)

1. Quit Manta if it is open.
2. `cp -R "$HOME/Library/Application Support/Manta" "$HOME/manta-profile-007"`
3. Keep a second, untouched copy for rollback: `cp -R "$HOME/manta-profile-007" "$HOME/manta-profile-007.orig"`
4. Add a temporary debug hook to `app/helpers/pouchDB.js`, directly after the two `new PouchDB(...)` lines:

```js
// TEMP (plan 007): expose DBs for count checks. Removed in Step 6.
if (localStorage.getItem('manta.debugDb') === '1') {
  window.__mantaDb = { contactsDB, invoicesDB };
}
```

5. `npm run build && MANTA_USER_DATA="$HOME/manta-profile-007" npx electron .`
6. In the DevTools console of the **main** window run:

```js
location.protocol
localStorage.setItem('manta.debugDb', '1'); location.reload();
```

then, after reload:

```js
await Promise.all([__mantaDb.contactsDB.info(), __mantaDb.invoicesDB.info()]).then(r => r.map(i => ({ name: i.db_name, docs: i.doc_count, adapter: i.adapter })))
localStorage.invoicesVersion
```

7. Write the output into the commit message body of this step (counts only — no customer names).

**Verify**: `location.protocol` prints `'file:'`; the info call prints two rows with `adapter: 'idb'` and the doc counts; the counts equal the number of rows in the Invoices tab and Contacts tab of the app. If any of these fail → STOP.

### Step 2: Fix the save/delete/update race (still on PouchDB 6.2)

In `app/helpers/pouchDB.js` change the three functions so `getAllDocs` runs only **after** the write finishes. Pass a function to `.then`:

```js
const saveDoc = (dbName, doc) =>
  setDB(dbName)
    .then(db => db.put(doc))
    .then(() => getAllDocs(dbName));

const deleteDoc = (dbName, docId) =>
  setDB(dbName)
    .then(db => db.get(docId).then(record => db.remove(record)))
    .then(() => getAllDocs(dbName));

const updateDoc = (dbName, updatedDoc) =>
  setDB(dbName)
    .then(db => db.put(updatedDoc))
    .then(() => getAllDocs(dbName));
```

Keep the exported names and argument order unchanged (`deleteDoc` is called with an id today — the parameter name `doc` in HEAD is misleading; the value is passed to `db.get`). Errors still reject the returned promise, which matches the old `.catch(err => reject(err))`.

**Verify**: `npm test` → all pass (middleware tests mock this module, so they must be unaffected).

### Step 3: Add regression tests against a real PouchDB on fake IndexedDB

1. `npm install --save-dev fake-indexeddb`
2. Create `app/helpers/__tests__/pouchDB.spec.js`. First lines:

```js
import 'fake-indexeddb/auto';
import { vi, describe, it, expect } from 'vitest';
vi.unmock('pouchdb-browser'); // use the real library, not __mocks__/pouchdb-browser.js
```

Then import `{ getAllDocs, saveDoc, updateDoc, deleteDoc, getSingleDoc }` from `../pouchDB` with a dynamic `await import('../pouchDB')` inside the tests (so the unmock and fake IndexedDB are active first).

Cases:
- `saveDoc('contacts', { _id: 'c1', fullname: 'A' })` resolves to a list that **contains** `c1`.
- `updateDoc('contacts', { ...savedDocWithRev, fullname: 'B' })` resolves to a list where `c1.fullname === 'B'`.
- `deleteDoc('contacts', 'c1')` resolves to a list that does **not** contain `c1`.
- `saveDoc('invoices', { _id: 'i1', status: 'pending', currency: { code: 'USD' } })` then `getAllDocs('invoices')` contains `i1` (exercises the migration queue on an empty DB).
- `getSingleDoc('contacts', 'missing')` rejects (404).

If `vi.unmock` does not reach the real package because plan 001 configured an alias for `pouchdb-browser` in the Vitest config, remove the alias for this file using `// @vitest-environment jsdom` plus a per-file `vi.mock('pouchdb-browser', async () => await vi.importActual('pouchdb-browser'))`. If neither works → STOP.

**Verify**: `npx vitest run app/helpers/__tests__/pouchDB.spec.js` → 5 passing tests on PouchDB **6.2**. (Writing them before the upgrade proves the test detects the right behavior on the old version.)

### Step 4: Upgrade the package and pin the adapter

1. `npm install pouchdb-browser@^9.0.0`
2. In `app/helpers/pouchDB.js` replace the setup lines with:

```js
import PouchDB from 'pouchdb-browser';

// Keep the 'idb' adapter: existing user data was written by it.
// The newer 'indexeddb' adapter cannot read these databases.
const contactsDB = new PouchDB('contacts', { adapter: 'idb' });
const invoicesDB = new PouchDB('invoices', { adapter: 'idb' });
```

Move `import { omit } from 'lodash';` up next to it so all imports are at the top.

3. If `npm test` fails only because `__mocks__/pouchdb-browser.js` exports a function but code now uses a default import, change the mock to `export default vi.fn(() => ({ name: 'test' }));` (keep behavior).

**Verify**:
- `npm ls pouchdb-browser` → `pouchdb-browser@9.x`
- `npm test` → all pass, including the 5 tests from Step 3
- `npm run build` → exit 0

### Step 5: Prove the real data still loads (copy only)

1. `npm run build && MANTA_USER_DATA="$HOME/manta-profile-007" npx electron .`
2. In the main window console run the same commands as Step 1.6 (the `manta.debugDb` flag is still set in this profile's localStorage).
3. Smoke test on this copy:
   - Invoices tab: every invoice from Step 1 is listed; open one with **Preview**; the preview window shows it.
   - Create invoice: fill a recipient and one item → **Save**. The new invoice appears in the Invoices tab at once (this is the race fixed in Step 2).
   - Contacts tab: delete a contact → confirm in the modal → it disappears at once.
   - Quit and start again with the same command → the new invoice is still there, the deleted contact is still gone.

**Verify**: both `doc_count` values equal the Step 1 values; `adapter` is `'idb'` for both; `localStorage.invoicesVersion` is unchanged from Step 1; every smoke-test item passes. Any count difference → STOP (go to Rollback).

### Step 6: Remove the debug hook

Delete the `TEMP (plan 007)` block added in Step 1.

**Verify**: `grep -n "__mantaDb\|manta.debugDb" app/helpers/pouchDB.js` → no output; `npm test` → all pass; `npm run build` → exit 0.

### Rollback (only if Step 5 fails)

- Data: `rm -rf "$HOME/manta-profile-007" && cp -R "$HOME/manta-profile-007.orig" "$HOME/manta-profile-007"` — the real profile was never touched.
- Code: `git revert` the Step 4 commit (keeps the race fix and tests from Steps 2–3).

## Test plan

- New file `app/helpers/__tests__/pouchDB.spec.js` with the 5 cases in Step 3, running real PouchDB on `fake-indexeddb`. Structure: model after `app/helpers/__tests__/form.spec.js` (plain `describe`/`it`/`expect`).
- Manual data check (Steps 1 and 5) on a copy of the real profile.
- Verification: `npm test` → all pass, including 5 new tests.

## Done criteria

- [ ] `npm ls pouchdb-browser` shows `9.x`
- [ ] `grep -n "adapter: 'idb'" app/helpers/pouchDB.js` → 2 matches
- [ ] `grep -nE "\.then\(getAllDocs" app/helpers/pouchDB.js` → no matches
- [ ] `grep -n "__mantaDb" app/helpers/pouchDB.js` → no matches
- [ ] `npm test` exits 0; `app/helpers/__tests__/pouchDB.spec.js` exists with 5 passing tests
- [ ] `npm run build` exits 0
- [ ] Step 5 doc counts equal Step 1 doc counts (recorded in commit messages)
- [ ] `git status` shows only in-scope files changed; `~/Library/Application Support/Manta` was never opened by the new build
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `location.protocol` is not `'file:'` when running the built app — plan 002's `loadFile` precondition is broken, and any data result would be wrong.
- In Step 1 or Step 5, `info().adapter` is not `'idb'`.
- Step 5 doc counts differ from Step 1, or any invoice is missing or shows wrong values.
- `localStorage.invoicesVersion` changes between Step 1 and Step 5 (the document migrations ran again).
- PouchDB 9 throws a `_rev` validation error on existing documents (9.0 made `isValidRev` stricter).
- The Step 3 tests cannot run against the real PouchDB in Vitest after the two options given.
- You find you must change the migration functions, an adapter migration, or window loading code.

## Maintenance notes

- Never switch to `adapter: 'indexeddb'` without a written data migration (replicate `idb` → `indexeddb`, then verify counts). The explicit `adapter: 'idb'` line is the guard; reviewers should reject PRs that remove it.
- The data is bound to the `file://` origin. Any future change to a custom protocol (`app://`) or to loading production pages from a server needs a data-move plan first.
- `localStorage.invoicesVersion` is stored in the same origin. Add new document migrations as key `5`, `6`, … in `invoicesMigrations`; never edit 1–4.
- Reviewer focus: the `.then(() => getAllDocs(...))` change — each must take a function.
- Deferred: `contactsDB` has no migration system; add one only when a contact schema change is needed.
