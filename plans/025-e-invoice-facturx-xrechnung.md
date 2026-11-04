# Plan 025: Export Factur-X/ZUGFeRD (EN 16931) hybrid PDFs and XRechnung XML, fully offline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- main/save-pdf.js main/print-options.js app.js preload/index.js app/helpers/invoice.js app/components/settings/sections app/components/contacts app/components/invoices/InvoiceDetailSheet.jsx preview/containers/SideBar.jsx preview/templates helpers package.json i18n/en`
> Plans 012–024 change most of these files on purpose (016 creates the settings sections and the client editor, 018 restyles the preview sidebar, 019–023 add unit codes, payments, tax rates, document types and credit notes). Compare only the parts that this plan depends on (listed in "Current state" part b). Compare `main/save-pdf.js` with the start-of-plan baseline: 017 adds an onboarding flag. Preserve that addition and normal PDF behavior. Reconcile intended predecessor changes rather than requiring byte equality with `3e89104`.
>
> **Rule**: do NOT add `Co-authored-by` trailers or any AI/tool attribution to commits, PR texts or files. Pass this rule to any subagent.

## Review rules (2026-11-01)

These rules take precedence over conflicting commands below. Before a live app check, call Jean `get_run_environments` and use the existing environment. If none runs, use Jean `start_run_environment` with its configured command. Do not start another server by hand or guess its port. Record the exact URL or Electron launch target used. Use a fresh disposable profile, never the production profile; do not delete or overwrite an existing review profile. For IndexedDB persistence checks, use the built `file://` app with `MANTA_USER_DATA`, because a dev HTTP origin cannot prove access to the existing `file://` database. A copied Settings file can still point `invoice.exportDir` at a real folder: change it to a disposable export directory before any export check. Run focused tests during each step. Run the full unit suite, lint and e2e once at the end, rather than after every edit. A passing library demo is not proof of the app's IPC, state or file behavior.

## Status

- **Priority**: P3
- **Effort**: XL, split in two phases in this file: **025a** (L: data fields, mapper, validator, XRechnung XML) and **025b** (M: Factur-X PDF/A-3 hybrid). Ship 025a alone if 025b hits a STOP condition.
- **Risk**: HIGH (legal compliance; PDF/A-3 conformance of Chromium output)
- **Depends on**: 016 (Settings sections, client editor, `ipc.invoke`), 018 (preview sidebar, PDF scripts), 019 (`unitCode`), 021 (tax categories, tax IDs), 023 (credit notes, type code 381). Also uses 014 (`getIssuedAt`, `getDueDate`, detail sheet), 015 (numbering), 020 (`getAmountPaid`), 022 (`getDocType`).
- **Category**: feature
- **Planned at**: commit `3e89104`, 2026-11-01 (runs after 018 and after 019–024)

## Why this matters

- Germany: every business must be able to receive e-invoices since 2025-01-01. Issuing is mandatory from 2027-01-01 for prior-year turnover above €800,000, and for all businesses from 2028-01-01 ([vatit](https://vatit.com/e-invoicing-guide/germany/)). A plain PDF is then no longer a valid B2B invoice in Germany.
- Germany accepts XRechnung and ZUGFeRD from 2.0.1, but not the profiles MINIMUM and BASIC WL. In a hybrid file the XML is the legal invoice ([PwC on BMF letter 15.10.2024](https://newsletter.pwc.de/umsatzsteuer/nl0029-2024-10-29/bmf-e-rechnung), [IHK Köln on BMF letter 15.10.2025](https://www.ihk.de/koeln/hauptnavigation/recht-steuern/steuern/bmf-schreiben-zur-e-rechnung-vom-15-10-2025-6774012)).
- EU ViDA: e-invoicing and digital reporting for intra-EU B2B start July 2030 ([Revenue.ie](https://www.revenue.ie/en/vat/vida-vat-modernisation/vida-implementation-timeline.aspx)).
- France: from 2026-09-01 all businesses must receive e-invoices; large and mid-size companies must issue them; SMEs from 2027-09-01. French invoices must go through an approved platform (PA/PDP), so a Factur-X file sent by email is not enough in France ([Fonoa](https://www.fonoa.com/resources/blog/french-e-invoicing-reform), [Solvimon](https://www.solvimon.com/blog/france-e-invoicing-2026)). This plan does not connect to a platform.
- Manta users are freelancers and small firms. Without this plan they must buy other software before 2028.

## Preconditions

| Check | Command | Expected |
|---|---|---|
| Branch | `git branch --show-current` | record the current branch; keep it |
| 016 settings sections | `ls app/components/settings/sections/BusinessProfile.jsx app/components/settings/sections/InvoiceDefaults.jsx` | both exist |
| 016 client editor | `grep -n "getContactErrors\|buildContact" app/helpers/clients.js && ls app/components/contacts/ClientEditorDialog.jsx` | exports + file |
| 016 `ipc.invoke` | `grep -n "invoke:" preload/index.js` | 1 hit |
| 013 dialog API | `grep -n "export" ui/lib/dialog.js` | write down the confirm function name (expected `confirm`) |
| 018 done | `test ! -d modal && ls scripts/pdf-snapshot.mjs scripts/pdf-compare.sh` | both exist, no `modal/` |
| 014 helpers | `grep -n "export.*\(getIssuedAt\|getDueDate\|getInvoiceNumber\)" app/helpers/invoice.js` | 3 exports |
| 014 detail sheet | `ls app/components/invoices/InvoiceDetailSheet.jsx` | exists |
| 015 numbering | `grep -n "numbering" app.js` | `invoice.numbering` default |
| 019 unit codes | `grep -n "UNIT_CODES\|DEFAULT_UNIT_CODE" app/constants/units.js` | both exports (`'C62'` default) |
| 020 payments | `grep -n "export.*getAmountPaid" app/helpers/invoice.js` | 1 hit |
| 021 totals | `grep -rn "export.*getInvoiceTotals" app/helpers` | 1 hit; returns `{ mode, lines: [{ net }], subtotal, discount, taxTotal, grandTotal, taxBreakdown: [{ key, category, rate, base, amount, exemptionReason }] }` |
| 021 tax rates and IDs | `grep -rn "export.*\(getTaxRates\|getSellerTaxIds\|roundMoney\)" app/helpers` | 3 hits (021 adds no `app.js` default; it reads with a fallback) |
| 021 snapshots | `grep -rn "taxCategory\|exemptionReason" app/helpers/form.js app/helpers/tax.js \| head -5` and `grep -rn "invoice.seller\|seller:" app/helpers/form.js \| head -3` | rows store `taxRate`, `taxCategory`, `exemptionReason`; saved docs get `seller: { taxId, vatId }` |
| 021 client tax ID | `grep -n "taxId" app/helpers/clients.js` | `buildContact` keeps `taxId` |
| 022 doc type | `grep -rn "export.*getDocType" app/helpers` | 1 hit |
| 023 credit notes | `grep -rn "creditedInvoice\b\|creditedInvoice:" app/helpers app/middlewares \| head -3` and `grep -rn "CREDIT_NOTE_STATUSES" app/constants` | snapshot `creditedInvoice: { invoiceID, issuedAt }`; statuses `draft, issued, void` |
| Unit tests, lint | `npm test && npm run lint` | exit 0 |
| Data copy | `ls /tmp/manta-profile-copy` | exists; else `cp -R "$HOME/Library/Application Support/Manta" /tmp/manta-profile-copy` |
| Java (validation only) | `java -version` | 17 or newer. If missing, install Eclipse Temurin 17+. Code steps can start without it. Done criteria need it. |

If a name differs, use the real name everywhere in this plan. If a thing does not exist, STOP.

## Current state

### a) At `3e89104` (012–024 do not change these parts)

`main/save-pdf.js:8-29` — the only PDF writer. Main reads settings itself:
```js
ipcMain.on('save-pdf', async (event, docId) => {
  const exportDir = appConfig.get('invoice.exportDir');
  const pdfPath = path.join(exportDir, `${docId}.pdf`);
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    const data = await win.webContents.printToPDF(
      getPrintOptions(appConfig.get('general.printOptions'))
    );
    await fs.promises.writeFile(pdfPath, data);
    if (appConfig.get('general.previewPDF')) { await shell.openPath(pdfPath); }
    win.webContents.send('pfd-exported', { title: 'PDF Exported', body: 'Click to reveal file.', location: pdfPath });
  } catch (error) { console.error('save-pdf failed:', error); }
});
```
`main/print-options.js:4-15` — `getPrintOptions(saved)` returns `{ landscape, printBackground, margins: { marginType }, preferCSSPageSize: true }`.

`app.js:178-186` — the seller address is one free-text string. There is no country, no bank account:
```js
    profile: {
      logo: logoBase64String,
      fullname: 'Manta Ray',
      company: 'Oceanic Preservation Society',
      address: '336 Bon Air Center #384 Greenbrae, CA 94904',
      email: 'info@opsociety.org',
      phone: '+01 (0) 1-2345-6789',
      website: 'http://www.opsociety.org/',
    },
```
`app.js:220-239` — `setInitialValues()` adds missing level-1 and level-2 keys only ("Changing anything deeper would need to be done with migration").

`app/components/form/RecipientForm.jsx:13` — a contact has only `const { fullname, company, email, phone } = formData;`. Contacts have **no address**.

`preview/templates/business/components/Header.jsx:72-86` (and `minimal/components/Footer.jsx:34-49`) print `profile.company`, `profile.fullname`, `profile.address`, `profile.email`, `profile.phone`, then `recipient.company`, `recipient.fullname`, `recipient.email`, `recipient.phone`.

`app/components/form/Tax.jsx:117-118` — legacy invoice-level tax methods `default` and `reverse`. `app/helpers/invoice.js:1-49` — legacy `getInvoiceValue` computes one tax on the discounted subtotal.

### b) Expected after 012–024 (expectations; check with Preconditions)

- 014 Step 2: `getIssuedAt(invoice)` = `invoice.issuedAt ?? invoice.created_at ?? null`; `getDueDate(invoice)` = ms or `null`; `getInvoiceNumber(invoice)`. `InvoiceDetailSheet.jsx` opens from a table row.
- 015 Decisions 4 and 8: saved docs always have `invoiceID`; `issuedAt` is the business date.
- 016 Step 8: `BusinessProfile.jsx` edits `profile.{logo, fullname, company, address, email, phone, website}`; `InvoiceDefaults.jsx` edits `invoice.*`; each section saves the whole section object with `onSave`. Step 1–4: `ClientEditorDialog.jsx` with `getContactErrors`/`buildContact` in `app/helpers/clients.js`, action `updateContact` (`CONTACT_UPDATE`). Step 13: `preload` `ipc.invoke`. 016 Decision 1: editing a client does not change existing invoices.
- 018 Step 7: preview sidebar is a function component with a scroll area and a sticky footer (`border-t p-4 flex flex-col gap-2`); `savePDF` still sends `save-pdf`. 018 does not change `main/save-pdf.js`.
- 019 Step 2: `app/constants/units.js` `UNIT_CODES`, `DEFAULT_UNIT_CODE = 'C62'`; rows have optional `unitCode`.
- 020 Step 2: `getAmountPaid(invoice)` (rounded to `currency.fraction`).
- 021 Decisions 5–12 and Step 1: `invoice.taxRates = [{ id, name, rate, category, isDefault, exemptionReason, active }]` (UNCL5305 `S Z E AE K G O`); rows snapshot `taxRateId`, `taxRate`, `taxCategory`, `exemptionReason`; Persist `taxMode: 'line'` and `taxCalc: 1` for new line-mode documents, including when Tax is off; legacy mode stays explicit/read-compatible. Do not infer mode only from a non-empty row tax field. `getInvoiceTotals(doc)` rounds each line net, allocates the discount to groups in proportion (remainder on the largest group), and rounds tax once per group (BR-CO-17) to `currency.fraction`. Group key = category + rate; Conflicting non-empty exemption reasons in one category/rate group are rejected; preserve the validated group reason. `E`, `AE`, `K`, `G`, `O` need a reason. Seller IDs: `profile.taxId`, `profile.vatId`, read through `getSellerTaxIds(profile, invoiceSettings)`; saved docs get the snapshot `seller: { taxId, vatId }`, which the templates print. Contact `taxId` → `recipient.taxId` (printed). 021 Maintenance note: "025 must read `getInvoiceTotals(doc).taxBreakdown` … and `doc.seller` / `doc.recipient.taxId`."
- 022: `getDocType(doc)` → `'invoice' | 'estimate' | 'creditNote'`.
- 023 Decisions 1–2: credit note doc has `invoiceID` (`CN-0001`), `creditedInvoiceId`, snapshot `creditedInvoice: { invoiceID, issuedAt }` ("025 maps it to BT-25/BT-26"), stored statuses `draft | issued | void`, positive row amounts.

## Reference facts (recheck versions and APIs at execution)

- **Factur-X / ZUGFeRD**: current release ZUGFeRD 2.5.2 = Factur-X 1.09.2, effective 2026-09-01; technically identical; CII D22B, backward compatible with D16B; profiles MINIMUM, BASIC WL, BASIC, EN 16931, EXTENDED, plus reference profile XRECHNUNG ([FeRD 2.5.2](https://www.ferd-net.de/en/downloads/publications/details/zugferd-252-english), [vatupdate 2.5.2](https://www.vatupdate.com/2026/08/06/germany-france-zugferd-2-5-2-factur-x-1-09-2-technical-update-published-effective-1-september-2026/), [Factur-X EN](https://fnfe-mpe.org/factur-x/factur-x_en/), [2.3.3 press release](https://www.ferd-net.de/fileadmin/user_upload/FeRD/Downloads/Press_Release_Factur-X_1.07.3_ZUGFeRD_2.3.3.pdf)).
- **Hybrid PDF requirements**: PDF/A-3 (level b), embedded file `factur-x.xml` with `AFRelationship` `Alternative` (EN 16931 profile), XMP extension schema prefix `fx` (`DocumentType INVOICE`, `DocumentFileName factur-x.xml`, `Version 1.0`, `ConformanceLevel EN 16931`), `pdfaid:part 3`, an sRGB output intent, all fonts embedded. Chromium `printToPDF` (Puppeteer `page.pdf()` too) has no PDF/A mode; a post-process step must add these parts ([ChromicPDF notes](https://readme.hex.pm/chromic_pdf/1.5.0)). Electron `printToPDF` returns `Promise<Buffer>`: https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions
- **Chosen library: `@e-invoice-eu/core` 3.4.2** (2026-10-22), license WTFPL. WTFPL is GPL-compatible ([FSF list](https://www.gnu.org/licenses/license-list.html#WTFPL)). Dependencies are pure JS: `@cantoo/pdf-lib` 2.11.1 (MIT), `xmlbuilder2` (MIT), `ajv` (MIT), `jsonpath-plus` (MIT), `@esgettext/runtime` (WTFPL), `tmp-promise` (MIT), `@e965/xlsx` (Apache-2.0, [GPLv3-compatible](https://www.gnu.org/licenses/license-list.html#apache2)). It uses `child_process` only to call LibreOffice for spreadsheet input; Manta never passes spreadsheet input. Formats (case-insensitive): `CII`, `UBL`, `XRECHNUNG-CII`, `XRECHNUNG-UBL`, `Factur-X-Minimum`, `Factur-X-Basic WL`, `Factur-X-Basic`, `Factur-X-EN16931`, `Factur-X-Extended`, `Factur-X-XRechnung`. API (from `dist/invoice/invoice.service.d.ts`): `new InvoiceService(logger).generate(input, { format, lang, pdf?: { buffer, filename, mimetype }, noWarnings?, customMetadata? })` → `string` (XML) or `Uint8Array` (PDF). Input is UBL-shaped JSON (`{ "ubl:Invoice": { "cbc:ID": "…", "cac:…": … } }`, all values strings, attributes as `"cbc:X@attr"`, 0..n elements as arrays) ([internal format](https://gflohr.github.io/e-invoice-eu/en/docs/details/internal-format/), [core README](https://github.com/gflohr/e-invoice-eu/tree/main/packages/core)). For Factur-X it loads the given PDF, attaches `factur-x.xml` (Alternative), writes XMP (`pdfaid`, `fx` extension), sets the trailer ID, adds an sRGB output intent, fixes link annotations, and sets MarkInfo. It reads the seller name for the metadata from `cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName`, so that key is required. Type code `381` turns the UBL output into `ubl:CreditNote` automatically. Its schema exports code lists at `invoiceSchema.$defs.codeLists` (`ISO3166`, `UNCL5305`, `UNECERec20`, `vatex`, `UNCL4461`). The author calls the PDF/A conversion "not battle-tested" ([repo](https://github.com/gflohr/e-invoice-eu)), so Step 0 tests it on Manta output first.
- **Rejected libraries**: `node-zugferd` 0.1.1-beta.1 (MIT, marked WIP, last release 2025-08, no XRechnung). `@lucaapp/zugferd-ts` 0.1.0 (Apache-2.0, very new, needs `xmllint-wasm`). Ghostscript PDF/A conversion: native binary, not shipped with Electron; rejected.
- **XRechnung**: current 3.0.2; validator configuration `v2026-08-31` (`xrechnung-3.0.2-validator-configuration-2026-08-31.zip`) for KoSIT validator 1.6.3 (`validator-1.6.3-standalone.jar`) ([config releases](https://github.com/itplr-kosit/validator-configuration-xrechnung/releases), [validator releases](https://github.com/itplr-kosit/validator/releases)). XRechnung 4.0 is a preview only (final expected 2027). Since XRechnung 3.0.1, BT-34 (seller electronic address) and BT-49 (buyer electronic address) are required, scheme `EM` = email ([e-rechnung-bund](https://e-rechnung-bund.de/en/new-version-xrechnung-standard-3-0-1-available/)). BR-DE-15 requires BT-10 (buyer reference / Leitweg-ID) to be present ([BR-DE-15](https://invoicekit-2ie.pages.dev/en/errors/br-de-15)). Leitweg-ID check digits use ISO 7064 MOD 97-10 ([Leitweg-ID spec 2.0.2](https://e-rechnung.service.rlp.de/fileadmin/zre-upload.rlp.de/allgemeine_Dokumente/Leitweg-ID-Formatspezifikation-v2-0-2.pdf)); `991-33333TEST-33` and `04011000-1234512345-06` are valid.
- **Decision: XRechnung as UBL** (`XRECHNUNG-UBL`). Both syntaxes are legal. The library input is UBL-shaped, so UBL output needs no syntax change, and UBL is the Peppol syntax that most receivers read. The Factur-X XML is CII (mandatory for Factur-X).
- **CLI usage**: KoSIT `java -jar validator-1.6.3-standalone.jar -s <scenarios.xml> -r <config dir> [-h] [-p] FILE…`; exit code 0 = all files acceptable, n > 0 = n files rejected ([cli.md](https://raw.githubusercontent.com/itplr-kosit/validator/main/docs/cli.md)). Mustang `java -Xmx1G -Dfile.encoding=UTF-8 -jar Mustang-CLI-2.26.0.jar --no-notices --action validate --source <file>`; it checks PDF/A and XML of a PDF, or only the XML; valid → `<summary status="valid"/>` and exit 0 ([Mustang CLI](https://www.mustangproject.org/commandline/), [release core-2.26.0](https://github.com/ZUGFeRD/mustangproject/releases)). veraPDF: `verapdf --flavour 3b <file>`; Docker image `verapdf/cli` ([docs](https://docs.verapdf.org/cli/validation), [Docker Hub](https://hub.docker.com/r/verapdf/cli)).
- **UBL paths per BT**: Peppol BIS 3 UBL tree https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/tree/
- Confirm versions at run time: `npm view @e-invoice-eu/core version license dependencies`.

## Commands you will need

```bash
npm view @e-invoice-eu/core version license
npm install @e-invoice-eu/core@3.4.2            # exact pin, see Step 1
npx vitest run helpers/einvoice                  # pure helpers
UPDATE_EINVOICE_SAMPLES=1 npx vitest run helpers/einvoice/__tests__/samples.spec.js
npm run build && MANTA_USER_DATA=/tmp/manta-profile-copy npm start
node scripts/pdf-snapshot.mjs /tmp/manta-pdf-after && sh scripts/pdf-compare.sh /tmp/manta-pdf-baseline /tmp/manta-pdf-after --light-ref
npm test && npm run lint && npm run test:e2e
```
Validators (once, outside the repo):
```bash
mkdir -p ~/manta-validators && cd ~/manta-validators
curl -LO https://github.com/itplr-kosit/validator/releases/download/v1.6.3/validator-1.6.3-standalone.jar
curl -LO https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-08-31/xrechnung-3.0.2-validator-configuration-2026-08-31.zip
unzip -o -d xr-config xrechnung-3.0.2-validator-configuration-2026-08-31.zip && ls xr-config   # find scenarios.xml
curl -LO https://github.com/ZUGFeRD/mustangproject/releases/download/core-2.26.0/Mustang-CLI-2.26.0.jar
docker pull verapdf/cli:latest                    # optional second PDF/A opinion
```

## Scope

**In scope**
- Seller data in settings: `profile.legalName`, `profile.postalAddress`, `profile.bank` (IBAN/BIC → payment means `58`).
- Client data: `postalAddress`, `buyerReference` (Leitweg-ID) on contacts; copied into `invoice.recipient` like the other contact fields.
- Pure mapper `toEn16931(invoice, settings, derived)`, pure validator `getEInvoiceIssues(model, { format })`, pure `toUblJson(model)`. Fixtures and golden XML in `e2e/fixtures/einvoice/`.
- XRechnung UBL XML export (save dialog). Factur-X EN 16931 hybrid PDF export (025b).
- Settings › Invoice defaults › "E-invoice" section with a disclaimer confirm, a seller checklist and a default format.
- Preview sidebar "E-invoice" section with the fix-it checklist and the export buttons. Invoice detail sheet: "Copy client details" fix.
- Templates print the structured addresses, buyer reference and bank details when they exist (PDF and XML must show the same data).
- Local validation with KoSIT, Mustang and veraPDF (exact commands).

**Out of scope**: Peppol or any network sending; French PA/PDP platforms; receiving or parsing incoming e-invoices; automatic parsing of the old free-text address (the checklist asks the user instead); delivery date (BT-72) and invoicing period (no form field today; see Maintenance notes); category `K` (intra-community supply of goods needs BT-72 and BT-80); EXTENDED/BASIC profiles; legacy invoice-level tax (e-invoices need 021 per-line tax); CI validation with Java (optional, Maintenance notes).

**Files to create**: `helpers/einvoice/{codes.js,money.js,identifiers.js,toEn16931.js,getEInvoiceIssues.js,toUblJson.js,address.js}`, `helpers/einvoice/__tests__/{identifiers,toEn16931,getEInvoiceIssues,toUblJson,samples}.spec.js`, `app/helpers/einvoice.js`, `app/helpers/__tests__/einvoice.spec.js`, `main/einvoice.js`, `app/components/settings/sections/EInvoiceSettings.jsx`, `app/components/einvoice/EInvoiceChecklist.jsx`, `preview/components/sidebar/EInvoice.jsx`, `e2e/fixtures/einvoice/*.json` (6 cases), `e2e/fixtures/einvoice/expected/*.xml`, `e2e/fixtures/einvoice/README.md` (validation commands; this file is input for the executor, not a report).

**Files to change**: `app/helpers/form.js` (+ preservation/snapshot tests), invoice template profile resolution in `preview/containers/MainContent.jsx` (confirm live path), `package.json`, `package-lock.json`, `app.js` (defaults, `require('./main/einvoice')`), `preload/index.js`, `vitest.setup.js` (if the mock needs `invoke`), `app/components/settings/sections/{BusinessProfile,InvoiceDefaults}.jsx`, `app/helpers/clients.js`, `app/components/contacts/ClientEditorDialog.jsx`, `app/components/invoices/InvoiceDetailSheet.jsx`, `preview/containers/SideBar.jsx`, `preview/templates/business/components/Header.jsx`, `preview/templates/minimal/components/Footer.jsx`, the 016 settings import validation in `app/helpers/settings.js` (only if it rejects unknown keys), `e2e/app.e2e.mjs`, `i18n/en/{common,settings,contacts,preview}.json`, `README.md` (one feature line).

**Files to delete**: none.

## Git workflow

Continue on the current branch. Do not create a worktree or switch branches unless the user explicitly asks. Use short imperative commit subjects, with no attribution lines. Do not push or create a PR unless asked.

## Steps

### Step 0 (025b gate): PDF/A-3 feasibility spike — throw-away, no commit

1. Record the initial working-tree status first. Install the candidate package without changing the manifest or lockfile (`npm install --no-save --package-lock=false @e-invoice-eu/core@3.4.2`). Do not require a clean tree or discard pre-existing changes.
2. `npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-spike` (018 script; it prints real Chromium PDFs).
3. Write `/tmp/spike.mjs` (outside the repo). It reads `/tmp/manta-spike/business-default-light.pdf`, builds a minimal valid `ubl:Invoice` JSON by hand (one line, 19 % `S`, DE seller/buyer, IBAN, due date), and calls `new InvoiceService(console).generate(json, { format: 'Factur-X-EN16931', lang: 'en', pdf: { buffer, filename: 'spike.pdf', mimetype: 'application/pdf' } })`. Import the candidate through an absolute resolved module URL, or use `createRequire` anchored at the repository package.json. ESM does not resolve bare imports through `NODE_PATH` ([Node ESM resolution](https://nodejs.org/api/esm.html#no-node_path)). Do not rely on `NODE_PATH` for `/tmp/spike.mjs`. Write `/tmp/spike-fx.pdf`.
4. Validate: Mustang command on `/tmp/spike-fx.pdf`, and veraPDF `--flavour 3b`.

**Verify**: Mustang prints `<summary status="valid"/>` (exit 0); veraPDF reports `isCompliant="true"`. Repeat with `minimal-default-light.pdf`. Record the result in your report. If PDF/A fails, write down the failing rule IDs (for example `6.2.11.4.1` fonts) and do 025a only (STOP condition for 025b). Compare `git diff` and `git status` with the recorded initial state: no manifest or lockfile changes from the spike. Do not remove user changes.

### Phase 025a

### Step 1: Install the library

`npm install --save-exact @e-invoice-eu/core@3.4.2` (confirm the registry and upstream API first; use the same exact version for the spike, install and validators, and update every version assertion together). It is a main-process dependency. electron-vite externalizes `dependencies` in the main build.
**Verify**: `npm ls @e-invoice-eu/core` → `3.4.2`; `npm run build && grep -c "@e-invoice-eu/core" out/main/index.js` → ≥ 1 and the file did not grow by more than 50 kB (`ls -l`), so the library is required at run time, not bundled.

### Step 2: Settings defaults and new-document seller snapshot

In `app.js` `setInitialValues()` add level-2 defaults:
- `profile.legalName: ''`
- `profile.postalAddress: { street: '', additional: '', postcode: '', city: '', region: '', countryCode: '' }`
- `profile.bank: { accountName: '', iban: '', bic: '' }`
- `invoice.eInvoice: { enabled: false, format: 'xrechnung-ubl' }` (allowed formats: `'facturx-en16931'`, `'xrechnung-ubl'`).

On a new invoice save, snapshot the legal name, structured address, email/contact, bank and tax identity in a versioned seller object. Preserve the snapshot on edit and back up/restore it. Recurring templates retain business fields only; creating a new period resolves the current seller identity before its first final save. Do not silently refresh historical documents.

Keep `profile.address` (free text). It still prints when the structured address is empty. If 016's `getSettingsErrors`/`mergeImportedSettings` reject unknown keys, allow these keys there.
**Verify**: `npm run build && MANTA_USER_DATA=/tmp/manta-profile-copy npm start`, quit, then `node -p "const s=require('/tmp/manta-profile-copy/Settings'); [s.profile.postalAddress, s.profile.bank, s.invoice.eInvoice]"` → the 3 default objects; old keys unchanged. `npx vitest run app/helpers/__tests__/settings.spec.js app/helpers/__tests__/backup.spec.js` → pass.

### Step 3: Code lists, money and identifiers (`helpers/einvoice/`)

Shared, pure, ESM, no imports from `app/` or `window`. Main and renderers both bundle them.
1. `codes.js`: `COUNTRY_CODES` (copy once from the library: `node -p "JSON.stringify(require('@e-invoice-eu/core').invoiceSchema.\$defs.codeLists.ISO3166.enum)"`; frozen array), `TYPE_CODE = { invoice: '380', creditNote: '381' }`, `VATEX_DEFAULTS = { AE: 'VATEX-EU-AE', G: 'VATEX-EU-G', O: 'VATEX-EU-O' }`, `PAYMENT_MEANS_SEPA = '58'`, `DEFAULT_UNIT = 'C62'` (same value as 019 `DEFAULT_UNIT_CODE`; do not import it, this folder stays free of `app/`), `SUPPORTED_CATEGORIES = ['S','Z','E','AE','G','O']`.
2. `money.js`: `round2(n)` = `Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100`; `fmt2(n)` = `round2(n).toFixed(2)`; `fmtQty(n)` (no exponent, max 4 decimals, trims trailing zeros).
3. `identifiers.js`: `isValidIban(s)` (strip spaces, upper-case, length 15–34, mod-97 = 1), `isValidBic(s)` (`/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/`), `looksLikeVatId(s)` (`/^[A-Z]{2}[0-9A-Z+*.]{2,12}$/` after removing spaces), `leitwegCheck(s)` → `'ok' | 'bad-check-digits' | 'not-leitweg'` (pattern `^\d{2,12}(-[0-9A-Z]{1,30})?-\d{2}$`; check digits = 98 − (number mod 97), letters A=10…Z=35, computed over the ID without the last part plus `00`).
4. `address.js`: `hasPostalAddress(a)` (any of street/city/postcode non-empty), `formatPostalAddress(a, lang)` → array of lines (`street`, `additional`, `postcode city`, `region`, country name via `new Intl.DisplayNames([lang], { type: 'region' }).of(code)`); empty values are skipped.

**Verify**: `npx vitest run helpers/einvoice/__tests__/identifiers.spec.js` → pass. Cases: IBAN `DE89370400440532013000` true, last digit changed false, spaces and lower case accepted; BIC `COBADEFFXXX` true, `COBADEF` false; Leitweg `991-33333TEST-33` ok, `04011000-1234512345-06` ok, `04011000-1234512345-07` bad-check-digits, `PO-4711` not-leitweg; `round2(1.005)` = 1.01, `round2(-1.005)` = -1.01, `fmt2(0.1+0.2)` = `'0.30'`.

### Step 4: Mapper `toEn16931(invoice, settings, derived)`

`settings = { profile, invoice }` (the two settings sections). For new saved documents, resolve `profile` from the invoice seller identity/bank snapshot; only legacy documents without that snapshot use current Settings as an explicit fallback. A preview export and its XML must use the same resolved profile. `derived` is computed by the renderer (Step 7) with the 014/020/021/023 helpers, so this file imports nothing from `app/`: `{ docType, status, issuedAt, dueAt, amountPaid, totals: getInvoiceTotals(invoice), seller: { taxId, vatId }, preceding: { number, issuedAt } | null, lang }`. The mapper never recomputes amounts. It copies the 021 numbers that the PDF prints, so PDF and XML show the same values. Step 5 checks that these numbers obey the EN 16931 arithmetic. Dates format with `moment(ms).format('YYYY-MM-DD')` in local time.

Output model (plain object; field comments = BT numbers). Mapping table:

| Model field | BT | Source |
|---|---|---|
| `number` | BT-1 | `invoice.invoiceID` (trimmed) |
| `issueDate` | BT-2 | `derived.issuedAt` |
| `typeCode` | BT-3 | `TYPE_CODE[derived.docType]` (`380`/`381`) |
| `currency` | BT-5 | `invoice.currency.code` |
| `dueDate` | BT-9 | `derived.dueAt` (omitted for `381`) |
| `buyerReference` | BT-10 | `invoice.recipient.buyerReference` |
| `note` | BT-22 | `invoice.note` |
| `preceding` | BT-25, BT-26 | `derived.preceding` (credit notes) |
| `seller.name` | BT-27 | `profile.legalName \|\| profile.company \|\| profile.fullname` |
| `seller.tradingName` | BT-28 | `profile.company` if it differs from BT-27 |
| `seller.vatId` | BT-31 | `derived.seller.vatId` (omitted when any line is `O`) |
| `seller.taxNumber` | BT-32 | `derived.seller.taxId` (scheme `FC`) |
| `seller.electronicAddress` | BT-34 | `profile.email` (scheme `EM`) |
| `seller.address` | BT-35..40 | `profile.postalAddress` |
| `seller.contact` | BT-41..43 | `profile.fullname`, `profile.phone`, `profile.email` |
| `buyer.name` | BT-44 | `recipient.company \|\| recipient.fullname` |
| `buyer.vatId` | BT-48 | `recipient.taxId` if `looksLikeVatId` (omitted when any line is `O`) |
| `buyer.electronicAddress` | BT-49 | `recipient.email` (scheme `EM`) |
| `buyer.address` | BT-50..55 | `recipient.postalAddress` |
| `buyer.contactName` | BT-56 | `recipient.fullname` when `company` is set |
| `payment` | BT-81, BT-84..86 | `profile.bank` → `{ meansCode: '58', iban, accountName, bic }`; `null` without IBAN |
| `lines[]` | BG-25: BT-126 id (1…n), BT-129 `quantity`, BT-130 `unitCode ?? 'C62'`, BT-131 `totals.lines[i].net`, BT-146 `price`, BT-151 `taxCategory`, BT-152 `taxRate`, BT-153 `description` | `invoice.rows[i]` |
| `vatBreakdown[]` | BG-23: BT-116 `base`, BT-117 `amount`, BT-118 `category`, BT-119 `rate`, BT-120 `exemptionReason` (E/AE/G/O), BT-121 `VATEX_DEFAULTS[category]` | `totals.taxBreakdown[]` |
| `allowances[]` | BG-20: BT-92 = (Σ line nets of the group) − `base`, BT-95 category, BT-96 rate, BT-97 `'Discount'` | one per group with a share > 0 |
| `totals` | BT-106 `subtotal`, BT-107 `discount`, BT-109 = 106 − 107, BT-110 `taxTotal`, BT-112 `grandTotal`, BT-113 `derived.amountPaid` (only when > 0), BT-115 = 112 − 113 | `derived.totals` |

Rules: amounts are numbers; `round2` only removes float noise. Prices keep up to 4 decimals. Keep the 021 breakdown order. The exemption text (BT-120) is the same text the 021 templates print as exemption notes.
**Verify**: `npx vitest run helpers/einvoice/__tests__/toEn16931.spec.js` → pass (cases in Test plan).

### Step 5: Validator `getEInvoiceIssues(model, { format, invoice, derived })`

Returns `[{ code, severity: 'error' | 'warning', rule, field, fix }]`, where `fix` is one of `'profile' | 'bank' | 'client' | 'invoice' | 'taxRates'` (the place to fix it). `format` is `'facturx-en16931'` or `'xrechnung-ubl'`. Errors block the export. Codes:

| Code | Severity | Rule | Condition |
|---|---|---|---|
| `DOC_TYPE_UNSUPPORTED` | error | — | `docType` is `estimate` |
| `NOT_FINAL` | error | — | invoice `status === 'draft'`; credit note status not `issued` (`draft` or `void`) |
| `NUMBER_MISSING` | error | BR-02 | empty BT-1 |
| `CURRENCY_FRACTION_UNSUPPORTED` | error | BR-DEC-* | `invoice.currency.fraction > 2` |
| `TAX_PER_LINE_REQUIRED` | error | BR-CO-04 | `derived.totals.mode !== 'line'` or a row without `taxCategory` (legacy invoice-level tax) |
| `CATEGORY_NOT_SUPPORTED` | error | BR-IC-11/12 | a line with `K` or an unknown category |
| `RATE_CATEGORY_MISMATCH` | error | BR-S-05, BR-Z-05, BR-E-05, BR-AE-05, BR-G-05, BR-O-05 | `S` with rate ≤ 0, or other categories with rate ≠ 0 |
| `OUT_OF_SCOPE_MIXED` | error | BR-O-11 | `O` together with another category |
| `EXEMPTION_REASON_MISSING` | error | BR-E-10, BR-AE-10, BR-G-10, BR-O-10 | E/AE/G/O group with empty `exemptionReason` (old rows saved before 021 had the field) |
| `SELLER_NAME_MISSING` | error | BR-06 | empty BT-27 |
| `SELLER_ADDRESS_INCOMPLETE` | error | BR-08, BR-DE-3/4 | street, postcode or city empty |
| `SELLER_COUNTRY_MISSING` | error | BR-09 | `countryCode` not in `COUNTRY_CODES` |
| `SELLER_TAX_ID_MISSING` | error | BR-S-02, BR-Z-02, BR-E-02 | S/Z/E lines and neither BT-31 nor BT-32 |
| `SELLER_VAT_ID_REQUIRED` | error | BR-AE-02, BR-G-02 | AE/G lines and no BT-31 |
| `BUYER_NAME_MISSING` | error | BR-07 | empty BT-44 |
| `BUYER_COUNTRY_MISSING` | error | BR-11 | no valid BT-55 |
| `BUYER_ADDRESS_INCOMPLETE` | error for XRechnung, warning for Factur-X | BR-DE-8/9 | buyer postcode or city empty |
| `BUYER_VAT_ID_REQUIRED` | error | BR-AE-03 | AE lines and no valid BT-48 |
| `BUYER_VAT_ID_FORMAT` | warning | — | `recipient.taxId` set but not VAT-ID shaped |
| `DUE_DATE_MISSING` | error | BR-CO-25 | `380`, BT-115 > 0, no BT-9 |
| `PAYMENT_ACCOUNT_MISSING` | error for XRechnung, warning for Factur-X | BR-DE-1 | no IBAN and BT-115 > 0 |
| `IBAN_INVALID` / `BIC_INVALID` | error / warning | BR-61 | `isValidIban` / `isValidBic` false |
| `BUYER_REFERENCE_MISSING` | error (XRechnung only) | BR-DE-15 | empty BT-10 |
| `LEITWEG_CHECK_DIGITS` | warning | — | `leitwegCheck` = `bad-check-digits` |
| `SELLER_CONTACT_INCOMPLETE` | error (XRechnung only) | BR-DE-2/5/6/7 | BT-41, BT-42 or BT-43 empty |
| `ELECTRONIC_ADDRESS_MISSING` | error (XRechnung only) | XRechnung 3.0.1 BT-34/BT-49 | seller or buyer email empty |
| `CREDIT_NOTE_REFERENCE_MISSING` | warning | BT-25 | `381` without `preceding` |
| `ARITHMETIC_MISMATCH` | error | BR-CO-10, BR-CO-13, BR-CO-14, BR-CO-15, BR-CO-17 | any of: Σ BT-131 ≠ BT-106; BT-109 ≠ BT-106 − BT-107; Σ BT-117 ≠ BT-110; BT-112 ≠ BT-109 + BT-110; a group `amount` ≠ `round2(base × rate / 100)`; an amount with more than 2 decimals. Compare in cents (`Math.round(x * 100)`). |

`ARITHMETIC_MISMATCH` protects the rule that the XML (the legal invoice) has the same totals as the PDF and obeys EN 16931. Validate every exported fixture and document, including `fraction` 2; the app rounding policy alone does not prove conformance. For `fraction` 0 (for example JPY) it fires when the whole-unit rounding breaks BR-CO-17. It must never become a warning.
**Verify**: `npx vitest run helpers/einvoice/__tests__/getEInvoiceIssues.spec.js` → pass.

### Step 6: UBL JSON and golden samples

1. `toUblJson(model)` → `{ 'ubl:Invoice': … }` for the library. Paths (check each key against the library schema; it throws with the JSON path): `cbc:ID`, `cbc:IssueDate`, `cbc:DueDate`, `cbc:InvoiceTypeCode`, `cbc:Note` (array), `cbc:DocumentCurrencyCode`, `cbc:BuyerReference`, `cac:BillingReference[].cac:InvoiceDocumentReference.{cbc:ID,cbc:IssueDate}`, `cac:AccountingSupplierParty.cac:Party.{cbc:EndpointID, cbc:EndpointID@schemeID:'EM', cac:PartyName.cbc:Name, cac:PostalAddress.{cbc:StreetName, cbc:AdditionalStreetName, cbc:CityName, cbc:PostalZone, cbc:CountrySubentity, cac:Country.cbc:IdentificationCode}, cac:PartyTaxScheme[] ({cbc:CompanyID, cac:TaxScheme.cbc:ID 'VAT'|'FC'}), cac:PartyLegalEntity.cbc:RegistrationName, cac:Contact.{cbc:Name, cbc:Telephone, cbc:ElectronicMail}}`, the same for `cac:AccountingCustomerParty`, `cac:PaymentMeans[].{cbc:PaymentMeansCode, cac:PayeeFinancialAccount.{cbc:ID, cbc:Name, cac:FinancialInstitutionBranch.cbc:ID}}`, `cac:AllowanceCharge[].{cbc:ChargeIndicator:'false', cbc:AllowanceChargeReason, cbc:Amount, cac:TaxCategory.{cbc:ID, cbc:Percent, cac:TaxScheme.cbc:ID:'VAT'}}`, `cac:TaxTotal[0].{cbc:TaxAmount, cac:TaxSubtotal[].{cbc:TaxableAmount, cbc:TaxAmount, cac:TaxCategory.{cbc:ID, cbc:Percent, cbc:TaxExemptionReasonCode, cbc:TaxExemptionReason, cac:TaxScheme.cbc:ID}}}`, `cac:LegalMonetaryTotal.{cbc:LineExtensionAmount, cbc:TaxExclusiveAmount, cbc:TaxInclusiveAmount, cbc:AllowanceTotalAmount, cbc:PrepaidAmount, cbc:PayableAmount}`, `cac:InvoiceLine[].{cbc:ID, cbc:InvoicedQuantity, cbc:InvoicedQuantity@unitCode, cbc:LineExtensionAmount, cac:Item.{cbc:Name, cac:ClassifiedTaxCategory.{cbc:ID, cbc:Percent, cac:TaxScheme.cbc:ID}}, cac:Price.cbc:PriceAmount}`. Every amount gets `@currencyID`. All values are strings (`fmt2`, `fmtQty`). Omit empty keys (never write `''`).
2. Create 6 fixtures in `e2e/fixtures/einvoice/`: `standard-de.json`, `multi-rate-discount.json`, `reverse-charge-eu.json`, `kleinunternehmer-exempt.json`, `credit-note.json`, `xrechnung-b2g.json`. Each is `{ invoice, settings: { profile, invoice }, derived, expectedIssueCodes: { 'facturx-en16931': [], 'xrechnung-ubl': [] } }`. Use the DE IBAN `DE89370400440532013000`, Leitweg-ID `04011000-1234512345-06`, buyer VAT `ATU12345678` with reason "Reverse charge" for AE, and the E reason `Steuerbefreit gemäß § 19 UStG` (seller with `taxId` only, no `vatId`). Reuse the 021 test numbers for `multi-rate-discount`: 100 @ S 19, 50 @ S 7, 30 @ E 0, 10 % discount → bases 90/45/27, taxes 17.10/3.15/0, grandTotal 182.25. `credit-note` has `creditedInvoice: { invoiceID: 'INV-0007', issuedAt }`, status `issued`. Write `derived` by hand from the expected numbers (Step 7 proves they equal the real helpers).
3. Use separate expectations for Factur-X CII and XRechnung UBL. A Factur-X-valid fixture need not satisfy every German CIUS rule; each positive XRechnung fixture must include all required contact and buyer reference data. `samples.spec.js` (first line `// @vitest-environment node`): for each fixture, map, check issues equal `expectedIssueCodes`, then `generate(toUblJson(model), { format: 'XRECHNUNG-UBL', lang: 'en' })` and `{ format: 'CII', lang: 'en' }`. Compare with `expected/<name>.xrechnung.xml` and `expected/<name>.cii.xml`. With `UPDATE_EINVOICE_SAMPLES=1`, write the files instead. For each Factur-X fixture, render a PDF from that same invoice, settings, language and template, then embed its matching XML. Never reuse one standard invoice PDF for different fixtures: validator success cannot detect differing visual invoice amounts. Render fixtures with image/font readiness and compare extracted PDF text/totals to their XML model.

**Verify**: `UPDATE_EINVOICE_SAMPLES=1 npx vitest run helpers/einvoice/__tests__/samples.spec.js` writes 12 files; a second run without the variable → pass (output is deterministic). KoSIT on `expected/*.xrechnung.xml` → exit 0 (Step 12 command). Mustang on `expected/*.cii.xml` → `status="valid"`.

### Step 7: Renderer inputs and the client copy fix (`app/helpers/einvoice.js`)

1. `getEInvoiceDerived(invoice, { profile, invoiceSettings, lang })` → the `derived` object of Step 4: `docType: getDocType(invoice)`, `status: invoice.status`, `issuedAt: getIssuedAt(invoice)`, `dueAt: getDueDate(invoice)`, `amountPaid: docType === 'invoice' ? getAmountPaid(invoice) : 0`, `totals: getInvoiceTotals(invoice)` (the numbers the templates print), `seller: invoice.seller ?? getSellerTaxIds(profile, invoiceSettings)`, `preceding: invoice.creditedInvoice ? { number: invoice.creditedInvoice.invoiceID, issuedAt: invoice.creditedInvoice.issuedAt } : null`, `lang`.
2. `mergeRecipientFromContact(recipient, contact)` → a new recipient with `postalAddress`, `buyerReference`, `taxId` copied from the contact when the contact value is not empty. Other keys stay unchanged.
3. Tests in `app/helpers/__tests__/einvoice.spec.js`: for every fixture, `getEInvoiceDerived(fixture.invoice, …)` deep-equals `fixture.derived` (this proves that the hand-written fixtures match the real 014/020/021/023 helpers); a doc without `seller` falls back to `getSellerTaxIds`; `mergeRecipientFromContact` keeps `fullname` and `_id`, does not copy empty values, and does not mutate inputs.

**Verify**: `npx vitest run app/helpers/__tests__/einvoice.spec.js` → pass.

### Step 8: Settings UI

1. `BusinessProfile.jsx`: add a "Legal name" input (hint: "Registered name; leave empty to use the company name"), an "Address" group (Street, Additional line, Postcode, City, Region, Country `Combobox` over `COUNTRY_CODES` with `Intl.DisplayNames` labels in the UI language), and a "Bank account" group (Account holder, IBAN, BIC; inline error from `isValidIban`/`isValidBic`). Keep the old "Address" text area and rename its label to "Printed address (used when the structured address is empty)". Do not parse it. Save whole section objects as 016 does.
2. Create `EInvoiceSettings.jsx` and render it at the end of `InvoiceDefaults.jsx` under the title "E-invoice". Controls: `Switch` "Enable e-invoice export"; `Select` "Default format" (`XRechnung XML (UBL)` and Factur-X only after 025b passes); a readiness list = `getEInvoiceIssues` on a model built from the profile and an empty sample invoice, filtered to `fix === 'profile' | 'bank'`; the disclaimer text (always visible). Turning the switch on first opens the 013 confirm dialog with the disclaimer and the buttons "I understand" / "Cancel". Only "I understand" saves `enabled: true`.
3. Disclaimer text (`i18n/en/settings.json` `sections.eInvoice.disclaimer`): "Manta creates e-invoices to the best of its ability but does not guarantee legal compliance. Validate the files and check them with your tax advisor before you send them."

**Verify**: `npm run build`; manual on the data copy in light and dark mode: fill the address and IBAN, reopen Settings → values kept; the switch shows the confirm; Cancel leaves it off.

### Step 9: Client fields

1. `app/helpers/clients.js` `buildContact`: keep `postalAddress` (same shape as the profile) and `buyerReference` (trimmed). `getContactErrors`: no new required fields; `countryCode` must be empty or in `COUNTRY_CODES`.
2. `ClientEditorDialog.jsx`: add an "Address" group (same controls as Step 8) and "Buyer reference (Leitweg-ID)" with the hint "Required by German public-sector buyers". Show the `leitwegCheck` warning inline. Do not add these fields to the editor's inline new-client form (`ClientField.jsx`); the checklist sends the user to Clients instead.
3. Add a case to `app/helpers/__tests__/clients.spec.js`: `buildContact` keeps the new fields and an old contact without them still builds.

**Verify**: `npx vitest run app/helpers/__tests__/clients.spec.js` → pass. Manual: edit a client, then create a new invoice for it; Redux DevTools shows `recipient.postalAddress`.

### Step 10: Print the same data on the PDF

In `business/components/Header.jsx` and `minimal/components/Footer.jsx`:
- Seller: if `hasPostalAddress(profile.postalAddress)` print `formatPostalAddress(...)` lines; else print `profile.address` as today.
- Recipient: print `formatPostalAddress(recipient.postalAddress)` lines when present, and "Buyer reference: X" when `recipient.buyerReference` is set.
- Payment: when `profile.bank.iban` is set, print "IBAN / BIC / account holder" once (business: header; minimal: footer).
Use the invoice language (`configs.language`) for labels; add keys to `i18n/en/preview.json`. 021 already prints the seller tax IDs, `recipient.taxId`, the tax breakdown and the exemption notes; do not change those lines.

**Verify**: Take a baseline before the edit (`npm run build && node scripts/pdf-snapshot.mjs /tmp/manta-pdf-025-before && SNAPSHOT_SET=line node scripts/pdf-snapshot.mjs /tmp/manta-pdf-025-line-before`). After the edit, snapshot both sets again and compare each pair with `sh scripts/pdf-compare.sh <before> <after> --light-ref` → `ALL IDENTICAL` (the snapshot cases have none of the new fields). Manual: a client with an address shows it in the preview; a profile with an empty structured address still prints the old text.

### Step 11: XRechnung export and the checklist UI

1. Create `main/einvoice.js` and `require` it in `app.js` next to `save-pdf`. Accept only the main frame of the known preview window for export. Reject other windows/frames and unknown `kind` before any dialog, print or file write ([Electron IPC sender validation](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages)). `ipcMain.handle('einvoice-export', async (event, { kind, invoice, derived }))` with `kind` `'xrechnung' | 'facturx'`:
   1. `settings = { profile: appConfig.get('profile'), invoice: appConfig.get('invoice') }`. If `!settings.invoice.eInvoice?.enabled` → `{ ok: false, error: 'disabled' }`.
   2. `model = toEn16931(...)`; `issues = getEInvoiceIssues(model, { format, invoice, derived })`. Any error → `{ ok: false, issues }`. The main process checks again. Schema-check all input with bounded rows/strings and finite numeric values; independently verify row net arithmetic, discounts, VAT groups, paid/balance arithmetic, dates, currency and unit codes against the invoice payload using shared pure rules. Comparing a renderer model to renderer-derived totals alone is insufficient. This is an integrity check on a supplied snapshot, not proof that renderer data matches persisted PouchDB documents.
   3. `xrechnung`: `xml = await new InvoiceService(logger).generate(toUblJson(model), { format: 'XRECHNUNG-UBL', lang: derived.lang })`. `dialog.showSaveDialog(win, { defaultPath: path.join(exportDir, `${safe(model.number)}.xml`), filters: [{ name: 'XRechnung', extensions: ['xml'] }] })`. Cancel → `{ ok: false, canceled: true }`. Write UTF-8. Return `{ ok: true, path, warnings }`.
   4. `logger` collects `warn`/`error` lines into `warnings` and also logs them. Any throw → `{ ok: false, error: err.message }`.
   `safe(name)` must remove separators, control characters, trailing dots/spaces and Windows reserved basenames; use a safe fallback and cap length. Never join an unvalidated invoice number into a path.
2. `preload/index.js`: add `'einvoice-export'` to `CHANNELS`.
3. `app/components/einvoice/EInvoiceChecklist.jsx`: shows issues grouped by `fix`, error icon/label vs warning, the translated text (`i18n/en/common.json` `einvoice.issues.<CODE>`, each says where to fix it, for example "Add the country in Settings › Business profile › Address"), and the rule ID in muted text.
4. `preview/components/sidebar/EInvoice.jsx` (section in the 018 sidebar, only when `eInvoice.enabled`): status line ("Ready" or "N problems"), `EInvoiceChecklist`, buttons "Export XRechnung (XML)" and (025b) "Export Factur-X (PDF)". The default format is the filled button; the other is outline. Short disclaimer line under the buttons. It calls `window.manta.ipc.invoke('einvoice-export', { kind, invoice, derived: getEInvoiceDerived(invoice, …) })` and shows the result inline (path + "Show in folder" → `reveal-file`; or the issues/error).
5. `InvoiceDetailSheet.jsx` (only when enabled): an "E-invoice" block with the same checklist. When an issue has `fix === 'client'` and the contact with `recipient._id` exists and has data, show "Copy client details" → `mergeRecipientFromContact` → dispatch the 014/015 invoice update action. This is the explicit fix for old invoices; 016 Decision 1 stays true for all other edits.

**Verify**: `npm run build`; manual on the data copy: enable e-invoice, open an invoice with missing data → checklist lists the problems and Export is blocked; fix them → "Ready"; export XRechnung → file saved; run KoSIT on it → exit 0.

### Step 12: Local validation of 025a

```bash
cd ~/manta-validators
java -jar validator-1.6.3-standalone.jar -s xr-config/scenarios.xml -r xr-config -h <repo>/e2e/fixtures/einvoice/expected/*.xrechnung.xml ~/Desktop/<exported>.xml; echo "exit=$?"
for f in <repo>/e2e/fixtures/einvoice/expected/*.cii.xml; do java -Xmx1G -Dfile.encoding=UTF-8 -jar Mustang-CLI-2.26.0.jar --no-notices --action validate --source "$f" 2>/dev/null | grep -o 'summary status="[a-z]*"' | tail -1; done
```
Write the same commands into `e2e/fixtures/einvoice/README.md`.
**Verify**: KoSIT `exit=0`; every Mustang line `summary status="valid"`. If KoSIT rejects a file for a rule that the checklist does not know, add the rule to Step 5 with a test, then re-run.

### Phase 025b

### Step 13: Factur-X in the main process

In `main/einvoice.js`, `kind === 'facturx'`: after the checks, `win = the validated preview window`; bind invoice, profile, configs and language to a unique render request token; wait for the matching committed DOM plus fonts and images, and serialize preview updates through completion of printing; `pdf = await win.webContents.printToPDF(getPrintOptions(appConfig.get('general.printOptions')))` (same options as `save-pdf`); `out = await service.generate(toUblJson(model), { format: 'Factur-X-EN16931', lang: derived.lang, pdf: { buffer: pdf, filename: `${safe(model.number)}.pdf`, mimetype: 'application/pdf' } })`; save dialog with `.pdf` default name `${safe(model.number)}.pdf` in `exportDir`; write `Buffer.from(out)`. Then do what `save-pdf` does: open it when `general.previewPDF` is true, and send `pfd-exported`. Do not change the `save-pdf` handler; the normal "Export PDF" stays byte-for-byte the same path.
**Verify**: `npm run build`; export from the preview on the data copy; Mustang on the file → `status="valid"`; `docker run --rm -v "$PWD:/data" verapdf/cli:latest --flavour 3b /data/<file>.pdf` → `isCompliant="true"` (if the image entrypoint differs, run it with `--help` first).

### Step 14: Preview button

Enable the "Export Factur-X (PDF)" button from Step 11.4. While the export runs, disable both buttons and show a spinner.
**Verify**: manual in light and dark mode; the button never stays disabled after an error.

### Step 15: e2e test

Add one test to `e2e/app.e2e.mjs`: "exports a Factur-X PDF". Write a Settings file into the temp `MANTA_USER_DATA` with the `standard-de` fixture settings, `eInvoice.enabled: true` and `exportDir` = temp dir. Send the fixture invoice through `update-preview` (as 018's test does). Stub `dialog.showSaveDialog` through `app.evaluate` to return a temp path. Call `window.manta.ipc.invoke('einvoice-export', …)` in the preview window. Expect `ok: true` and a PDF parsed with the installed PDF parser: inspect the embedded file, AF relationship and XMP metadata after decompression (raw byte searches are not reliable). Extract the embedded XML, check its invoice number and totals against the visible PDF, and run external validators in the validation step. Add a main-process handler test for an untrusted sender and tampered derived totals; neither may print or write.
**Verify**: `npm run test:e2e` → all pass.

### Step 16: Packaged build and full validation

1. `npx electron-builder --dir` and start the packaged app with `MANTA_USER_DATA=/tmp/manta-profile-copy`. Export both formats. This checks that the library and its gettext files load from the asar.
2. Produce one matching rendered PDF per fixture and template as specified in Step 6, then run Mustang + veraPDF on every generated Factur-X PDF. Assert visual PDF number, parties and amounts match the embedded XML; never attach all fixtures to the same standard PDF.
3. `npm test && npm run lint && npm run test:e2e`.

**Verify**: all exports valid; all three commands exit 0.

## Test plan

- `helpers/einvoice/__tests__/identifiers.spec.js`: IBAN, BIC, VAT-ID shape, Leitweg check digits, `round2`/`fmt2`/`fmtQty` edge cases (Step 3 list).
- `toEn16931.spec.js`: single rate; the 021 mixed case (bases 90/45/27, taxes 17.10/3.15/0, BT-112 182.25) gives allowances 10/5/3 and BT-107 = Σ BT-92; the 021 remainder case (flat 1.00 over three groups → 0.34/0.33/0.33); line nets come from `totals.lines`, not from `price × quantity`; reverse charge (AE, rate 0, BT-121 `VATEX-EU-AE`, BT-120 = group `exemptionReason`, buyer VAT mapped); §19 exempt (E, seller tax number only); `O` drops BT-31 and BT-48; credit note → `381`, no BT-9, preceding reference; payments → BT-113 and BT-115; missing `unitCode` → `C62`; seller name fallback chain; `buyer.contactName` only when company is set; dates are local `YYYY-MM-DD`.
- `getEInvoiceIssues.spec.js`: one test per code (condition true → issue; condition false → no issue); XRechnung-only codes absent for Factur-X; severity differences for `BUYER_ADDRESS_INCOMPLETE` and `PAYMENT_ACCOUNT_MISSING`; `ARITHMETIC_MISMATCH` on a 1-cent change of one group amount, and for the 021 fraction-0 case (1000 @ S 10 + 333 @ S 8 → taxTotal 127, where BR-CO-17 gives 126.64); a void credit note → `NOT_FINAL`.
- `toUblJson.spec.js`: no empty strings anywhere; every amount has `@currencyID`; arrays for 0..n elements; `FC` and `VAT` tax schemes.
- `samples.spec.js`: golden XML for 6 fixtures in 2 syntaxes (serialization regression).
- `app/helpers/__tests__/einvoice.spec.js`: derived values equal fixtures (021/023 helpers agree with the mapper); `mergeRecipientFromContact`.
- `clients.spec.js`: one new case. Settings/backup specs keep passing with the new defaults.
- e2e: one Factur-X export test.
- Not tested by unit tests: the settings forms, the checklist markup, button states (manual smoke in light and dark mode on the data copy, with screenshots).

## Done criteria

- [ ] `npm ls @e-invoice-eu/core` → exact pinned version; license WTFPL noted in the report
- [ ] `npx vitest run helpers/einvoice app/helpers/__tests__/einvoice.spec.js` → pass
- [ ] `ls e2e/fixtures/einvoice/*.json | wc -l` → 6; `ls e2e/fixtures/einvoice/expected/*.xml | wc -l` → 12
- [ ] KoSIT on all `*.xrechnung.xml` and one app export → exit 0
- [ ] Mustang on all `*.cii.xml` and on the Factur-X samples and one app export → `status="valid"` (025b)
- [ ] veraPDF `--flavour 3b` on one app export → `isCompliant="true"` (025b)
- [ ] `sh scripts/pdf-compare.sh … --light-ref` → `ALL IDENTICAL` for the 018 cases
- [ ] `grep -n "einvoice-export" preload/index.js main/einvoice.js` → hits in both
- [ ] `git diff <start-of-025-SHA> -- main/save-pdf.js` → no change to normal PDF behavior, including the 017 onboarding flag
- [ ] Disclaimer confirm appears when the switch is turned on (manual)
- [ ] `npm test && npm run lint && npm run test:e2e` → exit 0
- [ ] `git log --format=%B -n 6 | grep -ci "co-authored\|generated with"` → 0

## STOP conditions

- A precondition fails, or 021 has no per-line tax category, or 023 has no way to get the credited invoice number and date.
- Step 0: Mustang or veraPDF rejects the PDF/A output of Chromium + the library. Do 025a only and report the failing rules. Do not add Ghostscript or any native binary.
- The library or one of its dependencies has a license that is not GPL-3.0 compatible at install time (`npx license-checker --production --summary` if needed).
- Step 7: `getInvoiceTotals` gives other numbers than the hand-written fixture for a `fraction` 2 case, or `ARITHMETIC_MISMATCH` fires for a `fraction` 2 fixture. That means 021 does not round per EN 16931. Do not recompute amounts inside the mapper (PDF and XML would then disagree); report it.
- KoSIT or Mustang rejects a golden file and the cause is a rule that needs a new form field (for example BT-72 delivery date).
- The packaged app cannot load the library from the asar.
- Any step would change saved invoices without an explicit user action, or would change `main/save-pdf.js` behavior for normal PDFs.

## Additional acceptance checks

- 025a alone must be shippable: default to XRechnung, hide unavailable Factur-X controls, skip 025b-only e2e assertions and record 025a DONE / 025b BLOCKED separately. A failed feasibility spike must not leave a Factur-X default.
- Before enabling hybrid export, prove visual/XML parity for each fixture with both templates, and prove the requested invoice is still the rendered invoice at print time. Serialize render, print and export; reject a stale token rather than exporting a different document.
- Add negative validation cases for invalid/missing issue date, non-finite amounts, negative unit price, zero/unsupported quantity, unsupported unit/currency code, mismatched prepaid/payable totals and inconsistent derived line nets. Do not silently round a price/quantity beyond supported precision; block it or preserve exact supported precision consistently in PDF and XML.
- Preserve seller legal name, address, tax identity and bank data as a saved invoice snapshot for new documents. Read old documents with an explicit fallback. Changing global settings must not change the legal identity of an already exported invoice on a later export. Include this metadata in backups and edit preservation; do not mutate old invoices silently.
- Confirm downloaded validator versions against official release pages and pin their checksums before use. A downloaded validator and changing `latest` container are not a reproducible baseline. Preserve process exit status when capturing validator output; a pipeline ending in `tail` must not hide validator failure.

## Maintenance notes

- Standards move twice a year. When FeRD/FNFE or KoSIT publish a new release: update the library, run the samples spec, run KoSIT with the new configuration and Mustang with the newest jar. Update the versions in `e2e/fixtures/einvoice/README.md`.
- XRechnung 4.0 (expected 2027) will change the CustomizationID and rules. The library sets the CustomizationID; check its changelog.
- Known gaps for a later plan: delivery date or period (BT-72/BG-14; German law asks for it, so most German invoices should state it), category `K`, seller legal registration ID (BT-30), purchase order reference (BT-13), attachments, France PA/PDP sending, Peppol.
- Optional CI: a GitHub Actions job with `actions/setup-java` that downloads the three validators and runs Step 12 on `expected/*.xml`. Not added now to keep CI free of Java.
- The mapper and validator are pure and shared by main and renderers. Keep them free of `app/` imports and `window`.
- Never downgrade `ARITHMETIC_MISMATCH` to a warning, and never let the mapper compute its own amounts. The XML is the legal invoice in Germany; a wrong total is a wrong invoice.
- The XML uses the structured address only. The old `profile.address` text is a display fallback; it is never parsed.
