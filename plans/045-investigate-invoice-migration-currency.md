# Plan 045: Find out whether invoice migration 2 can still abort the database

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/helpers/pouchDB.js app/helpers/__tests__/pouchDB.spec.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Outcome**: DONE — historical settings mismatch proves a persisted missing-currency path; migration 2 now preserves those documents.
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/038-pouch-mutation-without-full-reload.md if that plan is not done, because both edit `pouchDB.js`. The investigation can be read-only until you decide a guard is required.
- **Category**: bug
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Invoice migration 2 reads `doc.currency.code` with no guard. `runMigration` runs every migration above `localStorage.invoicesVersion` inside one try. One throw marks the migration failed and the invoice queue receives the error. Current installs that already reached version 4 never run migration 2 again. This plan finds out whether a document without `currency` can still be migrated. If it cannot, record that and do not change code. If it can, add a guard and a test.

This is an investigation plan. A code change is allowed only in the case below. Do not refactor migrations.

## Current state

`app/helpers/pouchDB.js`:

```js
const invoicesVersion = localStorage.invoicesVersion || 0;

const invoicesMigrations = {
  2: doc => {
    const newDoc = Object.assign({}, doc, {
      currency: {
        code: doc.currency.code,
        placement: 'before',
        separator: 'commaDot',
        fraction: 2,
      },
    });
    return newDoc;
  },
  // migrations 1, 3, and 4 also exist
};

runMigration(invoicesDB, invoicesVersion, invoicesMigrations, (err, latestVersion) => {
  alreadyRunInvoiceMigration = true;
  if (latestVersion) {
    localStorage.invoicesVersion = latestVersion;
  }
  invoiceQueue.forEach(f => f(err));
  invoiceQueue = [];
});
```

Migration 1 returns immediately when `doc.status` is set. It does not add `currency`. Migration 2 always reads `doc.currency.code`. The key `4` is the last migration. After a successful run, `localStorage.invoicesVersion` is `'4'`.

`adapter: 'idb'` must stay. Do not point tests at a real profile.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Migration tests | `npm test -- app/helpers/__tests__/pouchDB.spec.js` | exit 0 |

## Scope

**In scope**:

- Read `app/helpers/pouchDB.js` migrations
- `app/helpers/__tests__/pouchDB.spec.js` only if you implement the guard
- A short "Result" section appended to this plan file

**Out of scope**:

- Rewriting migrations 1, 3, or 4
- Changing `saveDoc` or `getAllDocs` (plan 038)
- Migrating real user data

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks.
- Do not push. No AI attribution.
- You may edit this plan file to add the Result section. That edit is in scope.

## Steps

### Step 1: See when migration 2 runs

Read `runMigration` and migrations 1 through 4. Answer in the Result section:

- The version compare is string or number. Quote the `filter` line.
- A database whose `localStorage.invoicesVersion` is `'4'` does not call migration 2. Say that explicitly if the code shows it.
- A document that already has `status` still enters migration 2 when the stored version is less than 2.

**Verify**: the Result section contains those three answers and quotes `pouchDB.js` line numbers. No production edit yet.

### Step 2: Decide

Add a test only if step 1 shows a stored version below 2 still runs on first open of an old database. That is the original Manta upgrade path (`invoicesVersion` missing or `0`).

Test shape, using the existing pouch test harness or a direct call of the migration function if it is not exported: a document `{ status: 'pending' }` with no `currency` must not throw. Expected behavior if you implement the guard: return the document unchanged, or set a default currency object. Prefer unchanged when `currency` is missing, so you do not invent `USD`. Write that choice in the Result section.

If step 1 shows migration 2 cannot run unless version is below 2, and every supported upgrade from this repo's 1.1.x line already stored version `4` before currency could be missing, mark this plan `REJECTED` in `plans/README.md` with the one-line reason. Do not add a defensive guard "just in case" if you cannot name a document that still hits it. The original app shipped these same migrations. Look for a fixture or comment that shows a pre-currency document. If you find none, REJECTED is the right end.

**Verify**: either `npm test -- app/helpers/__tests__/pouchDB.spec.js` exits 0 and includes the missing-currency case, or the README status is `REJECTED` and no production file changed.

## Test plan

- One migration fixture, and only if you implement the guard.
- No test if the result is REJECTED.

## Done criteria

- [x] This file has a Result section with the three answers from step 1
- [x] Missing-currency guard and real migration regression pass; evidence below.
- [x] `adapter: 'idb'` is unchanged
- [ ] Coordinator: set `plans/README.md` row 045 to `DONE` (index edit excluded by operator).

## STOP conditions

- You would need to run a migration against `~/Library/Application Support/Manta`. STOP. Use a fixture.
- The guard you want changes documents that already have `currency`. STOP.
- `runMigration` does not match the excerpt. STOP and quote the function.

## Maintenance notes

`localStorage.invoicesVersion` is the only switch for these migrations. Resetting it in development re-runs them on current documents. Do not reset it in a user profile.


## Result (2026-11-17; revised after independent review)

**DONE.** The historical persistence path below justifies a guard. Migration 2
returns the original document when currency is missing; it does not invent USD.
The previous REJECTED result missed a settings rename mismatch in the fallback
used before persistence. This result replaces that decision.

### Migration selection and execution

- `app/helpers/pouchDB.js:16-18` selects migrations with the exact filter line
  `.filter(k => k > version)`. `Object.keys` supplies string keys. At line 46,
  missing or empty storage falls back to numeric `0`; comparison then converts
  keys to numbers. A stored nonempty value such as `'1'` remains a string, so
  comparison is lexicographic. Numeric and string versions 0, 1, 2, and 4 select
  the same migrations for the existing single-digit keys 1–4. There is no numeric
  parse; sorting at line 18 is also lexicographic.
- Stored version `'4'` selects nothing and returns at lines 19–20. Migration 2
  is not called and documents are not read. Successful migration returns the
  last selected key at line 37; lines 114–115 store localStorage string `'4'`.
- With stored version below 2, including missing storage, migration 2 runs on
  first open. A document with `status` skips only migration 1 (`:50-51`), not
  the later migrations in the reduction (`:29-32`). Migration 1 adds no currency.
  The read at line 73 previously threw for missing currency. The catch at
  lines 38–39 forwards errors to the callback and queued callers (`:117-118`).
- The new guard at line 69 returns the document unchanged when currency is
  missing. Documents with currency follow the same existing transformation.
  Migrations 1, 3 (`:82-92`), and 4 (`:94-105`), `runMigration`, all `idb`
  adapters, and plan 038 mutation APIs and existing tests are unchanged.

### Concrete historical persistence evidence

The fix [2a320580691a2a025f28b0a37df9dd6a9b23d92b](https://github.com/jamesso/manta/commit/2a320580691a2a025f28b0a37df9dd6a9b23d92b)
changes the fallback setting from `appSettings.currency` to `invoice.currency`.
Its parent is `9a88e060d0860717b9ae64402bea71ca2a15e852`:

1. [app.js:179–195](https://github.com/jamesso/manta/blob/9a88e060d0860717b9ae64402bea71ca2a15e852/app.js#L179-L195)
   initializes `invoice.currency` to USD and disables the optional currency field.
2. [app/helpers/form.js:50–51](https://github.com/jamesso/manta/blob/9a88e060d0860717b9ae64402bea71ca2a15e852/app/helpers/form.js#L50-L51)
   omits currency when that field is disabled.
3. [app/middlewares/InvoicesMW.jsx:48–61](https://github.com/jamesso/manta/blob/9a88e060d0860717b9ae64402bea71ca2a15e852/app/middlewares/InvoicesMW.jsx#L48-L61)
   sets status to pending, reads the obsolete `appSettings.currency`, and calls
   `saveDoc`. Under the normal historical settings, currency is undefined and
   is absent from the serialized document.
4. [app/helpers/pouchDB.js:1–33](https://github.com/jamesso/manta/blob/9a88e060d0860717b9ae64402bea71ca2a15e852/app/helpers/pouchDB.js#L1-L33)
   writes the document with `db.put` at line 29. This helper contains no
   migration/version initialization. A direct upgrade with missing version
   storage therefore selects migration 2 for this persisted pending invoice.

This is a concrete source path between release tags. Affected released-user
databases are **unproven**. Also, the earlier claim that every 1.1.x upgrade had
version 4 is false: `v1.1.0:app/helpers/pouchDB.js:45-64` has migration 1 only;
`v1.1.4:app/helpers/pouchDB.js:64-87` has migrations 2 and 3 without migration 4.
No real user database was needed or accessed.

### Regression and verification

`app/helpers/__tests__/pouchDB.spec.js:31` adds one focused test. It seeds a
pending historical document without currency in real PouchDB with the `idb`
adapter over fake IndexedDB, removes only the jsdom test version key, and imports
the real helper to run all selected migrations. It verifies the unchanged body
(except the database revision) and stored version `'4'`. A companion invoice
with EUR verifies the existing currency transformation and migrations 3 and 4.
The database is destroyed and module cache and test storage are restored.
Module reset behavior was checked against the [Vitest API documentation](https://vitest.dev/api/vi#vi-resetmodules);
the installed lockfile version is Vitest 5.0.5.

Commands and exits:

| Command | Exit | Result |
| --- | --- | --- |
| `git diff --stat 10f3f0e..HEAD -- app/helpers/pouchDB.js app/helpers/__tests__/pouchDB.spec.js` | 0 | Existing drift is the authorized 038 mutation work; migration excerpt and runner matched before this fix. |
| `git show 2a32058` and `git show 2a32058^:<path>` for the four historical files above | 0 | Confirmed settings mismatch and persistence path. |
| `npm ci --no-audit --no-fund` | 0 | Installed from package-lock.json; no manifest or lockfile change. npm reported dependency deprecation and install-script notices. |
| `npm test -- app/helpers/__tests__/pouchDB.spec.js -t 'migrates historical invoices without currency on first open'` before guard | 1 | Regression failed at `doc.currency.code` with TypeError; 18 other tests skipped. |
| `npm test -- app/helpers/__tests__/pouchDB.spec.js` after guard | 0 | All 19 tests passed, including migration regression and 038 contracts. |
| `./node_modules/.bin/eslint app/helpers/pouchDB.js app/helpers/__tests__/pouchDB.spec.js` | 0 | Narrow lint passed. |
| `./node_modules/.bin/prettier --check app/helpers/pouchDB.js app/helpers/__tests__/pouchDB.spec.js` | 0 | Both files passed. |
| `git diff --check` | 0 | No whitespace errors. |

No browser or running local app was used: the regression directly exercises the
real migration runner with isolated storage. No real Manta profile or user
localStorage was opened or changed. No security boundary changed; the guard
only skips currency transformation when currency is absent. No broader tests
were needed for this one-line change. The coordinator owns `plans/README.md`;
this task leaves it unchanged. All source, test, and plan changes belong in one
commit. `.ai/todo.md` remains untracked.
