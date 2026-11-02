import { getIssuedAt } from './invoice';

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function filterCommands(commands, query) {
  const q = normalize(query);
  if (!q) return commands;
  return commands.filter(cmd => {
    const haystack = [cmd.label, ...(cmd.keywords || [])]
      .map(normalize)
      .join(' ');
    return (
      haystack.includes(q) ||
      q.split(/\s+/).every(term => haystack.includes(term))
    );
  });
}

function matchTerms(haystackParts, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return false;
  const haystack = haystackParts.map(normalize).join(' ');
  return terms.every(term => haystack.includes(term));
}

function invoiceFields(invoice) {
  const recipient = invoice.recipient || {};
  const idPrefix = invoice._id ? String(invoice._id).slice(0, 8) : '';
  return [
    invoice.invoiceID,
    idPrefix,
    recipient.fullname,
    recipient.company,
    recipient.email,
  ];
}

function contactFields(contact) {
  return [contact.fullname, contact.company, contact.email];
}

export function searchRecords({
  query,
  invoices = [],
  contacts = [],
  limit = 5,
}) {
  const q = normalize(query);
  if (!q) return { invoices: [], contacts: [] };

  const matchedInvoices = invoices
    .filter(inv => matchTerms(invoiceFields(inv), query))
    .sort((a, b) => (getIssuedAt(b) || 0) - (getIssuedAt(a) || 0))
    .slice(0, limit);

  const matchedContacts = contacts
    .filter(c => matchTerms(contactFields(c), query))
    .slice(0, limit);

  return { invoices: matchedInvoices, contacts: matchedContacts };
}
