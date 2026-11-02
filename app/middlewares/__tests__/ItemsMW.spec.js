import * as ACTION_TYPES from '../../constants/actions.jsx';
import * as Actions from '../../actions/items';
import ItemsMW from '../ItemsMW';
import i18n from '../../../i18n/i18n';
import { toast } from '@/components/ui/toast';
import {
  saveDoc,
  getAllDocs,
  updateDoc,
  removeDocs,
  restoreDocs,
  mockData,
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
    vi.clearAllMocks();
    next = vi.fn();
    dispatch = vi.fn();
    middleware = ItemsMW({ dispatch })(next);
  });

  it('ITEM_GET_ALL reads items database', async () => {
    await middleware(Actions.getAllItems());
    expect(getAllDocs).toHaveBeenCalledWith('items');
    expect(getAllDocs).not.toHaveBeenCalledWith('contacts');
  });

  it('ITEM_SAVE resolves true and updates store on success', async () => {
    const doc = { _id: 'new', name: 'N', unitPrice: 1, unitCode: 'C62' };
    const ok = await middleware(Actions.saveItem(doc));
    expect(ok).toBe(true);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ACTION_TYPES.ITEM_SAVE,
        payload: expect.any(Array),
      })
    );
  });

  it('ITEM_SAVE resolves false when saveDoc rejects', async () => {
    saveDoc.mockRejectedValueOnce(new Error('fail'));
    const ok = await middleware(Actions.saveItem({ _id: 'x' }));
    expect(ok).toBe(false);
    expect(next).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: ACTION_TYPES.ITEM_SAVE })
    );
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

  it('ITEM_RESTORE calls restoreDocs', async () => {
    const docs = [{ _id: 'item-1' }];
    await middleware(Actions.restoreItems(docs));
    expect(restoreDocs).toHaveBeenCalledWith('items', docs);
  });
});
