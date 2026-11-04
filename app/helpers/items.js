import { normalize } from './commandSearch';
import { DEFAULT_UNIT_CODE, UNIT_CODES } from '../constants/units';

export function getUnitCode(value) {
  if (typeof value === 'string' && /^[A-Z0-9]{2,3}$/.test(value)) {
    return value;
  }
  return DEFAULT_UNIT_CODE;
}

export function isKnownUnit(code) {
  return UNIT_CODES.includes(code);
}

export function getItemErrors(values, items, selfId, options = {}) {
  const errors = {};
  const name = String(values.name ?? '').trim();
  const willBeActive =
    options.willBeActive ??
    (values.archived !== true &&
      values.archived !== 'true' &&
      Boolean(values.archived) !== true);
  if (!name) {
    errors.name = 'items:errors:nameRequired';
  } else if (name.length > 120) {
    errors.name = 'items:errors:nameTooLong';
  } else if (willBeActive) {
    const normalizedName = normalize(name);
    const taken = items.some(
      item =>
        !item.archived &&
        item._id !== selfId &&
        normalize(item.name) === normalizedName
    );
    if (taken) {
      errors.name = 'items:errors:nameTaken';
    }
  }
  const priceRaw = String(values.unitPrice ?? '').trim();
  if (priceRaw === '' || !Number.isFinite(Number(values.unitPrice))) {
    errors.unitPrice = 'items:errors:price';
  }
  const unitCode = String(values.unitCode ?? '');
  if (!/^[A-Z0-9]{2,3}$/.test(unitCode)) {
    errors.unitCode = 'items:errors:unit';
  }
  return errors;
}

export function buildItem(values, existing, now) {
  const taxRateId =
    values.taxRateId === '' || values.taxRateId == null
      ? null
      : values.taxRateId;
  const base = {
    name: String(values.name ?? '').trim(),
    description: String(values.description ?? '').trim(),
    unitPrice: Number(values.unitPrice),
    unitCode: getUnitCode(values.unitCode),
    taxRateId,
  };
  if (existing) {
    return { ...existing, ...base };
  }
  return {
    _id: crypto.randomUUID(),
    taxRateId: null,
    archived: false,
    created_at: now,
    ...base,
  };
}

export function withArchived(item, archived) {
  return { ...item, archived: Boolean(archived) };
}

export function itemToRowDescription(item) {
  const desc = String(item.description ?? '').trim();
  return desc || item.name;
}

export function applyItemToRow(row, item) {
  const quantity =
    row.quantity === '' || row.quantity == null ? 1 : row.quantity;
  const price = item.unitPrice;
  const qtyNum = Number(quantity) || 0;
  return {
    ...row,
    description: itemToRowDescription(item),
    price,
    quantity,
    unitCode: getUnitCode(item.unitCode),
    subtotal: price * qtyNum,
  };
}

export function rowToItemValues(row) {
  const trimmed = String(row.description ?? '').trim();
  const firstLine = trimmed.split(/\r?\n/)[0] ?? '';
  const name = firstLine.slice(0, 80);
  const description = trimmed && trimmed !== name ? trimmed : '';
  return {
    name,
    description,
    unitPrice: row.price === '' || row.price == null ? '' : String(row.price),
    unitCode: getUnitCode(row.unitCode),
  };
}

export function searchItems(items, query, limit = 8) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return [];
  }
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const candidates = items.filter(item => {
    if (item.archived) {
      return false;
    }
    const haystack = normalize(`${item.name} ${item.description ?? ''}`);
    return terms.every(term => haystack.includes(term));
  });
  candidates.sort((a, b) => {
    const na = normalize(a.name);
    const nb = normalize(b.name);
    const rank = n => {
      if (n.startsWith(normalizedQuery)) {
        return 0;
      }
      if (n.includes(normalizedQuery)) {
        return 1;
      }
      return 2;
    };
    const diff = rank(na) - rank(nb);
    if (diff !== 0) {
      return diff;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return candidates.slice(0, limit);
}

// Most-used first: count saved document lines whose description matches
// the text the item prints. Ties sort by name.
export function sortItemsByUsage(items, docs) {
  const counts = new Map();
  for (const doc of docs) {
    for (const row of doc.rows ?? []) {
      const key = normalize(String(row.description ?? '').trim());
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const usage = item => counts.get(normalize(itemToRowDescription(item))) ?? 0;
  return [...items].sort(
    (a, b) =>
      usage(b) - usage(a) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

export function matchesItemQuery(item, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return true;
  }
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const haystack = normalize(
    `${item.name} ${item.description ?? ''} ${getUnitCode(item.unitCode)}`
  );
  return terms.every(term => haystack.includes(term));
}

export const ITEM_VIEWS = ['active', 'archived'];

export function countItems(items) {
  let active = 0;
  let archived = 0;
  for (const item of items) {
    if (item.archived) {
      archived += 1;
    } else {
      active += 1;
    }
  }
  return { active, archived };
}

export function filterItems(items, { view, query }) {
  const wantArchived = view === 'archived';
  return items.filter(
    item =>
      Boolean(item.archived) === wantArchived && matchesItemQuery(item, query)
  );
}
