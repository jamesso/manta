import { getDefaultPreviewConfigs } from '../../preview/constants/defaultConfigs';
import { getInvoiceValue, getIssuedAt } from './invoice';
import { pickInvoiceFields } from './form';

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
    subtotal: getInvoiceValue(fields).subtotal,
    grandTotal: getInvoiceValue(fields).grandTotal,
  };
  const configs =
    editMode.data?.configs ??
    getDefaultPreviewConfigs(invoiceSettings, generalSettings);
  return { invoice, configs, profile };
}
