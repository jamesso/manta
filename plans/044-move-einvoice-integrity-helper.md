# Plan 044: Main-process e-invoice code does not import the renderer tree

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- main/einvoice.js helpers/einvoice app/helpers/einvoiceExportIntegrity.js helpers/email.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **State**: DONE
- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

`main/einvoice.js` imports `validateEInvoiceExportPayload` from `app/helpers/einvoiceExportIntegrity.js`. That file imports `app/helpers/invoice.js` and `app/helpers/tax.js`. The main process, which prints legal XML and PDF, depends on the renderer helper tree. `helpers/einvoice/toEn16931.js` also imports `getSellerTaxIds` from `app/helpers/tax.js`. A UI-only import added to `invoice.js` can break the main bundle. This plan moves the shared integrity function to `helpers/einvoice/` and leaves a one-line re-export in the old path so renderer imports keep working.

## Current state

`main/einvoice.js`:

```js
import { validateEInvoiceExportPayload } from '../app/helpers/einvoiceExportIntegrity.js';
import { toEn16931 } from '../helpers/einvoice/toEn16931.js';
```

`app/helpers/einvoiceExportIntegrity.js` starts with imports from `../constants/units`, `./docType`, `./invoice`, `./tax`, and `../../helpers/einvoice/money.js`. It exports `validateEInvoiceExportPayload`. Search for other exports before the move. Every export must still be importable from the old path.

`helpers/einvoice/toEn16931.js:11`:

```js
import { getSellerTaxIds } from '../../app/helpers/tax.js';
```

`getSellerTaxIds` is the second crossing. Move it only if it has no React or `window` dependency. Read `app/helpers/tax.js` `getSellerTaxIds`. If it is a pure function, move that function to `helpers/einvoice/sellerTax.js` (or the existing `helpers/einvoice/` file that already talks about seller ids) and re-export it from `app/helpers/tax.js`. If it reads `window` or a React module, STOP. Do not move it.

`helpers/email.js` imports `EMAIL_REGEX` from `app/helpers/clients.js`. That is a similar crossing. Leave it. Do not widen this plan.

Tests: `app/helpers/__tests__/einvoiceExportIntegrity.spec.js` if it exists, and `helpers/einvoice/__tests__/`. Search for `einvoiceExportIntegrity` imports and update them only if the re-export is not enough. Prefer the re-export so test paths stay.

`npm test -- helpers/einvoice app/helpers/__tests__/einvoiceExportIntegrity.spec.js` is the gate. If the app spec path does not exist, test the file that currently imports the validator. Find it with `rg -n "validateEInvoiceExportPayload" --glob '!plans/**' --glob '!node_modules/**'`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| No main import of app helpers | `rg -n "from '\\.\\./app/|from '\\.\\./\\.\\./app/" main helpers/einvoice --glob '!**/__tests__/**'` | no matches |
| Tests | `npm test -- helpers/einvoice` | exit 0 |
| Build | `npm run build` | exit 0 |
| Lint | `npx eslint main/einvoice.js helpers/einvoice app/helpers/einvoiceExportIntegrity.js app/helpers/tax.js` | exit 0 |

The `rg` in the table is allowed to match a test. Production `main/` and `helpers/einvoice/` must not import `app/`.

## Scope

**In scope**:

- `app/helpers/einvoiceExportIntegrity.js` (move, then re-export)
- `helpers/einvoice/` (new home)
- `main/einvoice.js` import path
- `helpers/einvoice/toEn16931.js` and `app/helpers/tax.js` only for `getSellerTaxIds` if it is pure
- Tests that break only because of the path

**Out of scope**:

- `helpers/email.js` and `EMAIL_REGEX`
- Changing validation rules, XML shape, or fixtures
- `preview/` imports of `app/components`

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Move e-invoice validation into shared helpers`.
- Do not push. No AI attribution.

## Steps

### Step 1: Read the exports and `getSellerTaxIds`

List every export of `einvoiceExportIntegrity.js`. Read `getSellerTaxIds`. Note whether it uses `window`, JSX, or a renderer module.

**Verify**: you can name the exports in the plan notes you keep locally. If `validateEInvoiceExportPayload` is not exported, STOP.

### Step 2: Move the file

Place the implementation in `helpers/einvoice/exportIntegrity.js`. Update its imports so they do not use `app/components`. Imports of pure `app/helpers` modules are still a layering break. For `getInvoiceTotals`, `getDocType`, and `getSellerTaxIds`, keep those imports only if moving them would pull UI code. The goal of this plan is `main/` and `helpers/einvoice/` do not import `app/`. If `exportIntegrity.js` still needs `app/helpers/invoice.js`, STOP and report the symbol list. Do not paper over it with a dynamic import.

`app/helpers/einvoiceExportIntegrity.js` becomes:

```js
export {
  validateEInvoiceExportPayload,
} from '../../helpers/einvoice/exportIntegrity.js';
```

Add every other former export to that list.

Point `main/einvoice.js` at `../helpers/einvoice/exportIntegrity.js`.

If `getSellerTaxIds` is pure, move it and re-export from `app/helpers/tax.js`. Update `toEn16931.js` to import the new module.

**Verify**: the `rg` command prints no production matches. `npm test -- helpers/einvoice` exits 0. Also run the existing integrity spec if `rg` found one: `npm test -- app/helpers/__tests__/einvoiceExportIntegrity.spec.js`.

### Step 3: Build and lint

**Verify**: `npm run build` exits 0. The eslint command exits 0.

## Test plan

- Existing e-invoice and integrity tests. No new rule tests.
- Do not regenerate golden XML fixtures.

## Done criteria

- [x] `main/einvoice.js` imports the validator from `helpers/einvoice/`
- [x] `rg` shows no `app/` import under `main/` or `helpers/einvoice/` (tests excluded)
- [x] The old `app/helpers/einvoiceExportIntegrity.js` path still re-exports the same names
- [x] `npm test -- helpers/einvoice` and `npm run build` exit 0
- [ ] `plans/README.md` row 044 is `DONE`

## STOP conditions

- Moving the file requires `window` or a React import in `helpers/einvoice/`. STOP.
- Golden XML tests fail after a move that did not change logic. You introduced a behavior change. Revert the logic and STOP with the test name.
- `getSellerTaxIds` is not pure. Leave `toEn16931.js` as it is and say so in the README row. Still move the integrity module if it can move alone. If the integrity module's remaining `app/` imports include more than `getSellerTaxIds`, STOP.

## Maintenance notes

New e-invoice checks belong in `helpers/einvoice/`. `main/einvoice.js` should import that folder and `@e-invoice-eu/core` only. The re-export can be deleted in a later cleanup once `rg` shows no renderer imports of the old path. Do not delete it in this plan.

State: DONE. `plans/README.md` was not edited. The operator maintains that index.

`getSellerTaxIds` is pure. It now lives in `helpers/einvoice/sellerTax.js`. `app/helpers/tax.js` re-exports it. `toEn16931.js` imports the new module.

`getDocType` is pure. The doc-type module now lives in `helpers/docType.js`. The old path re-exports it.

`validateEInvoiceExportPayload` now lives in `helpers/einvoice/exportIntegrity.js`. The old path re-exports `validateEInvoiceExportPayload`, `taxGroupMultisetSignature`, `priceWithinFourDecimals`, and `linePriceQuantityCentsMatch`.

`exportIntegrity.js` also needs `getAmountPaid`, `getDueDate`, `getInvoiceTotals`, `getIssuedAt`, and `UNIT_CODES`. Those functions do not use `window` or React. They now live outside `app/` so the main process does not import `app/helpers/invoice.js`:

- `helpers/invoiceTotals.js` holds the total, payment, issue-date, and due-date helpers.
- `helpers/money.js`, `helpers/taxGroups.js`, `helpers/docStatuses.js`, `helpers/estimateStatus.js`, and `helpers/units.js` hold the pure helpers those totals need.
- The old `app/` paths re-export the same names.

`helpers/email.js` was not changed. Validation rules, XML shape, and fixtures were not changed.
