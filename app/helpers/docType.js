export const DOC_TYPES = ['invoice', 'estimate', 'creditNote'];

export function getDocType(doc) {
  if (doc == null || typeof doc !== 'object') {
    return undefined;
  }
  const value = doc.docType;
  if (value === undefined || value === null || value === '') {
    return 'invoice';
  }
  return value;
}

export function isInvoice(doc) {
  return getDocType(doc) === 'invoice';
}

export function isEstimate(doc) {
  return getDocType(doc) === 'estimate';
}

export function isCreditNote(doc) {
  return getDocType(doc) === 'creditNote';
}

export function onlyInvoices(docs = []) {
  return docs.filter(isInvoice);
}

export function onlyEstimates(docs = []) {
  return docs.filter(isEstimate);
}

export function getDocTitleKey(doc) {
  if (isEstimate(doc)) {
    return 'preview:common:estimate';
  }
  if (isCreditNote(doc)) {
    return 'preview:common:creditNote';
  }
  if (isInvoice(doc)) {
    return 'preview:common:invoice';
  }
  return null;
}

export function listTabFor(docType) {
  if (docType === 'estimate') {
    return 'estimates';
  }
  return 'invoices';
}
