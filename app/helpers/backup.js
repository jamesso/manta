import { getSettingsErrors, getRawNumberingErrors } from './settings';

export const BACKUP_APP = 'Manta';
export const BACKUP_VERSION = 3;

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function hasDangerousKey(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some(item => hasDangerousKey(item, seen));
  }
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) {
      return true;
    }
    if (hasDangerousKey(value[key], seen)) {
      return true;
    }
  }
  return false;
}

function docHasAttachments(doc) {
  return doc != null && typeof doc === 'object' && '_attachments' in doc;
}

export function sanitizeDoc(doc) {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  if (docHasAttachments(doc)) {
    throw Object.assign(new Error('unsupported-data'), {
      code: 'unsupported-data',
    });
  }
  if (hasDangerousKey(doc)) {
    throw Object.assign(new Error('invalid-format'), {
      code: 'invalid-format',
    });
  }
  const next = Object.create(null);
  for (const key of Object.keys(doc)) {
    if (key === '_id' || !key.startsWith('_')) {
      next[key] = doc[key];
    }
  }
  return next;
}

export function buildBackup({ settings, invoices, contacts, items = [] }) {
  if (hasDangerousKey(settings)) {
    throw Object.assign(new Error('unsupported-data'), {
      code: 'unsupported-data',
    });
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    settings,
    invoices: invoices.map(sanitizeDoc),
    contacts: contacts.map(sanitizeDoc),
    items: items.map(sanitizeDoc),
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validDocId(id) {
  return typeof id === 'string' && id.length > 0 && !id.startsWith('_');
}

function validateInvoice(doc) {
  return (
    isPlainObject(doc) &&
    validDocId(doc._id) &&
    Array.isArray(doc.rows) &&
    isPlainObject(doc.recipient)
  );
}

function validateContact(doc) {
  return (
    isPlainObject(doc) &&
    validDocId(doc._id) &&
    typeof doc.fullname === 'string'
  );
}

function validateItem(doc) {
  return (
    isPlainObject(doc) &&
    validDocId(doc._id) &&
    typeof doc.name === 'string' &&
    doc.name.length > 0
  );
}

function parseDocList(list, validate) {
  const valid = [];
  let invalid = 0;
  let duplicates = 0;
  const seen = new Set();
  for (const raw of list) {
    if (!isPlainObject(raw)) {
      invalid += 1;
      continue;
    }
    if (hasDangerousKey(raw)) {
      return { error: 'invalid-format' };
    }
    if (docHasAttachments(raw)) {
      return { error: 'unsupported-data' };
    }
    if (!validate(raw)) {
      invalid += 1;
      continue;
    }
    let doc;
    try {
      doc = sanitizeDoc(raw);
    } catch (err) {
      if (err.code === 'unsupported-data' || err.code === 'invalid-format') {
        return { error: err.code };
      }
      throw err;
    }
    if (seen.has(doc._id)) {
      duplicates += 1;
      continue;
    }
    seen.add(doc._id);
    valid.push(doc);
  }
  return { valid, invalid, duplicates };
}

export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'invalid-format' };
  }
  if (hasDangerousKey(parsed)) {
    return { ok: false, error: 'invalid-format' };
  }
  if (parsed.app !== BACKUP_APP) {
    return { ok: false, error: 'wrong-app' };
  }
  const version = parsed.version;
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'invalid-format' };
  }
  if (version > BACKUP_VERSION) {
    return { ok: false, error: 'newer-version' };
  }
  if (!Array.isArray(parsed.invoices) || !Array.isArray(parsed.contacts)) {
    return { ok: false, error: 'invalid-format' };
  }
  let itemsList = [];
  if (parsed.items === undefined) {
    itemsList = [];
  } else if (!Array.isArray(parsed.items)) {
    return { ok: false, error: 'invalid-format' };
  } else {
    itemsList = parsed.items;
  }
  let settings = parsed.settings;
  if (settings != null) {
    if (!isPlainObject(settings)) {
      settings = null;
    } else if (hasDangerousKey(settings)) {
      return { ok: false, error: 'invalid-format' };
    }
  }
  const invoicesResult = parseDocList(parsed.invoices, validateInvoice);
  if (invoicesResult.error) {
    return { ok: false, error: invoicesResult.error };
  }
  const contactsResult = parseDocList(parsed.contacts, validateContact);
  if (contactsResult.error) {
    return { ok: false, error: contactsResult.error };
  }
  const itemsResult = parseDocList(itemsList, validateItem);
  if (itemsResult.error) {
    return { ok: false, error: itemsResult.error };
  }
  return {
    ok: true,
    backup: {
      appVersion: parsed.appVersion,
      exportedAt: parsed.exportedAt,
      settings,
      invoices: invoicesResult.valid,
      contacts: contactsResult.valid,
      items: itemsResult.valid,
    },
    invalid: {
      invoices: invoicesResult.invalid,
      contacts: contactsResult.invalid,
      items: itemsResult.invalid,
    },
    duplicates: {
      invoices: invoicesResult.duplicates,
      contacts: contactsResult.duplicates,
      items: itemsResult.duplicates,
    },
  };
}

export function planMerge(incomingDocs, existingDocs, mode) {
  const byId = new Map(existingDocs.map(doc => [doc._id, doc]));
  const toWrite = [];
  const counts = { added: 0, overwritten: 0, skipped: 0 };
  for (const doc of incomingDocs) {
    const existing = byId.get(doc._id);
    if (!existing) {
      toWrite.push({ ...doc });
      counts.added += 1;
    } else if (mode === 'overwrite') {
      toWrite.push({ ...doc, _rev: existing._rev });
      counts.overwritten += 1;
    } else {
      counts.skipped += 1;
    }
  }
  return { toWrite, counts };
}

function mergeInvoiceNumbering(currentInvoice, incomingInvoice) {
  const merged = { ...currentInvoice, ...incomingInvoice };
  merged.exportDir = currentInvoice?.exportDir ?? merged.exportDir;
  const curNum = currentInvoice?.numbering;
  const incNum = incomingInvoice?.numbering;
  if (incNum != null) {
    const rawErrors = getRawNumberingErrors(incNum);
    if (Object.keys(rawErrors).length) {
      return { error: 'numbering', merged: null };
    }
  }
  if (isPlainObject(curNum) && isPlainObject(incNum)) {
    const next =
      Number.isInteger(curNum.next) &&
      curNum.next >= 1 &&
      Number.isInteger(incNum.next) &&
      incNum.next >= 1
        ? Math.max(curNum.next, incNum.next)
        : incNum.next;
    merged.numbering = { ...curNum, ...incNum, next };
  } else if (isPlainObject(incNum)) {
    merged.numbering = { ...incNum };
  }
  return { merged };
}

export function mergeImportedSettings(current, incoming) {
  if (hasDangerousKey(incoming)) {
    return {
      settings: current,
      skippedSections: ['profile', 'invoice', 'general'],
    };
  }
  const sections = ['profile', 'invoice', 'general'];
  const settings = { ...current };
  const skippedSections = [];
  for (const section of sections) {
    const inc = incoming?.[section];
    if (!isPlainObject(inc)) {
      continue;
    }
    let merged = section === 'invoice' ? null : { ...current[section], ...inc };
    if (section === 'invoice') {
      const invoiceMerge = mergeInvoiceNumbering(current.invoice, inc);
      if (invoiceMerge.error) {
        skippedSections.push(section);
        settings[section] = current[section];
        continue;
      }
      merged = invoiceMerge.merged;
    }
    const errors = getSettingsErrors(section, merged);
    if (Object.keys(errors).length) {
      skippedSections.push(section);
      settings[section] = current[section];
      continue;
    }
    settings[section] = merged;
  }
  return { settings, skippedSections };
}
