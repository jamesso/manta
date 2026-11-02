import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  getEInvoiceDerived,
  mergeRecipientFromContact,
} from '../einvoice';

const fixtureDir = path.join(process.cwd(), 'e2e/fixtures/einvoice');

describe('app einvoice helpers', () => {
  const files = readdirSync(fixtureDir).filter(
    f => f.endsWith('.json') && f !== 'de-profile.json'
  );

  it.each(files)('derived matches helpers for %s', file => {
    const fixture = JSON.parse(
      readFileSync(path.join(fixtureDir, file), 'utf8')
    );
    const derived = getEInvoiceDerived(fixture.invoice, {
      profile: fixture.settings.profile,
      invoiceSettings: fixture.settings.invoice,
      lang: fixture.lang ?? 'en',
    });
    expect(derived).toEqual(fixture.derived);
  });

  it('falls back to seller tax ids from profile', () => {
    const invoice = { rows: [], currency: { fraction: 2 } };
    const profile = { taxId: 'T', vatId: 'V' };
    const derived = getEInvoiceDerived(invoice, {
      profile,
      invoiceSettings: { tax: { tin: 'legacy' } },
      lang: 'en',
    });
    expect(derived.seller).toEqual({ taxId: 'T', vatId: 'V' });
  });

  it('mergeRecipientFromContact copies address fields only when set', () => {
    const recipient = { fullname: 'Keep', _id: 'r1', email: 'old@x.de' };
    const contact = {
      postalAddress: { street: 'New', city: 'C', postcode: '1', countryCode: 'DE' },
      buyerReference: '04011000-1234512345-06',
      taxId: 'DE123',
      email: '',
    };
    const merged = mergeRecipientFromContact(recipient, contact);
    expect(merged.fullname).toBe('Keep');
    expect(merged._id).toBe('r1');
    expect(merged.postalAddress.street).toBe('New');
    expect(merged.buyerReference).toBe('04011000-1234512345-06');
    expect(merged.taxId).toBe('DE123');
    expect(merged.email).toBe('old@x.de');
    expect(recipient.fullname).toBe('Keep');
  });
});
