<p align="center">
  <img width="128" alt="Manta App Logo" src="https://github.com/user-attachments/assets/80f92e83-7dcb-4586-9c54-2d6f80fcb501" />
</p>

<h2>
  Manta
  <a href="https://github.com/jamesso/manta/actions/workflows/ci.yml">
    <img src="https://github.com/jamesso/manta/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status">
  </a>
  <a href="https://github.com/jamesso/manta/releases/latest">
    <img src="https://img.shields.io/github/v/release/jamesso/manta?label=version&color=green" alt="Latest release">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg" alt="GPL-3.0 license">
  </a>
</h2>

A desktop application for creating invoices with beautiful and customizable templates.

<a href="#about-this-repository">About</a> •
<a href="#screenshots">Screenshots</a> •
<a href="#features">Features</a> •
<a href="#downloads">Downloads</a> •
<a href="#your-data">Your data</a> •
<a href="#translations">Translations</a> •
<a href="#technologies">Technologies</a> •
<a href="#development">Development</a> •
<a href="#faq">FAQ</a> •
<a href="#credits">Credits</a>

### About this repository

Manta was created by [Hung Q. Le](https://github.com/hql287) at [hql287/Manta](https://github.com/hql287/Manta). That project has not had a release since 2018, and its builds do not run on current systems (for example, Apple Silicon Macs without Rosetta).

This repository continues Manta. It moves the app to current, supported tools and keeps your saved invoices and contacts. The main changes:

- **Electron 45.** Runs on macOS 13+, Windows 10/11 and 64-bit Linux. One universal macOS build for Apple Silicon and Intel.
- **Current libraries.** React 19, Redux 5, PouchDB 9, i18next, styled-components 6. The old drag-and-drop, animation, date picker and color picker libraries were replaced.
- **Security.** Every window runs sandboxed with context isolation. Renderers talk to the main process only through a preload bridge. Built pages have a Content Security Policy.
- **Tooling.** electron-vite for builds and hot reload, Vitest and Testing Library for unit tests, Playwright for end-to-end tests, ESLint 9 and Prettier 3.
- **Releases.** GitHub Actions builds, tests and publishes the installers. In-app updates come from this repository's [releases](https://github.com/jamesso/manta/releases).

The issue tracker, discussions and wiki of the original project do not apply to this repository. Report issues [here](https://github.com/jamesso/manta/issues).

### Screenshots

![Business Template](https://github.com/user-attachments/assets/199d6705-b248-43f4-b581-84b7e351be32)

![Minimal Template](https://github.com/user-attachments/assets/cd9d3227-41e0-4ff5-aa59-28c7f7055e4e)

![Form](https://github.com/user-attachments/assets/4d17905b-753c-472a-a906-cbba3373527a)

### Features

- 🎚 Flexible form. Turn fields on or off and save them as the default.
- 🏗 Drag and drop to reorder items.
- 📐 SVG logos for sharp printing.
- 🎨 Custom designed, highly customizable templates.
- 🏷 Custom statuses for invoices.
- 📊 Export to PDF to print or email.
- 🔒 Complete privacy. Your financial data stays on your computer.
- 💯 Free and open source (GPL-3.0).

### Downloads

[Download the latest release](https://github.com/jamesso/manta/releases/latest)

| Platform | Files                                                     |
| -------- | --------------------------------------------------------- |
| macOS    | `.dmg` or `.zip` (universal: Apple Silicon and Intel)     |
| Windows  | Installer (`.exe`) or portable `.exe`, for x64 and Arm64 |
| Linux    | `.deb` or `AppImage`, for x64 and arm64                   |

#### Supported platforms

- **macOS** 13 (Ventura) or later. No Rosetta needed.
- **Windows** 10 or 11, 64-bit (x64 or Arm64). 32-bit Windows is not supported.
- **Linux** 64-bit (x64 or arm64) distributions that current Chromium supports. See the [Chrome system requirements](https://support.google.com/chrome/a/answer/7100626).

These limits come from Electron 45. See the [Electron 45 release notes](https://www.electronjs.org/blog/electron-45-0) and [breaking changes](https://www.electronjs.org/docs/latest/breaking-changes).

#### Unsigned builds

A release can be unsigned when no code-signing certificate is set up for it. Your system then warns you the first time you open Manta:

- **macOS:** open Manta once, then go to **System Settings → Privacy & Security** and click **Open Anyway**.
- **Windows:** on the SmartScreen dialog, click **More info → Run anyway**.

#### Linux rendering problems

If parts of the window render incorrectly (for example, black select menus), start Manta with hardware acceleration off. This can make the app slower.

```sh
manta --disable-hardware-acceleration
```

### Your data

Manta keeps all data on your computer. It does not send your invoices or contacts anywhere.

| Platform | Data folder                             |
| -------- | --------------------------------------- |
| macOS    | `~/Library/Application Support/Manta`   |
| Windows  | `%APPDATA%\Manta`                       |
| Linux    | `~/.config/Manta`                       |

Invoices and contacts are in IndexedDB in this folder. Settings are in the `Settings` file. Back up this folder before you change versions.

#### Moving from the original Manta (1.1.x)

This version uses the same data folder and reads your existing invoices, contacts and settings. Install it over the old version.

The original app checks for updates from the original project, so it does not update to this version by itself. Download this version once from the [releases page](https://github.com/jamesso/manta/releases/latest). After that, Manta updates from this repository.

### Translations

Manta is available in English, Chinese (Simplified), French, German, Indonesian, Italian, Slovak, Urdu (Pakistan) and Vietnamese.

The translation files are in [`i18n/`](./i18n), one folder for each language. To add or fix a translation:

1. Copy `i18n/en` to a new folder with the language code (for example `i18n/es`), or edit an existing folder.
2. Translate the values in the JSON files. Do not change the keys.
3. Register a new language in [`i18n/i18n.js`](./i18n/i18n.js).
4. Open a pull request.

### Technologies

- [Electron](https://www.electronjs.org/) and [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/), [Redux](https://redux.js.org/) and [styled-components](https://styled-components.com/)
- [PouchDB](https://pouchdb.com/) for local storage, [electron-store](https://github.com/sindresorhus/electron-store) for settings
- [i18next](https://www.i18next.com/) for translations
- [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) for drag and drop, [Motion](https://motion.dev/) for animation
- [Vitest](https://vitest.dev/), [Testing Library](https://testing-library.com/) and [Playwright](https://playwright.dev/) for tests
- [electron-builder](https://www.electron.build/) and [electron-updater](https://www.electron.build/auto-update) for packaging and updates

### Development

Use the Node version in `.nvmrc` (Node 24). Use npm.

```sh
git clone https://github.com/jamesso/manta.git
cd manta
npm ci
```

| Command                                 | What it does                                          |
| --------------------------------------- | ----------------------------------------------------- |
| `npm run dev`                           | Start the app with hot reload.                        |
| `npm run build`                         | Build main, preload and renderer code into `out/`.    |
| `npm start`                             | Run the built app from `out/`.                        |
| `npm test`                              | Run the unit tests (Vitest).                          |
| `npm run test:watch`                    | Run the unit tests in watch mode.                     |
| `npm run test:e2e`                      | Build, then run the end-to-end tests (Playwright).    |
| `npm run lint`                          | Run ESLint.                                           |
| `npm run format` / `format:check`       | Format, or check formatting, with Prettier.           |
| `npm run build && npx electron-builder --publish never` | Build installers for your platform into `dist/`. |

Development and test runs do not use your real data folder. They use `Manta-dev` next to it. To test with a copy of real data, copy the data folder and point Manta at the copy:

```sh
cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy
MANTA_USER_DATA=/tmp/manta-profile-copy npm start
```

A pre-commit hook runs ESLint and Prettier on staged files.

If packaging on Linux fails because `icns2png` or `gm` is missing, install them. On Ubuntu/Debian: `sudo apt install -y icnsutils graphicsmagick`.

#### Releases

Push a tag that starts with `v` (for example `v1.2.0`). The [Release workflow](./.github/workflows/release.yml) builds macOS, Windows and Linux installers and publishes them to GitHub Releases. It signs and notarizes the macOS build, and signs the Windows build, only when the signing secrets are set. Otherwise it publishes unsigned builds.

See [CONTRIBUTING.md](./.github/CONTRIBUTING.md) to contribute.

### FAQ

- **Is this app built with Electron?**

  Yes. See [Technologies](#technologies).

- **What CSS/UI framework does it use?**

  Most styles are in components with [`styled-components`](https://styled-components.com/). Some layout still uses Bootstrap.

- **Where do the icons come from?**

  [Ionicons](https://ionic.io/ionicons).

- **Why is it named Manta?**

  The original author was inspired by the film [Racing Extinction](http://racingextinction.com/) and chose the name to raise awareness of the environmental issues it shows. Read more on the [original Manta website](https://manta.life).

- **Where do I report a problem?**

  Open an issue in [this repository](https://github.com/jamesso/manta/issues). Do not send reports for this version to the original author.

### Credits

[Hung Q. Le](https://github.com/hql287) created Manta, including its logo, illustrations and templates. This repository builds on that work under the same [GPL-3.0 license](./LICENSE).

Thanks to everyone who contributed code and translations to the [original project](https://github.com/hql287/Manta/graphs/contributors).
