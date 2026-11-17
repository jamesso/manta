# Plan 050: Spike a review step after recurring drafts are created

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- app/helpers/recurring.js app/helpers/recurringRunner.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **State**: DONE
- **Priority**: P3
- **Effort**: S for the spike. A later build is about M.
- **Risk**: LOW for the spike
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Recurring profiles create draft invoices when the app runs. They do not send mail and they do not issue numbers. The user opens each draft to issue and email it. People with several retainers do that by hand after every catch-up. A review queue can list those new drafts and offer the existing email flow. It must not issue numbers unless the user asks, and it must not send mail by itself.

Do not build the queue.

## Current state

`app/helpers/recurring.js` `buildInvoiceFromProfile` sets `status: 'draft'`, `docType: 'invoice'`, `_id` `rec-<profileId>-<periodKey>`, and deletes `invoiceID`:

```js
const draft = {
  ...template,
  rows,
  _id: `rec-${profile._id}-${periodKey}`,
  status: 'draft',
  docType: 'invoice',
  issuedAt,
  created_at: now,
  recurringId: profile._id,
  periodKey,
  dueDate,
};
delete draft.invoiceID;
```

`app/helpers/recurringRunner.js` `saveInvoiceDraft` calls `db.saveDoc('invoices', invoice)`. A 409 that belongs to the period is a skip, not a second draft.

Email of an existing invoice already exists (`main/email-invoice.js`, `app/helpers/emailDraft.js`). The mail client does not receive an attachment. Do not design SMTP.

Numbering: a generated draft gets a number when the user first saves or issues it, not when the runner creates it. A queue action named "issue" would consume `invoice.numbering`. The default in this spike stays "leave as draft".

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Draft has no number | `rg -n "delete draft.invoiceID|status: 'draft'" app/helpers/recurring.js` | both match |

## Scope

**In scope**:

- This plan file, Result section
- Reading `recurring.js`, `recurringRunner.js`, and the email helper names

**Out of scope**:

- Profile schema changes, new buttons, and automatic `mailto:`
- Changing tombstone ids
- Plan 034's delete behavior

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks.
- Do not push. No AI attribution.

## Steps

### Step 1: Confirm drafts stay unnumbered

**Verify**: the `rg` command matches.

### Step 2: Write the spec in Result

Include:

1. The queue is the set of invoices with `recurringId`, `status: 'draft'`, and no `invoiceID`, created since the previous successful runner pass. If "since last pass" is not stored, say the queue is "all unnumbered recurring drafts" and do not invent a new timestamp in this spike. Name the field a build plan would add if the operator wants "only the drafts from the last run".
2. Allowed actions: open the draft, and the existing email action only after the document has a number and passes `canEmail`. Quote `canEmail` from `app/helpers/emailDraft.js` (it rejects drafts).
3. Forbidden actions in the default: auto-issue, auto-send, and any path that calls the numbering writer inside `runRecurringOnce`.
4. An optional per-profile flag is a later plan. Default off. Turning it on must still show a confirm before numbers are consumed. Describe the confirm in one sentence. Do not add the flag to the profile document now.
5. Test cases for the build plan: runner still creates a draft without `invoiceID`. A second run does not duplicate it. The queue helper excludes issued invoices and tombstones.

**Verify**: Result contains those five parts. No source file outside this plan and `plans/README.md` changes.

## Test plan

- None in this spike.
- The Result lists the three test cases in item 5.

## Done criteria

- [x] Result contains the five parts
- [x] The spec does not auto-send and does not auto-issue by default
- [x] No application file is modified
- [ ] README row 050 is `DONE`

## STOP conditions

- You add a profile field or a button. Revert it.
- The spec calls `shell.openExternal` or `mailto` from the runner. Remove that.
- `canEmail` allows drafts. Quote the function and STOP. The email rule is different from this plan's assumption.

## Result

Drift: `app/helpers/recurring.js` and `app/helpers/recurringRunner.js` are unchanged since `10f3f0e`.

The search matched `status: 'draft'` and `delete draft.invoiceID` in `buildInvoiceFromProfile`. A recurring draft has no `invoiceID`.

`canEmail` in `app/helpers/emailDraft.js` returns false for a draft. It also requires `invoiceID`, and it rejects `cancelled` and `refunded`. It does not allow drafts. The spike continues.

1. The queue is every invoice with `recurringId`, `status: 'draft'`, no `invoiceID`, and no `recurringTombstone`. `lastRunAt` is stored on the profile and is overwritten with the runner `now` after a checkpoint. It is not a list of the drafts from that pass, and the previous value is not kept. The queue is therefore all unnumbered recurring drafts. Do not add a timestamp in this spike. A build plan that wants only the last run should add `runnerPassAt` on the draft, set to that pass's `now`, and compare it with the profile `lastRunAt`.

2. Allowed actions: open the draft. The existing email action is allowed only after the document has an `invoiceID` and `canEmail` returns true. `canEmail` rejects drafts, so a draft in the queue cannot be emailed.

3. Forbidden in the default: auto-issue, auto-send, and any path that calls the numbering writer inside `runRecurringOnce`. A 409 that belongs to the period stays a skip. The runner does not call `shell.openExternal` or open a `mailto:` link.

4. An optional per-profile flag is a later plan. Default off. Do not add the flag to the profile document now. If a later plan turns it on, the user must confirm before numbers are consumed. The confirm says how many drafts will receive an invoice number, and it does not send mail.

5. Tests for the build plan:
   - The runner still creates a draft without `invoiceID`.
   - A second run does not create a second draft for the same period.
   - The queue helper excludes issued invoices and tombstones.

This spike does not build the queue. A follow-up build plan is required before any button or profile field.

## Maintenance notes

State: DONE. `plans/README.md` was not edited. The operator maintains that index.

`runRecurringOnce` must stay safe to retry. A review queue that issues numbers has to use the same numbering writer as a manual save (`runInvoiceNumberingWrite`), not a new counter. That wiring belongs to the build plan.
