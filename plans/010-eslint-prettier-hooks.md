# Plan 010: Replace ESLint 4 / airbnb / Prettier 1 / pre-commit with ESLint 9 flat config, Prettier 3, husky + lint-staged

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c530133..HEAD -- .eslintrc.yml package.json .gitignore`
> Plans 001–009 are expected to have changed `package.json` (that is normal).
> `.eslintrc.yml` must be unchanged. If `.eslintrc.yml` changed, or the
> `"prettier"`, `"pre-commit"`, `"lint-staged"` or `"lint"` entries in
> `package.json` no longer match the "Current state" excerpts below, treat it
> as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/009-*.md (and transitively 001–008)
- **Category**: dx
- **Planned at**: commit `c530133`, 2026-10-31

## Why this matters

The lint and format toolchain is from early 2018: ESLint 4 with `eslint-config-airbnb` 16, Prettier 1.11 and the `pre-commit` package. These versions do not understand the code that plans 001–009 produce (ESM config files, React 19, Vitest globals), and the `lint` script pipes `find` into `xargs`, so it is slow and lints build output. The pre-commit hook runs `git add` inside lint-staged, which current lint-staged versions reject. After this plan, `npm run lint` and `npm run format:check` work on Node 24, a pre-commit hook formats only staged files, and the one-time mass reformat lives in a single commit that `git blame` skips.

## Current state

Preconditions from earlier plans (not in commit `c530133`; verify before you start — STOP if any check fails):

| Precondition | Check command | Expected |
|---|---|---|
| npm with lockfile | `test -f package-lock.json && echo ok` | `ok` |
| Node 24 | `cat .nvmrc && node -v` | `24…` and `v24.…` |
| Vitest test script | `node -p "require('./package.json').scripts.test"` | `vitest run` |
| Tests green | `npm test` | exit 0 |
| electron-vite build | `npm run build` | exit 0, creates `out/main`, `out/preload`, `out/renderer` |
| No Jest left | `grep -rn "jest" package.json` | no `jest`/`babel-jest` dependency (the string may appear nowhere) |

Files this plan changes, as they are at `c530133`:

- `.eslintrc.yml` — legacy ESLint config. Excerpt (lines 1–20):

  ```yaml
  root: true
  extends:
    - airbnb
    - plugin:import/errors
    - prettier
  plugins:
    - prettier
    - jest
  env:
    node: true
    commonjs: true
    es6: true
    browser: true
    mocha: true
  globals:
    # JEST GLOBALS
    jest: false
    it: false
    describe: false
    test: false
  ```

  It then turns off ~45 rules (`rules:` block, lines 26–68), for example `radix: off`, `no-unused-vars: off`, `no-useless-escape: off`, `no-fallthrough: off`, `import/extensions: off`, `react/prop-types: off`, `jsx-a11y/label-has-for: off`.

- `package.json` (lines from `c530133`; plans 001–009 may have changed other parts):

  ```json
  "lint": "find . -name \"*.js\" -o -name \"*.jsx\" | grep -v -f .gitignore | xargs eslint",
  "prettier:base": "prettier --write",
  "prettify": "find . -name \"*.js\" -o -name \"*.jsx\" | grep -v -f .gitignore | xargs npm run prettier:base",
  "lint-staged": "lint-staged"
  ```

  ```json
  "pre-commit": [
    "lint-staged"
  ],
  "lint-staged": {
    "*.jsx?": [
      "npm run prettier:base",
      "eslint",
      "git add"
    ]
  },
  "prettier": {
    "proseWrap": "never",
    "singleQuote": true,
    "trailingComma": "es5",
    "semi": true
  }
  ```

  devDependencies at `c530133` related to this plan: `eslint ^4.18.2`, `eslint-config-airbnb ^16.1.0`, `eslint-config-prettier ^2.9.0`, `eslint-plugin-import ^2.9.0`, `eslint-plugin-jest ^21.13.0`, `eslint-plugin-jsx-a11y ^6.0.3`, `eslint-plugin-prettier ^2.6.0`, `eslint-plugin-react ^7.7.0`, `lint-staged ^7.0.0`, `pre-commit ^1.2.2`, `prettier ^1.11.1`. Some may already be removed by earlier plans — check with `npm ls --depth=0`.

- `.gitignore` (whole file at `c530133`): `.env`, `/node_modules`, `/coverage`, `/dist`, `/prod`, `/monitor`. Plan 002 should have added `/out`.

- The repo has no `// eslint-disable` comments (`grep -rn "eslint-disable" --include='*.js' --include='*.jsx' .` excluding `node_modules` returned nothing at `c530133`).

- Code style today (Prettier 1.11 defaults plus the options above): single quotes, semicolons, ES5 trailing commas, and **arrow functions without parentheses around a single parameter** (Prettier 1 default `arrowParens: "avoid"`). Example, `main/save-pdf.js:7` and `:24`:

  ```js
  ipcMain.on('save-pdf', (event, docId) => {
  ...
  fs.writeFile(pdfPath, data, error => {
  ```

  Prettier 3 defaults are `trailingComma: "all"` and `arrowParens: "always"`. This plan sets both back explicitly so the reformat diff stays small.

### Version decisions (checked on the npm registry 2026-10-31)

| Package | Version to install | Reason |
|---|---|---|
| `eslint` | `^9.39.5` | **Not ESLint 10.** `eslint-plugin-react@7.37.5` (latest) declares `peerDependencies.eslint` `^3 … ^9.7` — no `^10`. ESLint 9 supports flat config (`eslint.config.mjs`) fully. |
| `@eslint/js` | `^9.39.5` | Must match the ESLint major. |
| `eslint-plugin-react` | `^7.37.5` | Exports `configs.flat.recommended` and `configs.flat['jsx-runtime']` ([README](https://github.com/jsx-eslint/eslint-plugin-react)). |
| `eslint-plugin-react-hooks` | `^7.1.1` | Peer range includes ESLint 9 and 10. |
| `eslint-config-prettier` | `^10.1.8` | Flat-config compatible; turns off rules that conflict with Prettier. |
| `globals` | `^17.13.0` | `browser` and `node` global sets. |
| `prettier` | `^3.9.10` | |
| `husky` | `^9.1.7` | |
| `lint-staged` | `^17.6.0` | Needs Node ≥ 22.22.1 — Node 24 satisfies this. |

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 |
| Tests | `npm test` | exit 0 (same pass count as before this plan) |
| Build | `npm run build` | exit 0 |
| Lint | `npm run lint` | exit 0 (warnings allowed, 0 errors) |
| Format check | `npm run format:check` | exit 0, "All matched files use Prettier code style!" |
| Hook test | see Step 6 | lint-staged runs on commit |

## Suggested executor toolkit

- ESLint flat config docs: https://eslint.org/docs/latest/use/configure/configuration-files
- eslint-plugin-react flat config: https://github.com/jsx-eslint/eslint-plugin-react#flat-configs
- husky 9 setup: https://typicode.github.io/husky/get-started.html

## Scope

**In scope** (the only files you should modify/create/delete):
- `package.json`, `package-lock.json`
- `eslint.config.mjs` (create)
- `.eslintrc.yml` (delete)
- `.prettierrc.json` (create), `.prettierignore` (create)
- `.husky/pre-commit` (create)
- `.git-blame-ignore-revs` (create)
- Any `*.js`, `*.jsx`, `*.mjs` source file — **only** through `prettier --write` (Step 4) and `eslint --fix` (Step 5). No hand edits to source logic.

**Out of scope** (do NOT touch):
- `README.md`, `plans/**`, `*.md`, `*.yml`, `*.json` data files (`libs/currencies.json`, `i18n/**`) — do not reformat them; the Prettier run in this plan targets JS only.
- `static/**` — vendored CSS/fonts/sounds; never format or lint vendored code.
- CI files (`.travis.yml`, `.github/workflows/**`) — plan 011 owns CI and adds the lint step.
- Any change to code behaviour to satisfy a lint rule. If a rule reports a real problem that `--fix` cannot fix, list it in your report (Step 5) instead of fixing it.

## Git workflow

- Branch: `upgrade/electron-45` (shared by plans 001–011; do not create a new branch).
- Commit messages: short imperative subject, no prefix, no AI attribution. Repo examples: `Updated domain & email address`, `Fix typo in form.json (#314)`.
- Commits for this plan, in order:
  1. `Replace ESLint 4 and Prettier 1 config with ESLint 9 flat config and Prettier 3`
  2. `Format code with Prettier 3` (formatting only — nothing else in this commit)
  3. `Ignore Prettier 3 reformat in git blame`
  4. `Apply ESLint autofixes` (only if Step 5 produced changes)
  5. `Run lint-staged with husky pre-commit hook`
- Do NOT push.

## Steps

### Step 1: Remove old lint/format packages and install new ones

1. Check which old packages are still installed: `npm ls --depth=0 2>/dev/null | grep -E "eslint|prettier|lint-staged|pre-commit"`.
2. Uninstall every one of these that appears: `eslint-config-airbnb eslint-plugin-import eslint-plugin-jsx-a11y eslint-plugin-jest eslint-plugin-prettier pre-commit`.
   Example: `npm uninstall eslint-config-airbnb eslint-plugin-import eslint-plugin-jsx-a11y eslint-plugin-jest eslint-plugin-prettier pre-commit`
3. Install: `npm install --save-dev eslint@^9.39.5 @eslint/js@^9.39.5 eslint-plugin-react@^7.37.5 eslint-plugin-react-hooks@^7.1.1 eslint-config-prettier@^10.1.8 globals@^17.13.0 prettier@^3.9.10 husky@^9.1.7 lint-staged@^17.6.0`

**Verify**: `npx eslint --version` → `v9.39.x`; `npx prettier --version` → `3.9.x`; `npm ls pre-commit eslint-config-airbnb` → `(empty)` / exit 1 with "empty".

### Step 2: Write the flat ESLint config and delete `.eslintrc.yml`

Create `eslint.config.mjs` with exactly this content (adjust the `ignores` list only if `npm run build` writes to another folder):

```js
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'prod/**',
      'coverage/**',
      'static/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Vitest globals (only matters if vitest.config sets globals: true)
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        beforeAll: 'readonly',
        afterEach: 'readonly',
        afterAll: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Kept from the old .eslintrc.yml: these rules are in the new
      // recommended sets and the codebase intentionally relies on the pattern.
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
      'no-fallthrough': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
    },
  },
  prettier,
];
```

Why each kept rule is off: the old config disabled `no-unused-vars`, `no-useless-escape`, `no-fallthrough` and `react/prop-types`, and they are part of `@eslint/js` recommended / `react` recommended, so without these lines they would come back as errors. `react/display-name` is new in this setup and fires on every `compose(...)(Component)` HOC export; turning it off keeps the old behaviour.

Old rules that are **dropped on purpose** (do not port them): every `import/*`, `jsx-a11y/*` and airbnb-only rule (`radix`, `prefer-template`, `no-underscore-dangle`, `prefer-destructuring`, `no-use-before-define`, `global-require`, `one-var`, `no-unused-expressions`, `no-shadow`, `no-plusplus`, `eqeqeq`, `no-multi-assign`, `camelcase`, `no-restricted-syntax`, `consistent-return`, `no-sequences`, `class-methods-use-this`, `no-return-assign`, `default-case`, `react/sort-comp`, `react/forbid-prop-types`, `react/no-array-index-key`, `react/no-unused-state`, `react/no-unused-prop-types`, `react/require-default-props`, `react/jsx-filename-extension`). They were all `off`; without airbnb nothing turns them on, so listing them would be noise.

Then: `git rm .eslintrc.yml`.

Do NOT add `eslint-plugin-react-hooks` `configs.recommended` presets — v7 presets add React Compiler rules that flag large parts of legacy class code. The two explicit rules above are the intended scope.

**Verify**: `npx eslint --print-config app/index.jsx > /dev/null && echo ok` → `ok`; `test ! -f .eslintrc.yml && echo gone` → `gone`.

### Step 3: Prettier config, ignore file and scripts

1. Create `.prettierrc.json`:

   ```json
   {
     "proseWrap": "never",
     "singleQuote": true,
     "trailingComma": "es5",
     "semi": true,
     "arrowParens": "avoid"
   }
   ```

2. Create `.prettierignore`:

   ```
   node_modules/
   out/
   dist/
   prod/
   coverage/
   static/
   plans/
   playwright-report/
   test-results/
   package-lock.json
   *.md
   *.yml
   *.json
   ```

3. In `package.json`:
   - Delete the `"prettier"` key (moved to `.prettierrc.json`).
   - Delete the `"pre-commit"` key.
   - Replace the `"lint-staged"` key with:

     ```json
     "lint-staged": {
       "*.{js,jsx,mjs}": ["eslint --fix", "prettier --write"]
     }
     ```

   - In `"scripts"`: delete `"prettier:base"`, `"prettify"` and `"lint-staged"`; set
     `"lint": "eslint ."`,
     `"format": "prettier --write \"**/*.{js,jsx,mjs}\""`,
     `"format:check": "prettier --check \"**/*.{js,jsx,mjs}\""`,
     `"prepare": "husky"`.
     Keep every other script unchanged.

**Verify**: `node -e "const p=require('./package.json');console.log(!!p.prettier, !!p['pre-commit'], p.scripts.lint, p.scripts.prepare)"` → `false false eslint . husky`.

Commit 1 now (config + package files only; `git status` must show no source-file changes yet).

### Step 4: One-time reformat in its own commit

1. `npm run format`
2. `npm test` → must pass with the same count as before Step 1.
3. `npm run build` → exit 0.
4. `git add -A && git commit -m "Format code with Prettier 3"` — this commit must contain only formatting changes to `*.js`, `*.jsx`, `*.mjs` files.
5. Get the SHA: `git rev-parse HEAD`. Create `.git-blame-ignore-revs`:

   ```
   # Prettier 3 reformat (plan 010)
   <full 40-char SHA from git rev-parse HEAD>
   ```

   Commit 3: `Ignore Prettier 3 reformat in git blame`. GitHub reads this file automatically; locally run `git config blame.ignoreRevsFile .git-blame-ignore-revs` (local config, not committed).

**Verify**: `npm run format:check` → exit 0; `git show --stat HEAD~1 | grep -vE "\.(js|jsx|mjs) " | grep "|"` → no output (the format commit touched only JS files).

### Step 5: Lint, apply autofixes, report the rest

1. `npx eslint . --fix`
2. `npm test` → pass; `npm run build` → exit 0.
3. If files changed, commit 4 `Apply ESLint autofixes`.
4. `npm run lint` — read the remaining output.
   - **Errors** that `--fix` could not fix: do not change logic. For each rule with errors, choose one:
     - (a) If it flags a real bug (for example `no-undef` on a misspelled variable, `react-hooks/rules-of-hooks`), leave the code, and add a line to your report: `file:line rule — message`.
     - (b) If it flags a deliberate legacy pattern used in many places (≥ 5 hits of the same rule), set that rule to `'off'` in `eslint.config.mjs` with a one-line comment that says why, and list it in your report.
   - Then the errors left from case (a) would still fail `npm run lint`. For each case-(a) hit, add `// eslint-disable-next-line <rule> -- TODO plan 010 report` above the line. This is the only hand edit allowed in source files.
   - **Warnings**: leave them, list the count per rule in your report.

**Verify**: `npm run lint` → exit 0 (0 errors). `grep -c "'off'" eslint.config.mjs` → 5 plus the number of rules you turned off in this step.

### Step 6: husky pre-commit hook

1. `npx husky init` — this creates `.husky/pre-commit` (with `npm test` inside) and sets the `prepare` script.
2. Replace the whole content of `.husky/pre-commit` with one line:

   ```
   npx lint-staged
   ```

3. Confirm `"prepare": "husky"` is still the value in `package.json` (husky init may rewrite it).
4. Test lint-staged without making a commit: `printf "const a = \"x\"\n" > scratch-hook-test.js && git add scratch-hook-test.js && npx lint-staged && cat scratch-hook-test.js` → prints `const a = 'x';`. Then clean up: `git rm --cached -q scratch-hook-test.js && rm scratch-hook-test.js`. Do NOT use `git reset --hard`.
5. Commit 5: `Run lint-staged with husky pre-commit hook` (`.husky/pre-commit`, `package.json`).

**Verify**: `cat .husky/pre-commit` → `npx lint-staged`; `git config core.hooksPath` → `.husky/_`; `test ! -f scratch-hook-test.js && echo clean` → `clean`.

## Test plan

- No new unit tests: this plan changes tooling only (per repo policy, do not write tests for config).
- Behaviour safety net: `npm test` and `npm run build` must pass after Step 4 and Step 5 with the same test count as before Step 1.
- Tool checks: `npm run lint` exit 0, `npm run format:check` exit 0, hook test in Step 6.

## Done criteria

ALL must hold:

- [ ] `test ! -f .eslintrc.yml && test -f eslint.config.mjs && test -f .prettierrc.json && test -f .prettierignore && test -f .git-blame-ignore-revs && echo ok` → `ok`
- [ ] `npm run lint` exits 0
- [ ] `npm run format:check` exits 0
- [ ] `npm test` exits 0, same pass count as before this plan
- [ ] `npm run build` exits 0
- [ ] `npm ls eslint-config-airbnb eslint-plugin-import eslint-plugin-jsx-a11y eslint-plugin-jest eslint-plugin-prettier pre-commit` reports none installed
- [ ] `node -p "require('./package.json')['lint-staged']['*.{js,jsx,mjs}'].includes('git add')"` → `false`
- [ ] `.git-blame-ignore-revs` contains the SHA of the `Format code with Prettier 3` commit (`git log --format=%H --grep="Format code with Prettier 3"` matches)
- [ ] `git status` clean; no files outside the Scope list changed (`git diff --stat <SHA before this plan>..HEAD`)
- [ ] Report lists: rules turned off in Step 5 with reasons, `eslint-disable-next-line` locations, warning counts per rule
- [ ] `plans/README.md` status row for 010 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any precondition in "Current state" fails (no `package-lock.json`, tests not on Vitest, `npm run build` fails before you start).
- `npm install` reports an `ERESOLVE` peer conflict for `eslint-plugin-react` with ESLint 9. Do not use `--force` or `--legacy-peer-deps`.
- `npm test` or `npm run build` fails after the Prettier reformat (Step 4) — a formatter must never change behaviour; report the failing file.
- `npm run lint` shows more than 50 errors of one rule that is not obviously a style rule — this suggests a real problem in plans 001–009; report it rather than disabling the rule.
- `npx husky init` fails because `.git` is not at the repo root or `core.hooksPath` is already set to something else.

## Maintenance notes

- **ESLint 10**: move to ESLint 10 and `@eslint/js` 10 only after `npm view eslint-plugin-react peerDependencies` includes `^10`. The flat config in this plan needs no change for that move.
- The rules turned off in Step 2 and Step 5 are tech debt markers. Turning `no-unused-vars` back on is a good small follow-up once the React 19 migration settles.
- `eslint-plugin-react-hooks` presets were left out on purpose (React Compiler rules). Revisit if components are rewritten as function components.
- Reviewers: check the `Format code with Prettier 3` commit only for scope (JS files only); review the other commits line by line.
- Plan 011 adds `npm run lint` and `npm run format:check` to CI.
