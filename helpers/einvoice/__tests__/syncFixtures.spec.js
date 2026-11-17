import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getEInvoiceDerived } from '../../../app/helpers/einvoice.js';

const fixtureDir = path.join(process.cwd(), 'e2e/fixtures/einvoice');

describe.skipIf(process.env.SYNC_EINVOICE_FIXTURES !== '1')(
  'sync fixture derived',
  () => {
    it('writes derived blocks', () => {
      for (const name of readdirSync(fixtureDir).filter(f =>
        f.endsWith('.json')
      )) {
        if (name === 'de-profile.json') {
          continue;
        }
        const filePath = path.join(fixtureDir, name);
        const fixture = JSON.parse(readFileSync(filePath, 'utf8'));
        fixture.derived = getEInvoiceDerived(fixture.invoice, {
          profile: fixture.settings.profile,
          invoiceSettings: fixture.settings.invoice,
          lang: fixture.lang ?? 'en',
        });
        writeFileSync(filePath, `${JSON.stringify(fixture, null, 2)}\n`);
      }
      expect(true).toBe(true);
    });
  }
);
