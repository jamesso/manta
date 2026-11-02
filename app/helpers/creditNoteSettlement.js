import { isCreditNote, isInvoice } from './docType';
import { resolveStatusAfterCredit } from './creditNotes';
import { getAllDocs, updateDocs } from './pouchDB';

export function linkedCreditNotesForInvoice(allDocs, invoiceId) {
  return allDocs.filter(
    d => isCreditNote(d) && d.creditedInvoiceId === invoiceId
  );
}

export async function settleCreditedInvoiceInDb(invoiceId) {
  const allDocs = await getAllDocs('invoices');
  const invoice = allDocs.find(d => d._id === invoiceId);
  if (!invoice || !isInvoice(invoice)) {
    return allDocs;
  }
  const linked = linkedCreditNotesForInvoice(allDocs, invoiceId);
  const updated = resolveStatusAfterCredit(invoice, linked, Date.now());
  if (updated === invoice) {
    return allDocs;
  }
  await updateDocs('invoices', [updated]);
  return getAllDocs('invoices');
}
