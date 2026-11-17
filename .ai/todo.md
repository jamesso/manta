# Plan 040: Remove dead manifest entries

Drift: package.json and package-lock.json changed for Electron ^45.3.3 and is-svg ^6.1.0 only. date-fns, overrides.enzyme, and allowScripts still match. Continue. Do not revert Electron or is-svg. Do not edit plans/README.md.

- [x] Step 1: Confirm date-fns has no source import, enzyme is not installed, styled-components@3 is absent from the lockfile, fsevents allowScripts stays
- [x] Step 2: Delete overrides.enzyme and the three stale allowScripts keys. npm uninstall date-fns. Keep fsevents@2.3.3 and moment
- [x] Step 3: npm ls date-fns shows no root dependency. npm test exit 0 (1297 passed, 2 skipped, 2 todo). npm run build exit 0
- [x] Mark plan DONE, add maintenance notes, commit plan files only

## Review

Root `date-fns`, `overrides.enzyme`, and three stale allowScripts keys are gone. `fsevents@2.3.3`, `moment`, `react-day-picker`, Electron `^45.3.3`, and is-svg `^6.1.0` stay. `plans/README.md` was not edited. No new tests.
