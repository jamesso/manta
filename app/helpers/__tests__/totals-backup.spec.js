import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  getInvoiceTotals,
  getInvoiceValue,
  isLineTaxInvoice,
} from '../invoice';

const backupPath = process.env.MANTA_TOTALS_BACKUP;

describe.skipIf(!backupPath)('totals-backup against exported backup', () => {
  it('legacy invoices match getInvoiceValue totals', () => {
    const raw = fs.readFileSync(backupPath, 'utf8');
    const backup = JSON.parse(raw);
    const invoices = backup.invoices ?? backup.data?.invoices ?? [];
    let storedMismatch = 0;
    for (const doc of invoices) {
      if (isLineTaxInvoice(doc)) {
        continue;
      }
      const v = getInvoiceValue(doc);
      const t = getInvoiceTotals(doc);
      expect(Object.is(t.grandTotal, v.grandTotal)).toBe(true);
      expect(Object.is(t.subtotal, v.subtotal)).toBe(true);
      if (
        Number.isFinite(doc.grandTotal) &&
        !Object.is(doc.grandTotal, v.grandTotal)
      ) {
        storedMismatch += 1;
      }
    }

    console.log(`stored grandTotal mismatch count: ${storedMismatch}`);
  });
});
