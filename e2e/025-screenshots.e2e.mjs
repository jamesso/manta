import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAIN_TITLE = 'Manta';
const PREVIEW_TITLE = 'Previewer';
const outDir = '/tmp/manta-025-screens';
fs.mkdirSync(outDir, { recursive: true });

let app;
let userData;

test.beforeAll(async () => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-025-screens-'));
  app = await electron.launch({
    args: [
      'out/main/index.js',
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
    env: { ...process.env, MANTA_USER_DATA: userData, NODE_ENV: 'production' },
    colorScheme: null,
  });

  await expect
    .poll(
      () =>
        app.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
        ),
      { timeout: 30_000 }
    )
    .toBeGreaterThanOrEqual(2);

  await expect
    .poll(async () => {
      const titles = await Promise.all(app.windows().map(p => p.title()));
      return titles.includes(MAIN_TITLE);
    }, { timeout: 30_000 })
    .toBe(true);
});

test.afterAll(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

async function pageByTitle(title) {
  let found;
  await expect
    .poll(
      async () => {
        for (const p of app.windows()) {
          try {
            if ((await p.title()) === title) found = p;
          } catch {
            // ignore
          }
        }
        return Boolean(found);
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  return found;
}

async function showMain(page) {
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'Manta');
    if (w) {
      w.setBounds({ x: 50, y: 50, width: 1280, height: 800 });
      w.show();
      w.focus();
    }
  });
  await page.waitForLoadState('load');
}

test('captures e-invoice UI screenshots', async () => {
  for (const theme of ['light', 'dark']) {
    const main = await pageByTitle(MAIN_TITLE);
    await showMain(main);
    await main.evaluate(t => window.manta.ipc.send('set-theme', t), theme);
    await expect
      .poll(() =>
        main.evaluate(
          t =>
            t === 'dark'
              ? matchMedia('(prefers-color-scheme: dark)').matches
              : !matchMedia('(prefers-color-scheme: dark)').matches,
          theme
        )
      )
      .toBe(true);

    const sidebar = main.locator('[data-slot="sidebar"]');
    await sidebar.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(main.locator('h1.text-2xl', { hasText: 'Settings' })).toBeVisible({
      timeout: 15_000,
    });
    await main.getByRole('button', { name: 'Invoice defaults', exact: true }).click();
    await expect(
      main.getByRole('switch', { name: 'Enable e-invoice export', exact: true })
    ).toBeVisible();

    const sw = main.getByRole('switch', { name: 'Enable e-invoice export', exact: true });
    await sw.scrollIntoViewIfNeeded();
    if ((await sw.getAttribute('aria-checked')) === 'true') {
      await sw.click({ force: true });
      await expect(sw).toHaveAttribute('aria-checked', 'false');
    }
    await sw.click({ force: true });
    const dialog = main.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.screenshot({
      path: path.join(outDir, `settings-einvoice-disclaimer-dialog-${theme}.png`),
    });
    await main.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(sw).toHaveAttribute('aria-checked', 'false');

    await sw.click({ force: true });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await main.getByRole('button', { name: 'I understand', exact: true }).click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await main.screenshot({
      path: path.join(outDir, `settings-einvoice-checklist-${theme}.png`),
      fullPage: true,
    });

    const preview = await pageByTitle(PREVIEW_TITLE);
    await preview.evaluate(() => {
      const invoice = window.manta.settings.get('invoice') ?? {};
      window.manta.settings.set('invoice', {
        ...invoice,
        eInvoice: { enabled: true, format: 'xrechnung-ubl' },
      });
    });
    const badInvoice = {
      _id: 'einvoice-check-block',
      invoiceID: 'INV-E2E',
      status: 'pending',
      issuedAt: Date.UTC(2026, 0, 10),
      taxMode: 'line',
      taxCalc: 1,
      currency: { code: 'EUR', fraction: 2 },
      rows: [
        {
          id: '1',
          description: 'Line',
          quantity: 1,
          price: 10,
          subtotal: 10,
          taxRate: 19,
          taxCategory: 'S',
        },
      ],
      recipient: { fullname: 'Buyer', email: 'b@example.de' },
      configs: {
        template: 'business',
        language: 'en',
        dateFormat: 'MM/DD/YYYY',
        showRecipient: true,
        showLogo: false,
        alignItems: 'flex-start',
        fontSize: 10,
        customAccentColor: false,
      },
    };
    await app.evaluate(({ BrowserWindow }, inv) => {
      BrowserWindow.getAllWindows()
        .find(w => w.getTitle() === 'Previewer')
        .webContents.send('update-preview', inv);
    }, badInvoice);
    await preview.waitForFunction(
      id =>
        document.querySelector('.print-area')?.getAttribute('data-invoice-id') ===
        id,
      badInvoice._id,
      { timeout: 15_000 }
    );
    await expect(
      preview.getByText(/\d+ problems to fix/)
    ).toBeVisible({ timeout: 10_000 });
    const einvoiceBlock = preview.locator('[data-einvoice-export]');
    await einvoiceBlock.scrollIntoViewIfNeeded();
    await expect(
      einvoiceBlock.getByRole('button', { name: 'Export XRechnung (XML)', exact: true })
    ).toBeDisabled();
    await expect(
      einvoiceBlock.getByRole('button', { name: 'Export Factur-X (PDF)', exact: true })
    ).toBeDisabled();
    await preview.screenshot({
      path: path.join(outDir, `preview-einvoice-blocked-${theme}.png`),
      fullPage: true,
    });
  }
});
