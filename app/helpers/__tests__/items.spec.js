import {
  applyItemToRow,
  buildItem,
  countItems,
  filterItems,
  getItemErrors,
  getUnitCode,
  rowToItemValues,
  searchItems,
  withArchived,
} from '../items';

describe('items helpers', () => {
  describe('getUnitCode', () => {
    it.each([
      [undefined, 'C62'],
      ['HUR', 'HUR'],
      ['XYZ', 'XYZ'],
      ['hour', 'C62'],
      ['', 'C62'],
      [42, 'C62'],
    ])('%j → %s', (input, expected) => {
      expect(getUnitCode(input)).toBe(expected);
    });
  });

  describe('getItemErrors', () => {
    const active = [
      { _id: 'a', name: 'Design', archived: false },
      { _id: 'b', name: '  Café  ', archived: false },
    ];

    it('flags empty and whitespace name', () => {
      expect(
        getItemErrors({ name: '  ', unitPrice: '1', unitCode: 'C62' }, [], null)
          .name
      ).toBe('items:errors:nameRequired');
    });

    it('flags name over 120 chars', () => {
      expect(
        getItemErrors(
          { name: 'x'.repeat(121), unitPrice: '1', unitCode: 'C62' },
          [],
          null
        ).name
      ).toBe('items:errors:nameTooLong');
    });

    it('flags invalid price', () => {
      expect(
        getItemErrors({ name: 'A', unitPrice: '', unitCode: 'C62' }, [], null)
          .unitPrice
      ).toBe('items:errors:price');
      expect(
        getItemErrors(
          { name: 'A', unitPrice: 'abc', unitCode: 'C62' },
          [],
          null
        ).unitPrice
      ).toBe('items:errors:price');
    });

    it('allows negative price', () => {
      expect(
        getItemErrors({ name: 'A', unitPrice: '-5', unitCode: 'C62' }, [], null)
          .unitPrice
      ).toBeUndefined();
    });

    it('detects duplicate active name case-insensitively', () => {
      expect(
        getItemErrors(
          { name: 'design', unitPrice: '10', unitCode: 'C62' },
          active,
          null
        ).name
      ).toBe('items:errors:nameTaken');
    });

    it('allows same name as archived item', () => {
      const items = [{ _id: 'z', name: 'Old', archived: true }];
      expect(
        getItemErrors(
          { name: 'Old', unitPrice: '1', unitCode: 'C62' },
          items,
          null
        ).name
      ).toBeUndefined();
    });

    it('skips active-name validation for archived updates', () => {
      const items = [
        { _id: 'live', name: 'Design', archived: false },
        { _id: 'dead', name: 'Design', archived: true },
      ];
      expect(
        getItemErrors(
          { name: 'Design', unitPrice: '1', unitCode: 'C62' },
          items,
          'dead',
          { willBeActive: false }
        ).name
      ).toBeUndefined();
    });

    it('allows editing self', () => {
      expect(
        getItemErrors(
          { name: 'Design', unitPrice: '1', unitCode: 'C62' },
          active,
          'a'
        ).name
      ).toBeUndefined();
    });

    it('flags unarchive when active namesake exists', () => {
      const items = [
        { _id: 'live', name: 'Taken', archived: false },
        { _id: 'dead', name: 'Taken', archived: true },
      ];
      const values = {
        name: 'Taken',
        unitPrice: '1',
        unitCode: 'C62',
      };
      expect(getItemErrors(values, items, 'dead').name).toBe(
        'items:errors:nameTaken'
      );
    });

    it('flags bad unit code', () => {
      expect(
        getItemErrors({ name: 'A', unitPrice: '1', unitCode: 'h' }, [], null)
          .unitCode
      ).toBe('items:errors:unit');
    });
  });

  describe('buildItem', () => {
    it('creates a new doc with defaults', () => {
      const now = 123;
      const doc = buildItem(
        {
          name: '  A  ',
          description: ' d ',
          unitPrice: '12.5',
          unitCode: 'HUR',
        },
        null,
        now
      );
      expect(doc._id).toEqual(expect.any(String));
      expect(doc.taxRateId).toBeNull();
      expect(doc.archived).toBe(false);
      expect(doc.created_at).toBe(now);
      expect(doc.unitPrice).toBe(12.5);
      expect(doc.name).toBe('A');
      expect(doc.description).toBe('d');
      expect(doc.unitCode).toBe('HUR');
    });

    it('preserves existing fields on edit', () => {
      const existing = {
        _id: 'id1',
        _rev: '1-abc',
        created_at: 1,
        archived: true,
        taxRateId: null,
        custom: true,
      };
      const doc = buildItem(
        { name: 'N', description: '', unitPrice: '2', unitCode: 'C62' },
        existing,
        99
      );
      expect(doc._id).toBe('id1');
      expect(doc._rev).toBe('1-abc');
      expect(doc.created_at).toBe(1);
      expect(doc.archived).toBe(true);
      expect(doc.custom).toBe(true);
    });
  });

  describe('applyItemToRow', () => {
    it('fills row without mutating input', () => {
      const row = Object.freeze({
        id: 'r1',
        description: 'old',
        price: 1,
        quantity: 3,
        unitCode: 'DAY',
        subtotal: 3,
      });
      const next = applyItemToRow(row, {
        name: 'Svc',
        description: '',
        unitPrice: 80,
        unitCode: 'HUR',
      });
      expect(next.id).toBe('r1');
      expect(next.description).toBe('Svc');
      expect(next.price).toBe(80);
      expect(next.quantity).toBe(3);
      expect(next.subtotal).toBe(240);
      expect(next.unitCode).toBe('HUR');
      expect(row.description).toBe('old');
    });

    it('uses quantity 1 when empty', () => {
      const next = applyItemToRow(
        { id: 'r', quantity: '', price: '', description: '' },
        { name: 'X', description: 'Line', unitPrice: 10 }
      );
      expect(next.quantity).toBe(1);
      expect(next.subtotal).toBe(10);
      expect(next.unitCode).toBe('C62');
    });
  });

  describe('rowToItemValues', () => {
    it('splits multi-line description', () => {
      expect(
        rowToItemValues({
          description: 'Title\nBody line',
          price: 5,
          unitCode: 'MON',
        })
      ).toEqual({
        name: 'Title',
        description: 'Title\nBody line',
        unitPrice: '5',
        unitCode: 'MON',
      });
    });

    it('truncates name to 80 chars', () => {
      const line = 'n'.repeat(100);
      expect(
        rowToItemValues({ description: line, price: 1 }).name
      ).toHaveLength(80);
    });

    it('uses empty description when same as name', () => {
      expect(
        rowToItemValues({ description: 'Short', price: '' })
      ).toMatchObject({
        name: 'Short',
        description: '',
        unitPrice: '',
        unitCode: 'C62',
      });
    });
  });

  describe('searchItems', () => {
    const catalog = [
      { _id: '1', name: 'Café', description: 'coffee', archived: false },
      {
        _id: '2',
        name: 'Design',
        description: 'café branding',
        archived: false,
      },
      { _id: '3', name: 'Hidden', description: 'café', archived: true },
    ];

    it('returns empty for empty query', () => {
      expect(searchItems(catalog, '')).toEqual([]);
    });

    it('finds accent-insensitive matches and excludes archived', () => {
      const hits = searchItems(catalog, 'cafe');
      expect(hits.map(i => i._id)).toEqual(['1', '2']);
    });

    it('requires all terms', () => {
      expect(searchItems(catalog, 'cafe branding').map(i => i._id)).toEqual([
        '2',
      ]);
    });

    it('ranks name prefix above description-only', () => {
      const hits = searchItems(catalog, 'caf');
      expect(hits[0]._id).toBe('1');
    });

    it('respects limit', () => {
      expect(searchItems(catalog, 'caf', 1)).toHaveLength(1);
    });
  });

  describe('filterItems and countItems', () => {
    const items = [
      { _id: '1', name: 'A', archived: false, unitCode: 'HUR' },
      { _id: '2', name: 'B', archived: true, unitCode: 'C62' },
    ];

    it('counts active and archived', () => {
      expect(countItems(items)).toEqual({ active: 1, archived: 1 });
    });

    it('filters by view and unit code query', () => {
      expect(
        filterItems(items, { view: 'active', query: 'hur' }).map(i => i._id)
      ).toEqual(['1']);
      expect(
        filterItems(items, { view: 'archived', query: '' }).map(i => i._id)
      ).toEqual(['2']);
    });
  });

  it('withArchived toggles flag', () => {
    expect(withArchived({ _id: '1', archived: false }, true).archived).toBe(
      true
    );
  });
});
