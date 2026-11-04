# Plan 026: Email an invoice or a payment reminder through the default mail client

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before you go to the
> next step. If a "STOP conditions" item occurs, stop and report. Do not
> improvise. When done, update the status row for this plan in
> `plans/README.md`, unless a reviewer dispatched you and told you that they
> maintain the index. Do NOT add `Co-authored-by` trailers or any AI/tool
> attribution to commits or PR text. Pass this rule to any subagent.
>
> **Drift check (run first)**: `git diff --stat 3e89104..HEAD -- main/save-pdf.js main/preview-window.js preload/index.js app.js app/helpers/invoice.js app/helpers/form.js app/helpers/settings.js app/middlewares/InvoicesMW.jsx app/actions/invoices.jsx app/constants/actions.jsx app/components/invoices app/components/dashboard/NeedsAttention.jsx app/components/settings/sections/InvoiceDefaults.jsx preview/Viewer.jsx preview/containers/SideBar.jsx helpers/ i18n/en/`
> Plans 012–025 change most of these files on purpose (014: invoice helpers, row menu, detail sheet; 015: form.js; 016: settings, preload `invoke`; 017: save-pdf.js onboarding flag, dashboard; 018: preview window; 020: payments; 022: `docType`; 025: separate Factur-X export). Do not compare whole files. Compare only the parts that this plan names in "Current state". If a named function, file or channel is missing, see STOP conditions.

## Review rules (2026-11-01)

These rules take precedence over conflicting commands below. Before a live app check, call Jean `get_run_environments` and use the existing environment. If none runs, use Jean `start_run_environment` with its configured command. Do not start another server by hand or guess its port. Record the exact URL or Electron launch target used. Use a fresh disposable profile, never the production profile; do not delete or overwrite an existing review profile. For IndexedDB persistence checks, use the built `file://` app with `MANTA_USER_DATA`, because a dev HTTP origin cannot prove access to the existing `file://` database. A copied Settings file can still point `invoice.exportDir` at a real folder: change it to a disposable export directory before any export check. Run focused tests during each step. Run the full unit suite, lint and e2e once at the end, rather than after every edit. A passing library demo is not proof of the app's IPC, state or file behavior.

## Status

- **Priority**: P3
- **Effort**: L (mail draft, PDF job coordination, external app handoff and recovery)
- **Risk**: MED (PDF content, safe file creation, concurrent preview jobs and external app handoff)
- **Depends on**: 014, 016, 017 (Needs attention), 018 (preview and normal PDF export), 020 (balance), 022 (docType), 024 (numberless recurring drafts). Plan 025 is optional and exposes a separate explicit Factur-X export; normal email PDF export does not invoke it automatically.
- **Category**: feature
- **Planned at**: commit `3e89104`, 2026-11-01 (runs after 018)

## Why this matters

A user sends almost every invoice by email. Today Manta only writes a PDF. The user must open the mail app, type the address, the subject and a message, and then find the PDF file. For late invoices, the user must write the same reminder text each time. After this plan, one click ("Email invoice" or "Send reminder") does four things. It writes the PDF. It opens a new message in the default mail app with the recipient, subject and body filled in. It shows the PDF in the file manager, so the user can drag it into the message. It then lets the user record "Sent on …". Manta stays offline. It does not use SMTP, a server or stored passwords.

## Preconditions

Continue on the current branch after the required plans are present. Plan 025 is optional; normal PDF export does not require it.

| Check | Command | Expected |
|---|---|---|
| 014 helpers | `grep -n "export.*\(getDisplayStatus\|getDueDate\|getInvoiceNumber\|formatInvoiceAmount\|withStatus\)\|getDisplayStatus,\|withStatus," app/helpers/invoice.js` | all 5 names exported |
| 014 row menu + sheet | `ls app/components/invoices/InvoiceRowActions.jsx app/components/invoices/InvoiceDetailSheet.jsx` | both exist |
| 013 toast | `grep -rn "export.*toast" ui/components/ui/toast.jsx ui/lib 2>/dev/null` | exported `toast` with `add`/`close` (write down the import path = `<toast path>`) |
| 013 dialog API | `grep -n "export function confirm\|export function alert" ui/lib/dialog.js` | 2 lines |
| 016 invoke | `grep -n "invoke:" preload/index.js; grep -n "invoke" vitest.setup.js` | `ipc.invoke` in preload and in the test mock |
| 016 client update | `grep -n "CONTACT_UPDATE" app/constants/actions.jsx; grep -n "updateContact" app/actions/contacts.jsx` | both found |
| 016 settings | `ls app/components/settings/sections/InvoiceDefaults.jsx; grep -n "getSettingsErrors" app/helpers/settings.js` | file exists; function exported |
| 016 email rule | `grep -n "emailInvalid" app/helpers/clients.js` | the email regex used by `getContactErrors` (reuse its pattern) |
| 017 Needs attention | `grep -n "getNeedsAttention" app/helpers/dashboard.js; ls app/components/dashboard/NeedsAttention.jsx` | both found |
| 018 preview sidebar | `grep -n "FileDown\|save-pdf" preview/containers/SideBar.jsx` | the "Export PDF" button sends `save-pdf` |
| 018 preview function component | `grep -n "useEffect" preview/Viewer.jsx` | at least 1 hit |
| 020 balance | `grep -n "export.*getBalanceDue" app/helpers/invoice.js` | export exists |
| 022 docType | `grep -rn "export.*getDocType" app/helpers` | export exists |
| shadcn Textarea | `ls ui/components/ui/textarea.jsx` | exists, else Step 9 adds it |
| Tests and lint | `npm test && npm run lint` | exit 0 |

Use a fresh, non-existing disposable profile path for every manual run; preserve prior review files. Never run against or export into a production folder. See Review rules.

## Current state

### (a) At 3e89104 (012–018 do not change these parts)

`main/save-pdf.js:8-33`. The PDF prints from the window that sent `save-pdf`. That window is always the preview window. The file name is the doc id:

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
    if (appConfig.get('general.previewPDF')) {
      await shell.openPath(pdfPath);
    }
    win.webContents.send('pfd-exported', { title: 'PDF Exported', body: 'Click to reveal file.', location: pdfPath });
  } catch (error) { console.error('save-pdf failed:', error); }
});
ipcMain.on('reveal-file', (event, location) => { shell.showItemInFolder(location); });
```

`main/save-pdf.js:6` requires the ESM file `main/print-options.js` (`export function getPrintOptions`). The electron-vite main build bundles mixed CJS/ESM. So a pure ESM helper in `helpers/` works in main (with `require`) and in renderers (with `import`).

`main/preview-window.js:4-15`. The preview window is a long-lived hidden window. Main sends it the invoice:

```js
const previewWindow = BrowserWindow.fromId(appConfig.get('previewWindowID'));
const mainWindow = BrowserWindow.fromId(appConfig.get('mainWindowID'));
ipcMain.on('preview-invoice', (event, invoiceData) => {
  previewWindow.show();
  previewWindow.focus();
  previewWindow.webContents.send('update-preview', invoiceData);
});
```

`preview/reducers/index.jsx:34-40`: `INVOICE_UPDATE` sets `invoice` and takes `configs` from `invoice.configs`, else it keeps the previous configs.

`preload/index.js:3-53`: `CHANNELS` is a `Set` of allowed names, and `check(channel)` throws `Blocked IPC channel: …`. `preload/index.js:81`: `platform: process.platform`. `vitest.setup.js` mocks `window.manta.platform = 'darwin'`.

`app.js:195-214`: the `invoice` defaults (`exportDir: os.homedir()`, `template`, `dateFormat: 'MM/DD/YYYY'`, `tax`, `currency`, `required_fields`). `app.js:221-241`: `setInitialValues()` adds missing level-1 and level-2 keys. So new keys under `invoice.*` need no migration.

`app/helpers/form.js:77-86`: edit mode copies only `_id`, `_rev`, `created_at`, `status` from the old doc. Any other stored field is lost on edit unless it is listed there (017 adds `paidAt` the same way).

`helpers/formatNumber.js:30`: `formatNumber(number, fraction, separator)`.

### (b) Expected after 012–025 (expectations; Preconditions check them)

- 014 Step 2: `app/helpers/invoice.js` exports `getIssuedAt`, `getStoredStatus`, `getDueDate(invoice)` (ms or `null`), `getDisplayStatus(invoice, now)` (`overdue` is derived), `withStatus(doc, status, now)`, `getInvoiceNumber(invoice)` (`invoiceID || _id.slice(0, 8)`), `formatInvoiceAmount(invoice)` (`"USD 1,234.00"`).
- 014 Steps 5–6: `InvoiceRowActions.jsx` is a shadcn `DropdownMenu` (Preview / Export PDF, Edit, Duplicate, Mark as paid, Set status, Delete). `InvoiceDetailSheet.jsx` has a summary `<dl>` and footer buttons. 020 renamed "Mark as paid" to "Record payment".
- 014 Step 4: `INVOICE_SET_STATUS` reads the doc with `getSingleDoc` and dispatches `INVOICE_UPDATE`. Use the same pattern.
- 015 Step 5: `INVOICE_DUPLICATE` uses `omit(invoice, ['_id', '_rev', 'status', 'paidAt', 'issuedAt', 'created_at'])`.
- 016 Steps 4, 6, 8, 11: `ClientEditorDialog`, `updateContact` (`CONTACT_UPDATE`), `getSettingsErrors(section, data)` in `app/helpers/settings.js`, `InvoiceDefaults.jsx` with `value` + `onSave(nextObject)` (instant apply, inline `FieldError`), `ipc.invoke`.
- 017 Steps 5–6: `save-pdf.js` sets `onboarding.exportedPdf` after `writeFile`. `NeedsAttention.jsx` rows are `<button>` elements from `getNeedsAttention(invoices, now)`.
- 018 Step 5: `preview/containers/SideBar.jsx` footer has `Button` "Export PDF" (lucide `FileDown`) and "Save settings". Both are disabled when `!canEmail(invoice)`.
- 025: normal `save-pdf` stays unchanged; Factur-X uses the separate `einvoice-export` handler. This plan emails a normal PDF through the shared normal PDF writer. Do not add hybrid post-processing implicitly.

## Reference facts (recheck versions and APIs at execution)

- RFC 6068 (https://www.rfc-editor.org/rfc/rfc6068.html): line breaks in `body` MUST be `%0D%0A` (§5). Spaces SHOULD be `%20`, and `+` may be `%2B` (§5). `?`, `=`, `&` must be `%3F`, `%3D`, `%26` when they are not delimiters, and `#` MUST be `%23` (§2). Non-ASCII is UTF-8, then percent-encoded (§2). `body` is for short text (§2). The RFC defines **no attachment parameter**. It states no maximum length.
- `attach=` is non-standard. Thunderbird treats it as a security issue and ignores it in `mailto:` (https://bugzilla.mozilla.org/show_bug.cgi?id=1613425, https://bugzilla.gnome.org/show_bug.cgi?id=616832). Apple and Microsoft document no support. Decision: never send `attach=`.
- Electron `shell.openExternal(url[, options])` → `Promise<void>`. `url` has a "Max 2081 characters on Windows" limit. `shell.showItemInFolder(fullPath)` shows the file and selects it if possible (https://www.electronjs.org/docs/latest/api/shell).
- Windows ShellExecute launches of `mailto:` fail at about 1,850–2,048 characters (https://eurekalog.com/help/eurekalog/send_options_mailto.php, https://forum.codeproject.com/post/2389339). Outlook raised its own limit from 2084 to 8192 only in recent builds (https://support.microsoft.com/office/outlook-error-cannot-send-this-item-when-replying-to-an-email-9346c0cd-06c8-4491-b5bf-0b91909c377d). Decision: `MAILTO_MAX_LENGTH = 1800` on all platforms.
- Electron security checklist item 15: do not pass untrusted content to `shell.openExternal` (https://www.electronjs.org/docs/latest/tutorial/security). Decision: main builds the URL itself and asserts the `mailto:` scheme.
- Electron `ShareMenu` (main process, macOS only, since 12.0.0): `new ShareMenu(sharingItem)`, `shareMenu.popup({ browserWindow, callback })` (https://www.electronjs.org/docs/latest/api/share-menu). `SharingItem` has `texts`, `filePaths`, `urls` (https://www.electronjs.org/docs/latest/api/structures/sharing-item). The docs do not name the Mail service. macOS lists Mail for files in the share menu, and Mail adds the file as an attachment. Decision: add "Share PDF…" on macOS only.
- Windows: Electron documents no share or MAPI API. Linux: `xdg-email --attach` is not an Electron API. Both are rejected (see Maintenance notes).
- Base UI toast: `toast.add({ title, description, timeout, actionProps })`. `timeout: 0` never closes by itself (014 Facts).

## Commands you will need

```bash
npx vitest run helpers/__tests__/email.spec.js
npx vitest run app/helpers/__tests__/emailDraft.spec.js
npx vitest run app/helpers/__tests__/settings.spec.js app/middlewares/__tests__/InvoicesMW.spec.js app/helpers/__tests__/form.spec.js
npm run build && MANTA_USER_DATA=/tmp/manta-profile-copy npm start
pdftotext a.pdf - | diff - <(pdftotext b.pdf -)   # poppler; brew install poppler
npm test && npm run lint && npm run test:e2e
```

## Scope

**In scope**
- IPC `email-invoice` (invoke) and `share-invoice-pdf` (invoke, macOS). Send-only channels `request-email-invoice` (preview → main → main window) and `preview-rendered` (preview → main).
- Shared pure helper `helpers/email.js`: `fillTemplate`, `encodeMailtoValue`, `buildMailto`, `assertMailtoUrl`, `isValidEmail`, `safePdfFileName`, `validateEmailRequest`, `MAILTO_MAX_LENGTH`.
- Renderer helper `app/helpers/emailDraft.js`: templates, variables, recipient lookup, `withSentMark`, `canSendReminder`.
- Settings `invoice.emailTemplate = { subject: '', body: '' }` and `invoice.reminderTemplate = { subject: '', body: '' }`. An empty string means "use the translated default".
- Optional stored fields `sentAt` and `remindedAt` (ms). Display only. No new status.
- "Mark as sent" from the toast and from the detail sheet. Drafts must be finalized and numbered first. Marking sent changes no status.
- Dialog for a missing or invalid address that can save the address to the client (016 `updateContact`).
- Settings › Invoice defaults › Email templates (subject/body per kind, placeholder list, filled preview, length warning, reset).
- Entry points: invoice row menu, detail sheet, preview window sidebar, dashboard Needs attention (reminder for overdue).

**Out of scope**: SMTP, OAuth mail APIs (Gmail/Graph), read/open tracking, a "Sent" status, a "Sent" column or filter in the table, Windows MAPI, Linux `xdg-email`, email for estimates or credit notes (only `docType === 'invoice'`), translations into other locales.

**Files to create**: `app/helpers/__tests__/emailFlow.spec.js`, `main/__tests__/email-invoice.spec.js`, `main/__tests__/preview-window.spec.js`, `helpers/email.js`, `helpers/__tests__/email.spec.js`, `app/helpers/emailDraft.js`, `app/helpers/__tests__/emailDraft.spec.js`, `app/helpers/emailFlow.js`, `app/helpers/emailPrompt.js`, `app/components/email/EmailAddressDialog.jsx`, `app/components/email/EmailHost.jsx`, `app/components/settings/sections/EmailTemplates.jsx`, `main/email-invoice.js`, `i18n/en/email.json`.

**Files to change**: `preview/actions/index.jsx`, `preview/reducers/index.jsx`, preview action constants (use the live paths), `main/einvoice.js` when 025 exists (print lock only), `e2e/app.e2e.mjs`, `main/save-pdf.js`, `main/preview-window.js`, `preload/index.js`, `app.js`, `preview/Viewer.jsx`, `preview/containers/SideBar.jsx`, `app/helpers/form.js` (+ spec), `app/helpers/settings.js` (+ spec), `app/middlewares/InvoicesMW.jsx` (+ spec), `app/actions/invoices.jsx`, `app/constants/actions.jsx`, `app/components/invoices/InvoiceRowActions.jsx`, `app/components/invoices/InvoiceDetailSheet.jsx`, `app/components/dashboard/NeedsAttention.jsx`, `app/components/settings/sections/InvoiceDefaults.jsx`, `app/index.jsx` (mount `EmailHost`), `i18n/en/index.js`, `i18n/en/settings.json`.

## Git workflow

Continue on the current branch. Do not create a worktree or switch branches unless the user explicitly asks. Use short imperative commit subjects, with no attribution lines. Do not push or create a PR unless asked.

## Steps

### Step 1: Shared helper `helpers/email.js` (pure ESM, no Electron, no DOM)

Write these exports:

1. `MAILTO_MAX_LENGTH = 1800`, `OPEN_EXTERNAL_MAX = 2081`, `EMAIL_KINDS = ['invoice', 'reminder']`.
2. `isValidEmail(s)`: trimmed string, one address, the same regex as 016 `getContactErrors`. Also reject `, ; ? & # < > "` and whitespace.
3. `fillTemplate(template, vars)`: replace each `{name}` (`/\{(\w+)\}/g`) when `Object.hasOwn(vars, name)`. `null`/`undefined` → `''`. Unknown names stay as written. One pass only: a value that contains `{total}` is not expanded again.
4. `encodeMailtoValue(s)`: normalize `\r\n`, `\r`, `\n` to `\r\n`, then `encodeURIComponent`. Result: space `%20`, `&` `%26`, `?` `%3F`, `#` `%23`, `+` `%2B`, `=` `%3D`, line break `%0D%0A`, non-ASCII as UTF-8 octets.
5. `buildMailto({ to, subject = '', body = '' }, { maxLength = MAILTO_MAX_LENGTH } = {})` → `{ url, truncated }`:
   - Throw `Error('invalid-recipient')` when `!isValidEmail(to)`. Encode `to` as `encodeURIComponent(local) + '@' + encodeURIComponent(domain)`.
   - Replace line breaks in `subject` with one space. Cap the subject at 200 code points, then binary-search a code-point prefix whose full recipient + `?subject=` + encoded subject fits `maxLength`; reserve delimiters exactly. If shortening is needed, use an ellipsis only when it fits and set `truncated: true`. A 200-emoji subject must not exceed the budget even with an empty body.
   - `url = 'mailto:' + to`, then `?subject=…` and `&body=…` (use `?` for the first part). Omit empty parts.
   - Throw `Error('too-long-recipient')` when `'mailto:' + to` alone is longer than `maxLength - 100`.
   - **Truncation rule**: fit the encoded subject within the URL budget first (without splitting code points), then fit the body. Mark `truncated` when either changes. Use `Array.from(body)` (code points, so no emoji is split). Binary-search the longest prefix `p` where the encoded `p.trimEnd() + '…'` fits the remaining budget. If the last whitespace in `p` is within 80 code points of its end, cut there. If even `'…'` does not fit, drop the body. Set `truncated: true`. Never cut inside a `%XX` sequence (you cut raw text before you encode, so this holds). Final postcondition: `url.length <= maxLength`; otherwise throw before PDF export or shell access. The main handler also checks this bound before `openExternal`.
6. `assertMailtoUrl(url)`: throw `Error('blocked-url')` unless all of these are true. `typeof url === 'string'`. `url.startsWith('mailto:')` (case-sensitive, no leading space). `new URL(url).protocol === 'mailto:'`. There is no raw `\r`, `\n` or `\0`. `url.length <= OPEN_EXTERNAL_MAX`. Return `url`.
7. `safePdfFileName(base, fallback)`: replace `\ / : * ? " < > |` and control characters with `-`. Trim spaces and dots at the ends. Cap at 100 characters. Append `_` to the Windows reserved names (`CON PRN AUX NUL COM1–9 LPT1–9`, case-insensitive). If the result is empty, use `fallback`. Add `.pdf`.
8. `validateEmailRequest(p)` → normalized `{ invoiceId, kind, invoice, draft: { to, subject, body }, fileBase, source, snapshot: { profile, configs, language }, previewToken }`, or throw `Error('invalid-request')`. Rules: `kind` is in `EMAIL_KINDS`. `invoice` is an object and `invoice._id === invoiceId` (string). `subject` and `body` are strings ≤ 10,000 characters. `source` is `'preview'` or `'app'`. `fileBase` is a string. `snapshot` is required: `profile` and `configs` are bounded plain objects with the same allowed fields as the preview; `language` is a supported locale string. Reject unsupported keys, excessive nesting/strings, non-finite values and malformed image data. For `source === 'preview'`, require a bounded non-empty `previewToken`; main must resolve it to the captured preview snapshot, match its invoice ID, and reject missing/expired tokens rather than substitute current Settings. For `source === 'app'`, omit `previewToken` and use the supplied validated snapshot. The share schema requires the same snapshot/token rules.

**Verify**: `npx vitest run helpers/__tests__/email.spec.js` → all pass (tests in Test plan A).

### Step 2: Renderer helper `app/helpers/emailDraft.js` and strings

1. Create `i18n/en/email.json` and register it in `i18n/en/index.js` (as 017 did for `dashboard`). Keys:
   - `defaults.invoice.subject` "Invoice {number} from {company}"
   - `defaults.invoice.body` "Hello {client},\n\nPlease find attached invoice {number} for {total}. Due date: {dueDate}.\n\nThank you for your business.\n\n{company}"
   - `defaults.reminder.subject` "Payment reminder: invoice {number}"
   - `defaults.reminder.body` "Hello {client},\n\nThis is a friendly reminder that invoice {number} for {total} was due on {dueDate}. The open balance is {balance}.\n\nIf you have already paid, please ignore this message.\n\nKind regards,\n{company}"
   - `vars.noDueDate` "on receipt". Add `placeholders.<name>` descriptions for the 6 names.
   - Action labels: `actions.email` "Email invoice", `actions.reminder` "Send reminder", `actions.share` "Share PDF…", `actions.markSent` "Mark as sent", `actions.markReminded` "Mark reminder as sent". Add `actions.copyFullMessage` "Copy full message" and `toast.copied` "Message copied".
   - Toasts: `toast.opened` "Mail opened — attach the PDF from the folder", `toast.openedHint` "{{fileName}} is selected in the folder that opened.", `toast.truncated` "The message was too long for a mail link. Use Copy full message to copy the complete text.", `toast.failed` "Could not prepare the email: {{reason}}", `toast.noMailApp` "Could not open your mail app. The PDF is saved.", `toast.markedSent` "Marked as sent", `toast.notSaved` "Save the invoice first."
   - Dialog: `ask.title` "Email address for {{client}}", `ask.description`, `ask.label` "Email", `ask.save` "Save this address to the client", `ask.confirm` "Continue", `ask.invalid` "Enter a valid email address".
   - Sheet: `sheet.sentOn` "Sent on {{date}}", `sheet.remindedOn` "Reminder sent on {{date}}".
2. In `app/helpers/emailDraft.js` (imports: `i18n`, `moment`, the 014 helpers, `fillTemplate`/`isValidEmail` from `../../helpers/email`), export:
   - `TEMPLATE_KEYS = { invoice: 'emailTemplate', reminder: 'reminderTemplate' }`.
   - `getEmailTemplate(invoiceSettings, kind, t = i18n.t)` → `{ subject, body, isDefault }`. A missing key (old settings), a missing field, or a whitespace-only field falls back to `t('email:defaults.<kind>.<field>')`.
   - `getEmailVars(invoice, { profile, dateFormat, t, allSalesDocs })` → `{ number, client, total, balance, dueDate, company }`. `number = getInvoiceNumber`. `client = recipient.fullname || recipient.company || ''`. `total = formatInvoiceAmount(invoice)`. `balance` uses the normal amount formatter with `getBalanceDue(invoice, allSalesDocs)` as an explicit amount and the invoice currency. Do not replace `grandTotal` on a clone: `formatInvoiceAmount` can recompute totals from rows and ignore that field. `dueDate = moment(getDueDate(invoice)).format(dateFormat)`, or `t('email:vars:noDueDate')` when it is `null`. `company = profile.company || profile.fullname || ''`.
   - `buildEmailDraft(invoice, kind, { to, invoiceSettings, profile, t, allSalesDocs })` → `{ to, subject, body }` with `fillTemplate`.
   - `resolveRecipient(invoice, contacts)` → `{ email, contact }`. `contact = contacts.find(c => c._id === invoice.recipient?._id) ?? null`. `email` = the first valid value of `contact?.email`, then `invoice.recipient?.email` (trimmed), else `''`. The current client wins, because 016 lets the user fix a typo in the client but invoices keep an old copy.
   - `canEmail(invoice)` → saved `docType === 'invoice'`, non-empty `invoiceID`, and stored status not `draft`, `cancelled` or `refunded`. Resolve real status names against 014/020; drafts require explicit editor finalization. Recheck in main request validation as well as the UI.
   - `canSendReminder(invoice, now, allSalesDocs)` → `canEmail(invoice) && getDisplayStatus(invoice, now, allSalesDocs) === 'overdue'`. Thread the unfiltered all-sales-documents collection from Redux through drafts, reminders and balance helpers so issued credit notes reduce the email balance; follow 023 signatures.
   - `withSentMark(doc, kind, now)`: for `invoice` → `{ ...doc, sentAt: now }` only when `canEmail(doc)`; otherwise reject without a write. For `reminder` → `{ ...doc, remindedAt: now }`. It never changes `paidAt` or `payments`.

**Verify**: `npx vitest run app/helpers/__tests__/emailDraft.spec.js` → all pass (Test plan B).

### Step 3: Settings defaults and validation

1. In `app.js` `setInitialValues()`, add under `invoice`: `emailTemplate: { subject: '', body: '' }, reminderTemplate: { subject: '', body: '' }`. The level-2 loop adds them to old Settings files.
2. In `app/helpers/settings.js` `getSettingsErrors('invoice', data)`, add the rules for each of `emailTemplate` and `reminderTemplate` when present. `subject`: a string, ≤ 200 characters, no line break → else `settings:errors:emailSubject`. `body`: a string, ≤ 1500 characters → else `settings:errors:emailBody`. Paths: `emailTemplate.subject` and so on.
3. Add the texts to `i18n/en/settings.json`: `errors.emailSubject` "Use one line of 200 characters or fewer", `errors.emailBody` "Use 1500 characters or fewer".

**Verify**: `npx vitest run app/helpers/__tests__/settings.spec.js` → pass. Commit Steps 1–3.

### Step 4: Record `sentAt` / `remindedAt`

1. `app/constants/actions.jsx`: add `INVOICE_MARK_SENT`. `app/actions/invoices.jsx`: `markInvoiceSent = createAction(INVOICE_MARK_SENT, (invoiceID, kind) => ({ invoiceID, kind }))`.
2. `app/middlewares/InvoicesMW.jsx`: a new case. Copy the `INVOICE_SET_STATUS` pattern: `getSingleDoc('invoices', invoiceID)` → `dispatch({ type: INVOICE_UPDATE, payload: withSentMark(doc, kind, Date.now()) })`. Use the same warning shape in `catch`.
3. `app/helpers/form.js` metadata block: keep `sentAt` and `remindedAt` in edit mode, like `paidAt` (`editMode.active ? editMode.data.sentAt : undefined`). First run `grep -n "paidAt\|\.\.\.editMode.data" app/helpers/form.js`. If 015/020 already keep all old fields, skip this item.
4. `INVOICE_DUPLICATE` omit list: add `'sentAt', 'remindedAt'`.

**Verify**: `npx vitest run app/middlewares/__tests__/InvoicesMW.spec.js app/helpers/__tests__/form.spec.js` → pass (Test plan C). Commit.

### Step 5: Render the PDF for email in main

1. `main/save-pdf.js`: extract the body into an exported function, and keep the `save-pdf` behavior unchanged:
   ```js
   // Prints the coordinated preview snapshot and writes a normal PDF.
   async function writeInvoicePdf(win, pdfPath) { /* printToPDF, writeFile; throw on failure */ return pdfPath; }
   module.exports = { writeInvoicePdf };
   ```
   The writer only prints and writes; it must not send export notifications, set unrelated flags, open files, or swallow errors. The `save-pdf` handler retains its existing onboarding update, then calls `openPath` (if `general.previewPDF`), then `pfd-exported`. Keep 025 Factur-X export separate; share the preview coordination lock when it prints.
2. Replace ID-only readiness with a render job token. Main creates a unique `requestId`; `update-preview` carries `{ requestId, invoice, profile, configs, language }` and the reducer commits that complete snapshot. Add the necessary preview action/reducer files to scope. Reset missing configs to the invoice defaults instead of retaining the previous invoice's unsaved configs (`preview/reducers/index.jsx` currently retains them).
3. After the matching React commit, await `document.fonts.ready` and every paper image's load/decode outcome, then ack `{ requestId, invoiceId }`. Do not rely on `requestAnimationFrame` in a hidden window. Main validates the ack sender as the preview main frame and matches the active token; invoice `_id` alone is insufficient for repeat edits of the same invoice.
4. `main/preview-window.js` exports one serialized job coordinator. Its lock covers render → matching readiness ack → `printToPDF` → file write. Queue or disable ordinary preview updates, normal PDF exports, share and e-invoice print jobs while it owns the window. Add timeout/destroyed-window cleanup; stale acks never resolve a later job. Printing must capture the same invoice, seller profile, configs and language used to build the mail draft. Preview-origin email uses a captured token/snapshot, not `getLastRenderedId()`.
5. Preview email starts with `{ invoiceId, invoice, snapshot: { profile, configs, language } }` captured from that preview render. Allow only its main frame to submit this message. Main validates and stores this immutable snapshot under a new opaque `previewToken`, then forwards `{ invoiceId, source: 'preview', previewToken, invoice, snapshot }` to EmailHost. Keep the snapshot until handoff completes or a bounded timeout expires; consume/release it on success, cancellation or failure. No token can be used for a different invoice. Keep preview request forwarding, but allow only the preview window's main frame to send it. Resolve current windows at job time rather than retaining destroyed BrowserWindow references.

**Verify**: `npm run build` → exit 0. Manual check after Step 6.

### Step 6: `main/email-invoice.js` and preload

1. Create `main/email-invoice.js`. Require `{ ipcMain, shell, clipboard, ShareMenu, BrowserWindow }`, `./settings`, `path`, `writeInvoicePdf`, the serialized preview PDF job coordinator, and the `helpers/email.js` exports.
   - `async function exportForEmail(req)`: Submit the captured invoice/profile/config/language snapshot to the serialized preview PDF job coordinator and await its matching token through completion of file writing. Never reuse a rendered invoice on `_id` equality alone. Choose a safe filename in the configured export directory, then create it without overwriting (`wx`, retry a numeric suffix on EEXIST). Sanitize both requested base and fallback; enforce path containment. Return the actual written path from the coordinated normal PDF writer. Never overwrite an existing invoice file on collision.
   - `ipcMain.handle('email-invoice', async (event, payload) => …)`:
     1. Validate the sender as the known main or preview window main frame; reject other frames/windows. `req = validateEmailRequest(payload)`. `{ url, truncated } = buildMailto(req.draft)`. `assertMailtoUrl(url)`. Any throw → `{ ok: false, error: err.message }`.
     2. `pdfPath = await exportForEmail(req)`. A throw → `{ ok: false, error: 'pdf-failed', message }`.
     3. If `truncated`, prepare `fullMessage = req.draft.subject + '\n\n' + req.draft.body`; otherwise omit it. Do not return early or write the clipboard.
     4. `await shell.openExternal(url)`. A throw → `shell.showItemInFolder(pdfPath)` and `{ ok: false, error: 'no-mail-app', pdfPath }`.
     5. `shell.showItemInFolder(pdfPath)`. Return `{ ok: true, pdfPath, fileName: path.basename(pdfPath), truncated, fullMessage }`.
     `openExternal` gets only the URL from step 1. No other code path calls `openExternal` with renderer data.
   - `ipcMain.handle('share-invoice-pdf', async (event, payload) => …)`: if `process.platform !== 'darwin'` → `{ ok: false, error: 'unsupported' }`. Use a separate share-request schema (no `draft`, no `kind`), validate the same sender and invoice rules, and use the same serialized PDF coordinator. Export the PDF. `new ShareMenu({ filePaths: [pdfPath] }).popup({ browserWindow: BrowserWindow.fromWebContents(event.sender) })`. Return `{ ok: true, pdfPath }`.
   - `ipcMain.handle('capture-preview-snapshot', (event, { invoice, snapshot }) => …)`: accept only the preview main frame, validate the same bounded invoice/snapshot schema, and return `{ ok: true, previewToken }` after registering the immutable snapshot in the coordinator. This only captures; it does not start an email. Use it for preview Share.
   - `ipcMain.handle('copy-email-message', (event, text) => …)`: validate the sender as the main window main frame and `text` as a string of at most 20,002 characters; write with `clipboard.writeText(text)` and return `{ ok: true }`. Reject invalid input without touching the clipboard. This handler is used only by the explicit Copy action.
2. `app.js` `loadMainProcessFiles()`: add `require('./main/email-invoice');` after `require('./main/save-pdf');`.
3. `preload/index.js` `CHANNELS`: add `'capture-preview-snapshot'`, `'copy-email-message'`, `'email-invoice'`, `'preview-rendered'`, `'request-email-invoice'`, `'share-invoice-pdf'` (alphabetical).

**Verify**: `npm run build` → exit 0. `grep -n "openExternal" -r main app.js` → only `main/email-invoice.js` (plus any older fixed-URL calls, which you must note). The manual check is in Step 8.

### Step 7: Renderer email flow

1. `app/helpers/emailPrompt.js`: copy the queue pattern of `ui/lib/dialog.js`. Export `askEmail({ client, email, canSave })` → `Promise<{ email, saveToClient } | null>`, plus `subscribe`/`getCurrent`/`resolveCurrent` for the host.
2. `app/components/email/EmailAddressDialog.jsx`: shadcn `Dialog` + `Field` (`FieldLabel`, `Input type="email"`, `FieldError`), a `Checkbox` "Save this address to the client" (shown only when `canSave`, checked by default), and Cancel / Continue buttons. Continue validates with `isValidEmail` and shows `email:ask:invalid` inline.
3. `app/helpers/emailFlow.js` → `runEmailFlow({ invoice, kind, source = 'app', snapshot, previewToken }, deps)`. `deps = { ipc, settings, contacts, allSalesDocs, dispatch, toast, t, now }` with defaults from `window.manta` / i18n / Date.now:
   1. `{ email, contact } = resolveRecipient(invoice, contacts)`. If `!email`: `answer = await askEmail({ client, email: invoice.recipient?.email ?? '', canSave: !!contact })`. `null` → return `'canceled'`. If `answer.saveToClient` → `dispatch(updateContact({ ...contact, email: answer.email }))`.
   2. For app-origin flow, capture one immutable `snapshot = { profile: invoice.sellerSnapshot ?? settings.get('profile'), configs: invoice.configs ?? getPreviewDefaults(settings), language: invoice.configs?.language ?? settings.get('general.language') }` before building the draft; use the real 025 snapshot field if present. For preview-origin flow, use only its forwarded snapshot/token. `draft = buildEmailDraft(invoice, kind, { to: email, invoiceSettings: settings.get('invoice'), profile: snapshot.profile, t, allSalesDocs })`. Dates and translations use `snapshot.configs.dateFormat` and `snapshot.language` so the mail and printed paper agree.
   3. `res = await ipc.invoke('email-invoice', { invoiceId: invoice._id, kind, invoice, draft, fileBase: getInvoiceNumber(invoice), source, snapshot, previewToken })`.
   4. `res.ok` → `toast.add({ title: t('email:toast:opened'), description: openedHint + (res.truncated ? ' ' + truncated : ''), timeout: 0, actionProps: { children: t(kind === 'reminder' ? 'email:actions:markReminded' : 'email:actions:markSent'), onClick: () => dispatch(markInvoiceSent(invoice._id, kind)) } })`.
   5. When `res.ok && res.truncated && typeof res.fullMessage === 'string'`, show a second persistent toast with `actions.copyFullMessage` ("Copy full message"). Its `onClick` awaits `ipc.invoke('copy-email-message', res.fullMessage)`; success shows `toast.copied`, failure shows the standard error. Keep the Mark as sent action on the first toast. Opening the mail client never triggers either action automatically.
   6. `res.error === 'no-mail-app'` → toast `email:toast:noMailApp` with the action "Show file" (`ipc.send('reveal-file', res.pdfPath)`). Other errors → toast `email:toast:failed`.
4. `app/components/email/EmailHost.jsx`: renders the prompt queue and subscribes to `request-email-invoice`. Read `allSalesDocs` from the raw invoices Redux slice (023's unfiltered selector, including invoices, estimates and credit notes), not an invoice-only display selector. Read contacts with `useSelector(getContacts)`. For preview events, validate the forwarded `{ invoiceId, invoice, snapshot, previewToken, source }` and run `runEmailFlow({ invoice, kind: 'invoice', source, snapshot, previewToken }, { contacts, allSalesDocs, dispatch })`; do not replace the captured preview invoice with a newer store doc. For app calls, export `useEmailInvoice()` → `(invoice, kind) => runEmailFlow({ invoice, kind }, { contacts, allSalesDocs, dispatch })`, with both selectors inside the hook. Use the raw selector for credit-aware reminder eligibility at all entry points too. Remove the listener on unmount; release unused preview tokens on cancellation through the coordinator's bounded token cleanup.

5. Mount `<EmailHost/>` in `app/index.jsx` next to 013's `DialogHost`/`Toaster`, inside the Redux `Provider`.

**Verify**: `npm run build` → exit 0. `npx vitest run app/helpers/__tests__/emailDraft.spec.js` → pass.

### Step 8: Entry points

1. `InvoiceRowActions.jsx`: after Preview, add "Email invoice" (lucide `Mail`), shown when `canEmail(invoice)`. Add "Send reminder" (lucide `BellRing`), shown when `canSendReminder(invoice, now, allSalesDocs)`. Both call `useEmailInvoice()`.
2. `InvoiceDetailSheet.jsx`:
   - In the summary `<dl>`, show `email:sheet:sentOn` and `email:sheet:remindedOn` when the fields exist (format with `dateFormat`).
   - In the footer, add Email invoice, Send reminder (same visibility rules), "Mark as sent" (when `!invoice.sentAt` and `canEmail`), and "Share PDF…" (lucide `Share`) only when `window.manta.platform === 'darwin'`. Share captures the same app snapshot as Step 7 and calls `ipc.invoke('share-invoice-pdf', { invoiceId, invoice, fileBase, source: 'app', snapshot })` and shows `email:toast:failed` on `!ok`.
3. `NeedsAttention.jsx`: a `<button>` cannot contain a `<button>`. Change each row to a `div` with two siblings: the existing row `<button>` (`flex-1`) and, for overdue rows only, an icon `Button` (`size="icon"`, lucide `BellRing`, `aria-label` = "Send reminder for {number}", tooltip, target ≥ 24×24 px). It calls `useEmailInvoice()(invoice, 'reminder')`.
4. `preview/containers/SideBar.jsx` footer: under "Export PDF", add `Button variant="outline"` "Email invoice" (lucide `Mail`) → `ipc.send('request-email-invoice', { invoiceId: invoice._id, invoice, snapshot: { profile, configs, language: configs.language } })`. On macOS, also add "Share PDF…" → call `ipc.invoke('capture-preview-snapshot', { invoice, snapshot: { profile, configs, language: configs.language } })`, stop on failure, and use the returned token, then `ipc.invoke('share-invoice-pdf', { invoiceId: invoice._id, invoice, fileBase: invoice.invoiceID, source: 'preview', snapshot, previewToken })`. Both are disabled when `!canEmail(invoice)`. Put the labels in `i18n/en/preview.json`.

**Verify** (manual, copy profile, light and dark): build, then `MANTA_USER_DATA=/tmp/manta-profile-copy npm start`.
- Row menu → Email invoice. The default mail app opens with the address, the subject and the line breaks. The file manager selects `<number>.pdf`. The toast says to attach the selected PDF manually; opening Mail does not mark sent. Attach the PDF, send it in Mail, then click "Mark as sent", then open the sheet → "Sent on <today>". Restart → it is still there.
- Export the same invoice with "Export PDF". `pdftotext <exportDir>/<number>.pdf - | diff - <(pdftotext <exportDir>/<_id>.pdf -)` → no difference, and `pdfinfo` shows the same page count.
- An overdue invoice → Send reminder on the dashboard and in the row menu. The body says "was due on …".
- Clear the client's email in the store (edit a test client without the 016 validation, or use an old invoice without an email) → the dialog asks. With "Save" checked → the Clients page shows the new email.
- Preview window → Email invoice. The main window comes to the front, and the flow runs on the invoice shown.
- macOS → Share PDF… → choose Mail → the PDF is attached.
- An invoice with `& ? # +`, `Zoë` and an emoji in the client name → the mail app shows them correctly.

Commit Steps 7–8.

### Step 9: Settings › Invoice defaults › Email templates

1. If `ui/components/ui/textarea.jsx` is missing: `npx shadcn@latest add textarea`.
2. Create `app/components/settings/sections/EmailTemplates.jsx`. Props: `value` (the `invoice` settings) and `onSave`. Content:
   - `Tabs` "Invoice email" / "Payment reminder".
   - For each tab: an `Input` Subject and a `Textarea` Body (rows 8). Each shows the effective text from `getEmailTemplate`. Show a "Default" badge when the stored field is `''`. Save on blur or after a 500 ms debounce with `onSave({ ...value, [TEMPLATE_KEYS[kind]]: { subject, body } })`. Show the middleware `errors` inline (016 pattern).
   - A placeholder list: `{number} {client} {total} {balance} {dueDate} {company}` as `<code>` with descriptions.
   - Preview: `fillTemplate` with `getEmailVars` of the newest invoice in the store, or of a fixed sample invoice when there is none. Render it in a `pre`-wrapped muted box.
   - A length warning when `buildMailto({ to: 'client@example.com', subject, body }).truncated` is true: "This message is long. Mail apps may get a shortened text."
   - Button "Reset to default" (`variant="ghost"`, lucide `RotateCcw`) → saves `{ subject: '', body: '' }` for that kind.
3. Render it at the end of `InvoiceDefaults.jsx` under the heading "Email templates". Add the strings to `i18n/en/settings.json` under `sections.invoice.email.*`.

**Verify**: manual on the copy profile. Edit the subject → toast "Saved". Restart → the text is kept. Type a line break into the subject (paste) → inline error, nothing is saved. Reset → "Default" badge. Switch the UI language → the default text follows the language (English fallback). `npx vitest run app/helpers/__tests__/settings.spec.js` → pass. Commit.

### Step 10: Final checks

**Verify**: `npm test` → exit 0. `npm run lint` → exit 0. `npm run test:e2e` → all pass (no e2e test opens a mail app; do not add one).

## Test plan

New and changed unit tests only for logic that can break silently:

- **A. `helpers/__tests__/email.spec.js`**
  - `encodeMailtoValue`: `"a b&c?d#e+f=g"` → `a%20b%26c%3Fd%23e%2Bf%3Dg`. `"x\ny"`, `"x\r\ny"`, `"x\ry"` → each `x%0D%0Ay` (no double CR). `"Zoë 日本 😀"` → UTF-8 octets (`Zo%C3%AB%20%E6%97%A5%E6%9C%AC%20%F0%9F%98%80`).
  - `buildMailto`: `bill+ietf@example.org` → `mailto:bill%2Bietf@example.org`. An empty subject or body is omitted. A short draft → `truncated: false` and `decodeURIComponent` round-trips subject and body. A 5,000-character body → `url.length <= 1800`, `truncated: true`, the body ends with `…`, and `decodeURIComponent` does not throw. An emoji at the cut point is not split. A subject with a line break becomes one line. An invalid or comma-separated `to` throws `invalid-recipient`.
  - `assertMailtoUrl`: accepts the output of `buildMailto`. Rejects `https://x`, `file:///etc/passwd`, `javascript:alert(1)`, `" mailto:a@b.c"`, `MAILTO:a@b.c`, a string with a raw `\n`, a 2,082-character URL, and a non-string.
  - `fillTemplate`: repeated and unknown placeholders; `null` → `''`; a value that contains `{total}` is not expanded.
  - `safePdfFileName`: `INV/2026:01` → `INV-2026-01.pdf`; `CON` → `CON_.pdf`; `"..."` → fallback; 300 characters → ≤ 104 characters.
  - `validateEmailRequest`: a mismatched `_id`, an unknown `kind` or a non-string body throws.
- **B. `app/helpers/__tests__/emailDraft.spec.js`**: `getEmailTemplate` (missing key, `''`, whitespace → default; custom kept). `getEmailVars` (number fallback to `_id`, client fallback to company, no due date → `on receipt`, balance includes partial payments and 023 linked issued credits, company fallback to fullname). `resolveRecipient` (the contact email wins over the invoice copy; an invalid contact email falls back; none → `''`). `canSendReminder` (overdue only; paid/draft false; non-invoice `docType` false for every non-invoice document). `withSentMark` (draft rejected; finalized invoice gains `sentAt` without a status change; pending keeps status; reminder sets `remindedAt` only; `paidAt` unchanged).
- **C.** `InvoicesMW.spec.js`: `INVOICE_MARK_SENT` → the `updateDoc` payload has `sentAt === <mocked now>` and the other fields unchanged; a rejected `getSingleDoc` → warning, no throw (use `return`/`await`, see README bug 12). `INVOICE_DUPLICATE` payload has no `sentAt`/`remindedAt`. `form.spec.js`: edit keeps `sentAt`/`remindedAt` (skip if 015/020 keep all fields and already test that).
- **D.** `settings.spec.js`: a subject with a line break → `emailTemplate.subject` error; a 1,501-character body → error; empty templates → no error.
- No tests for static markup, icons or toast copy. Add state/recovery tests in `app/helpers/__tests__/emailFlow.spec.js`, `main/__tests__/email-invoice.spec.js` and `main/__tests__/preview-window.spec.js` (include these files in scope). Verify stored/rendered outcomes: two rapid invoice requests print their own content; two revisions of the same `_id` cannot reuse a stale ack; normal preview updates cannot replace a queued print; image/font readiness, timeout, window destruction and failed write release the queue; unauthorized sender and malformed/share payload do not write or open apps; collisions preserve the original file; cancellation/failure never marks sent; draft/unnumbered docs are rejected. Test subject-only overflow, including 200 emoji or non-ASCII characters: returned URL is at most 1,800 characters, decodes successfully and has `truncated: true`; any irreducible overflow rejects before shell access. Test that a linked issued credit changes reminder/body balance using raw Redux docs; a forwarded preview snapshot survives a store edit; token mismatch/expiry rejects; truncated success returns fullMessage without clipboard changes, then an explicit Copy action writes the complete text and no send timestamp changes. `buildMailto` must bound the entire encoded URL, including subject; if the subject alone exceeds the budget, shorten it at code-point boundaries and set `truncated`, then fit the body. Add one e2e test of the coordinated PDF handoff with the OS mail launch stubbed; no test sends a real email.

## Done criteria

- [ ] `npx vitest run helpers/__tests__/email.spec.js app/helpers/__tests__/emailDraft.spec.js` → pass
- [ ] `grep -rn "openExternal" main app.js` → only `main/email-invoice.js` uses renderer data, and it calls `assertMailtoUrl` first
- [ ] `grep -c "capture-preview-snapshot\|copy-email-message\|email-invoice\|share-invoice-pdf\|request-email-invoice\|preview-rendered" preload/index.js` → 6
- [ ] `grep -n "emailTemplate\|reminderTemplate" app.js` → 2 lines
- [ ] `grep -rn "attach=" helpers app main` → no output
- [ ] Every new UI string is in `i18n/en/*.json` (`email.json` is registered in `i18n/en/index.js`)
- [ ] Manual Step 8 and Step 9 checks pass in light and dark mode on the copy profile
- [ ] `npm test && npm run lint && npm run test:e2e` → exit 0

## STOP conditions

- A Precondition fails, or 014/016/017/018 names differ and you cannot find the real name with one grep.
- `writeInvoicePdf` cannot be extracted while preserving normal Export PDF behavior and the 017 onboarding flag. Factur-X remains a separate 025 action.
- The PDF printed from the hidden preview window is blank or differs in text from "Export PDF". First try one fallback: call `previewWindow.showInactive()` before `update-preview`, then test again. If it still differs, STOP. If the fallback works, keep it and record it in Maintenance notes.
- `preview-rendered` never arrives within 10 s on a normal invoice.
- `shell.openExternal` with a valid `mailto:` URL of ≤ 1800 characters fails on a platform that has a default mail app.
- A step would need SMTP, a network call, a stored password, or a new stored status.

## Maintenance notes

- **Why no attachment**: `mailto:` cannot attach files (RFC 6068 has no such field; `attach=` is blocked by Thunderbird and is not documented by Apple or Microsoft). The flow shows the PDF in the file manager instead. macOS also gets "Share PDF…" through `ShareMenu`. **Rejected**: Windows MAPI (`MAPISendMail`) and the Windows share UI (no Electron API; native add-on needed), Linux `xdg-email --attach` (not an Electron API; client support varies), SMTP/OAuth (needs stored credentials and a network).
- **Length cap**: `MAILTO_MAX_LENGTH = 1800` keeps a margin under the documented 2081 limit and the reported ShellExecute limit. When the body is cut, offer an explicit Copy full message action; do not replace the clipboard without a user action. The settings editor warns before that happens.
- **Security**: renderers never send a URL. Main builds it with `buildMailto` and checks it with `assertMailtoUrl`. Keep this rule if you add more external links.
- **PDF file name**: the email flow writes `<invoice number>.pdf` (`safePdfFileName`) in `invoice.exportDir`. "Export PDF" still writes `<_id>.pdf`. A user may get both files. Unifying the names is a separate change, and it changes 018's PDF scripts.
- **Preview window**: emailing from the main window loads that invoice into the hidden preview window. If the preview window is open on another invoice, capture and restore its prior snapshot after the coordinated export, or explicitly show the requested invoice after completion. Never overwrite its state while another print job owns it.
- **Templates**: an empty stored string means "translated default". So a language change updates untouched templates. Backups (016) include the templates as part of `invoice` settings.
- **`sentAt` / `remindedAt`**: display only. Only the user sets them ("Mark as sent"). The latest confirmed action updates its timestamp only after a successful save. Recheck invoice eligibility on the freshly loaded doc. 024 recurring templates must not copy them. Check its omit list. A future "Sent" column or filter can read `sentAt` directly.
- **Estimates/credit notes**: `canEmail` allows only `docType === 'invoice'`. To email estimates later, add a kind `estimate` with its own template key and default text.
