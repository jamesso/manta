import * as ACTION_TYPES from '../../constants/actions.jsx';
import * as Actions from '../../actions/invoices';
import InvoicesMW from '../InvoicesMW';
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
  restoreDocs,
  updateDocs,
  mockData,
} from '../../helpers/pouchDB';
import { toast } from '@/components/ui/toast';
import * as dialog from '@/lib/dialog';
Date.now = vi.fn(() => 'now');

describe('Invoices Middleware', () => {
  let next, dispatch, middleware, getState;

  beforeEach(() => {
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
    removeDocs.mockClear();
    restoreDocs.mockClear();
    updateDocs.mockClear();
  });

  describe('should handle INVOICE_GET_ALL action', () => {
    it('retrieves data from correct DB', async () => {
      middleware(Actions.getInvoices());

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

    it('calls next after the promised is returned', () => {
      const action = Actions.getInvoices();
      middleware(action).then(() => {
        // Never call dispatch
        expect(dispatch.mock.calls.length).toBe(0);
        // Call next with resolved data
        return getAllDocs('invoices').then(data => {
          expect(next.mock.calls.length).toBe(1);
          expect(next).toHaveBeenCalledWith(
            Object.assign({}, action, {
              payload: data,
            })
          );
        });
      });
    });

    it('handle error correctly', () => {
      // Make sure getAllDocs will be called with incorrect dbName
      getAllDocs.mockImplementationOnce(() => getAllDocs('random-string'));
      const expectedError = new Error('Incorrect database!');
      // Execute
      middleware(Actions.getInvoices()).then(() => {
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

    it('handle unknown error correctly', () => {
      const unknownError = new Error('Something broke');
      getAllDocs.mockImplementationOnce(() => Promise.reject(unknownError));
      middleware(Actions.getInvoices()).then(() =>
        getAllDocs().catch(err => {
          expect(next).toHaveBeenCalled();
          expect(next).toHaveBeenCalledWith({
            type: ACTION_TYPES.UI_NOTIFICATION_NEW,
            payload: {
              type: 'warning',
              message: unknownError.message,
            },
          });
        })
      );
    });
  });

  describe('should handle INVOICE_SAVE action', () => {
    it('returns success for a draft without opening preview', async () => {
      window.manta.ipc.send.mockClear();
      const result = await middleware(
        Actions.saveInvoice({ status: 'draft', rows: [] })
      );
      expect(result).toBe(true);
      expect(
        window.manta.ipc.send.mock.calls.map(([event]) => event)
      ).not.toContain('preview-invoice');
    });
    it('returns false if invoice persistence fails', async () => {
      saveDoc.mockRejectedValueOnce(new Error('disk full'));
      await expect(
        middleware(Actions.saveInvoice({ status: 'draft', rows: [] }))
      ).resolves.toBe(false);
    });

    it('should save records to DB', () => {
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
      middleware(Actions.saveInvoice(newInvoice)).then(() =>
        saveDoc('invoices', newInvoice).then(data => {
          // Expect
          expect(data).toEqual([...mockData.invoicesRecords, newInvoice]);
        })
      );
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
      middleware(action).then(() =>
        saveDoc('invoices', newInvoice).then(data => {
          // Call next after the promised is returned
          expect(next.mock.calls.length).toBe(1);
          expect(next).toHaveBeenCalledWith(
            Object.assign({}, action, {
              payload: [...mockData.invoicesRecords, newInvoice],
            })
          );
          // Dispatch success notification
          expect(dispatch.mock.calls.length).toBe(1);
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

    it('tell main process to open preview window with invoice data', () => {
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
      middleware(Actions.saveInvoice(newInvoice)).then(() =>
        saveDoc('invoices', newInvoice).then(data => {
          // ipc to main process
          expect(window.manta.ipc.send).toHaveBeenCalled();
          expect(window.manta.ipc.send).toHaveBeenCalledWith(
            'preview-invoice',
            newInvoice
          );
        })
      );
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
      middleware(Actions.saveInvoice(newInvoice)).then(() => {
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
      // Execute
      const action = Actions.editInvoice(currentInvoice);
      middleware(action).then(() => {
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
    });

    it('should update the invoice', () => {
      middleware(Actions.updateInvoice(currentInvoice)).then(() =>
        updateDoc('invoices', currentInvoice).then(data => {
          expect(data).toEqual(mockData.invoicesRecords);
        })
      );
    });

    it('should call next and dispatch notification', () => {
      middleware(Actions.updateInvoice(currentInvoice)).then(() =>
        updateDoc('invoices', currentInvoice).then(data => {
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
        })
      );
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
      middleware(Actions.updateInvoice(currentInvoice)).then(() => {
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
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_TAB_CHANGE,
        payload: 'form',
      });
    });
  });

  describe('should handle INVOICE_CONFIGS_SAVE action correctly', () => {
    it('get the doc, merge with config object and dispatch a new action', () => {
      const invoiceID = 'id-string';
      const configs = { color: 'red' };
      middleware(Actions.saveInvoiceConfigs(invoiceID, configs)).then(() =>
        getSingleDoc('invoices', invoiceID).then(doc => {
          expect(dispatch.mock.calls.length).toBe(1);
          expect(dispatch).toHaveBeenCalledWith({
            type: ACTION_TYPES.INVOICE_UPDATE,
            payload: Object.assign({}, doc, { configs }),
          });
        })
      );
    });

    it('handle error correctly', () => {
      // Setup
      const invoiceID = 'id-string';
      const configs = { color: 'red' };
      const expectedError = new Error('No invoice found!');
      // Execute
      middleware(Actions.saveInvoiceConfigs(invoiceID, configs)).then(() => {
        getSingleDoc('test', invoiceID).then(() => {
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
  });

  describe('should handle INVOICE_SET_STATUS action', () => {
    it('get the doc, merge with status object and dispatch a new action', async () => {
      const invoiceID = 'id-string';
      const status = 'paid';
      await middleware(Actions.setInvoiceStatus(invoiceID, status));
      const doc = await getSingleDoc('invoices', invoiceID);
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_UPDATE,
        payload: expect.objectContaining({ status: 'paid', paidAt: 'now' }),
      });
      expect(doc).toBeDefined();
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
      getSingleDoc.mockResolvedValueOnce({ _id: 'a', status: 'pending' });
      getSingleDoc.mockResolvedValueOnce({ _id: 'b', status: 'pending' });
      await middleware(Actions.setInvoiceStatus(['a', 'b'], 'paid'));
      expect(updateDocs).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.INVOICE_UPDATE,
        payload: mockData.invoicesRecords,
      });
    });

    it('handle error correctly', async () => {
      const invoiceID = 'id-string';
      const status = 'paid';
      const expectedError = new Error('No invoice found!');
      getSingleDoc.mockImplementationOnce(() => Promise.reject(expectedError));
      await middleware(Actions.setInvoiceStatus(invoiceID, status));
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: expectedError.message,
        },
      });
    });
  });

  it('should handle INVOICE_NEW_FROM_CONTACT action', () => {
    const contact = {
      id: 'jon-snow',
      fullname: 'Jon Snow',
      email: 'jon@hbo.com',
    };
    const action = Actions.newInvoiceFromContact(contact);
    middleware(action);
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

  it('let other actions pass through', () => {
    const action = { type: 'TEST' };
    middleware(action);
    expect(next).toHaveBeenCalledWith(action);
  });
});
