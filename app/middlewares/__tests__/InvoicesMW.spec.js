import 'fake-indexeddb/auto';
import * as ACTION_TYPES from '../../constants/actions.jsx';
import * as Actions from '../../actions/invoices';
import InvoicesMW from '../InvoicesMW';
import FormMW from '../FormMW';
import FormReducer from '../../reducers/FormReducer';
import { faker } from '@faker-js/faker';
import i18n from '../../../i18n/i18n';

// Mock Functions
vi.mock('../../helpers/pouchDB');
vi.mock('@/lib/dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
  alert: vi.fn(),
}));
vi.mock('@/components/ui/toast', () => ({
  toast: { add: vi.fn(() => 't1'), close: vi.fn() },
}));
import {
  getAllDocs,
  getSingleDoc,
  saveDoc,
  updateDoc,
  removeDocs,
  bulkSaveDocs,
  restoreDocs,
  updateDocs,
  mockData,
  resetMockPouchData,
} from '../../helpers/pouchDB';
import { buildRecurringTombstone } from '../../helpers/recurring';
import { getAmountPaid, getStoredStatus } from '../../helpers/invoice';
import { clearInvoiceMutationQueuesForTests } from '../../helpers/invoiceMutations';
import { clearInvoiceNumberingWriteChainForTests } from '../../helpers/invoiceNumberingWrites';
import { toast } from '@/components/ui/toast';
import * as dialog from '@/lib/dialog';
import * as UIActions from '../../actions/ui';
const fixedNow = Date.UTC(2026, 0, 15, 12);
Date.now = vi.fn(() => fixedNow);

function installTrackedInvoice(doc) {
  let stored = { ...doc, _rev: doc._rev ?? '1-x' };
  mockData.invoicesRecords = [stored];

  getSingleDoc.mockImplementation((_db, id) => {
    if (id !== stored._id) {
      return Promise.reject(new Error('No invoice found!'));
    }
    return Promise.resolve({ ...stored });
  });

  updateDocs.mockImplementation((_db, docs) => {
    const [incoming] = docs;
    if (!incoming || incoming._rev !== stored._rev) {
      return Promise.reject(
        Object.assign(new Error('partial-update'), {
          succeeded: [],
          failed: [{ id: stored._id, status: 409 }],
          docs: [{ ...stored }],
        })
      );
    }
    const revNum = Number.parseInt(String(stored._rev).split('-')[0], 10);
    stored = { ...incoming, _rev: `${revNum + 1}-x` };
    mockData.invoicesRecords = [{ ...stored }];
    return Promise.resolve([{ ...stored }]);
  });

  return () => stored;
}

describe('Invoices Middleware', () => {
  let next, dispatch, middleware, getState;

  beforeEach(() => {
    clearInvoiceMutationQueuesForTests();
    clearInvoiceNumberingWriteChainForTests();
    resetMockPouchData();
    getSingleDoc.mockReset();
    getAllDocs.mockReset();
    getAllDocs.mockImplementation(
      dbName =>
        new Promise((resolve, reject) => {
          switch (dbName) {
            case 'contacts':
              resolve(mockData.contactsRecords);
              break;
            case 'invoices':
              resolve(mockData.invoicesRecords);
              break;
            case 'items':
              resolve(mockData.itemsRecords);
              break;
            case 'recurring':
              resolve(mockData.recurringRecords);
              break;
            default:
              reject(new Error('Incorrect database!'));
          }
        })
    );
    updateDocs.mockReset();
    updateDocs.mockImplementation(() =>
      Promise.resolve(mockData.invoicesRecords)
    );
    getSingleDoc.mockImplementation((dbName, docID) => {
      if (!dbName) {
        return Promise.reject(new Error('No database found!'));
      }
      if (!docID) {
        return Promise.reject(new Error('No docID found!'));
      }
      if (dbName === 'invoices') {
        return Promise.resolve({ ...mockData.invoicesRecords[0] });
      }
      if (dbName === 'contacts') {
        return Promise.resolve({ ...mockData.contactsRecords[0] });
      }
      return Promise.reject(new Error('Incorrect database!'));
    });
    next = vi.fn();
    dispatch = vi.fn();
    getState = vi.fn(() => ({
      form: {
        settings: { editMode: { active: false } },
        recipient: { newRecipient: true, new: {} },
        rows: [],
      },
    }));
    middleware = InvoicesMW({ dispatch, getState })(next);
    toast.add.mockClear();
    toast.close.mockClear();
    bulkSaveDocs.mockReset();
    removeDocs.mockClear();
    restoreDocs.mockClear();
    updateDocs.mockClear();
  });

  describe('should handle INVOICE_GET_ALL action', () => {
    it('retrieves data from correct DB', async () => {
      await middleware(Actions.getInvoices());

      // Call correct function
      expect(getAllDocs).toHaveBeenCalled();
      expect(getAllDocs).toHaveBeenCalledWith('invoices');
      expect(getAllDocs).not.toHaveBeenCalledWith('contacts');
      expect(getAllDocs).not.toHaveBeenCalledWith('');
      // Correctly resolves
      await expect(getAllDocs('invoices')).resolves.toBe(
        mockData.invoicesRecords
      );
    });

    it('calls next after the promised is returned', async () => {
      const action = Actions.getInvoices();
      await middleware(action);
      expect(dispatch.mock.calls.length).toBe(0);
      // Call next with resolved data
      const data = await getAllDocs('invoices');
      expect(next.mock.calls.length).toBe(1);
      expect(next).toHaveBeenCalledWith(
        Object.assign({}, action, {
          payload: data,
        })
      );
    });

    it('handle error correctly', () => {
      // Make sure getAllDocs will be called with incorrect dbName
      getAllDocs.mockImplementationOnce(() => getAllDocs('random-string'));
      const expectedError = new Error('Incorrect database!');
      // Execute
      return middleware(Actions.getInvoices()).then(() => {
        // Calling next & send new notification
        expect(next).toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: {
            type: 'warning',
            message: expectedError.message,
          },
        });
      });
    });

    it('handle unknown error correctly', async () => {
      const unknownError = new Error('Something broke');
      getAllDocs.mockImplementationOnce(() => Promise.reject(unknownError));
      await middleware(Actions.getInvoices());
      await getAllDocs().catch(err => {
        expect(next).toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: {
            type: 'warning',
            message: unknownError.message,
          },
        });
      });
    });
  });

  describe('should handle INVOICE_SAVE action', () => {
    it('returns success for a draft without opening preview', async () => {
      const result = await middleware(
        Actions.saveInvoice({ status: 'draft', rows: [] })
      );
      expect(result).toMatchObject({ status: 'draft', rows: [] });
      expect(dispatch.mock.calls.map(([action]) => action.type)).not.toContain(
        ACTION_TYPES.UI_PREVIEW_SHEET_SET
      );
    });
    it('returns false if invoice persistence fails', async () => {
      saveDoc.mockRejectedValueOnce(new Error('disk full'));
      await expect(
        middleware(Actions.saveInvoice({ status: 'draft', rows: [] }))
      ).resolves.toBe(false);
    });

    it('returns the submitted invoice when the db list has no matching id', async () => {
      const invoice = { _id: 'new-id', status: 'draft', rows: [] };
      saveDoc.mockResolvedValueOnce([
        { _id: 'other-id', status: 'pending', rows: [] },
      ]);
      const result = await middleware(Actions.saveInvoice(invoice));
      expect(result).toEqual(invoice);
    });

    it('should save records to DB', async () => {
      // Setup
      const newInvoice = {
        recipient: {
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
        },
        rows: [
          {
            id: crypto.randomUUID(),
            description: faker.commerce.productName(),
            price: faker.commerce.price(),
            quantity: faker.number.int({ max: 10 }),
          },
        ],
      };
      // Execute
      await middleware(Actions.saveInvoice(newInvoice));
      const data = await saveDoc('invoices', newInvoice);
      // Expect
      expect(data).toEqual([...mockData.invoicesRecords, newInvoice]);
    });

    it('should call next and dispatch notification ', () => {
      const newInvoice = {
        recipient: {
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
        },
        currency: {
          code: 'USD',
          placement: 'before',
          fraction: 2,
          separator: 'commaDot',
        },
        rows: [
          {
            id: crypto.randomUUID(),
            description: faker.commerce.productName(),
            price: faker.commerce.price(),
            quantity: faker.number.int({ max: 10 }),
          },
        ],
      };

      // Execute
      const action = Actions.saveInvoice(newInvoice);
      return middleware(action).then(() =>
        saveDoc('invoices', newInvoice).then(data => {
          // Call next after the promised is returned
          expect(next.mock.calls.length).toBe(1);
          expect(next).toHaveBeenCalledWith(
            Object.assign({}, action, {
              payload: [...mockData.invoicesRecords, newInvoice],
            })
          );
          // Dispatch success notification, then open the preview drawer
          expect(dispatch.mock.calls.length).toBe(2);
          expect(dispatch).toHaveBeenCalledWith({
            type: ACTION_TYPES.UI_NOTIFICATION_NEW,
            payload: {
              type: 'success',
              message: i18n.t('messages:invoice:saved'),
            },
          });
        })
      );
    });

    it('opens the preview drawer with the saved invoice', async () => {
      const newInvoice = {
        recipient: {
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
        },
        currency: {
          code: 'USD',
          placement: 'before',
          fraction: 2,
          separator: 'commaDot',
        },
        rows: [
          {
            id: crypto.randomUUID(),
            description: faker.commerce.productName(),
            price: faker.commerce.price(),
            quantity: faker.number.int({ max: 10 }),
          },
        ],
      };
      await middleware(Actions.saveInvoice(newInvoice));
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_PREVIEW_SHEET_SET,
        payload: newInvoice,
      });
    });

    it('handle syntax error correctly', async () => {
      const newInvoice = {
        recipient: {
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
        },
      };
      await middleware(Actions.saveInvoice(newInvoice));
      const dbError = new Error('No database found!');
      const docError = new Error('No doc found!');
      await expect(saveDoc()).rejects.toEqual(dbError);
      await expect(saveDoc('invoices')).rejects.toEqual(docError);
    });

    it('handle unknown error correctly', () => {
      // Setup
      const newInvoice = {
        recipient: {
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
        },
      };
      const expectedError = new Error('Something Broken!');
      saveDoc.mockImplementationOnce(() => Promise.reject(expectedError));

      // Execute
      return middleware(Actions.saveInvoice(newInvoice)).then(() => {
        // Expect
        expect(next).toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: {
            type: 'warning',
            message: expectedError.message,
          },
        });
      });
    });
  });

  describe('should handle INVOICE_EDIT action', () => {
    it('should call next and dispatch change Tab action', () => {
      // Setup
      const currentInvoice = {
        _id: 'edit-inv-1',
        docType: 'invoice',
        status: 'pending',
        recipient: {
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
        },
        currency: {
          code: 'USD',
          symbol: '$',
        },
        rows: [
          {
            id: crypto.randomUUID(),
            description: faker.commerce.productName(),
            price: faker.commerce.price(),
            quantity: faker.number.int({ max: 10 }),
          },
        ],
      };
      getSingleDoc.mockResolvedValueOnce({ ...currentInvoice, _rev: '1-x' });
      // Execute
      const action = Actions.editInvoice(currentInvoice);
      return middleware(action).then(() => {
        // Call next
        expect(next.mock.calls.length).toBe(1);
        expect(next).toHaveBeenCalledWith(
          Object.assign({}, action, {
            payload: Object.assign({}, action.payload, {
              contacts: mockData.contactsRecords,
            }),
          })
        );
        // Dispatch change Tab action
        expect(dispatch.mock.calls.length).toBe(1);
        expect(dispatch).toHaveBeenCalledWith({
          type: ACTION_TYPES.UI_TAB_CHANGE,
          payload: 'form',
        });
      });
    });
  });

  describe('should handle INVOICE_UPDATE action', () => {
    let currentInvoice;
    beforeEach(() => {
      currentInvoice = {
        _id: 'update-test-id',
        docType: 'invoice',
        status: 'pending',
        recipient: {
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
        },
        currency: {
          code: 'USD',
          symbol: '$',
        },
        rows: [
          {
            id: crypto.randomUUID(),
            description: faker.commerce.productName(),
            price: faker.commerce.price(),
            quantity: faker.number.int({ max: 10 }),
          },
        ],
      };
      getSingleDoc.mockImplementation((_db, id) => {
        if (_db === 'invoices' && id === currentInvoice._id) {
          return Promise.resolve({ ...currentInvoice, _rev: '1-u' });
        }
        return Promise.reject(new Error('No docID found!'));
      });
    });

    it('should update the invoice', async () => {
      await middleware(Actions.updateInvoice(currentInvoice));
      const data = await updateDoc('invoices', currentInvoice);
      expect(data).toEqual(mockData.invoicesRecords);
    });

    it('should call next and dispatch notification', async () => {
      await middleware(Actions.updateInvoice(currentInvoice));
      await updateDoc('invoices', currentInvoice);
      // Call next after the promised is returned
      expect(next.mock.calls.length).toBe(1);
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_UPDATE,
        payload: mockData.invoicesRecords,
      });
      // Dispatch success notification
      expect(dispatch.mock.calls.length).toBe(1);
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'success',
          message: i18n.t('messages:invoice:updated'),
        },
      });
    });

    it('should handle syntax error correctly', async () => {
      await middleware(Actions.updateInvoice(currentInvoice));
      const dbError = new Error('No database found!');
      const docError = new Error('No doc found!');
      await expect(updateDoc()).rejects.toEqual(dbError);
      await expect(updateDoc('invoices')).rejects.toEqual(docError);
    });

    it('should handle unkown error correctly', () => {
      const expectedError = new Error('Something Broken!');
      updateDoc.mockImplementationOnce(() => Promise.reject(expectedError));
      return middleware(Actions.updateInvoice(currentInvoice)).then(() => {
        expect(next).toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: {
            type: 'warning',
            message: expectedError.message,
          },
        });
      });
    });
  });

  describe('should handle INVOICE_DELETE action', () => {
    it.each(['rejection', 'per-document error'])(
      'refreshes the deleted list and warns after a tombstone %s',
      async failure => {
        const draft = {
          _id: 'rec-prof-2026-03-15',
          docType: 'invoice',
          status: 'draft',
          recurringId: 'prof',
          periodKey: '2026-03-15',
        };
        mockData.invoicesRecords = [draft];
        const error = new Error('tombstone write failed');
        bulkSaveDocs.mockImplementationOnce(() =>
          failure === 'rejection'
            ? Promise.reject(error)
            : Promise.resolve({
                succeeded: [],
                failed: [{ id: draft._id, error: true, message: error.message }],
                allDocs: [],
              })
        );

        await middleware(Actions.deleteInvoice(draft._id));

        expect(bulkSaveDocs).toHaveBeenCalledWith('invoices', [
          buildRecurringTombstone(draft.recurringId, draft.periodKey),
        ]);
        expect(next).toHaveBeenCalledWith({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: { type: 'warning', message: error.message },
        });
        expect(next).toHaveBeenLastCalledWith({
          type: ACTION_TYPES.INVOICE_DELETE,
          payload: [],
        });
        expect(mockData.invoicesRecords).toEqual([]);
      }
    );

    it('includes the persisted recurring tombstone in the delete result', async () => {
      const draft = {
        _id: 'rec-prof-2026-03-15',
        docType: 'invoice',
        status: 'draft',
        recurringId: 'prof',
        periodKey: '2026-03-15',
      };
      const db = await vi.importActual('../../helpers/pouchDB');
      await db.saveDoc('invoices', draft);
      const tombstone = buildRecurringTombstone('prof', '2026-03-15');
      getAllDocs.mockImplementationOnce(db.getAllDocs);
      removeDocs.mockImplementationOnce(db.removeDocs);
      bulkSaveDocs.mockImplementationOnce(db.bulkSaveDocs);
      const savesBefore = saveDoc.mock.calls.length;

      await middleware(Actions.deleteInvoice(draft._id));

      const stored = await db.getAllDocs('invoices');
      expect(stored).toEqual([expect.objectContaining(tombstone)]);
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_DELETE,
        payload: stored,
      });
      expect(saveDoc).toHaveBeenCalledTimes(savesBefore);
      await db.deleteDoc('invoices', draft._id);
    });

    it('should remove record from DB correctly', async () => {
      const invoiceID = 'jon-invoice';
      await middleware(Actions.deleteInvoice(invoiceID));
      expect(removeDocs).toHaveBeenCalledWith('invoices', [invoiceID]);
    });

    it('should call next with remaining docs', async () => {
      const invoiceID = 'jon-invoice';
      const action = Actions.deleteInvoice(invoiceID);
      await middleware(action);
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_DELETE,
        payload: [],
      });
      expect(toast.add).toHaveBeenCalled();
    });

    it('should clear the form when the edited invoice was removed', async () => {
      const getState = vi.fn(() => ({
        form: {
          settings: {
            editMode: {
              active: true,
              data: { _id: 'jon-invoice' },
            },
          },
        },
      }));
      const middleware = InvoicesMW({ dispatch, getState })(next);
      await middleware(Actions.deleteInvoice('jon-invoice'));
      expect(dispatch).toHaveBeenCalledWith({ type: ACTION_TYPES.FORM_CLEAR });
    });

    it('does not clear the form when delete failed for the edited id', async () => {
      removeDocs.mockResolvedValueOnce({
        removed: [],
        failed: ['jon-invoice'],
        docs: mockData.invoicesRecords,
      });
      const getState = vi.fn(() => ({
        form: {
          settings: {
            editMode: {
              active: true,
              data: { _id: 'jon-invoice' },
            },
          },
        },
      }));
      const middleware = InvoicesMW({ dispatch, getState })(next);
      await middleware(Actions.deleteInvoice('jon-invoice'));
      expect(dispatch).not.toHaveBeenCalledWith({
        type: ACTION_TYPES.FORM_CLEAR,
      });
    });

    it('undo dispatches restore with removed snapshots', async () => {
      const removed = [{ _id: 'jon-invoice', status: 'pending' }];
      removeDocs.mockResolvedValueOnce({
        removed,
        failed: [],
        docs: [],
      });
      await middleware(Actions.deleteInvoice('jon-invoice'));
      const addArg = toast.add.mock.calls[0][0];
      addArg.actionProps.onClick();
      expect(toast.close).toHaveBeenCalledWith('t1');
      expect(dispatch).toHaveBeenCalledWith(Actions.restoreInvoices(removed));
    });

    it('deduplicates ids for bulk delete', async () => {
      await middleware(Actions.deleteInvoice(['a', 'a', 'b']));
      expect(removeDocs).toHaveBeenCalledWith('invoices', ['a', 'b']);
    });

    it('handle error correctly', async () => {
      const expectedError = new Error('db down');
      removeDocs.mockRejectedValueOnce(expectedError);
      await middleware(Actions.deleteInvoice('ned-stark'));
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: expectedError.message,
        },
      });
    });
  });

  describe('INVOICE_RESTORE', () => {
    it('restores docs and updates state', async () => {
      const docs = [{ _id: 'x' }];
      restoreDocs.mockResolvedValueOnce(mockData.invoicesRecords);
      await middleware(Actions.restoreInvoices(docs));
      expect(restoreDocs).toHaveBeenCalledWith('invoices', docs);
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_RESTORE,
        payload: mockData.invoicesRecords,
      });
    });

    it('refreshes Redux from persisted docs on partial restore failure', async () => {
      const persisted = [{ _id: 'partial-restore-1' }];
      const err = Object.assign(new Error('partial-restore'), {
        restored: ['partial-restore-1'],
        failed: [{ id: undefined }],
        docs: persisted,
      });
      restoreDocs.mockRejectedValueOnce(err);
      await middleware(Actions.restoreInvoices([{}, {}]));
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_RESTORE,
        payload: persisted,
      });
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: 'partial-restore',
        },
      });
    });
  });

  describe('INVOICE_MARK_SENT', () => {
    it('writes sentAt on the stored invoice', async () => {
      let stored = {
        _id: 'inv-email',
        _rev: '1-x',
        docType: 'invoice',
        invoiceID: 'INV-1',
        status: 'pending',
      };
      mockData.invoicesRecords = [stored];
      getSingleDoc.mockImplementation((_db, id) => {
        if (id !== stored._id) {
          return Promise.reject(new Error('No invoice found!'));
        }
        return Promise.resolve({ ...stored });
      });
      updateDoc.mockImplementation((_db, doc) => {
        stored = { ...doc, _rev: '2-x' };
        mockData.invoicesRecords = [{ ...stored }];
        return Promise.resolve([{ ...stored }]);
      });
      await middleware(Actions.markInvoiceSent('inv-email', 'invoice'));
      expect(stored.sentAt).toBe(fixedNow);
      expect(stored.status).toBe('pending');
    });

    it('warns when the invoice is missing', async () => {
      getSingleDoc.mockRejectedValueOnce(new Error('No invoice found!'));
      await middleware(Actions.markInvoiceSent('missing', 'invoice'));
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        })
      );
    });
  });

  describe('INVOICE_DUPLICATE', () => {
    it('opens a copy in the editor without saving it', async () => {
      const data = {
        _id: 'a',
        _rev: 'b',
        status: 'paid',
        paidAt: 1,
        issuedAt: 2,
        created_at: 3,
        rows: [],
      };
      await middleware(Actions.duplicateInvoice(data));
      expect(saveDoc).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.FORM_LOAD_DUPLICATE,
        payload: expect.objectContaining({
          rows: [],
          contacts: expect.any(Array),
        }),
      });
      const payload = dispatch.mock.calls.find(
        ([a]) => a.type === ACTION_TYPES.FORM_LOAD_DUPLICATE
      )[0].payload;
      expect(payload).not.toHaveProperty('_id');
      expect(payload).not.toHaveProperty('status');
      expect(payload).not.toHaveProperty('issuedAt');
      expect(payload).not.toHaveProperty('payments');
      expect(payload).not.toHaveProperty('sentAt');
      expect(payload).not.toHaveProperty('remindedAt');
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_TAB_CHANGE,
        payload: 'form',
      });
    });
  });

  describe('should handle INVOICE_CONFIGS_SAVE action correctly', () => {
    it('get the doc, merge with config object and dispatch a new action', async () => {
      const invoiceID = 'id-string';
      const configs = { color: 'red' };
      await middleware(Actions.saveInvoiceConfigs(invoiceID, configs));
      const doc = await getSingleDoc('invoices', invoiceID);
      expect(dispatch.mock.calls.length).toBe(1);
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_UPDATE,
        payload: Object.assign({}, doc, { configs }),
      });
    });

    it('handle error correctly', async () => {
      const invoiceID = 'id-string';
      const configs = { color: 'red' };
      const expectedError = new Error('No invoice found!');
      getSingleDoc.mockRejectedValueOnce(expectedError);
      await middleware(Actions.saveInvoiceConfigs(invoiceID, configs));
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: expectedError.message,
        },
      });
    });
  });

  describe('should handle INVOICE_SET_STATUS action', () => {
    it('get the doc, merge with status object and dispatch a new action', async () => {
      const invoiceID = 'id-string';
      const status = 'paid';
      mockData.invoicesRecords = [
        {
          _id: invoiceID,
          status: 'pending',
          grandTotal: 100,
          currency: { fraction: 2 },
        },
      ];
      getSingleDoc.mockResolvedValueOnce({
        _id: invoiceID,
        status: 'pending',
        grandTotal: 100,
        currency: { fraction: 2 },
      });
      await middleware(Actions.setInvoiceStatus(invoiceID, status));
      expect(updateDocs).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_UPDATE,
        payload: mockData.invoicesRecords,
      });
    });

    it('rejects overdue as a stored status', async () => {
      await middleware(Actions.setInvoiceStatus('id-string', 'overdue'));
      expect(getSingleDoc).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: 'Unknown invoice status: overdue',
        },
      });
    });

    it('bulk update calls updateDocs', async () => {
      mockData.invoicesRecords = [
        {
          _id: 'a',
          status: 'pending',
          grandTotal: 10,
          currency: { fraction: 2 },
        },
        {
          _id: 'b',
          status: 'pending',
          grandTotal: 10,
          currency: { fraction: 2 },
        },
      ];
      getSingleDoc.mockResolvedValueOnce({ _id: 'a', status: 'pending' });
      getSingleDoc.mockResolvedValueOnce({ _id: 'b', status: 'pending' });
      await middleware(Actions.setInvoiceStatus(['a', 'b'], 'paid'));
      expect(updateDocs).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_UPDATE,
        payload: mockData.invoicesRecords,
      });
    });

    it('estimate status change does not enter runInvoiceNumberingWrite', async () => {
      const numberingWrites =
        await import('../../helpers/invoiceNumberingWrites');
      const spy = vi.spyOn(numberingWrites, 'runInvoiceNumberingWrite');
      mockData.invoicesRecords = [
        { _id: 'est-1', docType: 'estimate', status: 'draft' },
      ];
      getSingleDoc.mockResolvedValue({
        _id: 'est-1',
        docType: 'estimate',
        status: 'draft',
      });
      await middleware(Actions.setInvoiceStatus('est-1', 'sent'));
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('assigns distinct numbers when two drafts leave draft in parallel', async () => {
      let numbering = { prefix: 'INV-', next: 1, padding: 4 };
      window.manta.settings.get.mockImplementation(key => {
        if (key === 'invoice.numbering') {
          return numbering;
        }
        if (key === 'invoice') {
          return { numbering, currency: { fraction: 2 } };
        }
        return undefined;
      });
      window.manta.settings.set.mockImplementation((key, value) => {
        if (key === 'invoice.numbering') {
          numbering = value;
        }
      });
      const docs = [
        {
          _id: 'a',
          status: 'draft',
          docType: 'invoice',
          rows: [{ subtotal: 1 }],
          recipient: { fullname: 'A' },
          grandTotal: 1,
          currency: { fraction: 2 },
          _rev: '1-a',
        },
        {
          _id: 'b',
          status: 'draft',
          docType: 'invoice',
          rows: [{ subtotal: 1 }],
          recipient: { fullname: 'B' },
          grandTotal: 1,
          currency: { fraction: 2 },
          _rev: '1-b',
        },
      ];
      mockData.invoicesRecords = structuredClone(docs);
      getAllDocs.mockImplementation(async () => structuredClone(docs));
      getSingleDoc.mockImplementation(async (_name, id) =>
        structuredClone(docs.find(d => d._id === id))
      );
      updateDocs.mockImplementation(async (_name, updates) => {
        for (const patch of updates) {
          const target = docs.find(d => d._id === patch._id);
          Object.assign(target, patch, {
            _rev: `${Number.parseInt(String(target._rev).split('-')[0], 10) + 1}-x`,
          });
        }
        mockData.invoicesRecords = structuredClone(docs);
        return structuredClone(docs);
      });
      getState.mockReturnValue({
        form: {
          settings: { editMode: { active: false } },
          reconciledNumbering: null,
        },
      });
      await Promise.all([
        middleware(Actions.setInvoiceStatus('a', 'pending')),
        middleware(Actions.setInvoiceStatus('b', 'pending')),
      ]);
      expect(docs.map(d => d.invoiceID)).toEqual(['INV-0001', 'INV-0002']);
    });

    it('handle error correctly', async () => {
      const invoiceID = 'id-string';
      const status = 'paid';
      const expectedError = new Error('No invoice found!');
      getSingleDoc.mockImplementationOnce(() => Promise.reject(expectedError));
      await middleware(Actions.setInvoiceStatus(invoiceID, status));
      expect(toast.add).toHaveBeenCalled();
    });

    it('persists declined on an accepted estimate', async () => {
      const getStored = installTrackedInvoice({
        _id: 'est-1',
        docType: 'estimate',
        status: 'accepted',
        grandTotal: 50,
        currency: { fraction: 2 },
      });
      await middleware(Actions.setInvoiceStatus('est-1', 'declined'));
      expect(getStored().status).toBe('declined');
    });

    it('rejects paid status on an estimate', async () => {
      installTrackedInvoice({
        _id: 'est-paid',
        docType: 'estimate',
        status: 'sent',
        grandTotal: 50,
        currency: { fraction: 2 },
      });
      updateDocs.mockClear();
      await middleware(Actions.setInvoiceStatus('est-paid', 'paid'));
      expect(updateDocs).not.toHaveBeenCalled();
      expect(toast.add).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning' })
      );
    });

    it('rejects sent status on an invoice', async () => {
      installTrackedInvoice({
        _id: 'inv-sent',
        status: 'pending',
        grandTotal: 50,
        currency: { fraction: 2 },
      });
      updateDocs.mockClear();
      await middleware(Actions.setInvoiceStatus('inv-sent', 'sent'));
      expect(updateDocs).not.toHaveBeenCalled();
      expect(toast.add).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning' })
      );
    });
  });

  it('should handle INVOICE_NEW_FROM_CONTACT action', () => {
    const contact = {
      id: 'jon-snow',
      fullname: 'Jon Snow',
      email: 'jon@hbo.com',
    };
    const action = Actions.newInvoiceFromContact(contact);
    const pending = middleware(action);
    // Move to Form Tab
    expect(next.mock.calls.length).toBe(1);
    expect(next).toHaveBeenCalledWith({
      type: ACTION_TYPES.UI_TAB_CHANGE,
      payload: 'form',
    });
    // Update Form recipient data
    expect(dispatch.mock.calls.length).toBe(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTION_TYPES.FORM_RECIPIENT_UPDATE,
      payload: {
        new: {},
        select: contact,
        newRecipient: false,
      },
    });
    return pending;
  });

  it('INVOICE_NEW_FROM_CONTACT asks before replacing unsaved work', async () => {
    const original = {
      newRecipient: true,
      new: { fullname: 'Jane', email: 'jane@example.com' },
      select: {},
    };
    getState.mockReturnValue({
      form: {
        settings: { editMode: { active: false } },
        recipient: original,
        rows: [
          {
            id: '1',
            description: 'Work',
            price: 10,
            quantity: 1,
            subtotal: 10,
          },
        ],
        issuedAt: null,
      },
    });
    dialog.confirm.mockResolvedValueOnce(false);
    await middleware(
      Actions.newInvoiceFromContact({ _id: 'other', fullname: 'Other' })
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('INVOICE_NEW_FROM_CONTACT starts a new form after confirming on an edit', async () => {
    let form = {
      invoiceID: 'INV-0001',
      issuedAt: null,
      formRevision: 0,
      errors: {},
      recipient: { newRecipient: false, select: { _id: 'c1' }, new: {} },
      rows: [],
      currency: { code: 'USD', fraction: 2 },
      discount: {},
      tax: {},
      note: {},
      dueDate: {},
      settings: {
        editMode: { active: true, data: { _id: 'existing', _rev: '1-x' } },
        required_fields: {},
      },
      savedSettings: {
        currency: { code: 'USD', fraction: 2 },
        tax: {},
        required_fields: {},
      },
    };
    const chain = action => {
      form = FormReducer(form, action);
      return action;
    };
    let integrated;
    const dispatch = action => integrated(action);
    integrated = FormMW({ dispatch, getState: () => ({ form }) })(chain);
    const invoicesMw = InvoicesMW({ dispatch, getState: () => ({ form }) })(
      integrated
    );
    dialog.confirm.mockResolvedValueOnce(true);
    await invoicesMw(
      Actions.newInvoiceFromContact({ _id: 'other', fullname: 'Other' })
    );
    expect(form.settings.editMode.active).toBe(false);
    expect(form.settings.editMode.data?._id).toBeUndefined();
  });

  describe('INVOICE_PAYMENT_ADD', () => {
    it('records a payment and updates the store', async () => {
      getSingleDoc.mockResolvedValueOnce({
        _id: 'inv-1',
        status: 'pending',
        grandTotal: 100,
        currency: { fraction: 2 },
      });
      const ok = await middleware(
        Actions.recordPayment('inv-1', {
          id: 'pay-1',
          amount: 40,
          date: Date.UTC(2026, 0, 1),
          method: 'cash',
        })
      );
      expect(ok).toBe(true);
      expect(updateDocs).toHaveBeenCalledWith(
        'invoices',
        expect.arrayContaining([
          expect.objectContaining({
            payments: expect.arrayContaining([
              expect.objectContaining({ id: 'pay-1', amount: 40 }),
            ]),
          }),
        ])
      );
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_UPDATE,
        payload: mockData.invoicesRecords,
      });
    });

    it('syncs edit mode for the open invoice', async () => {
      const pendingDoc = {
        _id: 'open-id',
        status: 'pending',
        grandTotal: 50,
        currency: { fraction: 2 },
      };
      getAllDocs.mockResolvedValueOnce([pendingDoc]);
      getSingleDoc.mockResolvedValueOnce(pendingDoc);
      const freshDoc = {
        _id: 'open-id',
        _rev: '2',
        status: 'pending',
        grandTotal: 50,
        currency: { fraction: 2 },
        payments: [{ id: 'p1', amount: 10, date: 1, method: 'cash', note: '' }],
      };
      updateDocs.mockResolvedValueOnce([freshDoc]);
      getAllDocs.mockResolvedValueOnce([freshDoc]);
      getState.mockReturnValue({
        form: {
          settings: {
            editMode: { active: true, data: { _id: 'open-id', _rev: '1' } },
          },
        },
      });
      await middleware(
        Actions.recordPayment('open-id', {
          id: 'p1',
          amount: 10,
          date: 1,
          method: 'cash',
        })
      );
      expect(getAllDocs).toHaveBeenCalledWith('invoices');
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.FORM_EDIT_DATA_SYNC,
        payload: expect.objectContaining({ _id: 'open-id', _rev: '2' }),
      });
    });

    it('serializes overlapping payments on one invoice', async () => {
      const getStored = installTrackedInvoice({
        _id: 'inv-q',
        status: 'pending',
        grandTotal: 100,
        currency: { fraction: 2 },
        payments: [],
      });
      const payDate = Date.UTC(2026, 0, 1);
      const [firstOk, secondOk] = await Promise.all([
        middleware(
          Actions.recordPayment('inv-q', {
            id: 'pay-a',
            amount: 40,
            date: payDate,
            method: 'cash',
          })
        ),
        middleware(
          Actions.recordPayment('inv-q', {
            id: 'pay-b',
            amount: 40,
            date: payDate,
            method: 'bank',
          })
        ),
      ]);
      const stored = getStored();
      expect(firstOk).toBe(true);
      expect(secondOk).toBe(true);
      expect(stored.payments).toHaveLength(2);
      expect(getAmountPaid(stored)).toBe(80);
    });

    it('rejects a duplicate payment id', async () => {
      installTrackedInvoice({
        _id: 'inv-dup',
        status: 'pending',
        grandTotal: 100,
        currency: { fraction: 2 },
        payments: [],
      });
      const payment = {
        id: 'same-id',
        amount: 10,
        date: Date.UTC(2026, 0, 1),
        method: 'cash',
      };
      expect(await middleware(Actions.recordPayment('inv-dup', payment))).toBe(
        true
      );
      expect(await middleware(Actions.recordPayment('inv-dup', payment))).toBe(
        false
      );
      expect(updateDocs).toHaveBeenCalledTimes(1);
    });

    it('resolves false without writing when every invoice fails validation', async () => {
      getSingleDoc.mockImplementation((_db, id) =>
        Promise.resolve({
          _id: id,
          status: 'draft',
          grandTotal: 50,
          currency: { fraction: 2 },
        })
      );
      const ok = await middleware(
        Actions.recordPayment(['draft-a', 'draft-b'], {
          id: 'p1',
          amount: 10,
          date: Date.UTC(2026, 0, 1),
          method: 'cash',
        })
      );
      expect(ok).toBe(false);
      expect(updateDocs).not.toHaveBeenCalled();
    });

    it('records each full balance when bulk marking paid', async () => {
      mockData.invoicesRecords = [
        {
          _id: 'a',
          _rev: '1-x',
          status: 'pending',
          grandTotal: 80,
          currency: { fraction: 2 },
        },
        {
          _id: 'b',
          _rev: '1-x',
          status: 'pending',
          grandTotal: 120,
          currency: { fraction: 2 },
        },
        {
          _id: 'c',
          _rev: '1-x',
          status: 'draft',
          grandTotal: 40,
          currency: { fraction: 2 },
        },
      ];
      getSingleDoc.mockImplementation((_db, id) => {
        const doc = mockData.invoicesRecords.find(d => d._id === id);
        return doc
          ? Promise.resolve({ ...doc })
          : Promise.reject(new Error('missing'));
      });
      updateDocs.mockImplementation((_db, docs) => {
        const [incoming] = docs;
        const idx = mockData.invoicesRecords.findIndex(
          d => d._id === incoming._id
        );
        if (idx === -1) {
          return Promise.reject(new Error('missing'));
        }
        const prev = mockData.invoicesRecords[idx];
        if (incoming._rev !== prev._rev) {
          return Promise.reject(
            Object.assign(new Error('partial-update'), {
              docs: [...mockData.invoicesRecords],
            })
          );
        }
        const nextRev = `${Number.parseInt(String(prev._rev).split('-')[0], 10) + 1}-x`;
        mockData.invoicesRecords[idx] = { ...incoming, _rev: nextRev };
        return Promise.resolve([...mockData.invoicesRecords]);
      });
      await middleware(Actions.recordFullPayment(['a', 'b', 'c']));
      const a = mockData.invoicesRecords.find(d => d._id === 'a');
      const b = mockData.invoicesRecords.find(d => d._id === 'b');
      expect(getAmountPaid(a)).toBe(80);
      expect(getAmountPaid(b)).toBe(120);
      expect(toast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          title: i18n.t('invoices:payments:toast:skipped', {
            count: 1,
            reason: i18n.t('invoices:payments:errors:draft'),
          }),
        })
      );
    });

    it('does not sync edit mode for a different open invoice', async () => {
      installTrackedInvoice({
        _id: 'inv-other',
        status: 'pending',
        grandTotal: 100,
        currency: { fraction: 2 },
      });
      getState.mockReturnValue({
        form: {
          settings: {
            editMode: {
              active: true,
              data: { _id: 'editor-open', _rev: '1-x' },
            },
          },
        },
      });
      await middleware(
        Actions.recordPayment('inv-other', {
          id: 'p1',
          amount: 10,
          date: Date.UTC(2026, 0, 1),
          method: 'cash',
        })
      );
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: ACTION_TYPES.FORM_EDIT_DATA_SYNC })
      );
    });
  });

  describe('INVOICE_SET_STATUS payments', () => {
    it('marks pending invoice paid with one full payment', async () => {
      const getStored = installTrackedInvoice({
        _id: 'inv-paid',
        status: 'pending',
        grandTotal: 100,
        currency: { fraction: 2 },
      });
      await middleware(Actions.setInvoiceStatus('inv-paid', 'paid'));
      const stored = getStored();
      expect(stored.status).toBe('paid');
      expect(stored.payments).toHaveLength(1);
      expect(stored.payments[0].amount).toBe(100);
    });
  });

  describe('INVOICE_PAYMENT_REMOVE', () => {
    it('undo dispatches recordPayment with the same id', async () => {
      getSingleDoc.mockResolvedValueOnce({
        _id: 'inv-1',
        status: 'pending',
        grandTotal: 100,
        currency: { fraction: 2 },
        payments: [
          { id: 'pay-1', date: 1, amount: 40, method: 'cash', note: '' },
        ],
      });
      await middleware(Actions.removePayment('inv-1', 'pay-1'));
      const toastCall = toast.add.mock.calls.find(
        c => c[0]?.actionProps?.onClick
      );
      expect(toastCall).toBeDefined();
      toastCall[0].actionProps.onClick();
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTION_TYPES.INVOICE_PAYMENT_ADD,
          payload: expect.objectContaining({
            payment: expect.objectContaining({ id: 'pay-1' }),
          }),
        })
      );
    });
  });

  describe('credit notes', () => {
    const currency = { code: 'USD', fraction: 2 };

    it('CREDIT_NOTE_NEW_FROM_INVOICE loads the editor without saving', async () => {
      const invoice = {
        _id: 'inv-src',
        docType: 'invoice',
        status: 'pending',
        grandTotal: 1000,
        currency,
        invoiceID: 'INV-1',
        recipient: { fullname: 'A' },
        rows: [{ id: 'r', subtotal: 1000, price: 100, quantity: 10 }],
      };
      getAllDocs.mockImplementation(db => {
        if (db === 'invoices') return Promise.resolve([invoice]);
        if (db === 'contacts') return Promise.resolve([]);
        return Promise.reject(new Error('bad db'));
      });
      await middleware(Actions.createCreditNote(invoice));
      expect(saveDoc).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: ACTION_TYPES.FORM_LOAD_DUPLICATE })
      );
      expect(dispatch).toHaveBeenCalledWith(UIActions.changeActiveTab('form'));
    });

    it('CREDIT_NOTE_ISSUE rejects when total exceeds creditable amount', async () => {
      const invoice = {
        _id: 'inv-src',
        docType: 'invoice',
        status: 'pending',
        grandTotal: 100,
        currency,
      };
      const cn = {
        _id: 'cn-1',
        docType: 'creditNote',
        status: 'draft',
        creditedInvoiceId: 'inv-src',
        grandTotal: 200,
        currency,
      };
      getAllDocs.mockResolvedValue([invoice, cn]);
      updateDocs.mockClear();
      await middleware(Actions.issueCreditNote('cn-1'));
      expect(updateDocs).not.toHaveBeenCalled();
      expect(toast.add).toHaveBeenCalled();
    });

    it('CREDIT_NOTE_ISSUE writes issued then syncs invoice to cancelled', async () => {
      const invoice = {
        _id: 'inv-src',
        _rev: '1-a',
        docType: 'invoice',
        status: 'pending',
        grandTotal: 100,
        currency,
      };
      const cn = {
        _id: 'cn-1',
        _rev: '1-b',
        docType: 'creditNote',
        status: 'draft',
        creditedInvoiceId: 'inv-src',
        grandTotal: 100,
        currency,
      };
      let inv = { ...invoice };
      let note = { ...cn };
      getAllDocs.mockImplementation(() =>
        Promise.resolve([{ ...inv }, { ...note }])
      );
      getSingleDoc.mockImplementation((_db, id) => {
        if (id === 'cn-1') return Promise.resolve({ ...note });
        if (id === 'inv-src') return Promise.resolve({ ...inv });
        return Promise.reject(new Error('missing'));
      });
      updateDocs.mockImplementation((_db, docs) => {
        for (const d of docs) {
          if (d._id === 'cn-1') note = { ...d, _rev: '2-b' };
          if (d._id === 'inv-src') inv = { ...d, _rev: '2-a' };
        }
        return Promise.resolve([{ ...inv }, { ...note }]);
      });
      await middleware(Actions.issueCreditNote('cn-1'));
      expect(note.status).toBe('issued');
      expect(inv.status).toBe('cancelled');
      expect(inv.cancelledByCredit).toBe(true);
    });

    it('CREDIT_NOTE_ISSUE writes the note and the invoice in one updateDocs', async () => {
      const invoice = {
        _id: 'inv-src',
        _rev: '1-a',
        docType: 'invoice',
        status: 'pending',
        grandTotal: 100,
        currency,
      };
      const cn = {
        _id: 'cn-1',
        _rev: '1-b',
        docType: 'creditNote',
        status: 'draft',
        creditedInvoiceId: 'inv-src',
        grandTotal: 100,
        currency,
      };
      let inv = { ...invoice };
      let note = { ...cn };
      getAllDocs.mockImplementation(() =>
        Promise.resolve([{ ...inv }, { ...note }])
      );
      getSingleDoc.mockImplementation((_db, id) => {
        if (id === 'cn-1') return Promise.resolve({ ...note });
        if (id === 'inv-src') return Promise.resolve({ ...inv });
        return Promise.reject(new Error('missing'));
      });
      updateDocs.mockImplementation((_db, docs) => {
        for (const doc of docs) {
          if (doc._id === 'cn-1') note = { ...doc, _rev: '2-b' };
          if (doc._id === 'inv-src') inv = { ...doc, _rev: '2-a' };
        }
        return Promise.resolve([{ ...inv }, { ...note }]);
      });
      await middleware(Actions.issueCreditNote('cn-1'));
      expect(updateDocs).toHaveBeenCalledTimes(1);
      const written = updateDocs.mock.calls[0][1];
      expect(written).toHaveLength(2);
      expect(written[0]).toMatchObject({
        _id: 'cn-1',
        status: 'issued',
        _rev: '1-b',
      });
      expect(written[1]).toMatchObject({
        _id: 'inv-src',
        status: 'cancelled',
        cancelledByCredit: true,
      });
      const published = next.mock.calls
        .map(([action]) => action)
        .filter(action => action.type === ACTION_TYPES.INVOICE_UPDATE);
      expect(published.at(-1).payload).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ _id: 'cn-1', status: 'issued' }),
          expect.objectContaining({
            _id: 'inv-src',
            status: 'cancelled',
            cancelledByCredit: true,
          }),
        ])
      );
    });

    it('CREDIT_NOTE_ISSUE restores the previous note when the invoice put fails', async () => {
      await import('fake-indexeddb/auto');
      const actual = await vi.importActual('../../helpers/pouchDB');
      const { default: PouchDB } = await import('pouchdb-browser');
      await actual.getAllDocs('invoices');
      const noteId = 'cn-reload-1';
      const invoiceId = 'inv-reload-1';
      await actual.saveDoc('invoices', {
        _id: invoiceId,
        docType: 'invoice',
        status: 'pending',
        grandTotal: 100,
        currency,
      });
      await actual.saveDoc('invoices', {
        _id: noteId,
        docType: 'creditNote',
        status: 'draft',
        creditedInvoiceId: invoiceId,
        grandTotal: 100,
        currency,
      });
      const stored = await actual.getAllDocs('invoices');
      const realNote = stored.find(doc => doc._id === noteId);
      const realInvoice = stored.find(doc => doc._id === invoiceId);
      const seenInvoice = { ...realInvoice, _rev: '1-deadbeef' };
      const seenNote = { ...realNote };
      getAllDocs.mockImplementation(() =>
        Promise.resolve([{ ...seenInvoice }, { ...seenNote }])
      );
      getSingleDoc.mockImplementation((_db, id) => {
        if (id === noteId) return Promise.resolve({ ...seenNote });
        if (id === invoiceId) return Promise.resolve({ ...seenInvoice });
        return Promise.reject(new Error('missing'));
      });
      const open = PouchDB._destructionListeners?.get('invoices') ?? [];
      if (!open.length) {
        throw new Error('No open database named invoices');
      }
      let pendingReload = true;
      const spies = open.map(db => {
        const original = db.allDocs.bind(db);
        return vi.spyOn(db, 'allDocs').mockImplementation((...args) => {
          const opts = args[0];
          if (
            pendingReload &&
            opts &&
            typeof opts === 'object' &&
            opts.include_docs
          ) {
            pendingReload = false;
            return Promise.reject(new Error('reload failed'));
          }
          return original(...args);
        });
      });
      let partial;
      updateDocs.mockImplementation(async (dbName, docs) => {
        try {
          return await actual.updateDocs(dbName, docs);
        } catch (err) {
          if (err?.message === 'partial-update') {
            partial = err;
          }
          throw err;
        }
      });
      try {
        await middleware(Actions.issueCreditNote(noteId));
      } finally {
        spies.forEach(spy => spy.mockRestore());
      }
      expect(partial).toBeDefined();
      expect(partial.succeeded).toEqual([noteId]);
      expect(partial.failed).toEqual([
        expect.objectContaining({ id: invoiceId }),
      ]);
      expect(partial.docs.map(doc => doc._id)).toEqual([noteId]);
      expect(updateDocs).toHaveBeenCalledTimes(2);
      expect(updateDocs.mock.calls[1][0]).toBe('invoices');
      expect(updateDocs.mock.calls[1][1]).toEqual([
        expect.objectContaining({
          _id: noteId,
          status: 'draft',
          _rev: partial.docs[0]._rev,
          grandTotal: 100,
        }),
      ]);
      const published = next.mock.calls
        .map(([action]) => action)
        .filter(action => action.type === ACTION_TYPES.INVOICE_UPDATE);
      expect(
        published
          .at(-1)
          .payload.some(doc => doc._id === noteId && doc.status === 'issued')
      ).toBe(false);
      expect(toast.add).toHaveBeenCalledWith({
        title: i18n.t('invoices:creditNotes:errors:updateFailed'),
        type: 'warning',
      });
    });

    it('CREDIT_NOTE_ISSUE second concurrent issue stays draft when credit exhausted', async () => {
      const invoice = {
        _id: 'inv-src',
        _rev: '1-a',
        docType: 'invoice',
        status: 'pending',
        grandTotal: 100,
        currency,
      };
      const cnA = {
        _id: 'cn-a',
        _rev: '1-a',
        docType: 'creditNote',
        status: 'draft',
        creditedInvoiceId: 'inv-src',
        grandTotal: 60,
        currency,
      };
      const cnB = {
        _id: 'cn-b',
        _rev: '1-b',
        docType: 'creditNote',
        status: 'draft',
        creditedInvoiceId: 'inv-src',
        grandTotal: 60,
        currency,
      };
      let inv = { ...invoice };
      let noteA = { ...cnA };
      let noteB = { ...cnB };
      getAllDocs.mockImplementation(() =>
        Promise.resolve([{ ...inv }, { ...noteA }, { ...noteB }])
      );
      getSingleDoc.mockImplementation((_db, id) => {
        if (id === 'cn-a') return Promise.resolve({ ...noteA });
        if (id === 'cn-b') return Promise.resolve({ ...noteB });
        if (id === 'inv-src') return Promise.resolve({ ...inv });
        return Promise.reject(new Error('missing'));
      });
      let releaseFirst;
      updateDocs.mockImplementation((_db, docs) => {
        const updating = docs[0];
        if (updating._id === 'cn-a' && updating.status === 'issued') {
          return new Promise(resolve => {
            releaseFirst = () => {
              noteA = { ...updating, _rev: '2-a' };
              inv = { ...inv, _rev: '2-a' };
              resolve([{ ...inv }, { ...noteA }, { ...noteB }]);
            };
          });
        }
        if (updating._id === 'cn-b' && updating.status === 'issued') {
          noteB = { ...updating, _rev: '2-b' };
          return Promise.resolve([{ ...inv }, { ...noteA }, { ...noteB }]);
        }
        if (updating._id === 'inv-src') {
          inv = { ...updating, _rev: '3-a' };
          return Promise.resolve([{ ...inv }, { ...noteA }, { ...noteB }]);
        }
        return Promise.resolve([{ ...inv }, { ...noteA }, { ...noteB }]);
      });
      const first = middleware(Actions.issueCreditNote('cn-a'));
      const second = middleware(Actions.issueCreditNote('cn-b'));
      await vi.waitFor(() => {
        expect(typeof releaseFirst).toBe('function');
      });
      releaseFirst();
      await first;
      await second;
      expect(noteA.status).toBe('issued');
      expect(noteB.status).toBe('draft');
    });

    it('INVOICE_UPDATE rejects a total below credits issued while the edit was in flight', async () => {
      const invoice = {
        _id: 'inv-src',
        _rev: '1-a',
        docType: 'invoice',
        status: 'pending',
        grandTotal: 100,
        currency,
        rows: [{ id: 'r', price: 100, quantity: 1, subtotal: 100 }],
      };
      const issued = {
        _id: 'cn-1',
        _rev: '2-b',
        docType: 'creditNote',
        status: 'issued',
        creditedInvoiceId: 'inv-src',
        grandTotal: 60,
        currency,
      };
      getAllDocs.mockResolvedValue([invoice, issued]);
      getSingleDoc.mockImplementation((_db, id) => {
        if (id === 'inv-src') return Promise.resolve({ ...invoice });
        return Promise.reject(new Error('missing'));
      });
      updateDoc.mockClear();
      await middleware(
        Actions.updateInvoice({
          ...invoice,
          grandTotal: 50,
          rows: [{ id: 'r', price: 50, quantity: 1, subtotal: 50 }],
        })
      );
      expect(updateDoc).not.toHaveBeenCalled();
      expect(toast.add).toHaveBeenCalled();
    });

    it('CREDIT_NOTE_ISSUE reloads the list when the pair write fails', async () => {
      const invoice = {
        _id: 'inv-src',
        _rev: '1-a',
        docType: 'invoice',
        status: 'pending',
        grandTotal: 100,
        currency,
      };
      const cn = {
        _id: 'cn-1',
        _rev: '1-b',
        docType: 'creditNote',
        status: 'draft',
        creditedInvoiceId: 'inv-src',
        grandTotal: 100,
        currency,
      };
      let inv = { ...invoice };
      let note = { ...cn };
      getAllDocs.mockImplementation(() =>
        Promise.resolve([{ ...inv }, { ...note }])
      );
      getSingleDoc.mockImplementation((_db, id) => {
        if (id === 'cn-1') return Promise.resolve({ ...note });
        if (id === 'inv-src') return Promise.resolve({ ...inv });
        return Promise.reject(new Error('missing'));
      });
      updateDocs.mockImplementation((_db, docs) => {
        if (docs.some(d => d._id === 'inv-src')) {
          return Promise.reject(new Error('sync failed'));
        }
        note = { ...docs[0], _rev: '2-b', status: 'issued' };
        return Promise.resolve([{ ...inv }, { ...note }]);
      });
      await middleware(Actions.issueCreditNote('cn-1'));
      expect(updateDocs).toHaveBeenCalledTimes(1);
      expect(note.status).toBe('draft');
      expect(
        next.mock.calls.some(
          ([a]) =>
            a.type === ACTION_TYPES.INVOICE_UPDATE &&
            a.payload.some(d => d._id === 'cn-1' && d.status === 'draft')
        )
      ).toBe(true);
      expect(toast.add).toHaveBeenCalledWith({
        title: i18n.t('invoices:creditNotes:errors:updateFailed'),
        type: 'warning',
      });
    });

    it('CREDIT_NOTE_ISSUE rejects when original invoice is cancelled', async () => {
      const invoice = {
        _id: 'inv-src',
        docType: 'invoice',
        status: 'cancelled',
        grandTotal: 100,
        currency,
      };
      const cn = {
        _id: 'cn-1',
        docType: 'creditNote',
        status: 'draft',
        creditedInvoiceId: 'inv-src',
        grandTotal: 50,
        currency,
      };
      getAllDocs.mockResolvedValue([invoice, cn]);
      getSingleDoc.mockResolvedValue(cn);
      updateDocs.mockClear();
      await middleware(Actions.issueCreditNote('cn-1'));
      expect(updateDocs).not.toHaveBeenCalled();
    });

    it('INVOICE_EDIT refuses issued credit notes', async () => {
      getSingleDoc.mockResolvedValueOnce({
        _id: 'cn-1',
        docType: 'creditNote',
        status: 'issued',
      });
      await middleware(
        Actions.editInvoice({ _id: 'cn-1', docType: 'creditNote' })
      );
      expect(next).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: ACTION_TYPES.INVOICE_EDIT })
      );
    });

    it('INVOICE_DUPLICATE refuses issued credit notes', async () => {
      getSingleDoc.mockResolvedValueOnce({
        _id: 'cn-1',
        docType: 'creditNote',
        status: 'issued',
      });
      getAllDocs.mockResolvedValue([]);
      await middleware(
        Actions.duplicateInvoice({ _id: 'cn-1', docType: 'creditNote' })
      );
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: ACTION_TYPES.FORM_LOAD_DUPLICATE })
      );
    });

    it('CREDIT_NOTE_VOID rejects draft credit notes', async () => {
      getAllDocs.mockResolvedValue([
        {
          _id: 'cn-d',
          docType: 'creditNote',
          status: 'draft',
          creditedInvoiceId: 'inv-src',
          grandTotal: 10,
          currency,
        },
      ]);
      updateDocs.mockClear();
      await middleware(Actions.voidCreditNote('cn-d'));
      expect(updateDocs).not.toHaveBeenCalled();
    });

    it('CREDIT_NOTE_SYNC_INVOICE skips write when status unchanged', async () => {
      const invoice = {
        _id: 'inv-src',
        docType: 'invoice',
        status: 'pending',
        grandTotal: 100,
        currency,
      };
      getAllDocs.mockResolvedValue([invoice]);
      updateDocs.mockClear();
      await middleware(Actions.syncCreditedInvoice('inv-src'));
      expect(updateDocs).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ type: ACTION_TYPES.INVOICE_UPDATE })
      );
    });

    it('INVOICE_DELETE removes only deletable ids when credits block others', async () => {
      const invoice = {
        _id: 'inv-blocked',
        docType: 'invoice',
        status: 'pending',
      };
      const cn = {
        _id: 'cn-1',
        docType: 'creditNote',
        status: 'issued',
        creditedInvoiceId: 'inv-blocked',
      };
      const free = { _id: 'free-id', docType: 'invoice', status: 'draft' };
      getAllDocs.mockResolvedValue([invoice, cn, free]);
      removeDocs.mockResolvedValueOnce({
        removed: [free],
        failed: [],
        docs: [invoice, cn],
      });
      await middleware(Actions.deleteInvoice(['inv-blocked', 'free-id']));
      expect(removeDocs).toHaveBeenCalledWith('invoices', ['free-id']);
    });

    it('INVOICE_UPDATE rejects issued credit notes', async () => {
      getSingleDoc.mockResolvedValueOnce({
        _id: 'cn-1',
        docType: 'creditNote',
        status: 'issued',
        grandTotal: 10,
        currency,
      });
      const ok = await middleware(
        Actions.updateInvoice({
          _id: 'cn-1',
          docType: 'creditNote',
          status: 'issued',
          grandTotal: 10,
        })
      );
      expect(ok).toBe(false);
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  it('assigns consecutive numbers when bulk marking recurring drafts paid', async () => {
    const draftBase = {
      status: 'draft',
      grandTotal: 10,
      currency: { fraction: 2, code: 'USD' },
      rows: [{ subtotal: 10 }],
      recipient: { fullname: 'A', email: 'a@b.c' },
      recurringId: 'prof',
    };
    mockData.invoicesRecords = [
      { _id: 'r1', ...draftBase, periodKey: '2026-01-01' },
      { _id: 'r2', ...draftBase, periodKey: '2026-02-01' },
    ];
    getAllDocs.mockResolvedValue([...mockData.invoicesRecords]);
    getSingleDoc.mockImplementation((_db, id) => {
      const doc = mockData.invoicesRecords.find(d => d._id === id);
      return doc
        ? Promise.resolve({ ...doc, _rev: '1-x' })
        : Promise.reject(new Error('missing'));
    });
    getState.mockReturnValueOnce({
      form: {
        settings: { editMode: { active: false } },
        reconciledNumbering: null,
      },
    });
    window.manta.settings.get.mockImplementation(key => {
      if (key === 'invoice' || key === 'invoice.numbering') {
        return {
          numbering: { prefix: 'INV-', next: 1, padding: 4 },
          currency: { fraction: 2 },
        };
      }
      return undefined;
    });
    const written = [];
    updateDocs.mockImplementation((_db, docs) => {
      written.push(...docs);
      for (const doc of docs) {
        const idx = mockData.invoicesRecords.findIndex(d => d._id === doc._id);
        if (idx >= 0) {
          mockData.invoicesRecords[idx] = { ...doc, _rev: '2-x' };
        }
      }
      return Promise.resolve([...mockData.invoicesRecords]);
    });
    await middleware(Actions.setInvoiceStatus(['r1', 'r2'], 'paid'));
    const numbers = written.map(d => d.invoiceID).sort();
    expect(numbers).toEqual(['INV-0001', 'INV-0002']);
    expect(window.manta.settings.set).toHaveBeenCalledWith(
      'invoice.numbering',
      expect.objectContaining({ next: 3 })
    );
  });

  it('let other actions pass through', () => {
    const action = { type: 'TEST' };
    const pending = middleware(action);
    expect(next).toHaveBeenCalledWith(action);
    return pending;
  });
});
