import { EMAIL_REGEX } from '../app/helpers/clients.js';

export const MAILTO_MAX_LENGTH = 1800;
export const OPEN_EXTERNAL_MAX = 2081;
export const EMAIL_KINDS = ['invoice', 'reminder'];

const WINDOWS_RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

const INVALID_EMAIL_CHARS = /[,;?&#<>"\s]/;

const EMAIL_REGEX_PLUS_LOCAL =
  /^([a-zA-Z0-9_\.\-+])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

export function isValidEmail(s) {
  if (typeof s !== 'string') {
    return false;
  }
  const trimmed = s.trim();
  if (!trimmed || INVALID_EMAIL_CHARS.test(trimmed)) {
    return false;
  }
  return EMAIL_REGEX.test(trimmed) || EMAIL_REGEX_PLUS_LOCAL.test(trimmed);
}

export function fillTemplate(template, vars) {
  if (typeof template !== 'string') {
    return '';
  }
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (!Object.hasOwn(vars, name)) {
      return match;
    }
    const value = vars[name];
    if (value == null) {
      return '';
    }
    return String(value);
  });
}

export function encodeMailtoValue(s) {
  const normalized = String(s)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '\r\n');
  return encodeURIComponent(normalized);
}

function encodeRecipient(to) {
  const trimmed = to.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) {
    throw new Error('invalid-recipient');
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return `${encodeURIComponent(local)}@${encodeURIComponent(domain)}`;
}

function subjectForMailto(subject) {
  return String(subject).replace(/[\r\n]+/g, ' ');
}

function urlLengthFor(toEnc, subjectEnc, bodyEnc) {
  let url = `mailto:${toEnc}`;
  if (subjectEnc) {
    url += `?subject=${subjectEnc}`;
  }
  if (bodyEnc) {
    url += subjectEnc ? `&body=${bodyEnc}` : `?body=${bodyEnc}`;
  }
  return url.length;
}

function buildUrl(toEnc, subjectEnc, bodyEnc) {
  let url = `mailto:${toEnc}`;
  const parts = [];
  if (subjectEnc) {
    parts.push(`subject=${subjectEnc}`);
  }
  if (bodyEnc) {
    parts.push(`body=${bodyEnc}`);
  }
  if (parts.length) {
    url += `?${parts.join('&')}`;
  }
  return url;
}

function fitSubject(subject, toEnc, maxLength, bodyEnc) {
  const flat = subjectForMailto(subject);
  const fullChars = Array.from(flat);
  let chars = fullChars;
  if (chars.length > 200) {
    chars = chars.slice(0, 200);
  }
  let truncated = chars.length < fullChars.length;

  const tryLen = len => {
    const prefix = chars.slice(0, len).join('');
    const enc = encodeMailtoValue(prefix);
    return urlLengthFor(toEnc, enc, bodyEnc) <= maxLength;
  };

  const withEllipsisIfShortened = (prefix, wasTruncated) => {
    if (!wasTruncated) {
      return { subject: prefix, truncated: false };
    }
    const withEllipsis = `${prefix}\u2026`;
    if (
      urlLengthFor(toEnc, encodeMailtoValue(withEllipsis), bodyEnc) <= maxLength
    ) {
      return { subject: withEllipsis, truncated: true };
    }
    return { subject: prefix, truncated: true };
  };

  if (!tryLen(chars.length)) {
    let lo = 0;
    let hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (tryLen(mid)) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    const prefix = chars.slice(0, lo).join('');
    truncated = truncated || lo < chars.length;
    return withEllipsisIfShortened(prefix, truncated);
  }
  return withEllipsisIfShortened(chars.join(''), truncated);
}

function fitBody(body, toEnc, subjectEnc, maxLength) {
  const trimmed = String(body);
  if (!trimmed) {
    return { body: '', truncated: false };
  }
  const codePoints = Array.from(trimmed);
  const tryBody = text => encodeMailtoValue(text);

  if (urlLengthFor(toEnc, subjectEnc, tryBody(trimmed)) <= maxLength) {
    return { body: trimmed, truncated: false };
  }

  let lo = 0;
  let hi = codePoints.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const prefix = codePoints.slice(0, mid).join('').trimEnd();
    const candidate = `${prefix}…`;
    if (urlLengthFor(toEnc, subjectEnc, tryBody(candidate)) <= maxLength) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  if (lo === 0) {
    if (urlLengthFor(toEnc, subjectEnc, tryBody('…')) <= maxLength) {
      return { body: '…', truncated: true };
    }
    return { body: '', truncated: true };
  }

  let prefix = codePoints.slice(0, lo).join('').trimEnd();
  let candidate = `${prefix}\u2026`;
  if (urlLengthFor(toEnc, subjectEnc, tryBody(candidate)) <= maxLength) {
    const lastSpace = prefix.lastIndexOf(' ');
    if (lastSpace >= 0 && prefix.length - lastSpace <= 80) {
      const wordCut = prefix.slice(0, lastSpace);
      const wordCandidate = `${wordCut}\u2026`;
      if (
        urlLengthFor(toEnc, subjectEnc, tryBody(wordCandidate)) <= maxLength
      ) {
        return { body: wordCandidate, truncated: true };
      }
    }
    return { body: candidate, truncated: true };
  }
  const lastSpace = prefix.lastIndexOf(' ');
  if (lastSpace >= 0 && prefix.length - lastSpace <= 80) {
    const wordCut = prefix.slice(0, lastSpace);
    candidate = `${wordCut}\u2026`;
    if (urlLengthFor(toEnc, subjectEnc, tryBody(candidate)) <= maxLength) {
      return { body: candidate, truncated: true };
    }
  }
  while (lo > 0) {
    lo -= 1;
    prefix = codePoints.slice(0, lo).join('').trimEnd();
    candidate = `${prefix}…`;
    if (urlLengthFor(toEnc, subjectEnc, tryBody(candidate)) <= maxLength) {
      return { body: candidate, truncated: true };
    }
  }
  if (urlLengthFor(toEnc, subjectEnc, tryBody('…')) <= maxLength) {
    return { body: '…', truncated: true };
  }
  return { body: '', truncated: true };
}

export function buildMailto(
  { to, subject = '', body = '' },
  { maxLength = MAILTO_MAX_LENGTH } = {}
) {
  if (!isValidEmail(to)) {
    throw new Error('invalid-recipient');
  }
  const toEnc = encodeRecipient(to);
  if (`mailto:${toEnc}`.length > maxLength - 100) {
    throw new Error('too-long-recipient');
  }

  let truncated = false;
  const subjectResult = fitSubject(subject, toEnc, maxLength, '');
  let subjectEnc = subjectResult.subject
    ? encodeMailtoValue(subjectResult.subject)
    : '';
  if (subjectResult.truncated) {
    truncated = true;
  }

  const bodyResult = fitBody(body, toEnc, subjectEnc, maxLength);
  const bodyEnc = bodyResult.body ? encodeMailtoValue(bodyResult.body) : '';
  if (bodyResult.truncated) {
    truncated = true;
  }

  let url = buildUrl(toEnc, subjectEnc, bodyEnc);
  if (url.length > maxLength) {
    throw new Error('mailto-too-long');
  }
  return { url, truncated };
}

export function assertMailtoUrl(url) {
  if (typeof url !== 'string') {
    throw new Error('blocked-url');
  }
  if (!url.startsWith('mailto:')) {
    throw new Error('blocked-url');
  }
  if (/[\r\n\0]/.test(url)) {
    throw new Error('blocked-url');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('blocked-url');
  }
  if (parsed.protocol !== 'mailto:') {
    throw new Error('blocked-url');
  }
  if (url.length > OPEN_EXTERNAL_MAX) {
    throw new Error('blocked-url');
  }
  return url;
}

export function safePdfFileName(base, fallback) {
  let name = '';
  for (const ch of String(base ?? '')) {
    const code = ch.charCodeAt(0);
    name += code <= 31 ? '-' : ch;
  }
  name = name
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '');
  if (name.length > 100) {
    name = name.slice(0, 100);
  }
  if (WINDOWS_RESERVED.has(name.toUpperCase())) {
    name = `${name}_`;
  }
  if (!name) {
    name = String(fallback ?? 'invoice').replace(/[\\/:*?"<>|]/g, '-');
    if (!name) {
      name = 'invoice';
    }
  }
  return `${name}.pdf`;
}

const MAX_STRING = 10_000;
const MAX_LOGO_DATA_URL = 2_000_000;
const SUPPORTED_LANGUAGES = new Set([
  'de',
  'en',
  'fr',
  'id',
  'it',
  'sk',
  'ur-PK',
  'vi',
  'zh-CN',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateLogoString(value) {
  if (typeof value !== 'string') {
    throw new Error('invalid-request');
  }
  if (value.length > MAX_LOGO_DATA_URL) {
    throw new Error('invalid-request');
  }
  if (value.startsWith('data:')) {
    if (!value.startsWith('data:image/')) {
      throw new Error('invalid-request');
    }
    const comma = value.indexOf(',');
    if (
      comma < 12 ||
      !/^data:image\/[-+.a-z0-9]+;base64$/i.test(value.slice(0, comma))
    ) {
      throw new Error('invalid-request');
    }
  }
}

function validateBoundedObject(obj, depth = 0, parentKey = '') {
  if (!isPlainObject(obj) || depth > 4) {
    throw new Error('invalid-request');
  }
  for (const [key, value] of Object.entries(obj)) {
    const pathKey = parentKey ? `${parentKey}.${key}` : key;
    if (value == null) {
      continue;
    }
    if (typeof value === 'string') {
      if (key === 'logo') {
        validateLogoString(value);
        continue;
      }
      if (value.length > MAX_STRING) {
        throw new Error('invalid-request');
      }
      continue;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error('invalid-request');
      }
      continue;
    }
    if (typeof value === 'boolean') {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 500) {
        throw new Error('invalid-request');
      }
      for (const item of value) {
        validateBoundedObject({ item }, depth + 1, pathKey);
      }
      continue;
    }
    if (typeof value === 'object') {
      validateBoundedObject(value, depth + 1, pathKey);
    }
  }
}

function validateSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    throw new Error('invalid-request');
  }
  validateBoundedObject(snapshot.profile ?? {});
  validateBoundedObject(snapshot.configs ?? {});
  const language = snapshot.language;
  if (typeof language !== 'string' || !SUPPORTED_LANGUAGES.has(language)) {
    throw new Error('invalid-request');
  }
  return {
    profile: snapshot.profile ?? {},
    configs: snapshot.configs ?? {},
    language,
  };
}

function validateInvoiceDoc(invoice, invoiceId) {
  if (!isPlainObject(invoice) || typeof invoiceId !== 'string') {
    throw new Error('invalid-request');
  }
  if (invoice._id !== invoiceId) {
    throw new Error('invalid-request');
  }
  validateBoundedObject(invoice);
  return invoice;
}

function validateDraft(draft) {
  if (!isPlainObject(draft)) {
    throw new Error('invalid-request');
  }
  const { to, subject, body } = draft;
  if (
    typeof to !== 'string' ||
    typeof subject !== 'string' ||
    typeof body !== 'string'
  ) {
    throw new Error('invalid-request');
  }
  if (subject.length > MAX_STRING || body.length > MAX_STRING) {
    throw new Error('invalid-request');
  }
  if (!isValidEmail(to)) {
    throw new Error('invalid-request');
  }
  return { to: to.trim(), subject, body };
}

export function validateEmailRequest(p) {
  if (!isPlainObject(p)) {
    throw new Error('invalid-request');
  }
  const {
    invoiceId,
    kind,
    invoice,
    draft,
    fileBase,
    source,
    snapshot,
    previewToken,
  } = p;
  if (!EMAIL_KINDS.includes(kind)) {
    throw new Error('invalid-request');
  }
  if (source !== 'preview' && source !== 'app') {
    throw new Error('invalid-request');
  }
  if (typeof fileBase !== 'string' || fileBase.length > 200) {
    throw new Error('invalid-request');
  }
  const doc = validateInvoiceDoc(invoice, invoiceId);
  const normalizedDraft = validateDraft(draft);
  const normalizedSnapshot = validateSnapshot(snapshot);
  if (source === 'preview') {
    if (
      typeof previewToken !== 'string' ||
      previewToken.length > 200 ||
      previewToken.length < 8
    ) {
      throw new Error('invalid-request');
    }
  } else if (previewToken != null) {
    throw new Error('invalid-request');
  }
  return {
    invoiceId,
    kind,
    invoice: doc,
    draft: normalizedDraft,
    fileBase,
    source,
    snapshot: normalizedSnapshot,
    previewToken: source === 'preview' ? previewToken : undefined,
  };
}

export function validateShareRequest(p) {
  if (!isPlainObject(p)) {
    throw new Error('invalid-request');
  }
  const { invoiceId, invoice, fileBase, source, snapshot, previewToken } = p;
  if (source !== 'preview' && source !== 'app') {
    throw new Error('invalid-request');
  }
  if (typeof fileBase !== 'string' || fileBase.length > 200) {
    throw new Error('invalid-request');
  }
  const doc = validateInvoiceDoc(invoice, invoiceId);
  const normalizedSnapshot = validateSnapshot(snapshot);
  if (source === 'preview') {
    if (
      typeof previewToken !== 'string' ||
      previewToken.length > 200 ||
      previewToken.length < 8
    ) {
      throw new Error('invalid-request');
    }
  } else if (previewToken != null) {
    throw new Error('invalid-request');
  }
  return {
    invoiceId,
    invoice: doc,
    fileBase,
    source,
    snapshot: normalizedSnapshot,
    previewToken: source === 'preview' ? previewToken : undefined,
  };
}

export function validateCaptureSnapshotPayload(p) {
  if (!isPlainObject(p)) {
    throw new Error('invalid-request');
  }
  const { invoice, snapshot } = p;
  if (!isPlainObject(invoice)) {
    throw new Error('invalid-request');
  }
  validateBoundedObject(invoice);
  const normalizedSnapshot = validateSnapshot(snapshot);
  return { invoice, snapshot: normalizedSnapshot };
}

function fingerprintPart(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(fingerprintPart);
  }
  const keys = Object.keys(value).sort();
  const out = {};
  for (const key of keys) {
    out[key] = fingerprintPart(value[key]);
  }
  return out;
}

export function invoiceCaptureFingerprint(invoice) {
  if (!invoice || typeof invoice !== 'object') {
    return '';
  }
  return JSON.stringify(fingerprintPart(invoice));
}

export function invoicesMatchCaptured(stored, supplied) {
  if (!stored || !supplied || stored._id !== supplied._id) {
    return false;
  }
  return (
    invoiceCaptureFingerprint(stored) === invoiceCaptureFingerprint(supplied)
  );
}
