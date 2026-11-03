// Which sidebar entry is active while the form (editor) tab is open.
export function getFormNavSection({ docType, templateTarget, editActive }) {
  if (templateTarget != null) return 'recurring';
  if (docType === 'estimate') return 'estimates';
  if (docType === 'creditNote' || editActive) return 'invoices';
  return 'newInvoice';
}
