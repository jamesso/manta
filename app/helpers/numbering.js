export const DEFAULT_NUMBERING = { prefix: 'INV-', next: 1, padding: 4 };

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return fallback;
  }
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function normalizeNumbering(value) {
  if (value == null || typeof value !== 'object') {
    return { ...DEFAULT_NUMBERING };
  }
  return {
    prefix: typeof value.prefix === 'string' ? value.prefix : DEFAULT_NUMBERING.prefix,
    next: clampInt(value.next, 1, Number.MAX_SAFE_INTEGER, DEFAULT_NUMBERING.next),
    padding: clampInt(value.padding, 0, 12, DEFAULT_NUMBERING.padding),
  };
}

export function formatInvoiceNumber(n) {
  const numbering = normalizeNumbering(n);
  const digits = String(numbering.next).padStart(numbering.padding, '0');
  return `${numbering.prefix}${digits}`;
}

export function advanceNumbering(n, savedID) {
  const numbering = normalizeNumbering(n);
  if (!savedID || typeof savedID !== 'string') {
    return numbering;
  }
  const escaped = numbering.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(\\d+)$`);
  const match = savedID.match(re);
  if (!match) {
    return numbering;
  }
  const used = Number.parseInt(match[1], 10);
  if (!Number.isFinite(used) || used < numbering.next) {
    return numbering;
  }
  return { ...numbering, next: used + 1 };
}

export function mergeNumbering(stored, saved, edited) {
  const base = normalizeNumbering(stored);
  const savedNorm = normalizeNumbering(saved);
  const editedNorm = normalizeNumbering(edited);
  const prefix =
    editedNorm.prefix !== savedNorm.prefix ? editedNorm.prefix : base.prefix;
  let next = base.next;
  if (editedNorm.prefix === savedNorm.prefix && editedNorm.next !== savedNorm.next) {
    next = editedNorm.next;
  }
  let padding = base.padding;
  if (
    editedNorm.prefix === savedNorm.prefix &&
    editedNorm.padding !== savedNorm.padding
  ) {
    padding = editedNorm.padding;
  }
  return { prefix, next, padding };
}
