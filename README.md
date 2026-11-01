<p align="center">
  <img width="128" alt="457761" src="https://github.com/user-attachments/assets/80f92e83-7dcb-4586-9c54-2d6f80fcb501" alt="Manta App Logo" width="180" height="auto" />
</p>

<h2>
  Manta
  <a href="https://travis-ci.org/hql287/Manta">
    <img src="https://travis-ci.org/hql287/Manta.svg?branch=dev" alt="Build Status">
  </a>
  <a href="https://github.com/jamesso/manta/releases/latest">
    <img src="https://img.shields.io/badge/version-1.1.4-green.svg" alt="v1.1.4">
  </a>
  <a title="Crowdin" target="_blank" href="https://crowdin.com/project/manta">
    <img src="https://d322cqt584bo4o.cloudfront.net/manta/localized.svg">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg">
  </a>
</h2>

A desktop application for creating invoices with beautiful and customizable templates.

<a href="#screenshots">Screenshots</a> •
<a href="#features">Features</a> •
<a href="#downloads">Downloads</a> •
<a href="#technologies">Technologies</a> •
<a href="#why">Why?</a> •
<a href="#goals">Goals</a> •
<a href="#development">Development</a> •
<a href="#faq">FAQ</a> •
<a href="#acknowledgement">Acknowledgement</a>

### Screenshots

Here's a few screenshots of Manta. [See more](https://github.com/hql287/Manta/wiki/Screenshots)

![Business Template](https://github.com/user-attachments/assets/199d6705-b248-43f4-b581-84b7e351be32)

![Minimal Template](https://github.com/user-attachments/assets/cd9d3227-41e0-4ff5-aa59-28c7f7055e4e)

![Form](https://github.com/user-attachments/assets/4d17905b-753c-472a-a906-cbba3373527a)

### Translation

Do you speak multiple languages? We need your help!

If you're interested in translating Manta, please see the [detailed instruction here](https://github.com/hql287/Manta/wiki/Translating-Manta).
The following languages are currently being translated, if you would like to Manta to support another language, [please submit your request here](https://github.com/hql287/Manta/issues/9).

* [🇨🇳 中文 (Chinese Simplified)](https://crowdin.com/project/manta/zh-CN#)
* [🇨🇳 中文 (Chinese Traditional)](https://crowdin.com/project/manta/zh-TW#)
* [🇩🇪 Deutsch (German)](https://crowdin.com/project/manta/de#)
* [🇩🇰 Dansk (Danish)](https://crowdin.com/project/manta/da#)
* [🇪🇸 Español (Spanish)](https://crowdin.com/project/manta/es-ES)
* [🇫🇷 Français (French)](https://crowdin.com/project/manta/fr#)
* [🇬🇷 Ελληνικά (Greek)](https://crowdin.com/project/manta/el#)
* [🇮🇩 Indonesian](https://crowdin.com/project/manta/id#)
* [🇮🇹 Italiano (Italian)](https://crowdin.com/project/manta/it#)
* [🇯🇵 日本語 (Japanese)](https://crowdin.com/project/manta/ja#)
* [🇰🇷 한국어 (Korean)](https://crowdin.com/project/manta/ko#)
* [🇱🇹 Lietuviškai (Lithuanian)](https://crowdin.com/project/manta/lt#)
* [🇳🇱 Nederlands (Dutch)](https://crowdin.com/project/manta/nl#)
* [🇵🇹 Português (Portuguese)](https://crowdin.com/project/manta/pt-PT#)
* [🇧🇷 Portuguese, Brazilian (Brazil)](https://crowdin.com/project/manta/pt-BR#)
* [🇷🇺 Русский (Russian)](https://crowdin.com/project/manta/ru#)
* [🇹🇭 ไทย (Thai)](https://crowdin.com/project/manta/th#)
* [🇹🇷 Türkçe (Turkish)](https://crowdin.com/project/manta/tr#)
* [🇻🇳 Việt Nam (Vietnamese)](https://crowdin.com/project/manta/vi)

### Features
* 🎚 Flexible form. You can turn on/off field and save as default setting.
* 🏗 Drag & drop for reordering items. This makes editing easier.
* 📐 Use SVGs for logo for better printing.
* 🎨  Custom designed & highly customizable templates.
* 🏷 Custom statuses for invoices.
* 📊 Export PDF for print or email.
* 🔒Complete Privacy. You financial data stays where it belongs.
* 💯 Totally Free.

### Downloads

macOS | Windows | Linux
-----------------| ---| ---|
[Download latest release](https://github.com/jamesso/manta/releases/latest)

#### Supported Platforms

- **macOS** 13 (Ventura) or later — one universal download for Apple Silicon and Intel Macs (no Rosetta needed).
- **Windows** 10 or 11, 64-bit (x64 or Arm64). 32-bit Windows is no longer supported.
- **Linux** 64-bit (x64 or arm64) distributions supported by current Chromium — see [Chrome system requirements](https://support.google.com/chrome/a/answer/7100626). Packages: `.deb` and `AppImage`.

These limits come from Electron 45 (see the [Electron 45 release notes](https://www.electronjs.org/blog/electron-45-0) and [breaking changes](https://www.electronjs.org/docs/latest/breaking-changes)).

Note that on Linux, some users might experience a GPU bug where the select options rendered as a black box, see [issue #128 of Manta](https://github.com/hql287/Manta/pull/128) and [issue #4322 of Electron](https://github.com/electron/electron/issues/4322). This can be fixed by disabling hardware acceleration like so:

```sh
manta --disable-hardware-acceleration
```

> Remember that doing this might lead to some degradation of the app's performance. This is why "the fix" is not included by default.

### Technologies
* [Electron](https://github.com/electron/electron)
* [React](https://github.com/facebook/react)
* [Redux](https://github.com/reactjs/redux)
* [React-DnD](https://github.com/react-dnd/react-dnd)
* [React-Beautiful-DnD](https://github.com/atlassian/react-beautiful-dnd)
* [React-Motion](https://github.com/chenglou/react-motion)
* [Webpack](https://github.com/webpack/webpack)


### Why
The main reason I decided to build this is because I need a simple tool to create good looking invoices, estimates, and receipts but couldn't find one  that suits my needs. I don't do invoicing for a living but I do need it occasionally so an ideal invoicing app just needs to be good at one thing and one thing only, which is making invoices. I really don't need a full-fledged bookkeeping or accounting software.

I believe there are many people such as freelance designers, developers, photographers or writers... also have such need. However, most (if not all) products I found have these these problems:

**Complexity**

* Most invoicing products nowadays is web-based, which means you’ll need to maintain a new account (possible a monthly fee, too) just to create an invoice.
* Sure, there some open-source products that can be self-hosted, but that will introduce a new layer of complexity to your workflow. Who will setup the product? Who will maintain the server? Who will cover the cost? ...
* You will always need internet connection to be able to create your invoices. It can be slow sometimes.

**Privacy**

* When you use a web service, most of the time, you’re giving away your data whether you want it or not. Financial data is sensitive and I believe that no one should know about your data except yourself.


### Goals
With that in mind, I know that Manta would need to satisfy these criteria:

* 🚀 Fast!!!
* 👍 Friendly UI & UX
* 🎉 Has nice looking templates
* 🔒 Does not touch user’s data
* 💰 Free! :)

  If you think Manta delivers these, let me know by putting a star on this project 😉

### Development

Use the Node version in `.nvmrc`.

* Clone this project to your local machine.
* Open terminal and `cd` into the cloned folder, usually `cd Manta`.
* Run `npm ci` to install dependencies.
* Run `npm run dev` to start the app with hot reload.
* Run `npm test` for unit tests.
* Run `npm run test:e2e` for end-to-end tests.
* Run `npx electron-builder --publish never` to build installers into `dist/`.

This is still in beta and it's far from perfect so feedbacks, issues or PRs are greatly appreciated! :)

Note that on Linux you will need additional dependencies to provide the `icns2png` and `gm` commands.
Ubuntu/Debian users can run: `sudo apt install -y icnsutils graphicsmagick`.

### FAQ

* **Is this app built with Electron?**

Yes, it's built on top of [Electron](#). Please see the [Technologies](#technologies) section for more info.

* **What boilerplate did you use**

None. This is my attempt to integrate Electron with React from scratch. The idea was to get a better understanding of how things work together, especially Webpack.
But I do take cue from other projects.

* **What CSS/UI Framework did you use?**

I wrote all the CSS myself. I only use Bootstrap for prototyping at first. But I gradually encapsulate most of the style to the component with the help of [`styled-components`](https://www.styled-components.com/). There is some places still use Bootstrap mostly for layout purpose but I'll get rid of it eventually.

* **Where did you get the icons?**

[ionicons](http://ionicons.com/). They're great!

* **Why did you name the project Manta? It has nothing to do with invoicing.**

It's actually very common to associate an animal with your brand. There's a reason behind the Twitter bird, the famous MailChimp Freddy or the Docker whale ... It's called the Baby-Face bias. You can read more about it in the book [Designing for Emotion](https://abookapart.com/products/designing-for-emotion) by [Aaron Walter](http://aarronwalter.com/).
In my case, I was inspired by the movie [Racing Extinction](http://racingextinction.com/) and by naming this project Manta, I hope to raise people's awareness on some environmental issues mentioned in the movie. You can [read more about it here](https://usemanta.app/about/)

* **I like Manta's logo, did you design it?**

Yes, I actually did all the illustrations as well as the templates that you see in the app.

* **Are you available for hire?**

Yes, I'm exploring new opportunities at the moment. Please let me know what you have in mind.

* **How do I contact you?**

If you find an issue, please report it here. For everything else, please drop me a line at hi@usemanta.app

### Acknowledgement

Special thanks to [Crowdin](https://crowdin.com) for providing [an open-source license](https://crowdin.com/page/open-source-project-setup-request) for Manta. Feel free to check out [their website](https://crowdin.com/) for more information about this amazing localization management platform.
