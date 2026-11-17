import { isCreditNote, isInvoice } from './docType';
import { resolveStatusAfterCredit } from './creditNotes';
import { getAllDocs, updateDocs } from './pouchDB';

export function linkedCreditNotesForInvoice(allDocs, invoiceId) {
  return allDocs.filter(
    d => isCreditNote(d) && d.creditedInvoiceId === invoiceId
  );
}

// Returns whether settlement wrote an invoice. The caller owns the list reload.
export async function updateCreditedInvoiceInDb(invoiceId, allDocs) {
  const invoice = allDocs.find(d => d._id === invoiceId);
  if (!invoice || !isInvoice(invoice)) {
    return false;
  }
  const linked = linkedCreditNotesForInvoice(allDocs, invoiceId);
  const updated = resolveStatusAfterCredit(invoice, linked, Date.now());
  if (updated === invoice) {
    return false;
  }
  await updateDocs('invoices', [updated]);
  return true;
}

export async function settleCreditedInvoiceInDb(invoiceId) {
  const allDocs = await getAllDocs('invoices');
  const changed = await updateCreditedInvoiceInDb(invoiceId, allDocs);
  return changed ? getAllDocs('invoices') : allDocs;
}
