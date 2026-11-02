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
  });
});
