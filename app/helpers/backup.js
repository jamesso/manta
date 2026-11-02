import { getSettingsErrors } from './settings';

export const BACKUP_APP = 'Manta';
export const BACKUP_VERSION = 1;

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

export function sanitizeDoc(doc) {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  if (doc._attachments && Object.keys(doc._attachments).length) {
    throw Object.assign(new Error('unsupported-data'), {
      code: 'unsupported-data',
    });
  }
  const next = {};
  for (const key of Object.keys(doc)) {
    if (key === '_id' || !key.startsWith('_')) {
      next[key] = doc[key];
    }
  }
  return next;
}

export function buildBackup({ settings, invoices, contacts }) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    settings,
    invoices: invoices.map(sanitizeDoc),
    contacts: contacts.map(sanitizeDoc),
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

function parseDocList(list, validate) {
  const valid = [];
  let invalid = 0;
  let duplicates = 0;
  const seen = new Set();
  for (const raw of list) {
    if (!validate(raw)) {
      invalid += 1;
      continue;
    }
    if (raw._attachments && Object.keys(raw._attachments).length) {
      return { error: 'unsupported-data' };
    }
    let doc;
    try {
      doc = sanitizeDoc(raw);
    } catch (err) {
      if (err.code === 'unsupported-data') {
        return { error: 'unsupported-data' };
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
  let settings = parsed.settings;
  if (settings != null && !isPlainObject(settings)) {
    settings = null;
  }
  const invoicesResult = parseDocList(parsed.invoices, validateInvoice);
  if (invoicesResult.error) {
    return { ok: false, error: invoicesResult.error };
  }
  const contactsResult = parseDocList(parsed.contacts, validateContact);
  if (contactsResult.error) {
    return { ok: false, error: contactsResult.error };
  }
  return {
    ok: true,
    backup: {
      appVersion: parsed.appVersion,
      exportedAt: parsed.exportedAt,
      settings,
      invoices: invoicesResult.valid,
      contacts: contactsResult.valid,
    },
    invalid: {
      invoices: invoicesResult.invalid,
      contacts: contactsResult.invalid,
    },
    duplicates: {
      invoices: invoicesResult.duplicates,
      contacts: contactsResult.duplicates,
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
    let merged = { ...current[section], ...inc };
    if (section === 'invoice') {
      merged.exportDir = current.invoice?.exportDir ?? merged.exportDir;
      const curNum = current.invoice?.numbering;
      const incNum = inc.numbering;
      if (isPlainObject(curNum) && isPlainObject(incNum)) {
        const curNext = Number(curNum.next);
        const incNext = Number(incNum.next);
        let next = curNum.next;
        if (
          Number.isFinite(curNext) &&
          Number.isInteger(curNext) &&
          curNext >= 1
        ) {
          if (
            Number.isFinite(incNext) &&
            Number.isInteger(incNext) &&
            incNext >= 1
          ) {
            next = Math.max(curNext, incNext);
          }
        } else if (
          Number.isFinite(incNext) &&
          Number.isInteger(incNext) &&
          incNext >= 1
        ) {
          next = incNext;
        }
        merged.numbering = { ...merged.numbering, next };
      }
    }
    const errors = getSettingsErrors(section, merged);
    if (Object.keys(errors).length) {
      skippedSections.push(section);
      merged = current[section];
    }
    settings[section] = merged;
  }
  return { settings, skippedSections };
}
