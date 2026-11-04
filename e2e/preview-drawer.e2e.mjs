import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAIN_TITLE = 'Manta';
const shotDir = '/tmp/manta-preview-drawer';
fs.mkdirSync(shotDir, { recursive: true });

let app;
let userData;
let exportDir;

test.beforeAll(async () => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-drawer-'));
  exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-drawer-pdf-'));
  app = await electron.launch({
    args: [
      'out/main/index.js',
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
    env: { ...process.env, MANTA_USER_DATA: userData, NODE_ENV: 'production' },
  });
  await expect
    .poll(
      async () => {
        const titles = await Promise.all(app.windows().map(p => p.title()));
        return titles.includes(MAIN_TITLE);
      },
      { timeout: 30_000 }
    )
    .toBe(true);
});

test.afterAll(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
  fs.rmSync(exportDir, { recursive: true, force: true });
});

async function mainPage() {
  for (const p of app.windows()) {
    if ((await p.title()) === MAIN_TITLE) return p;
  }
  throw new Error('no main window');
}

async function reactInput(locator, value) {
  await locator.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('preview drawer edits the style per invoice and exports a PDF', async () => {
  const page = await mainPage();
  await app.evaluate(({ BrowserWindow, shell }) => {
    shell.openPath = async () => '';
    const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'Manta');
    w.setBounds({ x: 50, y: 50, width: 1280, height: 800 });
    w.show();
    w.focus();
  });
  await page.evaluate(dir => {
    const invoice = window.manta.settings.get('invoice');
    window.manta.settings.set('invoice', { ...invoice, exportDir: dir });
  }, exportDir);

  await page
    .locator('[data-slot="sidebar"]')
    .getByRole('button', { name: 'New Invoice', exact: true })
    .click();
  await expect(page.locator('#client-fullname')).toBeVisible({
    timeout: 30_000,
  });
  await reactInput(page.locator('#client-fullname'), 'Drawer Client');
  await reactInput(page.locator('#client-email'), 'drawer@example.com');
  await reactInput(page.getByLabel('Description for item 1'), 'Line item');
  await reactInput(page.getByLabel('Price for item 1'), '10');
  await reactInput(page.getByLabel('Quantity for item 1'), '1');
  await page
    .getByRole('button', { name: 'Save & Preview', exact: true })
    .click();

  // The drawer opens in the main window; the hidden window stays hidden.
  const drawer = page.getByRole('dialog', { name: /^Preview INV-/ });
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await expect(drawer.locator('.paper')).toHaveCount(1);
  await expect(
    drawer.getByText('This document uses the default style from Settings.')
  ).toBeVisible();
  const visible = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter(w => w.getTitle() !== 'Manta')
      .map(w => w.isVisible())
  );
  expect(visible).toEqual([false]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shotDir, 'drawer-default.png') });

  // Override the accent color for this invoice only.
  const saveStyle = drawer.getByRole('button', { name: 'Save style' });
  await expect(saveStyle).toBeDisabled();
  await drawer.getByRole('button', { name: '#F47373' }).click();
  await expect(saveStyle).toBeEnabled();
  await saveStyle.click();
  await expect(
    drawer.getByText('This document has its own style.')
  ).toBeVisible({
    timeout: 10_000,
  });
  await page.screenshot({ path: path.join(shotDir, 'drawer-own-style.png') });

  // Export what the drawer shows.
  await drawer.getByRole('button', { name: 'Export PDF' }).click();
  await expect(page.getByText('File exported')).toBeVisible({
    timeout: 15_000,
  });
  const pdfs = fs.readdirSync(exportDir).filter(f => f.endsWith('.pdf'));
  expect(pdfs.length).toBe(1);
  const head = fs.readFileSync(path.join(exportDir, pdfs[0])).subarray(0, 4);
  expect(head.toString('utf8')).toBe('%PDF');

  // Back to the default style.
  await drawer.getByRole('button', { name: 'Use default style' }).click();
  await expect(
    drawer.getByText('This document uses the default style from Settings.')
  ).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('Settings > Invoices shows the global invoice style', async () => {
  const page = await mainPage();
  await page
    .locator('[data-slot="sidebar"]')
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Settings' })
    .getByRole('button', { name: 'Invoices', exact: true })
    .click();
  const heading = page.getByRole('heading', { name: 'Invoice style' });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '#37D67A' }).click();
  await expect
    .poll(
      () => page.evaluate(() => window.manta.settings.get('invoice.style')),
      { timeout: 10_000 }
    )
    .toMatchObject({ accentColor: '#37D67A' });
  await heading.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotDir, 'settings-style.png') });
});
