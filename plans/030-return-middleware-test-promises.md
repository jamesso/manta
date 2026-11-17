# Plan 030: Middleware tests return the promise they assert on

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/middlewares/__tests__/InvoicesMW.spec.js app/middlewares/__tests__/ContactsMW.spec.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. Plans 032, 034, and 035 edit `InvoicesMW.jsx` and should run after this plan so their tests actually wait.
- **Category**: tests
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Vitest waits for a test only when the test function returns a promise (or is `async`). Several middleware tests call `.then` and do not return it. The test can finish before `expect` runs, so CI stays green when the assertion would fail. Later plans change invoice middleware. Those plans need this file to fail for real.

## Current state

`app/middlewares/__tests__/InvoicesMW.spec.js:150-163`:

```js
it('calls next after the promised is returned', () => {
  const action = Actions.getInvoices();
  middleware(action).then(() => {
    expect(dispatch.mock.calls.length).toBe(0);
    return getAllDocs('invoices').then(data => {
      expect(next.mock.calls.length).toBe(1);
      expect(next).toHaveBeenCalledWith(
        Object.assign({}, action, { payload: data })
      );
    });
  });
});
```

The same shape starts at line 166 (`handle error correctly`): `middleware(Actions.getInvoices()).then(() => { ... })` with no `return`.

Search the two in-scope spec files for `middleware(` and `.then` that are not returned. Also search `ContactsMW.spec.js` for the same pattern. Do not change assertions. Do not change production middleware.

Repo test command: `npm test -- <file>` runs Vitest. There is no TypeScript check.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Invoice middleware tests | `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` | exit 0 |
| Contact middleware tests | `npm test -- app/middlewares/__tests__/ContactsMW.spec.js` | exit 0 |

## Scope

**In scope**:

- `app/middlewares/__tests__/InvoicesMW.spec.js`
- `app/middlewares/__tests__/ContactsMW.spec.js`

**Out of scope**:

- `app/middlewares/InvoicesMW.jsx` and `ContactsMW.jsx`
- New test cases. This plan only makes existing tests wait.
- `FormMW.spec.js` unless a search shows the same unreturned pattern. If you find it, STOP and report the file. Do not expand the plan yourself.

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Return middleware test promises`.
- Do not push. No AI attribution.

## Steps

### Step 1: Find every unreturned middleware promise

In both in-scope files, find `it(` callbacks that call `.then` or a middleware function and do not `return` that promise and are not `async`.

**Verify**: `rg -n "middleware\\(" app/middlewares/__tests__/InvoicesMW.spec.js app/middlewares/__tests__/ContactsMW.spec.js` lists the call sites. You will edit only the ones that do not already return the promise.

### Step 2: Return the promise

For each unreturned chain, `return` it from the test. Prefer `async` / `await` when the chain is nested, and keep the same `expect` calls. Do not delete a test. Do not change expected action types or payloads.

**Verify**: `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js app/middlewares/__tests__/ContactsMW.spec.js` → exit 0.

### Step 3: If a test now fails, fix the test wait, not the app

A failure means the old test was skipping a real assertion, or the assertion was already wrong. Read the assertion. If the production code matches the assertion's intended behavior and the assertion is stale, update the assertion to the current behavior and write one sentence in the plan's status notes in `plans/README.md` when you mark 030 done. If you cannot tell which behavior is intended, STOP. Do not edit `InvoicesMW.jsx` in this plan.

**Verify**: the same `npm test` command exits 0.

## Test plan

- No new cases. The change is that existing cases return their promises.
- Pattern: other tests in the same file that already `return middleware(...).then(...)`.

## Done criteria

- [ ] Both spec commands exit 0
- [ ] Every `it` in the two files that asserts inside `.then` returns that promise or uses `await`
- [ ] No production file is modified (`git status`)
- [ ] `plans/README.md` row 030 is `DONE`

## STOP conditions

- The line-150 excerpt is gone because the tests were already fixed. Mark the plan `DONE` and say so. Do not invent new tests.
- A returned test fails and the correct behavior is unclear. STOP.
- The fix seems to require an edit under `app/middlewares/*.jsx`. STOP.

## Maintenance notes

New middleware tests in this repo should be `async` and `await` the middleware result. A green test that does not return its promise is not evidence.
