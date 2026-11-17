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

- [ ] This file has a Result section with the three answers from step 1
- [ ] Either the guard test passes, or the README row is `REJECTED` with a reason and `git diff` shows no production change
- [ ] `adapter: 'idb'` is unchanged
- [ ] `plans/README.md` row 045 is `DONE` or `REJECTED`

## STOP conditions

- You would need to run a migration against `~/Library/Application Support/Manta`. STOP. Use a fixture.
- The guard you want changes documents that already have `currency`. STOP.
- `runMigration` does not match the excerpt. STOP and quote the function.

## Maintenance notes

`localStorage.invoicesVersion` is the only switch for these migrations. Resetting it in development re-runs them on current documents. Do not reset it in a user profile.
