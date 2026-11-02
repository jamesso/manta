import { getDefaultPreviewConfigs } from '../../preview/constants/defaultConfigs';
import { getInvoiceTotals, getIssuedAt } from './invoice';
import { pickInvoiceFields, resolveSellerForSave } from './form';
import { getDefaultValidUntil, normalizeValidDays } from './estimate';
import { materializeDueDate } from './recurring';

export function formToPreviewInvoice(
  form,
  { invoiceSettings, generalSettings, profile, now }
) {
  const isTemplate = form.templateTarget != null;
  const previewIssued = isTemplate ? now : undefined;
  const { settings } = form;
  const { editMode } = settings;
  const docType = form.docType || 'invoice';
  const editIssued = editMode.active ? getIssuedAt(editMode.data) : null;
  const issuedAt = previewIssued ?? form.issuedAt ?? editIssued ?? now;
  const fields = pickInvoiceFields(form, invoiceSettings.currency);
  if (isTemplate && fields.dueDate) {
    fields.dueDate =
      materializeDueDate(fields.dueDate, issuedAt) ?? fields.dueDate;
  }
  const invoice = {
    ...fields,
    docType,
    _id: editMode.data?._id ?? 'preview',
    recipient: form.recipient.newRecipient
      ? { ...form.recipient.new }
      : { ...form.recipient.select },
    issuedAt,
    created_at: issuedAt,
    subtotal: getInvoiceTotals(fields).subtotal,
    grandTotal: getInvoiceTotals(fields).grandTotal,
  };
  if (docType === 'estimate') {
    invoice.validUntil =
      form.validUntil ??
      getDefaultValidUntil(
        issuedAt,
        normalizeValidDays(invoiceSettings.estimateValidDays)
      );
    delete invoice.dueDate;
    delete invoice.payments;
  } else if (editMode.active) {
    invoice.payments = editMode.data.payments;
  }
  const seller = resolveSellerForSave(form, profile, invoiceSettings);
  if (seller) {
    invoice.seller = seller;
  }
  const configs =
    editMode.data?.configs ??
    getDefaultPreviewConfigs(invoiceSettings, generalSettings);
  return { invoice, configs, profile };
}
