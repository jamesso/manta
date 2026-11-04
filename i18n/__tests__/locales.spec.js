import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next from 'i18next';

import de from '../de';
import en from '../en';
import fr from '../fr';
import id from '../id';
import itLocale from '../it';
import sk from '../sk';
import urPK from '../ur-PK';
import vi from '../vi';
import zhCN from '../zh-CN';
import { labelled } from '../../preview/templates/labelled';

const LOCALES = {
  de,
  fr,
  id,
  it: itLocale,
  sk,
  'ur-PK': urPK,
  vi,
  'zh-CN': zhCN,
};
const PLURAL = /_(zero|one|two|few|many|other)$/;
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

// Flatten nested resources to { 'a.b.c': 'value' }.
const flatten = (obj, prefix = '') =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    const p = prefix + key;
    if (value && typeof value === 'object')
      Object.assign(acc, flatten(value, `${p}.`));
    else acc[p] = value;
    return acc;
  }, {});

// Interpolations, nestings and tags must survive translation unchanged.
const tokens = value =>
  new Set(
    String(value).match(/\{\{[^}]+\}\}|\$t\([^)]*\)|<\/?\w+\s*\/?>/g) ?? []
  );

// Group English plural keys (`x_one`, `x_other`) under their base key.
function englishKeys(flat) {
  const singles = {};
  const plurals = {};
  for (const [key, value] of Object.entries(flat)) {
    if (PLURAL.test(key) && !key.endsWith('_zero')) {
      (plurals[key.replace(PLURAL, '')] ??= []).push(value);
    } else {
      singles[key] = value;
    }
  }
  return { singles, plurals };
}

describe('locale resources', () => {
  const namespaces = Object.keys(en).sort();

  describe.each(Object.entries(LOCALES))('%s', (lng, resources) => {
    const categories = new Intl.PluralRules(lng).resolvedOptions()
      .pluralCategories;

    it('loads the same namespaces as English', () => {
      expect(Object.keys(resources).sort()).toEqual(namespaces);
    });

    it.each(namespaces)('translates every English key in %s', ns => {
      const { singles, plurals } = englishKeys(flatten(en[ns]));
      const local = flatten(resources[ns] ?? {});
      const missing = [];
      const badTokens = [];

      for (const [key, value] of Object.entries(singles)) {
        if (typeof local[key] !== 'string' || !local[key].trim())
          missing.push(key);
        else if (
          [...tokens(value)].sort().join() !==
          [...tokens(local[key])].sort().join()
        ) {
          badTokens.push(key);
        }
      }
      for (const [base, values] of Object.entries(plurals)) {
        const allowed = new Set(values.flatMap(v => [...tokens(v)]));
        for (const cat of categories) {
          const key = `${base}_${cat}`;
          if (typeof local[key] !== 'string' || !local[key].trim())
            missing.push(key);
          else if ([...tokens(local[key])].some(t => !allowed.has(t)))
            badTokens.push(key);
        }
      }

      expect(missing).toEqual([]);
      expect(badTokens).toEqual([]);
    });

    it.each(namespaces)('has no keys in %s that English does not have', ns => {
      const english = flatten(en[ns]);
      const bases = new Set(
        Object.keys(english).map(k => k.replace(PLURAL, ''))
      );
      const stale = Object.keys(flatten(resources[ns] ?? {})).filter(
        key =>
          !(key in english) &&
          !(PLURAL.test(key) && bases.has(key.replace(PLURAL, '')))
      );
      expect(stale).toEqual([]);
    });
  });
});

describe('translation keys used in code', () => {
  const SOURCE_DIRS = ['app', 'main', 'preview', 'ui'];
  const files = SOURCE_DIRS.flatMap(dir => {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return [];
    return fs
      .readdirSync(abs, { recursive: true })
      .filter(
        f =>
          /\.(js|jsx)$/.test(f) &&
          !f.includes('__tests__') &&
          !f.includes('node_modules')
      )
      .map(f => path.join(abs, f));
  });
  const englishFlat = Object.fromEntries(
    Object.entries(en).flatMap(([ns, res]) =>
      Object.entries(flatten(res)).map(([k, v]) => [`${ns}:${k}`, v])
    )
  );
  const englishBases = new Set(
    Object.keys(englishFlat).map(k => k.replace(PLURAL, ''))
  );

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('only uses static namespaced keys that exist in English', () => {
    const missing = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const [, , raw] of src.matchAll(
        /\bt\(\s*(['"])([a-zA-Z]+:[\w.:]+)\1/g
      )) {
        // i18next joins everything after the first ':' with the key separator,
        // so 'ns:a:b' resolves the same as 'ns:a.b'.
        const [ns, ...rest] = raw.split(':');
        const key = `${ns}:${rest.join('.')}`;
        if (!(key in englishFlat) && !englishBases.has(key)) {
          missing.push(`${path.relative(ROOT, file)} → ${raw}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  // A key like 'ns:x_one' skips i18next plural rules: languages without a
  // "one" form fall back to English, and Slovak "few" is never used. Pass the
  // base key and { count } instead.
  it('does not hard-code plural suffixes in keys', () => {
    const suffixed =
      /(['"`])[a-zA-Z]+:[\w.:${}]*_(zero|one|two|few|many|other)\1|_\$\{[^}]*['"]one['"]/g;
    const found = files.flatMap(file =>
      [...fs.readFileSync(file, 'utf8').matchAll(suffixed)].map(
        ([match]) => `${path.relative(ROOT, file)} → ${match}`
      )
    );
    expect(found).toEqual([]);
  });
});

describe('resolved strings', () => {
  const i18n = i18next.createInstance();
  i18n.init({
    initAsync: false,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    resources: { en, ...LOCALES },
  });
  const t = i18n.t.bind(i18n);

  it.each(['en', ...Object.keys(LOCALES)])(
    'quotes the real Save & Preview label in the overflow hint (%s)',
    lng => {
      const hint = t('form:preview.overflow', { lng });
      expect(hint).not.toContain('$t(');
      expect(hint).toContain(t('form:header.btns.saveAndPreview', { lng }));
    }
  );

  it('uses the colon style of each PDF language', () => {
    const created = lng => labelled(t, lng, 'preview:common:created', '4.11.');
    expect(created('en')).toBe('Created: 4.11.');
    // French: no-break space before the colon, so it never wraps alone.
    expect(created('fr')).toBe('Date d’émission\u00a0: 4.11.');
    // Chinese: full-width colon, no space.
    expect(created('zh-CN')).toBe(
      `${t('preview:common:created', { lng: 'zh-CN' })}：4.11.`
    );
  });

  it('PDF templates do not hard-code a colon after a label', () => {
    const dir = path.join(ROOT, 'preview/templates');
    const hardCoded = fs
      .readdirSync(dir, { recursive: true })
      .filter(file => file.endsWith('.jsx'))
      .flatMap(file =>
        fs
          .readFileSync(path.join(dir, file), 'utf8')
          .split('\n')
          .filter(line => /\}\)\}\s*:|>[A-Z][\w ]+:\s*\{/.test(line))
          .map(line => `${file} → ${line.trim()}`)
      );
    expect(hardCoded).toEqual([]);
  });

  // PDFs render in the invoice language, not the app language.
  it('PDF templates pass lng to every t() call', () => {
    const dir = path.join(ROOT, 'preview/templates');
    const noLng = fs
      .readdirSync(dir, { recursive: true })
      .filter(file => file.endsWith('.jsx'))
      .flatMap(file =>
        [
          ...fs
            .readFileSync(path.join(dir, file), 'utf8')
            .matchAll(/\bt\(\s*(['"`])(?:(?!\1)[\s\S])*\1\s*\)/g),
        ].map(([call]) => `${file} → ${call.replace(/\s+/g, ' ')}`)
      );
    expect(noLng).toEqual([]);
  });
});
