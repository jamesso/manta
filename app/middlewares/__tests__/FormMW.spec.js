import * as Actions from '../../actions/form';
import * as TYPES from '../../constants/actions';
import FormMW from '../FormMW';
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
});
