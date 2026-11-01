import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TOUR_TITLE = 'Tour';
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
    .toBeGreaterThanOrEqual(3);

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

test('creates the Tour, Manta and Previewer windows', async () => {
  const infos = await windowInfo();
  const titles = infos.map(w => w.title);
  expect(titles).toContain(TOUR_TITLE);
  expect(titles).toContain(MAIN_TITLE);
  expect(titles).toContain(PREVIEW_TITLE);
});

test('fresh profile shows the tour window', async () => {
  await expect
    .poll(
      async () => {
        const infos = await windowInfo();
        return infos.find(w => w.title === TOUR_TITLE)?.visible;
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  const infos = await windowInfo();
  const tour = infos.find(w => w.title === TOUR_TITLE);
  const main = infos.find(w => w.title === MAIN_TITLE);
  const preview = infos.find(w => w.title === PREVIEW_TITLE);
  expect(tour).toBeTruthy();
  expect(tour.visible).toBe(true);
  expect(tour.resizable).toBe(false);
  // Electron does not implement `movable` on Linux; isMovable() is always true there.
  expect(tour.movable).toBe(process.platform === 'linux');
  expect(tour.minimized).toBe(false);
  expect(tour.devTools).toBe(false);
  expect(tour.bounds.width).toBe(700);
  expect(tour.bounds.height).toBe(600);
  expect(main.visible).toBe(false);
  expect(preview.visible).toBe(false);
});

test('tour next control is on screen and advances', async () => {
  let page;
  for (const p of app.windows()) {
    if ((await p.title()) === TOUR_TITLE) page = p;
  }
  expect(page).toBeTruthy();
  const next = page.getByRole('button', { name: 'Next' });
  const box = await next.boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(box).toBeTruthy();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight);
  await next.click();
  await expect(
    page.getByRole('heading', { name: 'Step 1. Create' })
  ).toBeVisible();
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
        for (const p of app.windows())
          if ((await p.title()) === title) found = p;
        return Boolean(found);
      },
      { timeout: 30_000 }
    )
    .toBe(true);
  return found;
}

test('theme setting reaches every window', async () => {
  const main = await pageByTitle(MAIN_TITLE);
  await main.evaluate(() =>
    window.manta.ipc.send('show-modal', {
      type: 'info',
      title: 'Theme check',
      message: 'Theme check',
      buttons: ['OK'],
    })
  );
  await pageByTitle('Dialog');
  expect(app.windows().length).toBeGreaterThanOrEqual(4);
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
});

test('no window reports a CSP violation', async () => {
  expect(cspErrors).toEqual([]);
});
