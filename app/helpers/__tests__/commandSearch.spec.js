import { normalize, filterCommands, searchRecords } from '../commandSearch.js';

const commands = [
  { id: 'clients', label: 'Clients', keywords: ['contacts', 'customers'] },
  { id: 'settings', label: 'Settings', keywords: [] },
];

describe('commandSearch', () => {
  it('returns all commands and no records for empty query', () => {
    expect(filterCommands(commands, '')).toHaveLength(2);
    expect(
      searchRecords({ query: '', invoices: [{}], contacts: [{}] })
    ).toEqual({ invoices: [], contacts: [] });
  });

  it('matches invoiceID and _id prefix', () => {
    const invoices = [
      { _id: 'abcdef12-uuid', invoiceID: 'INV-001', created_at: 1 },
      { _id: 'zzzzzzzz-uuid', created_at: 2 },
    ];
    expect(searchRecords({ query: 'INV-001', invoices }).invoices).toHaveLength(
      1
    );
    expect(
      searchRecords({ query: 'abcdef12', invoices }).invoices
    ).toHaveLength(1);
  });

  it('matches accent-insensitively and contact email', () => {
    const contacts = [{ fullname: 'José', company: 'Co', email: 'a@b.com' }];
    expect(searchRecords({ query: 'jose', contacts }).contacts).toHaveLength(1);
    expect(searchRecords({ query: 'a@b.com', contacts }).contacts).toHaveLength(
      1
    );
  });

  it('uses AND for multiple terms and respects limit', () => {
    const invoices = [
      {
        _id: '1',
        invoiceID: 'A B',
        recipient: { fullname: 'X' },
        created_at: 10,
      },
      {
        _id: '2',
        invoiceID: 'A',
        recipient: { fullname: 'B' },
        created_at: 20,
      },
    ];
    const r = searchRecords({ query: 'A B', invoices, limit: 1 });
    expect(r.invoices).toHaveLength(1);
    expect(r.invoices[0]._id).toBe('2');
  });

  it('sorts invoices newest first and tolerates missing fields', () => {
    const invoices = [
      { _id: 'old', created_at: 1 },
      { _id: 'new', created_at: 99, recipient: {} },
    ];
    const r = searchRecords({ query: 'new', invoices });
    expect(r.invoices[0]._id).toBe('new');
    expect(() =>
      searchRecords({ query: 'x', invoices: [{}], contacts: [{}] })
    ).not.toThrow();
  });

  it('filterCommands matches keywords', () => {
    expect(filterCommands(commands, 'customers')).toEqual([
      expect.objectContaining({ id: 'clients' }),
    ]);
  });

  it('normalize strips diacritics', () => {
    expect(normalize('José')).toBe('jose');
  });
});
