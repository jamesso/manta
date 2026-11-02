import * as dialog from '@/lib/dialog';
import { isEmpty, pick, includes } from 'lodash';
import moment from 'moment';

import i18n from '../../i18n/i18n';
import { getCurrencyFraction, getInvoiceTotals, getIssuedAt, isLineTaxInvoice } from './invoice';
import { roundMoney } from './money';
import {
  clearRowTax,
  getSellerTaxIds,
  getTaxRateErrors,
} from './tax';
import { reconcilePaymentStatus } from './payments';

const EMAIL_RE =
  /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

export function isBlankRow(row) {
  const noDesc = !row.description || String(row.description).trim() === '';
  const noPrice = row.price === '' || row.price == null;
  const noQty = row.quantity === '' || row.quantity == null;
  return noDesc && noPrice && noQty;
}

export function parseNumberInput(raw, { integer = false } = {}) {
  if (raw === '' || raw == null || String(raw).trim() === '') {
    return '';
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return '';
  }
  if (integer && !Number.isInteger(n)) {
    return '';
  }
  return n;
}

export function updateRowField(row, name, raw) {
  const next = { ...row };
  if (name === 'description') {
    next.description = raw;
  } else if (name === 'price' || name === 'quantity') {
    next[name] = parseNumberInput(raw, { integer: name === 'quantity' });
  }
  const { price, quantity } = next;
  if (price === '' || quantity === '') {
    next.subtotal = '';
  } else {
    const product = price * quantity;
    next.subtotal = Number.isFinite(product) ? product : Infinity;
  }
  return next;
}

function isDiscountComplete(discount) {
  if (!discount || typeof discount !== 'object') {
    return false;
  }
  const { amount } = discount;
  return (
    amount !== '' &&
    amount != null &&
    amount !== 0 &&
    Number.isFinite(Number(amount))
  );
}

function isTaxComplete(tax) {
  if (!tax || typeof tax !== 'object') {
    return false;
  }
  const { amount } = tax;
  return (
    amount !== '' &&
    amount != null &&
    Number(amount) > 0 &&
    Number.isFinite(Number(amount))
  );
}

function getEffectiveCurrency(form) {
  const appConfig = window.manta.settings;
  const { required_fields } = form.settings;
  if (required_fields.currency) {
    return form.currency;
  }
  return (
    appConfig.get('invoice.currency') ??
    form.savedSettings?.currency ??
    form.currency
  );
}

function isValidCurrencyFraction(fraction) {
  if (fraction === undefined || fraction === '') {
    return true;
  }
  const n = Number(fraction);
  return Number.isInteger(n) && n >= 0 && n <= 20;
}

function recipientHasDraftIdentity(recipient) {
  const data = recipient.newRecipient ? recipient.new : recipient.select;
  if (!data || isEmpty(data)) return false;
  return Boolean(data.fullname || data.company || data.email);
}

function hasDraftContent(form) {
  if (recipientHasDraftIdentity(form.recipient)) return true;
  return form.rows.some(
    row => row.description && String(row.description).trim()
  );
}

export function getRecipientErrors(recipient, mode) {
  if (mode === 'draft') {
    return {};
  }
  if (recipient.newRecipient === true) {
    if (isEmpty(recipient.new)) {
      return { recipient: 'dialog:validation:recipient:empty:message' };
    }
    if (
      recipient.new.fullname === undefined ||
      recipient.new.fullname === '' ||
      recipient.new.email === undefined ||
      recipient.new.email === ''
    ) {
      return {
        'recipient.fullname':
          recipient.new.fullname === '' || recipient.new.fullname === undefined
            ? 'dialog:validation:recipient:requiredFields:message'
            : undefined,
        'recipient.email':
          recipient.new.email === '' || recipient.new.email === undefined
            ? 'dialog:validation:recipient:requiredFields:message'
            : undefined,
      };
    }
    const errors = {};
    if (!EMAIL_RE.test(recipient.new.email)) {
      errors['recipient.email'] = 'dialog:validation:recipient:email:message';
    }
    return errors;
  }
  if (!recipient.select || !recipient.select._id) {
    return { recipient: 'form:errors:recipientRequired' };
  }
  return {};
}

export function getRowErrors(rows, mode) {
  const errors = {};
  for (const row of rows) {
    if (isBlankRow(row)) continue;
    if (
      row.price !== '' &&
      row.price != null &&
      row.quantity !== '' &&
      row.quantity != null &&
      !Number.isFinite(Number(row.subtotal))
    ) {
      errors[`rows.${row.id}.price`] =
        'dialog:validation:rows:priceZero:message';
    }
  }
  if (mode === 'draft') {
    return errors;
  }
  const nonBlank = rows.filter(row => !isBlankRow(row));
  if (nonBlank.length === 0) {
    return { rows: 'form:errors:noItems' };
  }
  for (const row of nonBlank) {
    if (!row.description) {
      errors[`rows.${row.id}.description`] =
        'dialog:validation:rows:emptyDescription:message';
    }
    if (!row.price || row.price <= 0) {
      errors[`rows.${row.id}.price`] =
        'dialog:validation:rows:priceZero:message';
    }
    if (!row.quantity || row.quantity <= 0) {
      errors[`rows.${row.id}.quantity`] =
        'dialog:validation:rows:qtyZero:message';
    }
  }
  return errors;
}

export function getIssuedAtErrors(form) {
  const { issuedAt } = form;
  if (issuedAt == null) {
    return {};
  }
  if (typeof issuedAt === 'number' && !Number.isFinite(issuedAt)) {
    return { issuedAt: 'dialog:validation:dueDate:message' };
  }
  const m = moment(issuedAt);
  if (!m.isValid()) {
    return { issuedAt: 'dialog:validation:dueDate:message' };
  }
  return {};
}

export function getDueDateErrors(isRequired, dueDate, mode) {
  if (mode === 'draft' || !isRequired) {
    return {};
  }
  const { selectedDate, useCustom } = dueDate;
  if (useCustom) {
    if (!selectedDate || selectedDate === null) {
      return { dueDate: 'dialog:validation:dueDate:message' };
    }
  }
  return {};
}

export function getCurrencyErrors(form, mode) {
  const errors = {};
  const currency = getEffectiveCurrency(form);
  const fraction = currency?.fraction;
  if (!isValidCurrencyFraction(fraction)) {
    errors['currency.fraction'] = 'dialog:validation:currency:fraction:message';
  }
  if (mode === 'draft') {
    return errors;
  }
  const { required_fields } = form.settings;
  if (required_fields.currency && fraction < 0) {
    errors['currency.fraction'] = 'dialog:validation:currency:fraction:message';
  }
  return errors;
}

export function getDiscountErrors(isRequired, discount, mode) {
  if (mode === 'draft' || !isRequired) {
    return {};
  }
  const { amount } = discount;
  if (!amount || amount === '' || amount === 0) {
    return { discount: 'dialog:validation:discount:message' };
  }
  return {};
}

export function getTaxErrors(isRequired, tax, mode) {
  if (mode === 'draft' || !isRequired) {
    return {};
  }
  const { amount } = tax;
  if (!amount || amount === '' || amount <= 0) {
    return { tax: 'dialog:validation:tax:message' };
  }
  return {};
}

export function getNoteErrors(isRequired, note, mode) {
  if (mode === 'draft' || !isRequired) {
    return {};
  }
  const { content } = note;
  if (!content || content === '') {
    return { note: 'dialog:validation:note:message' };
  }
  return {};
}

export function getInvoiceIDErrors(form, mode) {
  if (mode === 'draft') {
    return {};
  }
  const { invoiceID, settings } = form;
  const { editMode } = settings;
  if (editMode.active && editMode.data.invoiceID === undefined) {
    return {};
  }
  if (!invoiceID || invoiceID === '') {
    return { invoiceID: 'dialog:validation:invoiceID:message' };
  }
  return {};
}

function stripUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

function amountRepresentableAtFraction(amount, fraction) {
  if (!Number.isFinite(amount)) {
    return false;
  }
  return roundMoney(amount, fraction) === amount;
}

function editorTaxModeFromDoc(doc) {
  if (isLineTaxInvoice(doc)) {
    return 'line';
  }
  if (doc?.tax !== undefined) {
    return 'invoice';
  }
  return 'line';
}

function resolveSellerForSave(form, profile, invoiceSettings) {
  const ids = getSellerTaxIds(profile, invoiceSettings);
  const { editMode } = form.settings;
  if (!editMode.active) {
    return ids;
  }
  if (editMode.data?.status === 'draft') {
    return ids;
  }
  if (isLineTaxInvoice(editMode.data) && !editMode.data.seller) {
    return ids;
  }
  if (editMode.data?.seller) {
    return editMode.data.seller;
  }
  return null;
}

function getLineTaxFormErrors(form, mode) {
  if (mode === 'draft' || form.taxMode !== 'line') {
    return {};
  }
  if (!form.settings.required_fields.tax) {
    return {};
  }
  const errors = {};
  const currency = getEffectiveCurrency(form);
  const f = getCurrencyFraction({ currency });
  const previewDoc = {
    ...pickInvoiceFields(form, currency),
    taxMode: 'line',
    taxCalc: 1,
  };
  const totals = getInvoiceTotals(previewDoc);
  for (const row of form.rows) {
    if (isBlankRow(row)) {
      continue;
    }
    if (!Number.isFinite(Number(row.taxRate))) {
      errors[`rows.${row.id}.taxRate`] = 'form:errors:taxRateRequired';
    }
    const pseudo = {
      name: 'row',
      category: row.taxCategory ?? 'S',
      rate: Number(row.taxRate),
      exemptionReason: row.taxExemptionReason ?? '',
    };
    const rateErrs = getTaxRateErrors(pseudo);
    if (rateErrs.rate) {
      errors[`rows.${row.id}.taxRate`] = 'form:errors:taxRateRequired';
    }
    if (rateErrs.exemptionReason) {
      errors[`rows.${row.id}.taxExemptionReason`] =
        'form:errors:exemptionReasonRequired';
    }
    if (!Number.isFinite(Number(row.subtotal)) || Number(row.subtotal) < 0) {
      errors[`rows.${row.id}.price`] = 'dialog:validation:rows:priceZero:message';
    }
  }
  for (const group of totals.taxBreakdown) {
    if (group.conflict) {
      errors.taxGroups = 'form:errors:conflictingExemptionReasons';
      break;
    }
  }
  const discount = form.discount;
  if (isDiscountComplete(discount)) {
    const amount = Number(discount.amount);
    if (amount < 0) {
      errors.discount = 'form:errors:discountTooLarge';
    } else if (discount.type === 'percentage') {
      if (amount > 100) {
        errors.discount = 'form:errors:discountTooLarge';
      }
    } else if (amount > totals.subtotal) {
      errors.discount = 'form:errors:discountTooLarge';
    } else if (!amountRepresentableAtFraction(amount, f)) {
      errors.discount = 'form:errors:discountTooLarge';
    }
  }
  return errors;
}

function getCalculatedTotalsErrors(form, defaultCurrency) {
  const currencyDefault = defaultCurrency ?? getEffectiveCurrency(form);
  const fields = pickInvoiceFields(form, currencyDefault);
  const totals = getInvoiceTotals(fields);
  if (
    !Number.isFinite(totals.subtotal) ||
    !Number.isFinite(totals.grandTotal)
  ) {
    return { rows: 'dialog:validation:rows:priceZero:message' };
  }
  return {};
}

function getDraftNumericErrors(form) {
  const errors = {};
  for (const row of form.rows) {
    if (isBlankRow(row)) continue;
    if (
      row.price !== '' &&
      row.price != null &&
      (!Number.isFinite(Number(row.price)) || Number(row.price) <= 0)
    ) {
      errors[`rows.${row.id}.price`] =
        'dialog:validation:rows:priceZero:message';
    }
    if (
      row.quantity !== '' &&
      row.quantity != null &&
      (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0)
    ) {
      errors[`rows.${row.id}.quantity`] =
        'dialog:validation:rows:qtyZero:message';
    }
    if (
      row.price !== '' &&
      row.price != null &&
      row.quantity !== '' &&
      row.quantity != null &&
      !Number.isFinite(Number(row.subtotal))
    ) {
      errors[`rows.${row.id}.price`] =
        'dialog:validation:rows:priceZero:message';
    }
  }
  return errors;
}

export function getFormErrors(form, mode) {
  const { required_fields } = form.settings;
  if (mode === 'draft') {
    if (!hasDraftContent(form)) {
      return { draftEmpty: 'form:errors:draftEmpty' };
    }
    return stripUndefined({
      ...getCurrencyErrors(form, mode),
      ...getIssuedAtErrors(form),
      ...getDraftNumericErrors(form),
      ...getRowErrors(form.rows, mode),
      ...getCalculatedTotalsErrors(form),
    });
  }
  return stripUndefined({
    ...getInvoiceIDErrors(form, mode),
    ...getRecipientErrors(form.recipient, mode),
    ...getRowErrors(form.rows, mode),
    ...getDueDateErrors(required_fields.dueDate, form.dueDate, mode),
    ...getCurrencyErrors(form, mode),
    ...getDiscountErrors(required_fields.discount, form.discount, mode),
    ...(form.taxMode === 'line'
      ? getLineTaxFormErrors(form, mode)
      : getTaxErrors(required_fields.tax, form.tax, mode)),
    ...getNoteErrors(required_fields.note, form.note, mode),
    ...getIssuedAtErrors(form),
    ...getCalculatedTotalsErrors(form),
  });
}

export function pickInvoiceFields(form, defaultCurrency) {
  const {
    invoiceID,
    recipient,
    rows,
    dueDate,
    currency,
    discount,
    tax,
    note,
    settings,
    taxMode,
  } = form;
  const { required_fields } = settings;
  const lineMode = taxMode === 'line';
  const mapRow = row => {
    let next = {
      ...row,
      subtotal: Number(row.subtotal) || 0,
    };
    if (lineMode) {
      if (required_fields.tax) {
        next = {
          ...next,
          taxRateId: row.taxRateId,
          taxRate: row.taxRate,
          taxCategory: row.taxCategory,
          taxExemptionReason: row.taxExemptionReason,
        };
      } else {
        next = clearRowTax(next);
      }
    } else {
      next = clearRowTax(next);
    }
    return next;
  };
  const invoiceData = {
    rows: rows.filter(row => !isBlankRow(row)).map(mapRow),
  };

  if (lineMode) {
    invoiceData.taxMode = 'line';
    invoiceData.taxCalc = 1;
  }

  if (recipient.newRecipient) {
    invoiceData.recipient = { ...recipient.new };
  } else {
    invoiceData.recipient = recipient.select;
  }

  if (invoiceID) {
    invoiceData.invoiceID = invoiceID;
  }
  if (required_fields.dueDate) {
    invoiceData.dueDate = dueDate;
  }
  if (required_fields.currency) {
    invoiceData.currency = currency;
  } else {
    invoiceData.currency = defaultCurrency;
  }
  if (required_fields.discount && isDiscountComplete(discount)) {
    invoiceData.discount = discount;
  }
  if (!lineMode && required_fields.tax && isTaxComplete(tax)) {
    invoiceData.tax = tax;
  }
  if (required_fields.note) {
    invoiceData.note = note.content;
  }
  return invoiceData;
}

export function resolveSaveStatus(mode, editData) {
  if (mode === 'draft') {
    return 'draft';
  }
  if (!editData) {
    return 'pending';
  }
  if (editData.status === 'draft') {
    return 'pending';
  }
  return editData.status ?? 'pending';
}

export function getInvoiceData(
  formData,
  {
    mode = 'final',
    defaultCurrency,
    now = Date.now(),
    profile = {},
    invoiceSettings = {},
  } = {}
) {
  const { settings } = formData;
  const { editMode } = settings;
  const fields = pickInvoiceFields(formData, defaultCurrency);
  const seller = resolveSellerForSave(formData, profile, invoiceSettings);
  if (seller) {
    fields.seller = seller;
  }
  if (formData.recipient.newRecipient) {
    const savedRecipient =
      editMode.active && editMode.data?.recipient
        ? editMode.data.recipient
        : null;
    fields.recipient = {
      ...fields.recipient,
      _id: savedRecipient?._id ?? crypto.randomUUID(),
      created_at: savedRecipient?.created_at ?? Date.now(),
    };
  }
  const issuedAt =
    formData.issuedAt ?? (editMode.active ? getIssuedAt(editMode.data) : now);

  if (editMode.active) {
    const base = { ...editMode.data };
    Object.assign(base, fields, {
      issuedAt,
      status: resolveSaveStatus(mode, editMode.data),
      paidAt: editMode.data.paidAt,
      payments: editMode.data.payments,
      subtotal: getInvoiceTotals(fields).subtotal,
      grandTotal: getInvoiceTotals(fields).grandTotal,
    });
    if (!settings.required_fields.dueDate) delete base.dueDate;
    if (!('discount' in fields)) delete base.discount;
    if (!('tax' in fields)) delete base.tax;
    if (!('note' in fields)) delete base.note;
    return reconcilePaymentStatus(base, now);
  }

  return Object.assign({}, fields, {
    _id: crypto.randomUUID(),
    created_at: now,
    issuedAt,
    status: resolveSaveStatus(mode, null),
    subtotal: getInvoiceTotals(fields).subtotal,
    grandTotal: getInvoiceTotals(fields).grandTotal,
  });
}

export function validateTax(isRequired, tax) {
  const errors = getTaxErrors(isRequired, tax, 'final');
  const key = errors.tax;
  if (key) {
    dialog.alert({
      type: 'warning',
      title: i18n.t('dialog:validation:tax:title'),
      message: i18n.t(key),
    });
    return false;
  }
  return true;
}

export function validateCurrency(isRequired, currency) {
  const errors = getCurrencyErrors(
    {
      settings: { required_fields: { currency: isRequired } },
      currency,
      savedSettings: { currency },
    },
    'final'
  );
  const key = errors['currency.fraction'];
  if (key) {
    dialog.alert({
      type: 'warning',
      title: i18n.t('dialog:validation:currency:fraction:title'),
      message: i18n.t(key),
    });
    return false;
  }
  return true;
}

export function hasUnsavedFormChanges(form) {
  if (form.settings.editMode.active) {
    return true;
  }
  if (hasDraftContent(form)) {
    return true;
  }
  if (form.issuedAt != null) {
    return true;
  }
  return form.rows.some(row => !isBlankRow(row));
}

function setEditRecipient(allContacts, currentContact) {
  if (allContacts.length) {
    const contactIDs = allContacts.map(contact => contact._id);
    if (includes(contactIDs, currentContact._id)) {
      return {
        newRecipient: false,
        select: currentContact,
      };
    }
  }
  return {
    newRecipient: true,
    new: pick(currentContact, ['fullname', 'company', 'phone', 'email', 'taxId']),
  };
}

export { editorTaxModeFromDoc, setEditRecipient };
