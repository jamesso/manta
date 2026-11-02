import * as ACTION_TYPES from '../../constants/actions.jsx';
import * as Actions from '../../actions/items';
import ItemsMW from '../ItemsMW';
import i18n from '../../../i18n/i18n';
import { toast } from '@/components/ui/toast';
import { withArchived } from '../../helpers/items';
import {
  saveDoc,
  getAllDocs,
  updateDoc,
  removeDocs,
  restoreDocs,
  mockData,
  resetMockPouchData,
} from '../../helpers/pouchDB';

vi.mock('../../helpers/pouchDB');
vi.mock('@/components/ui/toast', () => ({
  toast: {
    add: vi.fn(() => 'toast-id'),
    close: vi.fn(),
  },
}));

describe('ItemsMW', () => {
  let next;
  let dispatch;
  let middleware;

  beforeEach(() => {
    resetMockPouchData();
    vi.clearAllMocks();
    next = vi.fn();
    dispatch = vi.fn();
    middleware = ItemsMW({ dispatch })(next);
    updateDoc.mockImplementation(async (_db, doc) => {
      const idx = mockData.itemsRecords.findIndex(row => row._id === doc._id);
      if (idx >= 0) {
        mockData.itemsRecords[idx] = { ...mockData.itemsRecords[idx], ...doc };
      }
      return [...mockData.itemsRecords];
    });
    getAllDocs.mockImplementation(async dbName => {
      if (dbName === 'items') {
        return mockData.itemsRecords.map(row => ({ ...row }));
      }
      return [];
    });
  });

  it('ITEM_GET_ALL reads items database', async () => {
    await middleware(Actions.getAllItems());
    expect(getAllDocs).toHaveBeenCalledWith('items');
    expect(getAllDocs).not.toHaveBeenCalledWith('contacts');
  });

  it('ITEM_SAVE rejects duplicate active names before writing', async () => {
    mockData.itemsRecords.push({
      _id: 'existing',
      name: 'Design',
      archived: false,
      unitPrice: 1,
      unitCode: 'C62',
    });
    const ok = await middleware(
      Actions.saveItem({
        _id: 'new',
        name: 'design',
        unitPrice: 2,
        unitCode: 'C62',
        archived: false,
      })
    );
    expect(ok).toBe(false);
    expect(saveDoc).not.toHaveBeenCalled();
  });

  it('ITEM_SAVE resolves true and updates store on success', async () => {
    const doc = {
      _id: 'new',
      name: 'Unique',
      unitPrice: 1,
      unitCode: 'C62',
      archived: false,
    };
    const ok = await middleware(Actions.saveItem(doc));
    expect(ok).toBe(true);
    expect(saveDoc).toHaveBeenCalledWith('items', doc);
  });

  it('ITEM_SAVE resolves false when saveDoc rejects', async () => {
    saveDoc.mockRejectedValueOnce(new Error('fail'));
    const ok = await middleware(
      Actions.saveItem({
        _id: 'x',
        name: 'Only',
        unitPrice: 1,
        unitCode: 'C62',
      })
    );
    expect(ok).toBe(false);
    expect(next).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: ACTION_TYPES.ITEM_SAVE })
    );
  });

  it('serializes concurrent unarchive attempts with the same normalized name', async () => {
    mockData.itemsRecords = [
      {
        _id: 'a',
        name: 'Café',
        archived: true,
        unitPrice: 1,
        unitCode: 'C62',
      },
      {
        _id: 'b',
        name: 'CAFE',
        archived: true,
        unitPrice: 2,
        unitCode: 'C62',
      },
    ];
    const first = middleware(
      Actions.updateItem(withArchived(mockData.itemsRecords[0], false))
    );
    const second = middleware(
      Actions.updateItem(withArchived(mockData.itemsRecords[1], false))
    );
    const results = await Promise.all([first, second]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });

  it('allows archive even when another active item shares the normalized name', async () => {
    mockData.itemsRecords = [
      {
        _id: 'a',
        name: 'Design',
        archived: false,
        unitPrice: 1,
        unitCode: 'C62',
      },
      {
        _id: 'b',
        name: 'design',
        archived: false,
        unitPrice: 2,
        unitCode: 'C62',
      },
    ];
    const ok = await middleware(
      Actions.updateItem(
        withArchived(mockData.itemsRecords[0], true),
        'messages:item:archived'
      )
    );
    expect(ok).toBe(true);
    expect(updateDoc).toHaveBeenCalled();
  });

  it('allows editing an archived item that shares a name with an active item', async () => {
    mockData.itemsRecords = [
      {
        _id: 'live',
        name: 'Design',
        archived: false,
        unitPrice: 1,
        unitCode: 'C62',
      },
      {
        _id: 'dead',
        name: 'Design',
        archived: true,
        unitPrice: 2,
        unitCode: 'C62',
        description: '',
      },
    ];
    const ok = await middleware(
      Actions.updateItem({
        ...mockData.itemsRecords[1],
        description: 'Archived copy',
      })
    );
    expect(ok).toBe(true);
    expect(updateDoc).toHaveBeenCalled();
  });

  it('ITEM_UPDATE rejects unarchive when an active namesake exists', async () => {
    mockData.itemsRecords = [
      {
        _id: 'live',
        name: 'Design',
        archived: false,
        unitPrice: 1,
        unitCode: 'C62',
      },
      {
        _id: 'dead',
        name: 'Design',
        archived: true,
        unitPrice: 2,
        unitCode: 'C62',
      },
    ];
    const ok = await middleware(
      Actions.updateItem(withArchived(mockData.itemsRecords[1], false))
    );
    expect(ok).toBe(false);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('ITEM_UPDATE uses meta messageKey', async () => {
    const doc = { ...mockData.itemsRecords[0], name: 'Renamed' };
    await middleware(Actions.updateItem(doc, 'messages:item:archived'));
    expect(updateDoc).toHaveBeenCalledWith('items', doc);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          message: i18n.t('messages:item:archived'),
        }),
      })
    );
  });

  it('ITEM_DELETE undo restores removed docs', async () => {
    removeDocs.mockResolvedValueOnce({
      removed: [{ _id: 'item-1', name: 'Design' }],
      failed: [],
      docs: [],
    });
    await middleware(Actions.deleteItem('item-1'));
    expect(removeDocs).toHaveBeenCalledWith('items', ['item-1']);
    const addCall = toast.add.mock.calls[0][0];
    addCall.actionProps.onClick();
    expect(toast.close).toHaveBeenCalledWith('toast-id');
    expect(dispatch).toHaveBeenCalledWith(
      Actions.restoreItems([{ _id: 'item-1', name: 'Design' }])
    );
  });

  it('ITEM_RESTORE archives conflicting undo restores instead of duplicating active names', async () => {
    mockData.itemsRecords = [
      {
        _id: 'b',
        name: 'Design',
        archived: false,
        unitPrice: 2,
        unitCode: 'C62',
      },
    ];
    restoreDocs.mockResolvedValueOnce([
      ...mockData.itemsRecords,
      {
        _id: 'a',
        name: 'Design',
        archived: true,
        unitPrice: 1,
        unitCode: 'C62',
      },
    ]);
    await middleware(
      Actions.restoreItems([
        {
          _id: 'a',
          name: 'Design',
          archived: false,
          unitPrice: 1,
          unitCode: 'C62',
        },
      ])
    );
    expect(restoreDocs).toHaveBeenCalledWith('items', [
      expect.objectContaining({ _id: 'a', archived: true }),
    ]);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: expect.objectContaining({
          message: i18n.t('items:errors:nameTaken'),
        }),
      })
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ type: ACTION_TYPES.ITEM_RESTORE })
    );
  });
});
