import { getDefaultPreviewConfigs } from '../../preview/constants/defaultConfigs';
import { getInvoiceTotals, getIssuedAt } from './invoice';
import { pickInvoiceFields, resolveSellerForSave } from './form';

export function formToPreviewInvoice(
  form,
  { invoiceSettings, generalSettings, profile, now }
) {
  const { settings } = form;
  const { editMode } = settings;
  const editIssued = editMode.active ? getIssuedAt(editMode.data) : null;
  const issuedAt = form.issuedAt ?? editIssued ?? now;
  const fields = pickInvoiceFields(form, invoiceSettings.currency);
  const invoice = {
    ...fields,
    _id: editMode.data?._id ?? 'preview',
    recipient: form.recipient.newRecipient
      ? { ...form.recipient.new }
      : { ...form.recipient.select },
    issuedAt,
    created_at: issuedAt,
    subtotal: getInvoiceTotals(fields).subtotal,
    grandTotal: getInvoiceTotals(fields).grandTotal,
    payments: editMode.active ? editMode.data.payments : undefined,
  };
  const seller = resolveSellerForSave(form, profile, invoiceSettings);
  if (seller) {
    invoice.seller = seller;
  }
  const configs =
    editMode.data?.configs ??
    getDefaultPreviewConfigs(invoiceSettings, generalSettings);
  return { invoice, configs, profile };
}
