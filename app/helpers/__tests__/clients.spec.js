import {
  buildContact,
  getContactErrors,
  matchesClientQuery,
  summarizeClients,
} from '../clients';

describe('summarizeClients', () => {
  const contactA = { _id: 'a', fullname: 'A' };
  const contactB = { _id: 'b', fullname: 'B' };
  const now = Date.parse('2026-06-01');

  it('keeps two currencies separate', () => {
    const invoices = [
      {
        _id: '1',
        recipient: { _id: 'a' },
        status: 'pending',
        currency: { code: 'USD' },
        rows: [{ price: '10', quantity: '1', subtotal: 10 }],
      },
      {
        _id: '2',
        recipient: { _id: 'a' },
        status: 'pending',
        currency: { code: 'EUR' },
        rows: [{ price: '20', quantity: '1', subtotal: 20 }],
      },
    ];
    const map = summarizeClients([contactA], invoices, now);
    expect(map.get('a').outstanding).toEqual({ USD: 10, EUR: 20 });
  });

  it('excludes paid, draft, cancelled, refunded', () => {
    const statuses = ['paid', 'draft', 'cancelled', 'refunded'];
    const invoices = statuses.map((status, i) => ({
      _id: String(i),
      recipient: { _id: 'a' },
      status,
      currency: { code: 'USD' },
      rows: [{ price: '5', quantity: '1', subtotal: 5 }],
    }));
    const map = summarizeClients([contactA], invoices, now);
    expect(map.get('a').outstanding).toEqual({});
    expect(map.get('a').invoiceCount).toBe(4);
  });

  it('counts legacy invoice without status as outstanding', () => {
    const invoices = [
      {
        _id: '1',
        recipient: { _id: 'a' },
        created_at: now,
        currency: { code: 'USD' },
        rows: [{ price: '15', quantity: '1', subtotal: 15 }],
      },
    ];
    const map = summarizeClients([contactA], invoices, now);
    expect(map.get('a').outstanding.USD).toBe(15);
  });

  it('counts overdue pending invoices', () => {
    const invoices = [
      {
        _id: '1',
        recipient: { _id: 'a' },
        status: 'pending',
        issuedAt: Date.parse('2020-01-01'),
        dueDate: {
          useCustom: true,
          selectedDate: Date.parse('2020-01-15'),
        },
        currency: { code: 'USD' },
        rows: [{ price: '7', quantity: '1', subtotal: 7 }],
      },
    ];
    const map = summarizeClients([contactA], invoices, now);
    expect(map.get('a').outstanding.USD).toBe(7);
  });

  it('ignores unknown recipient', () => {
    const invoices = [
      {
        _id: '1',
        recipient: { _id: 'unknown' },
        status: 'pending',
        currency: { code: 'USD' },
        rows: [{ price: '99', quantity: '1', subtotal: 99 }],
      },
    ];
    const map = summarizeClients([contactA], invoices, now);
    expect(map.get('a').invoiceCount).toBe(0);
  });

  it('sorts invoices newest first', () => {
    const invoices = [
      {
        _id: 'old',
        recipient: { _id: 'a' },
        created_at: 1,
        rows: [],
      },
      {
        _id: 'new',
        recipient: { _id: 'a' },
        issuedAt: 100,
        rows: [],
      },
    ];
    const map = summarizeClients([contactA], invoices, now);
    expect(map.get('a').invoices.map(i => i._id)).toEqual(['new', 'old']);
  });
});

describe('getContactErrors', () => {
  it('requires fullname', () => {
    expect(getContactErrors({ email: 'a@b.co' }).fullname).toBeDefined();
  });

  it('requires email', () => {
    expect(getContactErrors({ fullname: 'X' }).email).toBeDefined();
  });

  it('rejects invalid email', () => {
    expect(
      getContactErrors({ fullname: 'X', email: 'bad' }).email
    ).toBeDefined();
  });

  it('accepts valid contact', () => {
    expect(getContactErrors({ fullname: 'X', email: 'x@example.com' })).toEqual(
      {}
    );
  });
});

describe('buildContact', () => {
  it('creates new id when no existing', () => {
    const c = buildContact(
      { fullname: 'N', email: 'n@x.com', company: '', phone: '' },
      null,
      123
    );
    expect(c._id).toBeDefined();
    expect(c.created_at).toBe(123);
  });

  it('keeps _rev and created_at on edit', () => {
    const existing = {
      _id: 'id',
      _rev: '1-abc',
      created_at: 50,
      fullname: 'Old',
      email: 'o@x.com',
    };
    const c = buildContact(
      { fullname: 'New', email: 'n@x.com', company: 'Co', phone: '1' },
      existing,
      999
    );
    expect(c._rev).toBe('1-abc');
    expect(c.created_at).toBe(50);
    expect(c.fullname).toBe('New');
  });
});

describe('matchesClientQuery', () => {
  const contact = {
    fullname: 'Jane Doe',
    company: 'Acme Corp',
    email: 'Jane@Example.com',
    phone: '+1 (555) 123-4567',
  };

  it('matches company case-insensitively', () => {
    expect(matchesClientQuery(contact, 'acme')).toBe(true);
  });

  it('matches email case-insensitively', () => {
    expect(matchesClientQuery(contact, 'jane@example')).toBe(true);
  });

  it('matches phone digits only', () => {
    expect(matchesClientQuery(contact, '5551234')).toBe(true);
  });
});

describe('summarizeClients estimate filter', () => {
  it('ignores estimates for counts and outstanding', () => {
    const now = Date.parse('2026-06-01');
    const invoices = [
      {
        _id: '1',
        recipient: { _id: 'a' },
        status: 'pending',
        currency: { code: 'USD' },
        rows: [{ subtotal: 10 }],
      },
      {
        _id: '2',
        docType: 'estimate',
        recipient: { _id: 'a' },
        status: 'sent',
        currency: { code: 'USD' },
        rows: [{ subtotal: 99 }],
      },
    ];
    const map = summarizeClients([{ _id: 'a', fullname: 'A' }], invoices, now);
    expect(map.get('a').invoiceCount).toBe(1);
    expect(map.get('a').outstanding).toEqual({ USD: 10 });
  });
});
