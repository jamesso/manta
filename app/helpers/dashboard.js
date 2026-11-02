import { formatNumber } from '../../helpers/formatNumber';
import {
  formatInvoiceAmount,
  getDisplayStatus,
  getDueDate,
  getInvoiceValue,
  getIssuedAt,
  getPaidDate,
} from './invoice';

function startOfLocalDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfLocalMonth(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function startOfNextLocalMonth(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

function addLocalDays(ts, days) {
  const d = new Date(startOfLocalDay(ts));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function monthKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function amountOf(inv) {
  if (Number.isFinite(inv.grandTotal)) {
    return inv.grandTotal;
  }
  if (Array.isArray(inv.rows)) {
    return getInvoiceValue(inv).grandTotal;
  }
  return 0;
}

function currencyOf(inv, fallback) {
  const c = inv.currency;
  if (c?.code) {
    return c.code;
  }
  if (typeof c === 'string') {
    return c;
  }
  return fallback.code;
}

function currencyObjectOf(inv, fallback) {
  const c = inv.currency;
  if (c && typeof c === 'object' && c.code) {
    return c;
  }
  if (typeof c === 'string') {
    return { ...fallback, code: c };
  }
  return fallback;
}

function invoiceSortTime(inv) {
  return getIssuedAt(inv) ?? inv.created_at ?? 0;
}

function getDashboardStats(invoices, now, fallbackCurrency) {
  const byCurrency = {};
  let draft = 0;
  let overdue = 0;
  const monthStart = startOfLocalMonth(now);
  const monthEnd = startOfNextLocalMonth(now);

  for (const inv of invoices) {
    const code = currencyOf(inv, fallbackCurrency);
    if (!byCurrency[code]) {
      byCurrency[code] = {
        outstanding: 0,
        overdue: 0,
        paidThisMonth: 0,
        draftCount: 0,
        overdueCount: 0,
        outstandingCount: 0,
        currency: currencyObjectOf(inv, fallbackCurrency),
        _newest: invoiceSortTime(inv),
      };
    }
    const bucket = byCurrency[code];
    const t = invoiceSortTime(inv);
    if (t >= bucket._newest) {
      bucket._newest = t;
      bucket.currency = currencyObjectOf(inv, fallbackCurrency);
    }

    const display = getDisplayStatus(inv, now);
    const stored = inv.status ?? 'pending';
    const amount = amountOf(inv);

    if (stored === 'draft') {
      bucket.draftCount += 1;
      draft += 1;
      continue;
    }
    if (stored === 'refunded' || stored === 'cancelled') {
      continue;
    }

    if (display === 'overdue') {
      bucket.overdue += amount;
      bucket.overdueCount += 1;
      bucket.outstanding += amount;
      bucket.outstandingCount += 1;
      overdue += 1;
    } else if (display === 'pending') {
      bucket.outstanding += amount;
      bucket.outstandingCount += 1;
    }

    if (stored === 'paid') {
      const paid = getPaidDate(inv);
      if (paid != null && paid >= monthStart && paid < monthEnd) {
        bucket.paidThisMonth += amount;
      }
    }
  }

  const codes = Object.keys(byCurrency);
  codes.sort((a, b) => {
    const countA = invoices.filter(
      i => currencyOf(i, fallbackCurrency) === a
    ).length;
    const countB = invoices.filter(
      i => currencyOf(i, fallbackCurrency) === b
    ).length;
    if (countB !== countA) {
      return countB - countA;
    }
    return a.localeCompare(b);
  });

  for (const code of codes) {
    delete byCurrency[code]._newest;
  }

  return {
    currencies: codes,
    byCurrency,
    counts: { draft, overdue },
  };
}

function getMonthlyPaid(invoices, now, months = 6, fallbackCurrency) {
  const endMonthStart = startOfLocalMonth(now);
  const startMonthStart = new Date(
    new Date(endMonthStart).getFullYear(),
    new Date(endMonthStart).getMonth() - (months - 1),
    1
  ).getTime();

  const result = {};

  function ensureBuckets(code) {
    if (result[code]) {
      return;
    }
    const rows = [];
    let cursor = startMonthStart;
    while (rows.length < months) {
      rows.push({
        key: monthKey(cursor),
        start: cursor,
        total: 0,
      });
      const d = new Date(cursor);
      cursor = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    }
    result[code] = rows;
  }

  for (const inv of invoices) {
    if (inv.status !== 'paid') {
      continue;
    }
    const paid = getPaidDate(inv);
    if (paid == null) {
      continue;
    }
    const paidMonth = startOfLocalMonth(paid);
    if (paidMonth < startMonthStart || paidMonth > endMonthStart) {
      continue;
    }
    const code = currencyOf(inv, fallbackCurrency);
    ensureBuckets(code);
    const key = monthKey(paidMonth);
    const row = result[code].find(r => r.key === key);
    if (row) {
      row.total += amountOf(inv);
    }
  }

  return result;
}

function getNeedsAttention(invoices, now, days = 7) {
  const startToday = startOfLocalDay(now);
  const endExclusive = addLocalDays(startToday, days + 1);

  const overdueList = [];
  const upcoming = [];

  for (const inv of invoices) {
    const display = getDisplayStatus(inv, now);
    const due = getDueDate(inv);
    if (due === null) {
      continue;
    }
    if (display === 'overdue') {
      overdueList.push(inv);
    } else if (display === 'pending') {
      if (due >= startToday && due < endExclusive) {
        upcoming.push(inv);
      }
    }
  }

  overdueList.sort((a, b) => getDueDate(a) - getDueDate(b));
  upcoming.sort((a, b) => getDueDate(a) - getDueDate(b));

  return [...overdueList, ...upcoming];
}

function getRecentInvoices(invoices, limit = 5) {
  return [...invoices]
    .sort(
      (a, b) =>
        (getIssuedAt(b) ?? b.created_at ?? 0) -
        (getIssuedAt(a) ?? a.created_at ?? 0)
    )
    .slice(0, limit);
}

function formatMoney(amount, currency) {
  if (!currency) {
    return formatNumber(amount, 2);
  }
  const invoice = {
    grandTotal: amount,
    currency,
  };
  return formatInvoiceAmount(invoice);
}

/**
 * Reconcile dashboard currency selection. `selectedCode` null means no user
 * choice yet — pick configured code when it has invoices, else first available.
 */
function resolveDashboardCurrencySelection(
  selectedCode,
  availableCodes,
  configuredCode
) {
  if (!availableCodes.length) {
    return configuredCode ?? 'USD';
  }
  if (selectedCode != null && availableCodes.includes(selectedCode)) {
    return selectedCode;
  }
  if (configuredCode && availableCodes.includes(configuredCode)) {
    return configuredCode;
  }
  return availableCodes[0];
}

/** Drop a user pick that no longer exists in loaded invoice currencies. */
function pruneUserCurrencyPick(userPickedCode, availableCodes, dataReady) {
  if (!dataReady || userPickedCode == null) {
    return userPickedCode;
  }
  return availableCodes.includes(userPickedCode) ? userPickedCode : null;
}

/**
 * Display currency for the dashboard. Before initial data is ready, returns a
 * fallback for skeleton math only — do not store that value as a user pick.
 */
function getDashboardCurrencyDisplay({
  dataReady,
  userPickedCode,
  availableCodes,
  configuredCode,
}) {
  if (!dataReady) {
    return configuredCode ?? 'USD';
  }
  return resolveDashboardCurrencySelection(
    userPickedCode,
    availableCodes,
    configuredCode
  );
}

export {
  addLocalDays,
  formatMoney,
  getDashboardStats,
  getDashboardCurrencyDisplay,
  getMonthlyPaid,
  getNeedsAttention,
  getRecentInvoices,
  pruneUserCurrencyPick,
  resolveDashboardCurrencySelection,
  startOfLocalDay,
  startOfLocalMonth,
  startOfNextLocalMonth,
};
