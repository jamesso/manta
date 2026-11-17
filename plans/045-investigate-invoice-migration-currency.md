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

- **Outcome**: REJECTED — no concrete stored pre-currency invoice was found that can reach migration 2.
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
- [x] REJECTED with evidence below; no production change. The coordinator owns the README row.
- [x] `adapter: 'idb'` is unchanged
- [ ] Coordinator: set `plans/README.md` row 045 to `REJECTED` (index edit excluded by operator).

## STOP conditions

- You would need to run a migration against `~/Library/Application Support/Manta`. STOP. Use a fixture.
- The guard you want changes documents that already have `currency`. STOP.
- `runMigration` does not match the excerpt. STOP and quote the function.

## Maintenance notes

`localStorage.invoicesVersion` is the only switch for these migrations. Resetting it in development re-runs them on current documents. Do not reset it in a user profile.


## Result (2026-11-17)

**REJECTED.** No concrete fixture, comment, or history evidence identifies a
stored invoice without currency that reaches migration 2. No guard or test was
added. This is an evidence limit, not proof that all old databases are valid.

### Migration selection and execution

- `app/helpers/pouchDB.js:16-18` selects migrations with the exact filter line
  `.filter(k => k > version)`. `Object.keys` supplies string keys. At line 46,
  missing or empty storage falls back to numeric `0`; comparison then converts
  keys to numbers. A stored nonempty value such as `'1'` remains a string, so
  comparison is lexicographic. For the existing single-digit keys 1–4, numeric
  and string versions 0, 1, 2, and 4 select the same migrations. There is no
  explicit numeric parse. Sorting at line 18 is also lexicographic.
- Stored version `'4'` selects nothing, returns at lines 19–20, and never calls
  migration 2 or reads documents. Successful migration returns the last selected
  key at line 37; lines 113–114 store it as localStorage string `'4'`.
- With stored version below 2, migration 2 runs on first open, including when
  storage is missing. A document with `status` skips only migration 1
  (`:50-51`), not the reduction through later migrations (`:29-32`). Migration 1
  does not add currency. Migration 2 reads `doc.currency.code` at line 72;
  missing currency would throw. The catch at lines 38–39 passes the error to
  the callback, which forwards it to queued callers at lines 116–119.
- Migrations 3 (`:81-91`) and 4 (`:93-104`) run after migration 2 when selected;
  neither can repair an earlier throw. All migrations and adapters remain intact.

### Evidence and decision

- Drift command: `git diff --stat 10f3f0e..HEAD -- app/helpers/pouchDB.js app/helpers/__tests__/pouchDB.spec.js`
  exited 0 (two changed files). The full helper diff shows only mutation changes
  below the migration section. The live migration excerpt and `runMigration`
  match the plan. Plan 038 contracts and its tests remain unchanged.
- `git log --oneline --all -- app/helpers/pouchDB.js` and historical `git show`
  commands exited 0. Commit `688130c` introduced migration 1; `a2de896`
  introduced migration 2 with the same currency read; `f206ca8` added migration
  3; `8c91e2b` added migration 4. The comment at current lines 50–51 describes
  status-bearing new documents, not documents without currency.
- A candidate was checked rather than treated as a persisted fixture:
  `af80a58:app/helpers/__tests__/form.spec.js:63-71` asserts that optional
  currency is absent from form output. But
  `af80a58:app/middlewares/InvoicesMW.jsx:48-60` adds selected or configured
  currency before `saveDoc`. This test does not show a stored pre-currency
  document. Commit `ff5d8e8` moved document construction into the form helper;
  `a2de896^:app/helpers/form.js`, in `getInvoiceData`, assigns either form
  currency or `appConfig.get('invoice.currency')` before persistence.
- Release history does **not** support the plan's proposed claim that every
  1.1.x upgrade already stored version 4: `v1.1.0:app/helpers/pouchDB.js:45-64`
  has migration 1 only; `v1.1.4:app/helpers/pouchDB.js:64-87` has migrations
  2 and 3, with no 4. Old versions can therefore select migration 2. This alone
  does not establish a missing-currency document. Invalid settings, manually
  edited data, and reset storage would be speculative inputs, not evidence.
- Current invoice migration-related fixtures in
  `app/helpers/__tests__/pouchDB.spec.js` contain currency. Repository fixture,
  mock, and currency searches found no concrete persisted pre-currency upgrade
  fixture. The operator explicitly requires REJECTED when no such evidence is
  found. Do not add a guard or invent USD.

### Verification and limits

- A standalone `node -e` check of the exact key filter and sort for numeric and
  string versions 0, 1, 2, and 4 exited 0: selected keys were respectively
  `[1,2,3,4]`, `[2,3,4]`, `[3,4]`, and `[]` for both types. It used only
  in-memory values; no app imports or localStorage access.
- `git diff --check` exited 0. `git diff --name-only` exited 0 and listed
  only this plan. No production, test, adapter, or index file changed.
- No migration test was run, as required for REJECTED. No dependencies were
  installed. No browser, real Manta profile, or user localStorage was accessed.
- `rg` was unavailable (exit 127); searches used `git grep` instead.
  `.ai/lessons.md` was absent (`cat` exit 1). No `.ai` file was added.
- The coordinator must update `plans/README.md`; this task does not edit it.
