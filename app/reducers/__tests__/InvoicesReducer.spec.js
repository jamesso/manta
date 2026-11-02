import InvoicesReducer, {
  getInvoices,
  getOverdueCount,
} from '../InvoicesReducer';
import * as ACTION_TYPES from '../../constants/actions.jsx';
import { faker } from '@faker-js/faker';
const initialState = [];

describe('Invoices Reducer', () => {
  it('should handle initial state', () => {
    expect(InvoicesReducer(undefined, {})).toEqual([]);
  });

  let docs;
  beforeEach(() => {
    docs = [
      { id: crypto.randomUUID(), name: faker.person.fullName() },
      { id: crypto.randomUUID(), name: faker.person.fullName() },
      { id: crypto.randomUUID(), name: faker.person.fullName() },
    ];
  });

  it('should handle get all invoices', () => {
    expect(
      InvoicesReducer(initialState, {
        type: ACTION_TYPES.INVOICE_GET_ALL,
        payload: docs,
      })
    ).toEqual(docs);
  });

  it('should handle save invoice', () => {
    expect(
      InvoicesReducer(initialState, {
        type: ACTION_TYPES.INVOICE_SAVE,
        payload: docs,
      })
    ).toEqual(docs);
  });

  it('should handle get delete invoice', () => {
    expect(
      InvoicesReducer(initialState, {
        type: ACTION_TYPES.INVOICE_DELETE,
        payload: docs,
      })
    ).toEqual(docs);
  });

  it('should handle restore invoices', () => {
    expect(
      InvoicesReducer(initialState, {
        type: ACTION_TYPES.INVOICE_RESTORE,
        payload: docs,
      })
    ).toEqual(docs);
  });
});

// Test Selectors
const state = {
  invoices: initialState,
};

describe('Invoices Selector', () => {
  it('should return invoices list', () => {
    expect(getInvoices(state)).toEqual(state.invoices);
  });

  it('getOverdueCount counts pending past-due only', () => {
    const now = Date.UTC(2026, 0, 15);
    const invoices = [
      { _id: 'd', status: 'draft' },
      { _id: 'p', status: 'paid' },
      {
        _id: 'f',
        status: 'pending',
        dueDate: {
          useCustom: true,
          selectedDate: { years: 2026, months: 0, date: 20 },
        },
      },
      {
        _id: 'o',
        status: 'pending',
        dueDate: {
          useCustom: true,
          selectedDate: { years: 2026, months: 0, date: 1 },
        },
      },
    ];
    expect(getOverdueCount({ invoices }, now)).toBe(1);
  });
});
