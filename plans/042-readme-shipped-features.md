# Plan 042: The README feature list matches the shipped app

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: DONE
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

The README is what a new user and a new contributor read. The Features section still describes the older invoice app. The app now has estimates, partial payments, credit notes, recurring drafts, an item catalog, JSON backup, and offline e-invoice export. The status line omits the display status `partial`. People file issues against a product the file does not describe.

## Current state

`README.md` Features (about lines 53–64) lists a flexible form, drag and drop, SVG logos, templates, these statuses: Draft, Pending, Overdue, Paid, Refunded, and Cancelled, PDF export, XRechnung and Factur-X, local data, light and dark mode, and GPL-3.0.

Shipped code to mention, in one short bullet each. Do not describe internals:

- Estimates that convert to invoices (`app/containers/Estimates.jsx`)
- Payments and a Partially paid display when a pending invoice has a payment and a remaining balance (`app/helpers/invoice.js` `getDisplayStatus` returns `partial`)
- Credit notes (`app/helpers/creditNotes.js`)
- Recurring profiles that create draft invoices when the app runs (`app/helpers/recurring.js` sets `status: 'draft'`). They do not send email by themselves.
- An item catalog (`app/containers/Items.jsx`)
- JSON backup and CSV export (`main/backup.js`)
- Email opens the user's mail client. It does not attach the PDF. The app can show the PDF in its folder. Do not promise SMTP.

Keep the existing XRechnung / Factur-X bullet. Keep the local-data bullet. Do not add Peppol, a French e-invoicing platform, or online accounts.

Also add the release signing secret **names** under the existing Releases paragraph (`README.md` around line 171), which says secrets are set but does not name them. Names only, from `.github/workflows/release.yml`: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`. State that a missing set publishes an unsigned build for that OS. Do not invent how to obtain a certificate.

No test run is required for this prose change. Do not run the unit suite.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Feature words | `rg -n "Estimate|Partially paid|Credit note|Recurring|backup|catalog" README.md` | at least one match for each idea |
| Secret names | `rg -n "MAC_CSC_LINK|WIN_CSC_LINK" README.md` | both names appear |
| No secret values | `rg -n "BEGIN CERT|AKIA" README.md` | no matches |

## Scope

**In scope**:

- `README.md` Features list, the status sentence, and the Releases signing paragraph

**Out of scope**:

- `plans/README.md` (you still update the status row for this plan when done)
- Screenshots
- i18n files
- Code changes to match the README. If the README would claim a behavior the code does not have, delete that claim.

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Document shipped invoice features in the README`.
- Do not push. No AI attribution.

## Steps

### Step 1: Rewrite the feature bullets

Keep the current bullets that are still true. Add the bullets in Current state. Change the status bullet so Partially paid is described as a display state of a pending invoice that still has a balance, not as a stored status. Read `getDisplayStatus` if you are unsure. Stored statuses stay draft, pending, paid, refunded, and cancelled.

Mention that recurring invoices are created as drafts and are not emailed automatically.

**Verify**: the first `rg` command matches. Read the section once. Every bullet is a user-visible behavior.

### Step 2: Name the signing secrets

Under Releases, list the seven secret names and the unsigned outcome. Link the workflow file path `.github/workflows/release.yml`. Do not add secret values.

**Verify**: the two `rg` commands in the table succeed (names present, cert markers absent).

## Test plan

- No automated test. Prose only.
- Skipped `npm test` on purpose.

## Done criteria

- [x] Features mention estimates, partial payment display, credit notes, recurring drafts, items, and backup
- [x] The file does not say recurring mail is sent automatically
- [x] The file does not say the mail client receives an attachment
- [x] Signing secret names are listed and no secret value is present
- [ ] `plans/README.md` row 042 is `DONE` (index left for the operator)

## STOP conditions

- A feature bullet would be false. Example: you cannot find estimates in `app/containers`. Drop that bullet and report it. Do not add it.
- You feel you need a screenshot or a new markdown file. STOP. This plan only edits `README.md`.

## Maintenance notes

When a later plan adds a user-facing feature, update this list in the same change. The signing names must match `release.yml` if those env names change.

Executed 2026-11-16 on `plan-033-041-043`. Drift `git diff --stat 10f3f0e..HEAD -- README.md` was empty (exit 0). Edited `README.md` only. `npm test` skipped on purpose.

- `rg -n "Estimate|Partially paid|Credit note|Recurring|backup|catalog" README.md` — exit 0. Each idea matches.
- `rg -n "MAC_CSC_LINK|WIN_CSC_LINK" README.md` — exit 0. Both names appear, with the other five secret names.
- `rg -n "BEGIN CERT|AKIA" README.md` — exit 1. No matches.
