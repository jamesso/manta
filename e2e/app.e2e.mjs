import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAIN_TITLE = 'Manta';
const PREVIEW_TITLE = 'Previewer';

let app;
let userData;
const errors = [];
const cspErrors = [];

test.beforeAll(async () => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-e2e-'));
  app = await electron.launch({
    args: [
      'out/main/index.js',
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
    env: { ...process.env, MANTA_USER_DATA: userData, NODE_ENV: 'production' },
    // Playwright's default colorScheme is light. That sends
    // Emulation.setEmulatedMedia and hides nativeTheme.themeSource.
    colorScheme: null,
  });

  const watch = p => {
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => {
      if (/Content Security Policy/i.test(m.text())) cspErrors.push(m.text());
    });
  };
  for (const p of app.windows()) watch(p);
  app.on('window', watch);

  await expect
    .poll(
      () =>
        app.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
        ),
      {
        timeout: 30_000,
      }
    )
    .toBeGreaterThanOrEqual(2);

  await expect
    .poll(
      async () => {
        const titles = await Promise.all(app.windows().map(p => p.title()));
        return titles.includes('Manta');
      },
      { timeout: 30_000 }
    )
    .toBe(true);
});

test.afterAll(async () => {
  await app?.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

async function windowInfo() {
  return app.evaluate(({ BrowserWindow, screen }) => {
    const display = screen.getPrimaryDisplay().workArea;
    return BrowserWindow.getAllWindows().map(w => ({
      title: w.getTitle(),
      visible: w.isVisible(),
      minimized: w.isMinimized(),
      resizable: w.isResizable(),
      movable: w.isMovable(),
      devTools: w.webContents.isDevToolsOpened(),
      bounds: w.getBounds(),
      display,
    }));
  });
}

test('creates only the Manta and Previewer windows', async () => {
  const infos = await windowInfo();
  const titles = infos.map(w => w.title).sort();
  expect(titles).toEqual([MAIN_TITLE, PREVIEW_TITLE].sort());
});

test('fresh profile opens main window on Dashboard with the checklist', async () => {
  await expect
    .poll(
      async () => {
        const infos = await windowInfo();
        return infos.find(w => w.title === MAIN_TITLE)?.visible;
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  const infos = await windowInfo();
  const main = infos.find(w => w.title === MAIN_TITLE);
  const preview = infos.find(w => w.title === PREVIEW_TITLE);
  expect(main?.visible).toBe(true);
  expect(main?.devTools).toBe(false);
  expect(preview?.visible).toBe(false);

  let page;
  for (const p of app.windows()) {
    if ((await p.title()) === MAIN_TITLE) page = p;
  }
  expect(page).toBeTruthy();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashboard' })
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Setup steps' }).getByRole('listitem')
  ).toHaveCount(5);
});

test('main window is resizable and movable', async () => {
  const infos = await windowInfo();
  const main = infos.find(w => w.title === MAIN_TITLE);
  expect(main.resizable).toBe(true);
  expect(main.movable).toBe(true);
  expect(main.devTools).toBe(false);
});

test('main window renders without page errors', async () => {
  let page;
  for (const p of app.windows()) {
    if ((await p.title()) === MAIN_TITLE) page = p;
  }
  expect(page).toBeTruthy();
  await page.waitForLoadState('load');
  await expect
    .poll(() => page.locator('#root > *').count(), { timeout: 30_000 })
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
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
            // Window may have closed between list and title read.
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
      w.show();
      w.focus();
    }
  });
  await page.waitForLoadState('load');
}

test('theme setting reaches Manta and Previewer', async () => {
  const main = await pageByTitle(MAIN_TITLE);
  await showMain(main);
  await pageByTitle(PREVIEW_TITLE);
  const titles = (await Promise.all(app.windows().map(p => p.title()))).sort();
  expect(titles).toEqual([MAIN_TITLE, PREVIEW_TITLE].sort());
  for (const theme of ['dark', 'light']) {
    await main.evaluate(t => window.manta.ipc.send('set-theme', t), theme);
    await expect
      .poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
      .toBe(theme);
    for (const p of app.windows()) {
      await expect
        .poll(() =>
          p.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)
        )
        .toBe(theme === 'dark');
    }
    const expected = theme === 'dark' ? '#0c0c0d' : '#f2f1f0';
    await expect
      .poll(async () => {
        const colors = await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().map(w =>
            w.getBackgroundColor().toLowerCase()
          )
        );
        return colors.every(c => c.slice(0, 7) === expected);
      })
      .toBe(true);
    await expect
      .poll(
        () =>
          JSON.parse(fs.readFileSync(path.join(userData, 'Settings'), 'utf8'))
            .general?.theme
      )
      .toBe(theme);
  }
  await main.evaluate(() => window.manta.ipc.send('set-theme', 'bogus'));
  await expect
    .poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource))
    .toBe('system');
  await app.evaluate(({ BrowserWindow }) => {
    const mainWin = BrowserWindow.getAllWindows().find(
      w => w.getTitle() === 'Manta'
    );
    if (mainWin) {
      mainWin.show();
      mainWin.focus();
    }
  });
});

test('no window reports a CSP violation', async () => {
  expect(cspErrors).toEqual([]);
});

test('sidebar shows labels and Ctrl/Cmd+K opens the command palette', async () => {
  const page = await pageByTitle(MAIN_TITLE);
  await showMain(page);
  await page
    .locator('[data-slot="sidebar"]')
    .getByRole('button', { name: 'Dashboard', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashboard' })
  ).toBeVisible();
  const sidebarNav = page.locator('[data-slot="sidebar"]');
  await expect(
    sidebarNav.getByRole('button', { name: 'New Invoice', exact: true })
  ).toBeVisible();
  for (const name of ['Dashboard', 'Invoices', 'Clients', 'Settings']) {
    await expect(
      sidebarNav.getByRole('button', { name, exact: true })
    ).toBeVisible();
  }
  await page.keyboard.press('ControlOrMeta+K');
  const palette = page.getByRole('dialog');
  await expect(palette).toBeVisible();
  await page.keyboard.type('clients');
  await palette.getByRole('option', { name: 'Clients' }).click();
  await expect(palette).toBeHidden();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Clients' })
  ).toBeVisible();
});

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

test('recurring profile starting today creates one draft and resume does not duplicate', async () => {
  const page = await pageByTitle(MAIN_TITLE);
  await showMain(page);
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'Manta');
    if (w) {
      w.setBounds({ x: 50, y: 50, width: 1280, height: 800 });
      w.show();
      w.focus();
    }
  });

  const sidebar = page.locator('[data-slot="sidebar"]');
  await sidebar.getByRole('button', { name: 'Recurring', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Recurring' })
  ).toBeVisible({ timeout: 15_000 });
  await page.screenshot({
    path: '/tmp/manta-024-screens/recurring-empty-light.png',
    fullPage: true,
  });
  await page.evaluate(() => window.manta.ipc.send('set-theme', 'dark'));
  await expect
    .poll(() =>
      page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)
    )
    .toBe(true);
  await page.screenshot({
    path: '/tmp/manta-024-screens/recurring-empty-dark.png',
    fullPage: true,
  });
  await page.evaluate(() => window.manta.ipc.send('set-theme', 'light'));
  await page
    .getByRole('button', { name: 'New Recurring Invoice', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: 'Save Template', exact: true })
  ).toBeVisible({ timeout: 30_000 });

  await reactInput(page.locator('#client-fullname'), 'Recurring Client');
  await reactInput(page.locator('#client-email'), 'recurring@example.com');
  await reactInput(page.getByLabel('Description for item 1'), 'Retainer');
  await reactInput(page.getByLabel('Price for item 1'), '100');
  await reactInput(page.getByLabel('Quantity for item 1'), '1');
  await page
    .getByRole('button', { name: 'Save Template', exact: true })
    .click();
  // The detail sheet opens at once and hides the page from the a11y tree.
  await expect(page.locator('h1', { hasText: 'Recurring' })).toBeVisible({
    timeout: 15_000,
  });

  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await reactInput(
    sheet.locator('input:not([type="number"])').first(),
    'E2E Monthly'
  );
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Recurring invoice saved')).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole('button', { name: 'View drafts', exact: true })
  ).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'View drafts', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Invoices' })
  ).toBeVisible();
  await expect(page.getByText('No number yet')).toBeVisible({
    timeout: 20_000,
  });

  const countDraftRows = () =>
    page.locator('table tbody tr').filter({ hasText: /./ }).count();

  await app.evaluate(({ BrowserWindow, powerMonitor }) => {
    powerMonitor.emit('resume');
    const win = BrowserWindow.getAllWindows().find(
      w => w.getTitle() === 'Manta'
    );
    if (win && !win.isDestroyed()) {
      win.webContents.send('system-resumed');
    }
  });
  await expect.poll(async () => countDraftRows(), { timeout: 20_000 }).toBe(1);
});

test('draft save advances invoice numbering on cleared form', async () => {
  const page = await pageByTitle(MAIN_TITLE);
  await showMain(page);
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(x => x.getTitle() === 'Manta');
    if (w) {
      w.setBounds({ x: 50, y: 50, width: 1280, height: 800 });
      w.show();
      w.focus();
    }
  });
  await page
    .locator('[data-slot="sidebar"]')
    .getByRole('button', { name: 'New Invoice', exact: true })
    .click();
  await expect(page.locator('#client-fullname')).toBeVisible({
    timeout: 30_000,
  });

  await reactInput(page.locator('#client-fullname'), 'E2E Client');
  await reactInput(page.locator('#client-email'), 'e2e@example.com');
  await reactInput(page.getByLabel('Description for item 1'), 'Line item');
  await reactInput(page.getByLabel('Price for item 1'), '10');
  await reactInput(page.getByLabel('Quantity for item 1'), '1');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#invoice-number')).toHaveValue('INV-0002', {
    timeout: 15_000,
  });
});

test('client name field suggests saved clients like line items', async () => {
  const page = await pageByTitle(MAIN_TITLE);
  const name = page.locator('#client-fullname');
  await expect(name).toHaveValue('');
  await expect(page.locator('#client-email')).toBeVisible();

  await name.click();
  await name.pressSequentially('E2E');
  await page.getByRole('option', { name: /E2E Client/ }).click();
  await expect(name).toHaveValue('E2E Client');
  await expect(page.locator('#client-email')).toHaveCount(0);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(
    page.locator('#root').getByText('e2e@example.com')
  ).toBeVisible();

  await name.fill('Someone New');
  await expect(page.locator('#client-email')).toHaveValue('');
});

test('preview renders an invoice and exports a PDF', async () => {
  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-e2e-'));
  const page = await pageByTitle(MAIN_TITLE);
  await page.evaluate(dir => {
    const invoiceSettings = window.manta.settings.get('invoice');
    window.manta.settings.set('invoice', {
      ...invoiceSettings,
      exportDir: dir,
    });
  }, exportDir);
  await app.evaluate(({ shell }) => {
    shell.openPath = async () => '';
  });
  const issuedAt = Date.UTC(2026, 0, 15, 12);
  const invoice = {
    _id: 'pdf-snapshot-0001',
    invoiceID: 'INV-0042',
    created_at: issuedAt,
    issuedAt,
    status: 'pending',
    recipient: {
      fullname: 'Ada Lovelace',
      company: 'Analytical Engines Ltd',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
    },
    rows: [
      {
        id: 'r1',
        description: 'Design work',
        quantity: 10,
        price: 120,
        subtotal: 1200,
      },
      {
        id: 'r2',
        description: 'Development',
        quantity: 24.5,
        price: 95,
        subtotal: 2327.5,
      },
      {
        id: 'r3',
        description: 'Hosting (annual)',
        quantity: 1,
        price: 240,
        subtotal: 240,
      },
    ],
    currency: {
      code: 'USD',
      placement: 'before',
      separator: 'commaDot',
      fraction: 2,
    },
    tax: { tin: '123-456-789', method: 'default', amount: 10 },
    discount: { type: 'percentage', amount: 5 },
    dueDate: { useCustom: false, paymentTerm: 'net30' },
    note: 'Thank you for your business. Payment by bank transfer within 30 days.',
    subtotal: 3767.5,
    grandTotal: 3937.0375,
    configs: {
      dateFormat: 'MM/DD/YYYY',
      language: 'en',
      accentColor: '#2CCCE4',
      logoSize: '20',
      fontSize: '200',
      alignItems: 'middle',
      showLogo: true,
      useSymbol: true,
      customAccentColor: true,
      showRecipient: true,
      template: 'minimal',
    },
  };
  const result = await page.evaluate(
    inv =>
      window.manta.ipc.invoke('save-pdf', {
        invoice: inv,
        snapshot: {
          profile: window.manta.settings.get('profile'),
          configs: inv.configs,
          language: inv.configs.language,
        },
        docType: 'invoice',
      }),
    invoice
  );
  expect(result.ok, result.error).toBe(true);
  expect(path.dirname(result.pdfPath)).toBe(exportDir);
  const buf = fs.readFileSync(result.pdfPath);
  expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');

  const preview = await pageByTitle(PREVIEW_TITLE);
  await expect(preview.locator('.paper')).toHaveCount(1);
  expect(
    await preview.evaluate(
      () => document.querySelector('.print-area')?.dataset.invoiceId
    )
  ).toBe(invoice._id);
  const infos = await windowInfo();
  expect(infos.find(w => w.title === PREVIEW_TITLE)?.visible).toBe(false);
  expect(errors).toEqual([]);
});

test('exports a Factur-X PDF', async () => {
  const fixture = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'e2e/fixtures/einvoice/standard-de.json'),
      'utf8'
    )
  );
  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-fx-'));
  const outPath = path.join(exportDir, 'standard-de.pdf');
  const settingsPath = path.join(userData, 'Settings');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  settings.profile = fixture.settings.profile;
  settings.invoice = {
    ...settings.invoice,
    ...fixture.settings.invoice,
    exportDir,
    eInvoice: { enabled: true, format: 'facturx-en16931' },
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings));

  const page = await pageByTitle(MAIN_TITLE);
  await page.evaluate(
    data => {
      window.manta.settings.set('profile', data.profile);
      window.manta.settings.set('invoice', data.invoice);
    },
    { profile: settings.profile, invoice: settings.invoice }
  );
  await app.evaluate(({ shell }) => {
    shell.openPath = async () => '';
  });
  const invoice = {
    ...fixture.invoice,
    configs: {
      ...fixture.invoice.configs,
      template: 'business',
      language: 'en',
    },
  };

  await app.evaluate(async ({ dialog }, targetPath) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: targetPath,
    });
  }, outPath);

  const result = await page.evaluate(
    ({ invoice: inv, derived: d, profile }) =>
      window.manta.ipc.invoke('einvoice-export', {
        kind: 'facturx',
        invoice: inv,
        derived: d,
        snapshot: { profile, configs: inv.configs, language: 'en' },
      }),
    { invoice, derived: fixture.derived, profile: settings.profile }
  );

  expect(result.ok, result.error ?? JSON.stringify(result.issues)).toBe(true);
  expect(fs.existsSync(outPath)).toBe(true);
  const buf = fs.readFileSync(outPath);
  expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
  const text = buf.toString('latin1');
  expect(text.includes('factur-x.xml') || text.includes('Factur-X')).toBe(true);
});

test('email invoice handoff stubs mail client and writes PDF', async () => {
  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-email-e2e-'));
  const settingsPath = path.join(userData, 'Settings');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  settings.invoice = { ...settings.invoice, exportDir };
  fs.writeFileSync(settingsPath, JSON.stringify(settings));

  const page = await pageByTitle(MAIN_TITLE);
  await page.evaluate(
    data => {
      window.manta.settings.set('invoice', data.invoice);
    },
    { invoice: settings.invoice }
  );

  await app.evaluate(({ shell }) => {
    shell.openExternal = async () => {};
  });

  const invoice = {
    _id: 'email-e2e-inv',
    docType: 'invoice',
    invoiceID: 'INV-E2E',
    status: 'pending',
    issuedAt: Date.now(),
    created_at: Date.now(),
    currency: settings.invoice.currency,
    grandTotal: 100,
    subtotal: 100,
    rows: [
      {
        id: 'r1',
        description: 'Item',
        quantity: 1,
        price: 100,
        subtotal: 100,
      },
    ],
    recipient: {
      fullname: 'E2E Client',
      email: 'client@example.com',
    },
    configs: {
      template: settings.invoice.template,
      language: settings.general.language,
      dateFormat: settings.invoice.dateFormat,
      accentColor: '#2CCCE4',
      logoSize: '20',
      fontSize: '200',
      alignItems: 'middle',
      showLogo: true,
      useSymbol: true,
      customAccentColor: true,
      showRecipient: true,
    },
  };

  const payload = await page.evaluate(
    async ({ invoice: inv, profile }) => {
      const snapshot = {
        profile,
        configs: inv.configs,
        language: inv.configs.language,
      };
      return window.manta.ipc.invoke('email-invoice', {
        invoiceId: inv._id,
        kind: 'invoice',
        invoice: inv,
        draft: {
          to: 'client@example.com',
          subject: 'Invoice INV-E2E',
          body: 'Please pay.',
        },
        fileBase: 'INV-E2E',
        source: 'app',
        snapshot,
      });
    },
    { invoice, profile: settings.profile }
  );

  expect(payload.ok, payload.error).toBe(true);
  expect(fs.existsSync(payload.pdfPath)).toBe(true);
});
