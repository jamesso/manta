# Plan 036: One unsaved-changes rule for the invoice editor

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/helpers/form.js app/middlewares/InvoicesMW.jsx app/middlewares/UIMiddleware.jsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/035-payment-queue-error-codes.md. That plan edits `InvoicesMW.jsx` first.
- **Category**: bug
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Leaving the editor by changing tabs uses `hasUnsavedChanges`. That function is false when an open invoice has no edits since load. Starting a new invoice from a contact, or duplicating, uses `hasUnsavedFormChanges`. That function returns true whenever edit mode is on, even when nothing was edited. The user must confirm a discard that would not lose work. The two questions use different copy. This plan makes "would this lose work?" the only check. It keeps the existing confirm dialogs.

## Current state

`app/helpers/form.js`:

```js
export function hasUnsavedChanges(form) {
  if (!form || form.savePending) return false;
  if (form.settings?.editMode?.active || form.templateTarget != null) {
    return (form.formRevision ?? 0) !== (form.cleanRevision ?? 0);
  }
  return hasDraftContent(form);
}

export function hasUnsavedFormChanges(form) {
  if (form.settings.editMode.active) return true;
  if (hasDraftContent(form)) return true;
  if (form.issuedAt != null) return true;
  return form.rows.some(row => !isBlankRow(row));
}
```

`UIMiddleware.jsx` `leaveForm` uses `hasUnsavedChanges` and `form:cancel:*` strings.

`InvoicesMW.jsx` uses `hasUnsavedFormChanges` before `app:newInvoice:confirm*` at the new-invoice-from-contact path (about line 347) and at the duplicate / open path (about line 698). Search for every `hasUnsavedFormChanges` call. There are more than two.

`hasDraftContent` is true when the recipient has a name, company, or email, or a row has a description. `isBlankRow` treats unit-only rows as blank. Tests in `app/helpers/__tests__/form.spec.js` already cover draft content. Search that file for `hasUnsavedChanges` and `hasUnsavedFormChanges` before editing.

Intent to preserve:

- Tab leave of a clean open invoice does not confirm.
- Tab leave of a dirty open invoice confirms with `form:cancel:*`.
- A new invoice with typed recipient or line text confirms before it is replaced.
- A clean open invoice does not confirm when another document is opened or duplicated.
- `savePending` still suppresses the unsaved check in `hasUnsavedChanges`.

Do not treat "edit mode is on" as dirty by itself.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Form helper tests | `npm test -- app/helpers/__tests__/form.spec.js` | exit 0 |
| UI middleware tests | `npm test -- app/middlewares/__tests__/UIMiddleware.spec.js` | exit 0 |
| Invoice middleware tests | `npm test -- app/middlewares/__tests__/InvoicesMW.spec.js` | exit 0 |
| Lint | `npx eslint app/helpers/form.js app/middlewares/InvoicesMW.jsx app/helpers/__tests__/form.spec.js` | exit 0 |

## Scope

**In scope**:

- `app/helpers/form.js`
- `app/middlewares/InvoicesMW.jsx` (call sites of `hasUnsavedFormChanges` only)
- `app/helpers/__tests__/form.spec.js`
- `app/middlewares/__tests__/InvoicesMW.spec.js` only if an existing test expects a confirm on a clean edit

**Out of scope**:

- `UIMiddleware.jsx` behavior, unless a test shows it does not use `hasUnsavedChanges`. Then STOP.
- Dialog copy and i18n keys
- Form reducer revision counters. If `formRevision` is not updated on edit, STOP. Do not invent a second dirty flag.

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Confirm discard only when the editor is dirty`.
- Do not push. No AI attribution.

## Steps

### Step 1: Tests for the helper

Add cases to `form.spec.js`:

- Edit mode on, `formRevision === cleanRevision`, no extra draft signal required: `hasUnsavedChanges` is false.
- Edit mode on, revisions differ: `hasUnsavedChanges` is true.
- New form (edit mode off) with a recipient name: true.
- New form with only blank rows and an empty recipient: false.
- `savePending` true: false even when revisions differ.

If `hasUnsavedFormChanges` has tests that expect true whenever edit mode is on, change those tests to the revision rule and switch them to `hasUnsavedChanges`. Delete `hasUnsavedFormChanges` only after no caller remains.

**Verify**: `npm test -- app/helpers/__tests__/form.spec.js` → the new clean-edit case passes with the current `hasUnsavedChanges`. Do not make that helper return true for every edit.

### Step 2: Switch InvoicesMW

Replace every `hasUnsavedFormChanges(...)` with `hasUnsavedChanges(...)`. Keep the `app:newInvoice:*` confirm when the helper returns true. When it returns false, keep the current `apply()` / `proceed()` path.

Remove `hasUnsavedFormChanges` from `form.js` when `rg -n "hasUnsavedFormChanges" app` prints nothing.

**Verify**: `npm test -- app/helpers/__tests__/form.spec.js app/middlewares/__tests__/UIMiddleware.spec.js app/middlewares/__tests__/InvoicesMW.spec.js` → exit 0.

### Step 3: Lint

**Verify**: the eslint command exits 0. `rg -n "hasUnsavedFormChanges" app` prints nothing.

## Test plan

- Helper cases in step 1.
- Existing UIMiddleware and InvoicesMW tests must still pass.
- No DOM test.

## Done criteria

- [ ] The three test commands exit 0
- [ ] `hasUnsavedFormChanges` is gone
- [ ] InvoicesMW uses `hasUnsavedChanges` at every former call site
- [ ] A clean edit does not take the confirm branch
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` row 036 is `DONE`

## STOP conditions

- `formRevision` does not change when the user types, so `hasUnsavedChanges` is always false in edit mode. Report the reducer. Do not fall back to "always confirm".
- A caller outside `InvoicesMW.jsx` uses `hasUnsavedFormChanges`. Add that file to the edit only if it is a one-line call replacement. If it needs new behavior, STOP.
- An InvoicesMW test encodes "always confirm in edit mode" and you cannot see a dirty fixture to flip. STOP and quote the test name.

## Maintenance notes

New "leave the editor" paths should call `hasUnsavedChanges` and a confirm. Do not add a second predicate. `savePending` is what blocks a prompt during save. Reviewers should check duplicate and new-from-contact still prompt when the new-invoice draft has text.
