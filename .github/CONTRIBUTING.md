# Contributing to Manta

Thank you for helping with Manta. This guide tells you how to:

- Work on the Manta code
- Get help
- Make it more likely that your change is accepted

This repository continues the original [hql287/Manta](https://github.com/hql287/Manta). Open issues and pull requests here, not in the original project.

## Get in touch

Before you start a feature or a fix, open an issue so we can discuss it. For a change that is not small, describe:

- Why the change is necessary, and the use case.
- How the UI will look, if the change alters the UI.
- What could go wrong, and which tests it needs.
- How you plan to implement it. If you do not know where to start, ask.

## Follow the Code of Conduct

Manta uses the [Contributor Covenant](https://www.contributor-covenant.org/version/1/4/code-of-conduct/). All contributors must follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Making changes

### Development setup

1. Install the Node version in `.nvmrc` (Node 24). Use npm.
2. Clone the project and install dependencies:

   ```sh
   git clone https://github.com/jamesso/manta.git
   cd manta
   npm ci
   ```

3. Run `npm run dev` to start the app with hot reload.

Development runs use a separate `Manta-dev` data folder, so they do not touch your real invoices. See [Development in the README](../README.md#development) for all commands, and for how to test with a copy of real data.

### Code guidelines

- Add unit tests with [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/) for new logic, components and helpers.
- Add or update a [Playwright](https://playwright.dev/) test in `e2e/` when you change an app-level flow (windows, startup, tour).
- Renderer code has no Node access. To call the main process, add a channel to the preload bridge in `preload/` and its allow-list.
- Do not include code that is not related to your issue.

Before you open a pull request, make sure these pass:

```sh
npm run lint
npm run format:check
npm test
npm run test:e2e
```

A pre-commit hook runs ESLint and Prettier on staged files.

### Commits and commit messages

- Keep commits discrete: do not put unrelated changes in one commit.
- Keep commits self-contained: each commit must make sense alone.
- Write a short, imperative subject with no prefix (for example `Fix tax rounding on the invoice total`).
- If the commit is for an issue, add `Issue: #123` on a separate line.
- Do not add AI or tool attribution lines (such as `Co-authored-by` for an AI tool, or "Generated with ..."). A `commit-msg` hook removes them.

### Adding or refactoring custom fields

The original project has a guide for this: [Adding and Refactoring Custom Fields](https://github.com/hql287/Manta/wiki/Adding-and-Refactoring-Custom-Fields). It was written for the old code, so the file names and tools in it can be out of date.

### Submitting your change

Open a pull request against `main`. CI runs lint, format check, unit tests, end-to-end tests and a packaging build on macOS, Windows and Linux. A review can take several rounds. Change requests help keep the quality high.

## Thanks

Thank you for your help, large or small.
