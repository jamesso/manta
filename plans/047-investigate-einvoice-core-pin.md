# Plan 047: Decide whether to move @e-invoice-eu/core from 3.4.2 to 3.4.4

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- package.json package-lock.json helpers/einvoice main/einvoice.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/040-remove-dead-manifest-entries.md if both would edit `package.json` at the same time. Otherwise none.
- **Category**: migration
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

`@e-invoice-eu/core` is pinned to `3.4.2` with no caret. The rest of the dependencies float. On 2026-11-16, `npm outdated` reported `3.4.4` as latest. A pin can skip XML or EN 16931 fixes. It can also be intentional so golden files stay stable. This plan reads the changelog and either bumps the pin or records why 3.4.2 stays. It does not change Manta's mapper except to follow a breaking API that the changelog requires. If the API break is more than an import path, STOP.

## Current state

`package.json`: `"@e-invoice-eu/core": "3.4.2"`.

Imports:

- `main/einvoice.js` imports `InvoiceService` from `@e-invoice-eu/core`
- `helpers/einvoice/__tests__/samples.spec.js` imports `InvoiceService` from `@e-invoice-eu/core`

Golden tests live in `helpers/einvoice/__tests__/samples.spec.js`. They compare mapper output to files under `e2e/fixtures/einvoice/expected`. `UPDATE_EINVOICE_SAMPLES=1` rewrites fixtures. Do not set that variable. A fixture diff is a STOP, not a refresh.

Confirm versions with `npm view @e-invoice-eu/core versions --json` and the GitHub releases for `e-invoice-eu/core` or the package repository named in `npm view @e-invoice-eu/core repository`. Read 3.4.3 and 3.4.4 notes. Do not bump to 4.x or to a version you did not read.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Versions | `npm view @e-invoice-eu/core version` | prints the latest. Record it in the Result section. |
| Golden tests before | `npm test -- helpers/einvoice/__tests__/samples.spec.js` | exit 0 on 3.4.2, before any bump |
| Golden tests after | `npm test -- helpers/einvoice/__tests__/samples.spec.js` | exit 0 on the new pin, with no fixture edits |

## Scope

**In scope**:

- `package.json` and `package-lock.json` only if you bump the pin
- This plan file's Result section
- `main/einvoice.js` or the sample spec only if the changelog shows a renamed export you must follow. No other logic edits.

**Out of scope**:

- Regenerating `e2e/fixtures/einvoice/expected`
- Peppol, receive-side import (plan 048), and mapper refactors
- Bumping other dependencies

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Pin @e-invoice-eu/core to 3.4.4`.
- Do not push. No AI attribution.

## Steps

### Step 1: Baseline

**Verify**: `npm test -- helpers/einvoice/__tests__/samples.spec.js` exits 0 on the current pin. If it fails before any edit, STOP. Do not upgrade a red baseline.

### Step 2: Read the notes

Record the latest version and a one-line summary of each release after 3.4.2. Quote bugfix versus breaking.

If you cannot read a changelog or release page, set the plan to `BLOCKED` with that reason. Do not bump.

If every release after 3.4.2 is a docs-only or tooling change, or the notes are empty and the sample tests are the only signal, you may still install the newer 3.4.x and run the tests. If tests pass with no fixture diff, bump the pin to that exact version (no caret). If you are unsure the release is safe, leave the pin and set `REJECTED` with the note summary.

**Verify**: Result section contains the version and the note summary.

### Step 3: Bump only when tests stay green

`npm install @e-invoice-eu/core@<version>` using the exact version. Keep it exact, without a caret, matching the current pin style.

**Verify**: `npm test -- helpers/einvoice/__tests__/samples.spec.js helpers/einvoice/__tests__/toEn16931.spec.js helpers/einvoice/__tests__/getEInvoiceIssues.spec.js` exits 0. `git diff -- e2e/fixtures` is empty.

If a test fails, `npm install @e-invoice-eu/core@3.4.2` to restore, and set the README row to `REJECTED` with the failing test name. Do not edit fixtures.

## Test plan

- The existing golden sample spec. No new tests.
- Do not set `UPDATE_EINVOICE_SAMPLES`.

## Done criteria

- [ ] Result section names the latest version and what changed after 3.4.2
- [ ] Either the pin is an exact `3.4.x` newer than 3.4.2 and the sample tests pass with no fixture diff, or the pin is still `3.4.2` and the README row is `REJECTED` or `BLOCKED` with a reason
- [ ] `plans/README.md` row 047 matches that outcome

## STOP conditions

- The latest version is 4.x or higher and you were about to install it. STOP. This plan is a 3.4 patch decision.
- Golden files change. Restore 3.4.2 and STOP.
- `InvoiceService` is removed and the replacement is a different API. STOP and describe it. Do not rewrite `main/einvoice.js` in this plan.

## Maintenance notes

Leave the dependency exact until a plan reads the next changelog. A caret will pick up 3.5 or 4 without a fixture run. Reviewers should reject a bump that edits `e2e/fixtures/einvoice/expected` in the same change without a separate review of the XML.

## Result

- Review date: 2026-11-16. Latest registry version: **3.4.4**.
  `npm view @e-invoice-eu/core version`, `versions --json`, and
  `repository --json` each exited 0. The registry lists 3.4.3 and 3.4.4
  after 3.4.2; the repository is `gflohr/e-invoice-eu`.
- Release evidence read through WebSearch:
  - [3.4.3 release](https://github.com/gflohr/e-invoice-eu/releases/tag/%40e-invoice-eu%2Fcore%403.4.3):
    “Patch Changes”: correct CII identifiers BT-128/BT-18, supporting documents
    BG-24, and gross-price allowances; add the Factur-X MINIMUM buyer order
    reference; update dependencies. These are output fixes, not a stated API break.
  - [3.4.4 release](https://github.com/gflohr/e-invoice-eu/releases/tag/%40e-invoice-eu%2Fcore%403.4.4):
    “Patch Changes”: output CII originator/despatch references BT-17/BT-16,
    merge BT-17 with BT-18, map classification list versions and seller tax
    representatives, lower the BT-11 conformance level to EN16931, and update
    dependencies (except TypeScript and minimatch). No breaking export change
    is listed.
- Drift check: `git diff --stat 10f3f0e..HEAD -- package.json package-lock.json helpers/einvoice main/einvoice.js`
  exited 0. Compared the live manifest and imports with the plan. Preserved
  plans 039/028/040 manifest changes (Electron/is-svg versions and dead-entry
  removal). Plan 044's integrity helper is now
  `helpers/einvoice/exportIntegrity.js`; seller tax logic is in
  `helpers/einvoice/sellerTax.js`. Both `InvoiceService` imports and all three
  specified test paths still exist. The exact core pin remains 3.4.2 before
  the baseline. No unexpected mismatch requires a stop.
- Dependencies were absent. `npm ci` exited 0 and left the lockfile unchanged.
  Node v24.22.1; npm 11.19.1.
- Baseline: `env -u UPDATE_EINVOICE_SAMPLES npm test -- helpers/einvoice/__tests__/samples.spec.js`
  exited 0: 1 file, 6 tests passed on 3.4.2. The update variable was never set.
- Decision: test an exact 3.4.4 pin. The release notes describe relevant output
  fixes and retain the current API. Final status and post-install checks follow.
- Existing security findings: installation reported 11 moderate affected
  packages. Audit evidence identifies [minimatch denial of service](https://github.com/advisories/GHSA-g3hv-75wg-m249)
  through electron-builder/shadcn and [uuid buffer bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
  through pouchdb-browser. These are outside this dependency-only scope; no
  audit fix or unrelated dependency change was made.
- Final status: **COMPLETED — ACCEPTED**. Pinned core to exact **3.4.4**
  in `package.json` and `package-lock.json`. No import or mapper change was
  needed. The lockfile also updates core's required `jsonpath-plus` from
  11.2.2 to 11.3.0; core's declared tslib range changes to ^2.9.1, which the
  existing lock already satisfies. No unrelated package was bumped.
- `npm install --save-exact @e-invoice-eu/core@3.4.4`: exit 0.
- Post-bump: `env -u UPDATE_EINVOICE_SAMPLES npm test -- helpers/einvoice/__tests__/samples.spec.js helpers/einvoice/__tests__/toEn16931.spec.js helpers/einvoice/__tests__/getEInvoiceIssues.spec.js`:
  exit 0; 3 files and 26 tests passed, including all 6 golden samples.
- `git diff --exit-code -- e2e/fixtures`: exit 0, no fixture changes.
  `git diff --check`: exit 0. No fixtures were regenerated and no new tests
  were added. No STOP condition occurred. No running app check was needed
  for this dependency patch; the required existing tests cover XML output.
- `plans/README.md` was not edited, as directed by the operator. The
  coordinator must set row 047 to COMPLETED. `.ai/todo.md` stays untracked.
