// Usage: node scripts/pdf-snapshot.mjs <outDir>   (run `npm run build` first)
// Captures one PDF and one computed-style JSON per case and theme.
// Always uses a disposable profile under /tmp. Never the real Manta profile.
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] || '/tmp/manta-pdf-snapshot');
fs.mkdirSync(outDir, { recursive: true });

// Must equal getPrintOptions(undefined) in main/print-options.js.
const PRINT = {
  landscape: false,
  printBackground: true,
  margins: { marginType: 'default' },
  preferCSSPageSize: true,
};

const T = Date.UTC(2026, 0, 15, 12);
const BASE = {
  _id: 'pdf-snapshot-0001',
  invoiceID: 'INV-0042',
  created_at: T,
  issuedAt: T,
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
};
const DEF = {
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
};
const OFF = {
  showLogo: false,
  customAccentColor: false,
  showRecipient: false,
  useSymbol: false,
};
const CASES = {};
for (const template of ['minimal', 'business']) {
  CASES[`${template}-default`] = { template };
  CASES[`${template}-off-top`] = { template, ...OFF, alignItems: 'top' };
  CASES[`${template}-off-bottom`] = { template, ...OFF, alignItems: 'bottom' };
  CASES[`${template}-large`] = {
    template,
    fontSize: '500',
    logoSize: '40',
    accentColor: '#F47373',
    dateFormat: 'dddd, MMMM Do, YYYY',
  };
  CASES[`${template}-small`] = {
    template,
    fontSize: '100',
    logoSize: '7.5',
    accentColor: '#37D67A',
    dateFormat: 'DD/MM/YY',
  };
  CASES[`${template}-ur-PK`] = { template, language: 'ur-PK' };
  CASES[`${template}-zh-CN`] = { template, language: 'zh-CN' };
}

const PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'color',
  'background-color',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top',
  'border-bottom',
  'border-left',
  'border-right',
  'display',
  'box-sizing',
  'text-align',
  'vertical-align',
  'width',
  'height',
  'max-width',
  'letter-spacing',
  'text-transform',
  'direction',
  'box-shadow',
  'border-collapse',
  'border-radius',
];

// Reject the real profile even if a caller points SNAPSHOT_USER_DATA at it.
function assertDisposableProfile(dir) {
  const resolved = path.resolve(dir);
  const lower = resolved.toLowerCase();
  const banned = `${path.sep}library${path.sep}application support${path.sep}manta`;
  if (lower.includes(banned)) {
    throw new Error(`Refusing Manta profile: ${resolved}`);
  }
  const underTmp =
    lower === '/tmp' ||
    lower.startsWith(`/tmp${path.sep}`) ||
    lower === '/private/tmp' ||
    lower.startsWith(`/private/tmp${path.sep}`);
  if (!underTmp) {
    throw new Error(
      `Profile must be a disposable directory under /tmp: ${resolved}`
    );
  }
}

let app;
let userData;
let removeProfile = false;

if (process.env.SNAPSHOT_USER_DATA) {
  userData = path.resolve(process.env.SNAPSHOT_USER_DATA);
  assertDisposableProfile(userData);
  fs.mkdirSync(userData, { recursive: true });
} else {
  userData = fs.mkdtempSync(path.join('/tmp', 'manta-pdf-'));
  removeProfile = true;
  assertDisposableProfile(userData);
}

try {
  // Dynamic import so a bad profile path fails before Playwright loads.
  // Playwright's default colorScheme emulates light and hides nativeTheme.
  // e2e/app.e2e.mjs sets colorScheme: null for the same reason.
  const { _electron: electron } = await import('@playwright/test');
  app = await electron.launch({
    args: [
      'out/main/index.js',
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
    env: {
      ...process.env,
      MANTA_USER_DATA: userData,
      NODE_ENV: 'production',
      TZ: 'UTC',
    },
    colorScheme: null,
  });

  const findPreview = async () => {
    for (const p of app.windows()) {
      if ((await p.title()) === 'Previewer') return p;
    }
    return undefined;
  };

  let page;
  for (let i = 0; i < 60 && !page; i++) {
    page = await findPreview();
    if (!page) await new Promise(r => setTimeout(r, 500));
  }
  if (!page) throw new Error('Preview window not found');
  await page.waitForLoadState('load');

  for (const theme of ['light', 'dark']) {
    await app.evaluate(({ nativeTheme }, t) => {
      nativeTheme.themeSource = t;
    }, theme);
    for (const [name, cfg] of Object.entries(CASES)) {
      const invoice = {
        ...BASE,
        _id: `pdf-${name}-${theme}`,
        configs: { ...DEF, ...cfg },
      };
      await app.evaluate(({ BrowserWindow }, inv) => {
        BrowserWindow.getAllWindows()
          .find(w => w.getTitle() === 'Previewer')
          .webContents.send('update-preview', inv);
      }, invoice);
      await page.waitForFunction(
        id => document.querySelector('.print-area')?.dataset.invoiceId === id,
        invoice._id,
        { timeout: 10000 }
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map(i => i.decode().catch(() => {}))
        );
        // Do not wait on requestAnimationFrame in this hidden window.
        await new Promise(r => setTimeout(r, 50));
      });
      await page.waitForTimeout(300);
      const b64 = await app.evaluate(async ({ BrowserWindow }, opts) => {
        const w = BrowserWindow.getAllWindows().find(
          x => x.getTitle() === 'Previewer'
        );
        return (await w.webContents.printToPDF(opts)).toString('base64');
      }, PRINT);
      fs.writeFileSync(
        path.join(outDir, `${name}-${theme}.pdf`),
        Buffer.from(b64, 'base64')
      );
      const styles = await page.evaluate(props => {
        const root = document.querySelector('.print-area');
        return [root, ...root.querySelectorAll('*')].map(el => {
          const cs = getComputedStyle(el);
          return [
            el.tagName,
            ...props.map(p => `${p}: ${cs.getPropertyValue(p)}`),
          ];
        });
      }, PROPS);
      fs.writeFileSync(
        path.join(outDir, `${name}-${theme}.styles.json`),
        JSON.stringify(styles, null, 1)
      );
    }
  }
} finally {
  if (app) await app.close();
  if (removeProfile) fs.rmSync(userData, { recursive: true, force: true });
}

console.log(`Wrote ${Object.keys(CASES).length * 2} PDFs to ${outDir}`);
console.log(`Profile ${userData} (removed: ${removeProfile})`);
