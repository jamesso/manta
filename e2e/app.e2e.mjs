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
    page.locator('h1.text-2xl', { hasText: 'Dashboard' })
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

test('preview window is resizable and movable', async () => {
  const infos = await windowInfo();
  const preview = infos.find(w => w.title === PREVIEW_TITLE);
  expect(preview.resizable).toBe(true);
  expect(preview.movable).toBe(true);
  expect(preview.devTools).toBe(false);
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

test('theme setting reaches every window', async () => {
  const main = await pageByTitle(MAIN_TITLE);
  await showMain(main);
  await main.evaluate(() =>
    window.manta.ipc.send('show-modal', {
      type: 'info',
      title: 'Theme check',
      message: 'Theme check',
      buttons: ['OK'],
    })
  );
  await pageByTitle('Dialog');
  expect(app.windows().length).toBeGreaterThanOrEqual(3);
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
    const expected = theme === 'dark' ? '#0a0a0a' : '#ffffff';
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
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find(w => w.getTitle() === 'Dialog')
      ?.close()
  );
  await app.evaluate(({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find(
      w => w.getTitle() === 'Manta'
    );
    if (main) {
      main.show();
      main.focus();
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
    page.locator('h1.text-2xl', { hasText: 'Dashboard' })
  ).toBeVisible();
  const sidebarNav = page.locator('[data-slot="sidebar"]');
  await expect(
    sidebarNav.getByRole('button', { name: 'New invoice', exact: true })
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
    page.locator('h1.text-2xl', { hasText: 'Clients' })
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
    .getByRole('button', { name: 'New invoice', exact: true })
    .click();
  await expect(page.locator('#client-fullname')).toBeVisible({
    timeout: 30_000,
  });

  await reactInput(page.locator('#client-fullname'), 'E2E Client');
  await reactInput(page.locator('#client-email'), 'e2e@example.com');
  await reactInput(page.getByLabel('Description for item 1'), 'Line item');
  await reactInput(page.getByLabel('Price for item 1'), '10');
  await reactInput(page.getByLabel('Quantity for item 1'), '1');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#invoice-number')).toHaveValue('INV-0002', {
    timeout: 15_000,
  });
});
