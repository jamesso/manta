# Plan 048: Spike an offline e-invoice receive path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- main/einvoice.js helpers/einvoice app/helpers/backup.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S for the spike. A later build would be L or XL.
- **Risk**: LOW for this spike. The future import would be MED.
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Manta exports XRechnung and Factur-X. It does not read a supplier e-invoice back in. Plan 025 records a German duty to receive e-invoices from 2025-01-01 and points at secondary write-ups. This spike does not re-litigate that duty and does not add a network. The product question is whether a local file can become a preview the user can file, without mixing it into sales invoices by accident.

Do not implement the importer. The deliverable is a Result section in this file.

## Current state

`main/einvoice.js` imports `InvoiceService` from `@e-invoice-eu/core`, `toEn16931`, `toUblJson`, and `getEInvoiceIssues`. The file is an export pipeline. Search `main/` and `helpers/einvoice/` for `parse`, `import`, and `fromUbl`. At plan time there is no receive path.

`app/helpers/backup.js` rejects documents that contain `_attachments`. A received PDF or XML cannot be stuffed into the current backup format without a version bump.

Sales documents use `docType` `invoice`, `estimate`, or `creditNote` in the `invoices` database. A missing `docType` means invoice. Putting a supplier invoice in that database without a new type would make it count as revenue.

Out of scope forever for this spike, already decided:

- Peppol and any access point
- A French approved platform (PA/PDP)
- Sending the received file anywhere

`@e-invoice-eu/core` may already parse UBL. Read its exports in `node_modules/@e-invoice-eu/core` or the package readme. Quote the parse function name if one exists. Do not add a second XML library in this spike.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| No receive path | `rg -n "fromUbl|parseInvoice|importXml" main helpers/einvoice app --glob '!**/__tests__/**' --glob '!node_modules/**'` | no production receive function. If one exists, describe it and stop designing a second one. |

## Scope

**In scope**:

- This plan file, Result section
- Reading `main/einvoice.js`, `helpers/einvoice/`, `app/helpers/backup.js`, and the core package readme

**Out of scope**:

- New IPC channels, UI, database fields, and dependencies
- Fixture XML that you author as a new feature
- Legal advice. You may quote plan 025. Do not add a new legal claim.

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks.
- Do not push. No AI attribution.

## Steps

### Step 1: Confirm export-only

**Verify**: the `rg` command. Write what you found in Result.

### Step 2: Answer the design questions in Result

Write short answers:

1. Which function in `@e-invoice-eu/core`, if any, reads UBL or CII? If none, say the spike cannot name a parser and STOP inside the Result. Do not pick a new dependency.
2. Where a received document would live. Recommend a new `docType` or a new database. Do not recommend storing it as an `invoice`. Say why dashboard and CSV would count it.
3. Whether the first version stores the original XML as text on the document or only a normalized preview. Note the backup `_attachments` rejection. A text field does not need an attachment. A PDF embed does.
4. What the user sees in v1: file picker, validation issues from the existing `getEInvoiceIssues` style, save, and no posting to accounting.
5. Open questions that need the operator: retention, whether received credit notes are in scope, and backup version number. Do not pick a backup version. The current series ended at the version plan 024 described as 6. Read `BACKUP_VERSION` in `app/helpers/backup.js` and quote the constant.

**Verify**: Result contains all five answers. `git diff --stat` shows no file outside this plan and `plans/README.md`.

## Test plan

- None. No production change.

## Done criteria

- [ ] Result answers the five questions or stops at question 1 with the library fact
- [ ] No application source file is modified
- [ ] README row 048 is `DONE`
- [ ] The Result says a follow-up build plan is required before any IPC or schema work

## STOP conditions

- You start a UI or a database field. Revert it.
- The library has no parser and you were about to add `fast-xml-parser` or similar. STOP.
- A receive path already exists. Describe it. Do not design a second one.

## Maintenance notes

A build plan that follows this spike must keep received documents out of `onlyInvoices` totals, must stay offline, and must refuse a newer backup rather than importing a partial model. That build is not this plan.
