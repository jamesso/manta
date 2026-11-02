import * as Actions from '../../actions/form';
import * as ACTION_TYPES from '../../constants/actions.jsx';
import * as TYPES from '../../constants/actions';
import FormMW from '../FormMW';
import FormReducer from '../../reducers/FormReducer';
import InvoicesMW from '../InvoicesMW';
vi.mock('../../helpers/pouchDB');
vi.mock('@/lib/dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
  alert: vi.fn(),
}));
import { saveDoc, updateDoc, getAllDocs } from '../../helpers/pouchDB';
import * as dialog from '@/lib/dialog';
import * as InvoiceActions from '../../actions/invoices';
const currency = { code: 'USD', fraction: 2 };
const makeForm = () => ({
  invoiceID: 'INV-0001',
  issuedAt: null,
  formRevision: 0,
  errors: {},
  recipient: {
    newRecipient: true,
    new: { fullname: 'Jane', email: 'jane@example.com' },
    select: {},
  },
  rows: [
    { id: '1', description: 'Work', price: 10, quantity: 2, subtotal: 20 },
  ],
  dueDate: {},
  currency,
  discount: {},
  tax: {},
  note: {},
  savedSettings: { currency, tax: {}, required_fields: {} },
  settings: { editMode: { active: false }, required_fields: {} },
});
describe('Form middleware', () => {
  let form, dispatch, next, middleware;
  beforeEach(() => {
    form = makeForm();
    next = vi.fn();
    dispatch = vi.fn(() => Promise.resolve(true));
    window.manta.settings.set.mockClear();
    middleware = FormMW({ dispatch, getState: () => ({ form }) })(next);
  });
  it('rejects an invalid invoice without saving', async () => {
    form.invoiceID = '';
    await middleware(Actions.saveFormData());
    expect(dispatch.mock.calls.map(([a]) => a.type)).toContain(
      TYPES.FORM_SET_ERRORS
    );
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain(
      TYPES.INVOICE_SAVE
    );
  });
  it('saves, advances the counter and clears after success', async () => {
    await middleware(Actions.saveFormData());
    expect(dispatch.mock.calls.map(([a]) => a.type)).toContain(
      TYPES.INVOICE_SAVE
    );
    expect(dispatch.mock.calls.map(([a]) => a.type)).toContain(
      TYPES.FORM_CLEAR
    );
    expect(window.manta.settings.set).toHaveBeenCalledWith(
      'invoice.numbering',
      expect.objectContaining({ next: 2 })
    );
  });
  it('leaves the form and counter intact when saving fails', async () => {
    dispatch.mockImplementation(a =>
      Promise.resolve(a.type !== TYPES.INVOICE_SAVE)
    );
    await middleware(Actions.saveFormData());
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain(
      TYPES.FORM_CLEAR
    );
    expect(window.manta.settings.set).not.toHaveBeenCalled();
  });
  it('reuses an in-flight save', async () => {
    let resolve;
    dispatch.mockImplementation(a =>
      a.type === TYPES.INVOICE_SAVE
        ? new Promise(r => {
            resolve = r;
          })
        : Promise.resolve(true)
    );
    const first = middleware(Actions.saveFormData());
    const second = middleware(Actions.saveFormData());
    resolve(true);
    await Promise.all([first, second]);
    expect(
      dispatch.mock.calls.filter(([a]) => a.type === TYPES.INVOICE_SAVE)
    ).toHaveLength(1);
    expect(window.manta.settings.set).toHaveBeenCalledTimes(1);
  });
  it('does not clear newer edits after a delayed save', async () => {
    let resolve;
    dispatch.mockImplementation(a =>
      a.type === TYPES.INVOICE_SAVE
        ? new Promise(r => {
            resolve = r;
          })
        : Promise.resolve(true)
    );
    const pending = middleware(Actions.saveFormData());
    form = { ...form, formRevision: 1 };
    resolve(true);
    await pending;
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain(
      TYPES.FORM_CLEAR
    );
  });
  it('does not save an incomplete contact for a draft', async () => {
    form.recipient.new = { fullname: 'Jane' };
    await middleware(Actions.saveFormData('draft'));
    expect(dispatch.mock.calls.map(([a]) => a.type)).not.toContain(
      TYPES.CONTACT_SAVE
    );
  });
  it('fills the next number after clearing', () => {
    middleware(Actions.clearForm());
    expect(dispatch).toHaveBeenCalledWith(
      Actions.updateFieldData('invoiceID', 'INV-0001')
    );
  });
  it('uses reconciled numbering when persist fails after save', async () => {
    window.manta.settings.set.mockImplementation(() => {
      throw new Error('disk full');
    });
    let form = makeForm();
    form.savedSettings = { currency, tax: {}, required_fields: {} };
    const chain = action => {
      form = FormReducer(form, action);
      return action;
    };
    let integrated;
    const dispatch = action =>
      action.type === TYPES.INVOICE_SAVE || action.type === TYPES.CONTACT_SAVE
        ? Promise.resolve(true)
        : integrated(action);
    integrated = FormMW({ dispatch, getState: () => ({ form }) })(chain);
    await integrated(Actions.saveFormData('draft'));
    expect(form.invoiceID).not.toBe('INV-0001');
    window.manta.settings.set.mockReset();
  });
  it('keeps reconciled numbering after a second clear or duplicate', async () => {
    window.manta.settings.set.mockImplementation(() => {
      throw new Error('disk full');
    });
    let form = makeForm();
    form.savedSettings = { currency, tax: {}, required_fields: {} };
    const chain = action => {
      form = FormReducer(form, action);
      return action;
    };
    let integrated;
    const dispatch = action =>
      action.type === TYPES.INVOICE_SAVE || action.type === TYPES.CONTACT_SAVE
        ? Promise.resolve(true)
        : integrated(action);
    integrated = FormMW({ dispatch, getState: () => ({ form }) })(chain);
    await integrated(Actions.saveFormData('draft'));
    const used = 'INV-0001';
    expect(form.invoiceID).not.toBe(used);
    integrated(Actions.clearForm());
    expect(form.invoiceID).not.toBe(used);
    expect(form.reconciledNumbering).toBeTruthy();
    integrated(Actions.clearForm());
    expect(form.invoiceID).not.toBe(used);
    integrated({
      type: TYPES.FORM_LOAD_DUPLICATE,
      payload: {
        recipient: { fullname: 'Jane', email: 'jane@example.com' },
        contacts: [],
        rows: form.rows,
      },
    });
    expect(form.invoiceID).not.toBe(used);
    window.manta.settings.set.mockReset();
  });
  it('reuses invoice and recipient ids when saving again after mid-save edits', async () => {
    let resolve;
    let form = makeForm();
    form.savedSettings = { currency, tax: {}, required_fields: {} };
    const saves = [];
    const updates = [];
    const contacts = [];
    const chain = action => {
      form = FormReducer(form, action);
      return action;
    };
    let integrated;
    const dispatch = action => {
      if (action.type === TYPES.INVOICE_SAVE) {
        saves.push(action.payload);
        return new Promise(r => {
          resolve = r;
        });
      }
      if (action.type === TYPES.INVOICE_UPDATE) {
        updates.push(action.payload);
        return Promise.resolve(true);
      }
      if (action.type === TYPES.CONTACT_SAVE) {
        contacts.push(action.payload);
        return Promise.resolve(true);
      }
      return integrated(action);
    };
    integrated = FormMW({ dispatch, getState: () => ({ form }) })(chain);
    const pending = integrated(Actions.saveFormData('draft'));
    integrated(
      Actions.updateFieldData('note', { content: 'typed during save' })
    );
    resolve(true);
    await pending;
    await integrated(Actions.saveFormData('draft'));
    expect(saves).toHaveLength(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]._id).toBe(saves[0]._id);
    expect(updates[0].recipient._id).toBe(saves[0].recipient._id);
    expect(contacts).toHaveLength(1);
  });
  it('attaches saved draft when edits land during save', async () => {
    let resolve;
    let form = makeForm();
    form.savedSettings = { currency, tax: {}, required_fields: {} };
    const saves = [];
    const chain = action => {
      form = FormReducer(form, action);
      return action;
    };
    let integrated;
    const dispatch = action => {
      if (action.type === TYPES.INVOICE_SAVE) {
        saves.push(action.payload);
        return new Promise(r => {
          resolve = r;
        });
      }
      if (action.type === TYPES.INVOICE_UPDATE) {
        return Promise.resolve(true);
      }
      if (action.type === TYPES.CONTACT_SAVE) {
        return Promise.resolve(true);
      }
      return integrated(action);
    };
    integrated = FormMW({ dispatch, getState: () => ({ form }) })(chain);
    const pending = integrated(Actions.saveFormData('draft'));
    integrated(
      Actions.updateFieldData('note', { content: 'typed during save' })
    );
    resolve(true);
    await pending;
    await integrated(Actions.saveFormData('draft'));
    expect(saves).toHaveLength(1);
  });
  it('sends the database revision on the follow-up update', async () => {
    let resolveSave;
    let form = makeForm();
    form.savedSettings = { currency, tax: {}, required_fields: {} };
    const inv = [];
    const updates = [];
    saveDoc.mockImplementation(
      (_db, doc) =>
        new Promise(resolve => {
          resolveSave = () => {
            inv.length = 0;
            inv.push({ ...doc, _rev: '1-db' });
            resolve(inv);
          };
        })
    );
    updateDoc.mockImplementation(async (_db, doc) => {
      updates.push(doc);
      if (doc._rev !== inv[0]._rev) {
        throw new Error('Document update conflict');
      }
      inv[0] = { ...doc, _rev: '2-db' };
      return inv;
    });
    const chain = action => {
      form = FormReducer(form, action);
      return action;
    };
    let formMw;
    const dispatch = action =>
      action.type === TYPES.CONTACT_SAVE
        ? Promise.resolve(true)
        : formMw(action);
    const invoiceMw = InvoicesMW({ dispatch, getState: () => ({ form }) })(
      chain
    );
    formMw = FormMW({ dispatch, getState: () => ({ form }) })(invoiceMw);
    const pending = dispatch(Actions.saveFormData('draft'));
    dispatch(Actions.updateFieldData('note', { content: 'new work' }));
    form.settings.required_fields.note = true;
    resolveSave();
    await pending;
    await dispatch(Actions.saveFormData('draft'));
    expect(updates).toHaveLength(1);
    expect(updates[0]._rev).toBe('1-db');
    expect(updates[0]._id).toBe(inv[0]._id);
  });

  function stackWithForm(initialForm) {
    let form = initialForm;
    const chain = action => {
      form = FormReducer(form, action);
      return action;
    };
    let formMw;
    const dispatch = action => {
      if (action.type === TYPES.CONTACT_SAVE) {
        return Promise.resolve(true);
      }
      return formMw(action);
    };
    const invoiceMw = InvoicesMW({ dispatch, getState: () => ({ form }) })(
      chain
    );
    formMw = FormMW({ dispatch, getState: () => ({ form }) })(invoiceMw);
    return {
      dispatch,
      get form() {
        return form;
      },
    };
  }

  it('does not attach a late save after new from client replaces the form', async () => {
    dialog.confirm.mockResolvedValue(true);
    let finishUpdate;
    const updates = [];
    const creates = [];
    updateDoc.mockImplementation((_db, doc) => {
      updates.push({ ...doc });
      return new Promise(resolve => {
        finishUpdate = () => resolve([{ ...doc, _rev: '2-old' }]);
      });
    });
    saveDoc.mockImplementation(async (_db, doc) => {
      creates.push({ ...doc });
      return [{ ...doc, _rev: '1-new' }];
    });
    let form = makeForm();
    form.settings.editMode = {
      active: true,
      data: { _id: 'old-invoice', _rev: '1-old', status: 'draft' },
    };
    form.savedSettings = { currency, tax: {}, required_fields: {} };
    const stack = stackWithForm(form);
    const { dispatch } = stack;
    const pending = dispatch(Actions.saveFormData('draft'));
    await dispatch(
      InvoiceActions.newInvoiceFromContact({
        _id: 'client-new',
        fullname: 'New client',
      })
    );
    dispatch(
      Actions.updateItem({
        id: stack.form.rows[0].id,
        description: 'Replacement work',
        price: 5,
        quantity: 1,
        subtotal: 5,
      })
    );
    finishUpdate();
    await pending;
    expect(stack.form.settings.editMode.active).toBe(false);
    await dispatch(Actions.saveFormData('draft'));
    expect(updates).toHaveLength(1);
    expect(updates[0]._id).toBe('old-invoice');
    expect(updates[0].rows[0].description).toBe('Work');
    expect(creates).toHaveLength(1);
    expect(creates[0]._id).not.toBe('old-invoice');
    expect(creates[0].rows[0].description).toBe('Replacement work');
  });

  it('does not attach a late save after duplicate replaces the form', async () => {
    dialog.confirm.mockResolvedValue(true);
    getAllDocs.mockResolvedValue([]);
    let finishUpdate;
    const updates = [];
    const creates = [];
    updateDoc.mockImplementation((_db, doc) => {
      updates.push({ ...doc });
      return new Promise(resolve => {
        finishUpdate = () => resolve([{ ...doc, _rev: '2-old' }]);
      });
    });
    saveDoc.mockImplementation(async (_db, doc) => {
      creates.push({ ...doc });
      return [{ ...doc, _rev: '1-new' }];
    });
    let form = makeForm();
    form.settings.editMode = {
      active: true,
      data: { _id: 'old-invoice', _rev: '1-old', status: 'draft' },
    };
    form.savedSettings = { currency, tax: {}, required_fields: {} };
    const stack = stackWithForm(form);
    const { dispatch } = stack;
    const pending = dispatch(Actions.saveFormData('draft'));
    await dispatch({
      type: ACTION_TYPES.FORM_LOAD_DUPLICATE,
      payload: {
        recipient: { fullname: 'Copy', email: 'copy@example.com' },
        rows: [
          {
            id: 'dup-row',
            description: 'Duplicate work',
            price: 5,
            quantity: 1,
            subtotal: 5,
          },
        ],
        currency,
        contacts: [],
      },
    });
    expect(stack.form.settings.editMode.active).toBe(false);
    finishUpdate();
    await pending;
    expect(stack.form.settings.editMode.active).toBe(false);
    dispatch(
      Actions.updateItem({
        id: stack.form.rows[0].id,
        description: 'Changed duplicate row',
        price: 5,
        quantity: 1,
        subtotal: 5,
      })
    );
    await dispatch(Actions.saveFormData('draft'));
    expect(updates).toHaveLength(1);
    expect(updates[0]._id).toBe('old-invoice');
    expect(creates).toHaveLength(1);
    expect(
      creates[0].rows.some(r => r.description === 'Changed duplicate row')
    ).toBe(true);
    expect(updates[0].rows[0].description).toBe('Work');
  });

  it('waits for numbering advance before import snapshot during form save', async () => {
    getAllDocs.mockResolvedValue([]);
    const settingsStore = {
      invoice: {
        numbering: { prefix: 'INV-', next: 5, padding: 4 },
        currency,
      },
      profile: {},
      general: { language: 'en', theme: 'system', sound: 'default' },
    };
    window.manta.settings.get.mockImplementation(key => {
      if (key === 'invoice.numbering') {
        return settingsStore.invoice.numbering;
      }
      if (key === 'invoice.currency') {
        return settingsStore.invoice.currency;
      }
      if (key === 'invoice') {
        return settingsStore.invoice;
      }
      if (key === 'profile') {
        return settingsStore.profile;
      }
      if (key === 'general') {
        return settingsStore.general;
      }
      return settingsStore.invoice.currency;
    });
    window.manta.settings.set.mockImplementation((key, value) => {
      if (key === 'invoice.numbering') {
        settingsStore.invoice.numbering = value;
      }
    });

    let resolveSaveDoc;
    saveDoc.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveSaveDoc = () => resolve([{ _id: 'inv-5', _rev: '1-db' }]);
        })
    );

    const stack = stackWithForm({ ...makeForm(), invoiceID: 'INV-0005' });
    const savePromise = stack.dispatch(Actions.saveFormData('final'));

    await vi.waitFor(() => expect(saveDoc).toHaveBeenCalled());

    const { collectBackup } = await import('../../helpers/backupFlow');
    const { withImportWriteLock } =
      await import('../../helpers/importWriteLock');

    let snapshotNext;
    const importPromise = withImportWriteLock(async () => {
      const backup = await collectBackup({
        get: key => window.manta.settings.get(key),
      });
      snapshotNext = backup.settings.invoice.numbering.next;
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(settingsStore.invoice.numbering.next).toBe(5);

    resolveSaveDoc();
    await savePromise;
    await importPromise;

    expect(settingsStore.invoice.numbering.next).toBe(6);
    expect(snapshotNext).toBe(6);
  });

  it('does not save when the total is below the amount already paid', async () => {
    form.settings.editMode = {
      active: true,
      data: {
        _id: 'paid-inv',
        status: 'pending',
        grandTotal: 100,
        currency,
        payments: [{ id: 'p1', date: 1, amount: 60, method: 'cash', note: '' }],
        rows: form.rows,
        recipient: { fullname: 'Jane', email: 'jane@example.com' },
      },
    };
    form.rows = [
      { id: '1', description: 'Work', price: 10, quantity: 4, subtotal: 40 },
    ];
    const result = await middleware(Actions.saveFormData());
    expect(result).toBe(false);
    expect(
      dispatch.mock.calls.some(
        ([action]) => action.type === TYPES.INVOICE_UPDATE
      )
    ).toBe(false);
  });

  it('blocks SAVED_FORM_SETTING_UPDATE while import lock is held', async () => {
    const { withImportWriteLock } =
      await import('../../helpers/importWriteLock');
    await withImportWriteLock(async () => {
      await middleware({
        type: ACTION_TYPES.SAVED_FORM_SETTING_UPDATE,
        payload: {
          setting: 'tax',
          data: { amount: 99, method: 'default', tin: '' },
        },
      });
    });
    expect(window.manta.settings.set).not.toHaveBeenCalled();
    expect(
      dispatch.mock.calls.some(
        ([action]) =>
          action.type === ACTION_TYPES.UI_NOTIFICATION_NEW &&
          action.payload?.type === 'success'
      )
    ).toBe(false);
  });
});
