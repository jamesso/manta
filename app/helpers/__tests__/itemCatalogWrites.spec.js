import {
  prepareItemsForRestore,
  validateItemDocForWrite,
  willItemBeActive,
} from '../itemCatalogWrites';

describe('itemCatalogWrites', () => {
  it('validateItemDocForWrite skips active-name check for archived updates', () => {
    const items = [
      { _id: 'live', name: 'Design', archived: false },
      { _id: 'dead', name: 'Design', archived: true },
    ];
    const errors = validateItemDocForWrite(
      { ...items[1], description: 'Updated hint' },
      items
    );
    expect(errors.name).toBeUndefined();
    expect(willItemBeActive(items[1])).toBe(false);
  });

  it('prepareItemsForRestore archives conflicting active restores', () => {
    const current = [
      {
        _id: 'b',
        name: 'Design',
        archived: false,
        unitPrice: 2,
        unitCode: 'C62',
      },
    ];
    const { docs, archivedDueToConflict } = prepareItemsForRestore(
      [
        {
          _id: 'a',
          name: 'Design',
          archived: false,
          unitPrice: 1,
          unitCode: 'C62',
        },
      ],
      current
    );
    expect(archivedDueToConflict).toBe(true);
    expect(docs[0].archived).toBe(true);
  });

  it('prepareItemsForRestore tracks earlier docs in the same batch', () => {
    const { docs, archivedDueToConflict } = prepareItemsForRestore(
      [
        { _id: 'a', name: 'Alpha', archived: false },
        { _id: 'b', name: 'alpha', archived: false },
      ],
      []
    );
    expect(docs[0].archived).not.toBe(true);
    expect(docs[1].archived).toBe(true);
    expect(archivedDueToConflict).toBe(true);
  });
});
