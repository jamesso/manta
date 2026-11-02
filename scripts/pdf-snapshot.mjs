// Usage: node scripts/pdf-snapshot.mjs <outDir>   (run `npm run build` first)
// Captures one PDF and one computed-style JSON per case and theme.
// Always launches a profile this process created under /tmp.
// Never the real Manta profile, and never the caller's directory.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
  CASES[`${template}-partial`] = {
    template,
    invoice: {
      payments: [
        {
          id: 'p1',
          date: Date.UTC(2026, 0, 20),
          amount: 1500,
          method: 'bank',
          note: '',
        },
      ],
    },
  };
  CASES[`${template}-paid-full`] = {
    template,
    invoice: {
      status: 'paid',
      paidAt: Date.UTC(2026, 0, 25),
      payments: [
        {
          id: 'p2',
          date: Date.UTC(2026, 0, 25),
          amount: 3937.04,
          method: 'bank',
          note: '',
        },
      ],
    },
  };
}

CASES['minimal-credit-note'] = {
  template: 'minimal',
  invoice: {
    ...BASE,
    docType: 'creditNote',
    status: 'issued',
    invoiceID: 'CN-0001',
    creditedInvoiceId: 'pdf-snapshot-0001',
    creditedInvoice: { invoiceID: 'INV-0042', issuedAt: T },
    dueDate: undefined,
  },
};
CASES['business-credit-note'] = {
  template: 'business',
  invoice: {
    ...BASE,
    docType: 'creditNote',
    status: 'issued',
    invoiceID: 'CN-0001',
    creditedInvoiceId: 'pdf-snapshot-0001',
    creditedInvoice: { invoiceID: 'INV-0042', issuedAt: T },
    dueDate: undefined,
  },
};

const SNAPSHOT_SET = process.env.SNAPSHOT_SET || 'legacy';

const LINE_BASE = {
  ...BASE,
  tax: undefined,
  discount: undefined,
  taxMode: 'line',
  taxCalc: 1,
  seller: { taxId: 'DE-TAX-1', vatId: 'DE123456789' },
  recipient: {
    ...BASE.recipient,
    taxId: 'FR12345678901',
  },
};

const LINE = {
  ...LINE_BASE,
  rows: [
    {
      id: 'r1',
      description: 'Standard rated',
      quantity: 1,
      price: 100,
      subtotal: 100,
      taxRate: 19,
      taxCategory: 'S',
      taxRateId: 's19',
    },
    {
      id: 'r2',
      description: 'Reduced rate',
      quantity: 1,
      price: 50,
      subtotal: 50,
      taxRate: 7,
      taxCategory: 'S',
      taxRateId: 's7',
    },
    {
      id: 'r3',
      description: 'Exempt',
      quantity: 1,
      price: 30,
      subtotal: 30,
      taxRate: 0,
      taxCategory: 'E',
      taxExemptionReason: 'Exempt under §4 UStG',
      taxRateId: 'e0',
    },
  ],
  subtotal: 180,
  grandTotal: 202.15,
};

const LINE_AE = {
  ...LINE_BASE,
  rows: [
    {
      id: 'r1',
      description: 'Service A',
      quantity: 1,
      price: 200,
      subtotal: 200,
      taxRate: 0,
      taxCategory: 'AE',
      taxExemptionReason: 'Reverse charge',
      taxRateId: 'ae',
    },
    {
      id: 'r2',
      description: 'Service B',
      quantity: 1,
      price: 100,
      subtotal: 100,
      taxRate: 0,
      taxCategory: 'AE',
      taxExemptionReason: 'Reverse charge',
      taxRateId: 'ae',
    },
  ],
  subtotal: 300,
  grandTotal: 300,
};

const LINE_CASES = {};
for (const template of ['minimal', 'business']) {
  LINE_CASES[`${template}-line`] = { template, invoice: LINE };
  LINE_CASES[`${template}-line-ae`] = { template, invoice: LINE_AE };
}

const ESTIMATE_BASE = {
  ...BASE,
  docType: 'estimate',
  status: 'sent',
  validUntil: Date.UTC(2026, 1, 14),
};
delete ESTIMATE_BASE.dueDate;

const ESTIMATE_CASES = {};
for (const template of ['minimal', 'business']) {
  ESTIMATE_CASES[`${template}-default`] = {
    template,
    invoice: { ...ESTIMATE_BASE },
  };
}

const ACTIVE_CASES =
  SNAPSHOT_SET === 'line'
    ? LINE_CASES
    : SNAPSHOT_SET === 'estimate'
      ? ESTIMATE_CASES
      : CASES;

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

const MANTA_PROFILE_MARK = `${path.sep}library${path.sep}application support${path.sep}manta`;

function realTemporaryDirectory() {
  return fs.realpathSync('/tmp');
}

// Resolve the real path, including symlink ancestors, before any check.
export function assertDisposableProfile(dir) {
  let resolved;
  try {
    resolved = fs.realpathSync(dir);
  } catch {
    throw new Error(
      `Profile must be a disposable directory under /tmp: ${dir}`
    );
  }
  const lower = resolved.toLowerCase();
  if (lower.includes(MANTA_PROFILE_MARK)) {
    throw new Error(`Refusing Manta profile: ${resolved}`);
  }
  const realTmp = realTemporaryDirectory();
  if (
    resolved === realTmp ||
    resolved === '/tmp' ||
    resolved === '/private/tmp'
  ) {
    throw new Error(`Refusing temporary directory itself: ${resolved}`);
  }
  if (!resolved.startsWith(`${realTmp}${path.sep}`)) {
    throw new Error(
      `Profile must be a disposable directory under /tmp: ${resolved}`
    );
  }
  if (path.dirname(resolved) !== realTmp) {
    throw new Error(
      `Profile must be a dedicated child of the temporary directory: ${resolved}`
    );
  }
  return resolved;
}

function containsMantaProfile(resolved) {
  return resolved.toLowerCase().includes(MANTA_PROFILE_MARK);
}

// Follow symlink directories. Remember each real path so a cycle stops.
// Any resolved path inside the Manta profile throws before the copy.
function assertTreeHasNoMantaProfile(root) {
  const pending = [root];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    let resolved;
    try {
      resolved = fs.realpathSync(current);
    } catch {
      throw new Error(`Refusing unreadable profile entry: ${current}`);
    }
    if (containsMantaProfile(resolved)) {
      throw new Error(`Refusing Manta profile: ${resolved}`);
    }
    if (visited.has(resolved)) continue;
    visited.add(resolved);
    const info = fs.lstatSync(current);
    const symlinkDirectory =
      info.isSymbolicLink() && fs.statSync(resolved).isDirectory();
    if (!info.isDirectory() && !symlinkDirectory) continue;
    for (const name of fs.readdirSync(resolved)) {
      pending.push(path.join(resolved, name));
    }
  }
}

function resolvedSymlinkTarget(linkPath) {
  try {
    return fs.realpathSync(linkPath);
  } catch {
    throw new Error(`Refusing unreadable profile entry: ${linkPath}`);
  }
}

// Node's C++ copy keeps symlinks even when dereference is set. Replace
// anything that remains. A link into the Manta profile throws instead of
// copying that tree.
function materializeOwnedSymlinks(root) {
  const pending = [root];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink()) {
      const target = resolvedSymlinkTarget(current);
      if (containsMantaProfile(target)) {
        throw new Error(`Refusing Manta profile: ${target}`);
      }
      const targetInfo = fs.statSync(target);
      if (targetInfo.isDirectory()) {
        assertTreeHasNoMantaProfile(target);
        fs.unlinkSync(current);
        fs.cpSync(target, current, {
          recursive: true,
          dereference: true,
          filter: () => true,
        });
        pending.push(current);
      } else {
        fs.unlinkSync(current);
        fs.copyFileSync(target, current);
      }
      continue;
    }
    if (!info.isDirectory()) continue;
    const resolved = resolvedSymlinkTarget(current);
    if (containsMantaProfile(resolved)) {
      throw new Error(`Refusing Manta profile: ${resolved}`);
    }
    if (visited.has(resolved)) continue;
    visited.add(resolved);
    for (const name of fs.readdirSync(current)) {
      pending.push(path.join(current, name));
    }
  }
}

// Copy caller input into a new directory. Electron is only ever pointed at
// the directory this function creates. The copy contains no symlinks.
export function createOwnedProfile(sourceDir) {
  const source = sourceDir ? assertDisposableProfile(sourceDir) : null;
  const owned = fs.mkdtempSync(
    path.join(realTemporaryDirectory(), 'manta-pdf-')
  );
  if (!source) {
    assertDisposableProfile(owned);
    return { launchProfile: owned, callerProfile: null };
  }
  try {
    assertTreeHasNoMantaProfile(source);
    fs.cpSync(source, owned, { recursive: true, dereference: true });
    materializeOwnedSymlinks(owned);
  } catch (err) {
    fs.rmSync(owned, { recursive: true, force: true });
    throw err;
  }
  return { launchProfile: owned, callerProfile: source };
}

export async function closeAndRemoveOwnedProfile(app, profileDir) {
  try {
    if (app) await app.close();
  } finally {
    if (profileDir) fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

async function main() {
  const outDir = path.resolve(process.argv[2] || '/tmp/manta-pdf-snapshot');
  fs.mkdirSync(outDir, { recursive: true });

  let app;
  const prepared = createOwnedProfile(process.env.SNAPSHOT_USER_DATA || null);
  const launchProfile = prepared.launchProfile;
  const launchEnv = {
    ...process.env,
    MANTA_USER_DATA: launchProfile,
    NODE_ENV: 'production',
    TZ: 'UTC',
  };
  delete launchEnv.SNAPSHOT_USER_DATA;

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
      env: launchEnv,
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
      for (const [name, cfg] of Object.entries(ACTIVE_CASES)) {
        const { invoice: extra = {}, ...rest } = cfg;
        const invoice = {
          ...BASE,
          ...extra,
          _id: `pdf-${name}-${theme}`,
          configs: { ...DEF, ...rest },
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
    await closeAndRemoveOwnedProfile(app, launchProfile);
  }

  console.log(
    `Wrote ${Object.keys(ACTIVE_CASES).length * 2} PDFs to ${outDir}`
  );
  console.log(`Profile ${launchProfile} (removed: true)`);
}

if (isDirectRun()) {
  await main();
}
