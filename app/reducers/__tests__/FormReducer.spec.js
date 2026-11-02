import FormReducer, {
  getCurrentInvoice,
  getRows,
  getRecipient,
} from '../FormReducer';
import * as ACTION_TYPES from '../../constants/actions.jsx';
import currencies from '../../../libs/currencies.json';

import { faker } from '@faker-js/faker';
import { pick } from 'lodash';

describe('Form Reducer should handle', () => {
  let currentState;
  beforeEach(() => {
    currentState = {
      rows: [
        { id: 'Jon Snow' },
        { id: 'Daenerys Targaryen' },
        { id: 'Tyrion Lannister' },
        { id: 'Arya Stark' },
      ],
      dueDate: {
        selectedDate: null,
        paymentTerm: null,
        useCustom: true,
      },
      note: {},
      currency: {
        code: 'USD',
        fraction: 2,
        placement: 'before',
        separator: 'commaDot',
      },
      discount: {},
      tax: {},
      settings: {
        open: true,
        required_fields: {},
      },
      savedSettings: {
        tax: {},
        currency: {
          code: 'USD',
          fraction: 2,
          placement: 'before',
          separator: 'commaDot',
        },
        required_fields: {},
      },
    };
  });

  it('adding a row item', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_ITEM_ADD,
    });
    expect(newState.rows).toHaveLength(5);
  });

  it('remove a row item', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_ITEM_REMOVE,
      payload: 'Arya Stark',
    });
    expect(newState.rows).toHaveLength(3);
  });

  it('update a row item', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_ITEM_UPDATE,
      payload: {
        id: 'Tyrion Lannister',
        description: 'The Lannisters always pay their debts',
      },
    });
    expect(newState.rows[2].description).toEqual(
      'The Lannisters always pay their debts'
    );
  });

  it('drag row item', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_ITEM_MOVE,
      payload: {
        dragIndex: 2,
        hoverIndex: 3,
      },
    });
    expect(newState.rows).toHaveLength(4);
    expect(newState.rows).toEqual([
      { id: 'Jon Snow' },
      { id: 'Daenerys Targaryen' },
      { id: 'Arya Stark' },
      { id: 'Tyrion Lannister' },
    ]);
  });

  it('clear the form', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_CLEAR,
    });
    expect(newState.recipient).toEqual({
      newRecipient: true,
      select: {},
      new: {},
    });
    expect(newState.rows).toHaveLength(0);
    expect(newState.dueDate).toEqual({
      selectedDate: null,
      paymentTerm: null,
      useCustom: true,
    });
    expect(newState.note).toEqual({});
    expect(newState.currency).toEqual({
      code: 'USD',
      fraction: 2,
      placement: 'before',
      separator: 'commaDot',
    });
    expect(newState.discount).toEqual({});
    expect(newState.tax).toEqual({});
    expect(newState.settings.open).toEqual(false);
  });

  it('toggle the form settings', () => {
    const newState1 = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_SETTING_TOGGLE,
    });
    expect(newState1.settings.open).toEqual(false);
    const newState2 = FormReducer(newState1, {
      type: ACTION_TYPES.FORM_SETTING_TOGGLE,
    });
    expect(newState2.settings.open).toEqual(true);
  });

  it('close the form settings', () => {
    // Close It
    const newState1 = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_SETTING_CLOSE,
    });
    expect(newState1.settings.open).toEqual(false);
    // Close Again
    const newState2 = FormReducer(newState1, {
      type: ACTION_TYPES.FORM_SETTING_CLOSE,
    });
    expect(newState2.settings.open).toEqual(false);
  });
});

describe('Form Reducer should handle toggle', () => {
  let currentState;
  beforeEach(() => {
    currentState = {
      dueDate: {},
      currency: {},
      discount: {},
      tax: {},
      note: {},
      settings: {
        required_fields: {
          dueDate: false,
          currency: false,
          discount: false,
          tax: false,
          note: false,
        },
      },
    };
  });

  it('currency field', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_TOGGLE,
      payload: 'currency',
    });
    expect(newState.settings.required_fields.currency).toBe(true);
  });

  it('dueDate field', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_TOGGLE,
      payload: 'dueDate',
    });
    expect(newState.settings.required_fields.dueDate).toBe(true);
  });

  it('discount field', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_TOGGLE,
      payload: 'discount',
    });
    expect(newState.settings.required_fields.discount).toBe(true);
  });

  it('note field', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_TOGGLE,
      payload: 'note',
    });
    expect(newState.settings.required_fields.note).toBe(true);
  });

  it('tax field', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_TOGGLE,
      payload: 'tax',
    });
    expect(newState.settings.required_fields.tax).toBe(true);
  });
});

describe('Form Reducer should handle update', () => {
  let currentState;
  beforeEach(() => {
    currentState = {
      dueDate: { required: true },
      currency: { required: true },
      discount: { required: true },
      tax: { required: true },
      note: { required: true },
    };
  });

  it('recipient data', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_RECIPIENT_UPDATE,
      payload: {
        newRecipient: false,
        select: {
          fullname: 'Jon Snow',
          company: 'HBO',
          email: 'jon@snow.got',
          phone: '000000000',
        },
        new: {},
      },
    });
    expect(newState.recipient.newRecipient).toBe(false);
    expect(newState.recipient.select).toEqual({
      fullname: 'Jon Snow',
      company: 'HBO',
      email: 'jon@snow.got',
      phone: '000000000',
    });
    expect(newState.recipient.select).not.toEqual({
      fullname: 'Dany',
      company: 'HBO',
      email: 'mother@dragons.got',
      phone: '111111111',
    });
  });

  it('currency data', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_UPDATE_DATA,
      payload: {
        field: 'currency',
        data: {
          selectedCurrency: {
            symbol: '$',
            name: 'US Dollar',
            symbol_native: '$',
            decimal_digits: 2,
            rounding: 0,
            code: 'USD',
            name_plural: 'US dollars',
          },
        },
      },
    });
    expect(newState.currency.selectedCurrency.code).not.toEqual('VND');
    expect(newState.currency.selectedCurrency.code).toEqual('USD');
  });

  it('dueDate data', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_UPDATE_DATA,
      payload: {
        field: 'dueDate',
        data: {
          selectedDate: '28/07/1988',
        },
      },
    });
    expect(newState.dueDate.selectedDate).toEqual('28/07/1988');
  });

  it('discount data', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_UPDATE_DATA,
      payload: {
        field: 'discount',
        data: {
          type: 'percentage',
          amount: 10,
        },
      },
    });
    expect(newState.discount.type).toEqual('percentage');
    expect(newState.discount.type).not.toEqual('flat');
    expect(newState.discount.amount).toEqual(10);
    expect(newState.discount.amount).not.toEqual(5);
  });

  it('tax data', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_UPDATE_DATA,
      payload: {
        field: 'tax',
        data: {
          amount: 5,
        },
      },
    });
    expect(newState.tax.amount).toEqual(5);
    expect(newState.tax.amount).not.toEqual(10);
  });

  it('note data', () => {
    const newState = FormReducer(currentState, {
      type: ACTION_TYPES.FORM_FIELD_UPDATE_DATA,
      payload: {
        field: 'note',
        data: {
          content: 'You know nothing, Jon Snow',
        },
      },
    });
    expect(newState.note.content).toEqual('You know nothing, Jon Snow');
    expect(newState.note.content).not.toEqual(
      'The Lannisters always pay their debts'
    );
  });
});

describe('Form Reducer should handle Invoice Edit', () => {
  let currentState, invoiceData, newState;
  beforeEach(() => {
    currentState = {
      recipient: {
        newRecipient: true,
        select: {},
        new: {},
      },
      rows: [],
      dueDate: {},
      discount: {},
      note: {},
      currency: {
        code: 'USD',
        decimal_digits: 2,
        name: 'US Dollar',
        name_plural: 'US dollars',
        rounding: 0,
        symbol: '$',
        symbol_native: '$',
      },
      tax: {
        amount: 10,
        method: 'default',
        tin: '123-456-789',
      },
      settings: {
        open: false,
        editMode: {
          active: false,
        },
        required_fields: {
          dueDate: false,
          currency: false,
          discount: false,
          tax: false,
          note: false,
        },
      },
      savedSettings: {
        currency: 'VND',
      },
    };

    invoiceData = {
      contacts: [
        {
          _id: 'first-contact',
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
          company: faker.company.name(),
          phone: faker.phone.number(),
        },
        {
          _id: 'second-contact',
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
          company: faker.company.name(),
          phone: faker.phone.number(),
        },
        {
          _id: 'third-contact',
          fullname: faker.person.fullName(),
          email: faker.internet.email(),
          company: faker.company.name(),
          phone: faker.phone.number(),
        },
      ],
      recipient: {
        _id: 'random-string',
        fullname: faker.person.fullName(),
        email: faker.internet.email(),
        company: faker.company.name(),
        phone: faker.phone.number(),
      },
      rows: [
        {
          id: '16bf1a07-71e6-4be4-8a18-d89a715bd191',
          description: 'iPhone X',
          price: 999,
          quantity: 1,
          subtotal: 999,
        },
      ],
      currency: {
        code: 'USD',
        decimal_digits: 2,
        name: 'US Dollar',
        name_plural: 'US dollars',
        rounding: 0,
        symbol: '$',
        symbol_native: '$',
      },
      tax: {
        amount: 5,
        method: 'reverse-charge',
        tin: '555-444-333',
      },
      dueDate: {
        date: 1,
        hours: 12,
        milliseconds: 0,
        minutes: 0,
        months: 1,
        seconds: 0,
        years: 2018,
      },
      discount: {
        amount: 5,
        type: 'percentage',
      },
      note: 'Thank you!',
    };

    newState = FormReducer(currentState, {
      type: ACTION_TYPES.INVOICE_EDIT,
      payload: invoiceData,
    });
  });

  it('change editMode to true and add editData', () => {
    expect(newState.settings.editMode.active).toEqual(true);
    expect(newState.settings.editMode.data).toEqual(invoiceData);
  });

  it('should populate recipient field data correctly', () => {
    const invoiceData2 = Object.assign({}, invoiceData, {
      recipient: invoiceData.contacts[0],
    });
    const newState2 = FormReducer(currentState, {
      type: ACTION_TYPES.INVOICE_EDIT,
      payload: invoiceData2,
    });
    expect(newState2.recipient.newRecipient).toEqual(false);
    expect(newState2.recipient.select).toEqual(invoiceData2.recipient);
  });

  it('should create a new contact in form if all contacts are deleted', () => {
    expect(newState.recipient.newRecipient).toEqual(true);
    expect(newState.recipient.new).toEqual(
      pick(invoiceData.recipient, ['fullname', 'company', 'phone', 'email'])
    );
  });

  it('should populate other fields data correctly', () => {
    // Rows
    expect(newState.rows.length).toEqual(1);
    expect(newState.rows).toEqual(invoiceData.rows);
    // Tax
    expect(newState.tax).toEqual(invoiceData.tax);
    // Currency
    expect(newState.currency).toEqual(invoiceData.currency);
    // Note
    expect(newState.note.content).toEqual(invoiceData.note);
    // Discount
    expect(newState.discount).toEqual(invoiceData.discount);
    // DueDate
    expect(newState.dueDate).toEqual(invoiceData.dueDate);
  });

  it('toggle optional field if necessary', () => {
    const { required_fields } = newState.settings;
    expect(required_fields.tax).toEqual(invoiceData.tax !== undefined);
    expect(required_fields.dueDate).toEqual(invoiceData.dueDate !== undefined);
    expect(required_fields.discount).toEqual(
      invoiceData.discount !== undefined
    );
    expect(required_fields.note).toEqual(invoiceData.note !== undefined);
  });

  it('should only show currency field if it is different than default', () => {
    const currentCurrencyCode = newState.currency.code;
    const savedCurrencyCode = newState.savedSettings.currency;
    expect(newState.settings.required_fields.currency).toEqual(
      currentCurrencyCode !== savedCurrencyCode
    );
  });
});

describe('Form Reducer should handle update Settings', () => {
  let currentState, newState;
  beforeEach(() => {
    currentState = {
      recipient: {
        newRecipient: true,
        select: {},
        new: {},
      },
      rows: [],
      savedSettings: {
        tax: {
          amount: 10,
          method: 'default',
          tin: '123-456-789',
        },
        currency: 'USD',
        required_fields: {
          dueDate: false,
          currency: false,
          discount: false,
          tax: false,
          note: false,
        },
      },
    };
    newState = FormReducer(currentState, {
      type: ACTION_TYPES.SAVED_FORM_SETTING_UPDATE,
      payload: {
        tax: {
          amount: 5,
          method: 'reverse',
          tin: '111-111-111',
        },
        currency: 'VND',
        required_fields: {
          dueDate: true,
          currency: true,
          discount: true,
          tax: true,
          note: true,
        },
      },
    });
  });

  it('should save default tax value', () => {
    expect(newState.savedSettings.tax).toEqual({
      amount: 5,
      method: 'reverse',
      tin: '111-111-111',
    });
  });

  it('should save default currency value', () => {
    expect(newState.savedSettings.currency).toEqual('VND');
  });

  it('should save default visibility value', () => {
    expect(newState.savedSettings.required_fields).toEqual({
      dueDate: true,
      currency: true,
      discount: true,
      tax: true,
      note: true,
    });
  });
});

describe('plan 015 form reducer behavior', () => {
  const baseState = FormReducer(undefined, { type: '@@INIT' });

  it('FORM_ITEM_MOVE does not mutate the previous rows array', () => {
    const state = FormReducer(baseState, {
      type: ACTION_TYPES.FORM_ITEM_ADD,
      payload: { id: 'a' },
    });
    const withTwo = FormReducer(state, {
      type: ACTION_TYPES.FORM_ITEM_ADD,
      payload: { id: 'b' },
    });
    const priorRows = withTwo.rows;
    const next = FormReducer(withTwo, {
      type: ACTION_TYPES.FORM_ITEM_MOVE,
      payload: { dragIndex: 0, hoverIndex: 1 },
    });
    expect(next.rows).not.toBe(priorRows);
    expect(priorRows.length).toBe(2);
  });

  it('INVOICE_EDIT sets issuedAt from created_at for legacy invoices', () => {
    const created = Date.UTC(2020, 0, 15);
    const next = FormReducer(baseState, {
      type: ACTION_TYPES.INVOICE_EDIT,
      payload: {
        created_at: created,
        recipient: { fullname: 'A', email: 'a@b.com', _id: 'c1' },
        rows: [],
        contacts: [],
      },
    });
    expect(next.issuedAt).toBe(created);
  });

  it('FORM_LOAD_DUPLICATE clears edit mode and suggested invoiceID', () => {
    const editState = FormReducer(baseState, {
      type: ACTION_TYPES.INVOICE_EDIT,
      payload: {
        invoiceID: 'OLD-1',
        created_at: Date.now(),
        recipient: { fullname: 'A', email: 'a@b.com', _id: 'c1' },
        rows: [],
        contacts: [],
      },
    });
    const next = FormReducer(editState, {
      type: ACTION_TYPES.FORM_LOAD_DUPLICATE,
      payload: {
        invoiceID: 'OLD-1',
        recipient: { fullname: 'A', email: 'a@b.com', _id: 'c1' },
        rows: [],
        contacts: [],
      },
    });
    expect(next.settings.editMode.active).toBe(false);
    expect(next.invoiceID).toMatch(/^INV-/);
    expect(next.invoiceID).not.toBe('OLD-1');
  });

  it('FORM_LOAD_DUPLICATE keeps optional fields when defaults hide them', () => {
    const currency = { code: 'USD', fraction: 2 };
    const withHidden = Object.assign({}, baseState, {
      savedSettings: Object.assign({}, baseState.savedSettings, {
        required_fields: {},
      }),
    });
    const next = FormReducer(withHidden, {
      type: ACTION_TYPES.FORM_LOAD_DUPLICATE,
      payload: {
        recipient: { fullname: 'A', email: 'a@b.com', _id: 'c1' },
        rows: [
          {
            id: '1',
            description: 'Work',
            price: 10,
            quantity: 1,
            subtotal: 10,
          },
        ],
        contacts: [],
        currency,
        discount: { type: 'flat', amount: 5 },
        tax: { method: 'default', amount: 10 },
        note: 'Keep me',
        dueDate: { useCustom: false, paymentTerm: 'net30' },
      },
    });
    expect(next.settings.required_fields).toMatchObject({
      discount: true,
      tax: true,
      note: true,
      dueDate: true,
      currency: true,
    });
    expect(next.discount).toEqual({ type: 'flat', amount: 5 });
    expect(next.note).toEqual({ content: 'Keep me' });
  });

  it('FORM_CLEAR and FORM_LOAD_DUPLICATE increment formGeneration', () => {
    const cleared = FormReducer(
      Object.assign({}, baseState, { formGeneration: 2 }),
      { type: ACTION_TYPES.FORM_CLEAR }
    );
    expect(cleared.formGeneration).toBe(3);
    const duplicated = FormReducer(cleared, {
      type: ACTION_TYPES.FORM_LOAD_DUPLICATE,
      payload: {
        recipient: { fullname: 'A', email: 'a@b.com', _id: 'c1' },
        rows: [],
        contacts: [],
      },
    });
    expect(duplicated.formGeneration).toBe(4);
  });

  it('FORM_SET_ERRORS and FORM_CLEAR reset errors', () => {
    const withErrors = FormReducer(baseState, {
      type: ACTION_TYPES.FORM_SET_ERRORS,
      payload: { errors: { invoiceID: 'x' }, mode: 'final' },
    });
    expect(withErrors.errors.invoiceID).toBe('x');
    const cleared = FormReducer(withErrors, { type: ACTION_TYPES.FORM_CLEAR });
    expect(cleared.errors).toEqual({});
    expect(cleared.errorMode).toBeNull();
  });

  it('FORM_EDIT_DATA_SYNC replaces edit data when ids match', () => {
    const withEdit = FormReducer(
      Object.assign({}, baseState, {
        settings: Object.assign({}, baseState.settings, {
          editMode: { active: true, data: { _id: 'a', _rev: '1' } },
        }),
      }),
      {
        type: ACTION_TYPES.FORM_EDIT_DATA_SYNC,
        payload: { _id: 'a', _rev: '2', status: 'pending' },
      }
    );
    expect(withEdit.settings.editMode.data._rev).toBe('2');
    const other = FormReducer(withEdit, {
      type: ACTION_TYPES.FORM_EDIT_DATA_SYNC,
      payload: { _id: 'b', _rev: '3' },
    });
    expect(other.settings.editMode.data._rev).toBe('2');
  });
});

// Test Selectors
const state = {
  form: {
    rows: [],
    recipient: {},
  },
};

describe('Form Selectors', () => {
  it('getRows should return form rows', () => {
    expect(getRows(state)).toEqual(state.form.rows);
  });
  it('getRecipient should return form recipient', () => {
    expect(getRecipient(state)).toEqual(state.form.recipient);
  });
  it('getCurrentInvoice should return form state', () => {
    expect(getCurrentInvoice(state)).toEqual(state.form);
  });
});
