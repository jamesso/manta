import { buildInvoicesCsv, escapeCsvField } from '../csv';

describe('csv', () => {
  it('escapes commas and quotes', () => {
    expect(escapeCsvField('a,b', { text: true })).toBe('"a,b"');
    expect(escapeCsvField('a"b', { text: true })).toBe('"a""b"');
  });

  it('prefixes formula injection', () => {
    expect(escapeCsvField('=SUM(A1)', { text: true })).toBe("'=SUM(A1)");
  });

  it('does not prefix negative numbers without text flag', () => {
    expect(escapeCsvField('-5')).toBe('-5');
  });

  it('includes BOM and CRLF', () => {
    const csv = buildInvoicesCsv(
      [
        {
          _id: 'x',
          created_at: Date.UTC(2026, 0, 15),
          rows: [{ subtotal: 10 }],
          recipient: { fullname: 'A' },
          currency: { code: 'USD', fraction: 2 },
        },
      ],
      Date.UTC(2026, 0, 20)
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.includes('\r\n')).toBe(true);
    expect(csv.split('\r\n')[0]).toContain('amount_paid,balance_due');
  });

  it('prints partial amounts and empty balance for draft', () => {
    const now = Date.UTC(2026, 0, 20);
    const partial = {
      _id: 'p',
      status: 'pending',
      created_at: Date.UTC(2026, 0, 1),
      grandTotal: 100,
      currency: { code: 'USD', fraction: 2 },
      rows: [{ subtotal: 100 }],
      recipient: { fullname: 'A' },
      payments: [
        { id: '1', date: Date.UTC(2026, 0, 2), amount: 40, method: 'cash' },
      ],
    };
    const draft = {
      _id: 'd',
      status: 'draft',
      created_at: Date.UTC(2026, 0, 1),
      grandTotal: 50,
      currency: { code: 'USD', fraction: 2 },
      rows: [{ subtotal: 50 }],
      recipient: { fullname: 'B' },
    };
    const csv = buildInvoicesCsv([partial, draft], now);
    expect(csv).toContain('partial');
    expect(csv).toContain('40.00,60.00');
    const draftLine = csv.split('\r\n').find(l => l.includes(',B,'));
    expect(draftLine).toMatch(/0\.00,$/);
  });

  it('excludes estimates from row count', () => {
    const now = Date.UTC(2026, 0, 20);
    const csv = buildInvoicesCsv(
      [
        {
          _id: 'i',
          created_at: now,
          rows: [{ subtotal: 1 }],
          recipient: { fullname: 'I' },
          currency: { code: 'USD', fraction: 2 },
        },
        {
          _id: 'e',
          docType: 'estimate',
          created_at: now,
          rows: [{ subtotal: 2 }],
          recipient: { fullname: 'E' },
          currency: { code: 'USD', fraction: 2 },
        },
      ],
      now
    );
    expect(csv.split('\r\n').filter(Boolean).length).toBe(2);
    expect(csv).not.toContain(',E,');
  });
});
