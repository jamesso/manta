// @vitest-environment node
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { InvoiceService } from '@e-invoice-eu/core';

import { getEInvoiceIssues } from '../getEInvoiceIssues.js';
import { toEn16931 } from '../toEn16931.js';
import { toUblJson } from '../toUblJson.js';

const fixtureDir = path.join(process.cwd(), 'e2e/fixtures/einvoice');
const expectedDir = path.join(fixtureDir, 'expected');
const UPDATE = process.env.UPDATE_EINVOICE_SAMPLES === '1';

function issueCodes(issues) {
  return issues.map(i => i.code).sort();
}

describe('e-invoice golden samples', () => {
  const files = readdirSync(fixtureDir).filter(
    f => f.endsWith('.json') && f !== 'de-profile.json'
  );

  for (const file of files) {
    const base = file.replace(/\.json$/, '');
    it(base, async () => {
      const fixture = JSON.parse(
        readFileSync(path.join(fixtureDir, file), 'utf8')
      );
      const model = toEn16931(
        fixture.invoice,
        fixture.settings,
        fixture.derived
      );

      for (const format of ['facturx-en16931', 'xrechnung-ubl']) {
        const issues = getEInvoiceIssues(model, {
          format,
          invoice: fixture.invoice,
          derived: fixture.derived,
        });
        expect(issueCodes(issues)).toEqual(
          (fixture.expectedIssueCodes?.[format] ?? []).slice().sort()
        );
      }

      const errors = getEInvoiceIssues(model, {
        format: 'facturx-en16931',
        invoice: fixture.invoice,
        derived: fixture.derived,
      }).filter(i => i.severity === 'error');
      const xrErrors = getEInvoiceIssues(model, {
        format: 'xrechnung-ubl',
        invoice: fixture.invoice,
        derived: fixture.derived,
      }).filter(i => i.severity === 'error');

      const service = new InvoiceService({
        warn: () => {},
        error: () => {},
        info: () => {},
        debug: () => {},
      });
      const lang = fixture.lang ?? 'en';

      if (errors.length === 0) {
        const cii = await service.generate(toUblJson(model), {
          format: 'CII',
          lang,
        });
        const ciiPath = path.join(expectedDir, `${base}.cii.xml`);
        if (UPDATE) {
          mkdirSync(expectedDir, { recursive: true });
          writeFileSync(ciiPath, cii, 'utf8');
        } else {
          expect(readFileSync(ciiPath, 'utf8')).toBe(cii);
        }
      }

      if (xrErrors.length === 0) {
        const xr = await service.generate(toUblJson(model), {
          format: 'XRECHNUNG-UBL',
          lang,
        });
        const xrPath = path.join(expectedDir, `${base}.xrechnung.xml`);
        if (UPDATE) {
          mkdirSync(expectedDir, { recursive: true });
          writeFileSync(xrPath, xr, 'utf8');
        } else {
          expect(readFileSync(xrPath, 'utf8')).toBe(xr);
        }
      }
    });
  }
});
