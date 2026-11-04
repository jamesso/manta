// Actions Verbs
import * as ACTION_TYPES from '../constants/actions.jsx';
// Libs
import { handleActions, combineActions } from 'redux-actions';
import { createSelector } from 'reselect';
const appConfig = window.manta.settings;
const rawInvoiceSettings = appConfig.get('invoice');
const invoiceSettings =
  typeof rawInvoiceSettings === 'object' && rawInvoiceSettings !== null
    ? rawInvoiceSettings
    : { currency: {}, tax: {}, required_fields: {}, numbering: {} };
// Helper
import {
  setEditRecipient,
  editorTaxModeFromDoc,
  requiredTaxFieldFromDoc,
} from '../helpers/form';
import {
  formatInvoiceNumber,
  normalizeNumbering,
  numberingKeyFor,
  defaultNumberingFor,
  resolveStoredNumbering,
  suggestedInvoiceNumberFromReconciled,
} from '../helpers/numbering';
import { getDocType } from '../helpers/docType';
import { getIssuedAt } from '../helpers/invoice';

function invoiceNumberForState(state) {
  const docType = state.docType || 'invoice';
  const key = numberingKeyFor(docType);
  return suggestedInvoiceNumberFromReconciled(
    state.reconciledNumbering,
    appConfig.get(`invoice.${key}`),
    state.numberingInvoices,
    state.invoiceID
  );
}

function syncNumberingInvoices(state, invoices) {
  const next = Object.assign({}, state, { numberingInvoices: invoices });
  if (!state.settings.editMode.active) {
    next.invoiceID = invoiceNumberForState(next);
  }
  return next;
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
    invoiceSettings.numbering,
    null
  ),
  issuedAt: null,
  errors: {},
  errorMode: null,
  savePending: false,
  formRevision: 0,
  // formRevision when a saved document or template was loaded.
  cleanRevision: 0,
  formGeneration: 0,
  reconciledNumbering: null,
  numberingInvoices: null,
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
  taxMode: 'line',
  docType: 'invoice',
  validUntil: null,
  sourceEstimateId: null,
  creditedInvoiceId: null,
  creditedInvoice: null,
  seller: null,
  templateTarget: null,
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
    tax: requiredTaxFieldFromDoc(payload),
    dueDate: dueDate !== undefined,
    discount: discount !== undefined,
    note: note !== undefined,
  };
  let next = Object.assign({}, state, {
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
    taxMode: editorTaxModeFromDoc(payload),
    docType: getDocType(payload),
    validUntil: payload.validUntil ?? null,
    sourceEstimateId: payload.sourceEstimateId ?? null,
    creditedInvoiceId: payload.creditedInvoiceId ?? null,
    creditedInvoice: payload.creditedInvoice ?? null,
    seller: payload.seller ?? null,
  });
  if (getDocType(payload) === 'creditNote' && payload.recipient) {
    next = Object.assign({}, next, {
      recipient: {
        newRecipient: false,
        select: payload.recipient,
        new: {},
      },
      dueDate: initialState.dueDate,
      settings: Object.assign({}, next.settings, {
        required_fields: Object.assign({}, next.settings.required_fields, {
          dueDate: false,
        }),
      }),
    });
  }
  return next;
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
  let next = Object.assign({}, state, {
    recipient: Object.assign(
      {},
      state.recipient,
      setEditRecipient(contacts, recipient)
    ),
    rows: (rows ?? []).map(row => ({ ...row })),
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
        tax: requiredTaxFieldFromDoc(payload),
        dueDate: dueDate !== undefined,
        discount: discount !== undefined,
        note: note !== undefined,
      }),
    }),
    taxMode: editorTaxModeFromDoc(payload),
    docType: getDocType(payload),
    validUntil: payload.validUntil ?? null,
    sourceEstimateId: payload.sourceEstimateId ?? null,
    creditedInvoiceId: payload.creditedInvoiceId ?? null,
    creditedInvoice: payload.creditedInvoice ?? null,
    seller: payload.seller ?? null,
  });
  if (getDocType(payload) === 'creditNote' && payload.recipient) {
    next = Object.assign({}, next, {
      recipient: {
        newRecipient: false,
        select: payload.recipient,
        new: {},
      },
    });
  }
  return next;
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
        formGeneration: (state.formGeneration || 0) + 1,
        settings: Object.assign({}, populated.settings, {
          editMode: {
            active: true,
            data: action.payload,
          },
        }),
      });
    },

    [ACTION_TYPES.FORM_LOAD_DUPLICATE]: (state, action) =>
      Object.assign({}, populateFromDuplicate(state, action.payload), {
        formGeneration: (state.formGeneration || 0) + 1,
      }),

    [ACTION_TYPES.FORM_LOAD_TEMPLATE]: (state, action) => {
      const { template, profileId, contacts } = action.payload;
      const populated = populateFromInvoice(state, {
        ...template,
        contacts,
      });
      const dueDate = template.dueDate ?? {
        useCustom: false,
        paymentTerm: 'net30',
        selectedDate: null,
      };
      return Object.assign({}, populated, {
        invoiceID: '',
        issuedAt: null,
        dueDate,
        templateTarget: { profileId },
        formGeneration: (state.formGeneration || 0) + 1,
        settings: Object.assign({}, populated.settings, {
          editMode: { active: false },
          required_fields: Object.assign(
            {},
            populated.settings.required_fields,
            {
              invoiceID: false,
              dueDate: template.dueDate != null,
            }
          ),
        }),
      });
    },

    [ACTION_TYPES.FORM_RECONCILE_NUMBERING]: (state, action) =>
      Object.assign({}, state, {
        reconciledNumbering: action.payload,
        invoiceID: state.settings.editMode.active
          ? state.invoiceID
          : invoiceNumberForState({
              ...state,
              reconciledNumbering: action.payload,
            }),
      }),

    [combineActions(ACTION_TYPES.INVOICE_GET_ALL, ACTION_TYPES.INVOICE_UPDATE)]:
      (state, action) => syncNumberingInvoices(state, action.payload),

    [ACTION_TYPES.FORM_CLEAR_RECONCILED_NUMBERING]: state =>
      Object.assign({}, state, {
        reconciledNumbering: null,
        invoiceID: state.settings.editMode.active
          ? state.invoiceID
          : invoiceNumberForState({ ...state, reconciledNumbering: null }),
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

    [ACTION_TYPES.FORM_EDIT_DATA_SYNC]: (state, action) => {
      const { editMode } = state.settings;
      if (!editMode.active || editMode.data._id !== action.payload._id) {
        return state;
      }
      return Object.assign({}, state, {
        settings: Object.assign({}, state.settings, {
          editMode: Object.assign({}, editMode, {
            data: action.payload,
          }),
        }),
      });
    },

    [ACTION_TYPES.FORM_SET_ERRORS]: (state, action) =>
      Object.assign({}, state, {
        errors: action.payload.errors,
        errorMode: action.payload.mode,
      }),

    [ACTION_TYPES.FORM_SET_DOC_TYPE]: (state, action) => {
      if (state.settings.editMode.active) {
        return state;
      }
      const nextType = action.payload;
      if (nextType === state.docType) {
        return state;
      }
      return Object.assign({}, state, {
        docType: nextType,
        validUntil: null,
        sourceEstimateId: null,
        errors: {},
        errorMode: null,
        invoiceID: invoiceNumberForState({ ...state, docType: nextType }),
      });
    },

    [ACTION_TYPES.FORM_MARK_CLEAN]: state =>
      Object.assign({}, state, { cleanRevision: state.formRevision }),

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

    [ACTION_TYPES.FORM_TAX_MODE_SET]: (state, action) =>
      withRevision(
        Object.assign({}, state, {
          taxMode: action.payload,
        })
      ),

    [ACTION_TYPES.FORM_CLEAR]: state =>
      Object.assign({}, initialState, {
        docType: state.docType,
        currency: state.savedSettings.currency,
        tax: state.savedSettings.tax,
        invoiceID: invoiceNumberForState(state),
        reconciledNumbering: state.reconciledNumbering,
        formGeneration: (state.formGeneration || 0) + 1,
        taxMode: 'line',
        validUntil: null,
        sourceEstimateId: null,
        creditedInvoiceId: null,
        creditedInvoice: null,
        seller: null,
        templateTarget: null,
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
