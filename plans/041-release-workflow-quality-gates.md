# Plan 041: The release workflow runs the same checks as CI before it packages

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 10f3f0e..HEAD -- .github/workflows/release.yml .github/workflows/ci.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `10f3f0e`, 2026-11-16

## Why this matters

Pushing a `v*` tag builds installers. That workflow runs `npm ci`, `npm test`, and `npm run build`. Pull-request CI also runs lint, `format:check`, and Playwright. A tag can publish an app that `main` would reject. This plan copies those three steps into the release job, before packaging and before signing.

## Current state

`.github/workflows/ci.yml` runs, on macOS, Windows, and Ubuntu: `npm ci`, lint, `format:check`, `npm test`, `npm run build`, Playwright, and `electron-builder --publish never`. Read the file for the exact step names and the `CSC_IDENTITY_AUTO_DISCOVERY` env. Copy the lint, format, and Playwright steps. Do not copy `--publish never` into the release workflow. Release must keep its publish and signing steps.

`.github/workflows/release.yml` (about lines 23–25):

```yaml
- run: npm ci
- run: npm test
- run: npm run build
```

Signing detection starts after the build (`Detect signing credentials`). Playwright in CI needs the build output. Put lint and `format:check` after `npm ci` and before `npm test`. Put Playwright after `npm run build` and before signing and packaging. Read both files and match CI's Playwright invocation, including any `npx playwright install` step. If CI relies on a cache for browsers, add the same cache. Do not invent a browser install if CI does not have one.

Do not print secret values. The workflow already references secret names (`MAC_CSC_LINK`, `WIN_CSC_LINK`, and the Apple API names). Leave those env mappings as they are.

This plan cannot push a tag. The verification is YAML structure plus a local lint of the workflow if a tool exists. `actionlint` may be absent. If it is absent, skip it and say so. Do not install it globally.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Steps present | `rg -n "format:check|eslint|playwright" .github/workflows/release.yml` | at least one match for format, one for eslint or `npm run lint`, and one for playwright |
| Local lint (optional) | `npx --yes actionlint .github/workflows/release.yml` | exit 0, or the command is missing and you record that |

Do not run `npm run test:e2e` as the verification of this YAML edit. That builds installers' test app and is not required to prove the workflow text.

## Scope

**In scope**:

- `.github/workflows/release.yml`

**Out of scope**:

- `.github/workflows/ci.yml` behavior. You may read it. Do not change it unless a step cannot be copied without a shared composite action. STOP instead of creating a composite.
- Signing secrets, certificate files, and `electron-builder` config
- README text (plan 042)

## Git workflow

- Stay on the current branch. Do not create a branch or a worktree.
- Do not commit unless the operator asks. Example subject: `Run lint and e2e before a tagged release`.
- Do not push. No AI attribution. Do not push a tag.

## Steps

### Step 1: Copy the missing CI steps

Edit `release.yml` so each OS job runs, in order:

1. checkout, setup-node, `npm ci` (already present)
2. `npm run lint`
3. `npm run format:check`
4. `npm test`
5. `npm run build`
6. The same Playwright step CI uses
7. The existing signing detection, packaging, and publish steps

Keep `fail-fast: false` and the OS matrix. Keep `permissions: contents: write`.

**Verify**: the `rg` command in the table matches. `rg -n "publish never" .github/workflows/release.yml` prints nothing.

### Step 2: Lint the workflow if actionlint runs

**Verify**: `npx --yes actionlint .github/workflows/release.yml` exits 0. If `npx` cannot fetch it, record "actionlint not run" in the README row when you mark the plan done. Do not block on a network failure. Read the YAML once more for indentation errors.

## Test plan

- No unit test. The workflow file is the product.
- Do not add a test that shells out to `gh workflow run` unless the operator asks.

## Done criteria

- [ ] `release.yml` runs lint, `format:check`, unit tests, build, and Playwright before packaging
- [ ] Signing and publish steps still exist and still use the existing secret names
- [ ] CI workflow file is unchanged
- [ ] `plans/README.md` row 041 is `DONE`

## STOP conditions

- CI's Playwright step depends on a local path or a composite action you cannot see in `.github/workflows/ci.yml`. STOP and quote the step.
- Copying the step would publish artifacts (`--publish always` or a release upload) before tests finish. STOP.
- `actionlint` reports an error you cannot fix by indentation or by matching CI. STOP and paste the one-line error. Do not disable the step.

## Maintenance notes

When CI gains a new required check, add it here too, before packaging. A release job that only runs `npm test` will drift again.
