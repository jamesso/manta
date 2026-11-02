// Actions Verbs
import * as ACTION_TYPES from '../constants/actions.jsx';
// Libs
import { handleActions } from 'redux-actions';
import { createSelector } from 'reselect';
const appConfig = window.manta.settings;
const rawInvoiceSettings = appConfig.get('invoice');
const invoiceSettings =
  typeof rawInvoiceSettings === 'object' && rawInvoiceSettings !== null
    ? rawInvoiceSettings
    : { currency: {}, tax: {}, required_fields: {}, numbering: {} };
// Helper
import { setEditRecipient } from '../helpers/form';
import { getIssuedAt } from '../helpers/invoice';
import {
  formatInvoiceNumber,
  normalizeNumbering,
  resolveStoredNumbering,
  suggestedInvoiceNumberFromReconciled,
} from '../helpers/numbering';

function invoiceNumberForState(state) {
  return suggestedInvoiceNumberFromReconciled(
    state.reconciledNumbering,
    appConfig.get('invoice.numbering')
  );
}

const initialState = {
  recipient: {
    newRecipient: true,
    select: {},
    new: {},
  },
  rows: [],
  dueDate: {
    selectedDate: null,
    paymentTerm: null,
    useCustom: true,
  },
  discount: {},
  note: {},
  invoiceID: suggestedInvoiceNumberFromReconciled(
    null,
    invoiceSettings.numbering
  ),
  issuedAt: null,
  errors: {},
  errorMode: null,
  savePending: false,
  formRevision: 0,
  reconciledNumbering: null,
  // Set default values for currency and tax
  currency: invoiceSettings.currency,
  tax: invoiceSettings.tax,
  // Form current settings
  settings: {
    open: false,
    editMode: {
      active: false,
    },
    required_fields: invoiceSettings.required_fields,
  },
  // Saved settings, reserve for reference
  savedSettings: {
    tax: invoiceSettings.tax,
    currency: invoiceSettings.currency,
    required_fields: invoiceSettings.required_fields,
  },
};

function populateFromDuplicate(state, payload) {
  const {
    invoiceID,
    recipient,
    rows,
    currency,
    tax,
    dueDate,
    discount,
    note,
    contacts,
  } = payload;
  const required_fields = {
    invoiceID: invoiceID !== undefined,
    currency: currency !== undefined,
    tax: tax !== undefined,
    dueDate: dueDate !== undefined,
    discount: discount !== undefined,
    note: note !== undefined,
  };
  return Object.assign({}, state, {
    recipient: Object.assign(
      {},
      state.recipient,
      setEditRecipient(contacts, recipient)
    ),
    rows: rows.map(row => ({ ...row })),
    invoiceID: invoiceNumberForState(state),
    issuedAt: null,
    currency: currency !== undefined ? currency : state.savedSettings.currency,
    discount: discount !== undefined ? discount : {},
    tax: tax !== undefined ? tax : state.savedSettings.tax,
    dueDate: dueDate !== undefined ? dueDate : initialState.dueDate,
    note: note !== undefined ? { content: note } : { content: '' },
    errors: {},
    errorMode: null,
    settings: Object.assign({}, state.settings, {
      editMode: {
        active: false,
      },
      required_fields,
    }),
  });
}

function populateFromInvoice(state, payload) {
  const {
    invoiceID,
    recipient,
    rows,
    currency,
    tax,
    dueDate,
    discount,
    note,
    contacts,
  } = payload;
  return Object.assign({}, state, {
    recipient: Object.assign(
      {},
      state.recipient,
      setEditRecipient(contacts, recipient)
    ),
    rows: rows.map(row => ({ ...row })),
    invoiceID: invoiceID !== undefined ? invoiceID : state.invoiceID,
    issuedAt: getIssuedAt(payload) ?? null,
    currency: currency !== undefined ? currency : state.currency,
    discount: discount !== undefined ? discount : state.discount,
    tax: tax !== undefined ? tax : state.tax,
    dueDate: dueDate !== undefined ? dueDate : state.dueDate,
    note:
      note !== undefined
        ? Object.assign({}, state.note, {
            content: note,
          })
        : state.note,
    errors: {},
    errorMode: null,
    settings: Object.assign({}, state.settings, {
      required_fields: Object.assign({}, state.settings.required_fields, {
        invoiceID: invoiceID !== undefined,
        currency: currency !== state.savedSettings.currency,
        tax: tax !== undefined,
        dueDate: dueDate !== undefined,
        discount: discount !== undefined,
        note: note !== undefined,
      }),
    }),
  });
}

function withRevision(state) {
  return Object.assign({}, state, {
    formRevision: (state.formRevision || 0) + 1,
  });
}

const FormReducer = handleActions(
  {
    [ACTION_TYPES.FORM_RECIPIENT_UPDATE]: (state, action) =>
      withRevision(
        Object.assign({}, state, {
          recipient: action.payload,
        })
      ),

    [ACTION_TYPES.FORM_ITEM_ADD]: (state, action) =>
      withRevision(
        Object.assign({}, state, {
          rows: [...state.rows, action.payload],
        })
      ),

    [ACTION_TYPES.FORM_ITEM_REMOVE]: (state, action) =>
      withRevision(
        Object.assign({}, state, {
          rows: state.rows.filter(item => item.id !== action.payload),
        })
      ),

    [ACTION_TYPES.FORM_ITEM_UPDATE]: (state, action) =>
      withRevision(
        Object.assign({}, state, {
          rows: state.rows.map(item =>
            item.id !== action.payload.id ? item : action.payload
          ),
        })
      ),

    [ACTION_TYPES.FORM_ITEM_MOVE]: (state, action) => {
      const { dragIndex, hoverIndex } = action.payload;
      const newRows = [...state.rows];
      const dragRow = newRows[dragIndex];
      newRows.splice(dragIndex, 1);
      newRows.splice(hoverIndex, 0, dragRow);
      return withRevision(
        Object.assign({}, state, {
          rows: newRows,
        })
      );
    },

    [ACTION_TYPES.FORM_FIELD_UPDATE_DATA]: (state, action) => {
      const { field, data } = action.payload;
      if (typeof data === 'object') {
        return withRevision(
          Object.assign({}, state, {
            [field]: {
              ...state[field],
              ...data,
            },
          })
        );
      }
      return withRevision(
        Object.assign({}, state, {
          [field]: data,
        })
      );
    },

    [ACTION_TYPES.FORM_FIELD_TOGGLE]: (state, action) =>
      withRevision(
        Object.assign({}, state, {
          settings: Object.assign({}, state.settings, {
            required_fields: Object.assign({}, state.settings.required_fields, {
              [action.payload]: !state.settings.required_fields[action.payload],
            }),
          }),
        })
      ),

    [ACTION_TYPES.FORM_SETTING_TOGGLE]: state =>
      Object.assign({}, state, {
        settings: Object.assign({}, state.settings, {
          open: !state.settings.open,
        }),
      }),

    [ACTION_TYPES.FORM_SETTING_CLOSE]: state =>
      Object.assign({}, state, {
        settings: Object.assign({}, state.settings, {
          open: false,
        }),
      }),

    [ACTION_TYPES.INVOICE_EDIT]: (state, action) => {
      const populated = populateFromInvoice(state, action.payload);
      return Object.assign({}, populated, {
        settings: Object.assign({}, populated.settings, {
          editMode: {
            active: true,
            data: action.payload,
          },
        }),
      });
    },

    [ACTION_TYPES.FORM_LOAD_DUPLICATE]: (state, action) =>
      populateFromDuplicate(state, action.payload),

    [ACTION_TYPES.FORM_RECONCILE_NUMBERING]: (state, action) =>
      Object.assign({}, state, {
        reconciledNumbering: action.payload,
      }),

    [ACTION_TYPES.FORM_CLEAR_RECONCILED_NUMBERING]: state =>
      Object.assign({}, state, {
        reconciledNumbering: null,
      }),

    [ACTION_TYPES.FORM_ATTACH_SAVED_INVOICE]: (state, action) =>
      Object.assign({}, state, {
        settings: Object.assign({}, state.settings, {
          editMode: {
            active: true,
            data: action.payload,
          },
        }),
      }),

    [ACTION_TYPES.FORM_SET_ERRORS]: (state, action) =>
      Object.assign({}, state, {
        errors: action.payload.errors,
        errorMode: action.payload.mode,
      }),

    [ACTION_TYPES.FORM_SAVE_PENDING]: (state, action) =>
      Object.assign({}, state, {
        savePending: Boolean(action.payload),
      }),

    [ACTION_TYPES.SAVED_FORM_SETTING_UPDATE]: (state, action) => {
      const invoiceSettings = action.payload;
      return Object.assign({}, state, {
        savedSettings: Object.assign({}, state.savedSettings, {
          tax: invoiceSettings.tax,
          currency: invoiceSettings.currency,
          required_fields: invoiceSettings.required_fields,
        }),
      });
    },

    [ACTION_TYPES.FORM_CLEAR]: state =>
      Object.assign({}, initialState, {
        currency: state.savedSettings.currency,
        tax: state.savedSettings.tax,
        invoiceID: invoiceNumberForState(state),
        reconciledNumbering: state.reconciledNumbering,
        settings: Object.assign({}, state.settings, {
          open: false,
          editMode: {
            active: false,
          },
          required_fields: state.savedSettings.required_fields,
        }),
        savedSettings: state.savedSettings,
      }),
  },
  initialState
);

export default FormReducer;

// Selector Input
const getFormState = state => state.form;

// Selectors
export const getCurrentInvoice = state => state.form;

export const getRows = createSelector(
  getFormState,
  formState => formState.rows
);

export const getRecipient = createSelector(
  getFormState,
  formState => formState.recipient
);
