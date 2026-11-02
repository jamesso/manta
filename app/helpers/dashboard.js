import { formatNumber } from '../../helpers/formatNumber';
import { getPaymentEvents } from './payments';
import { groupCreditNotesByInvoice, onlyCreditNotes } from './creditNotes';
import {
  formatInvoiceAmount,
  getBalanceDue,
  getDisplayStatus,
  getDueDate,
  getInvoiceTotal,
  getIssuedAt,
  onlyInvoices,
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
  return getInvoiceTotal(inv);
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

function getDashboardStats(allSalesDocs, now, fallbackCurrency) {
  const creditByInvoice = groupCreditNotesByInvoice(allSalesDocs);
  const invoices = onlyInvoices(allSalesDocs);
  const creditNotes = onlyCreditNotes(allSalesDocs);
  const byCurrency = {};
  let draft = 0;
  let overdue = 0;
  const monthStart = startOfLocalMonth(now);
  const monthEnd = startOfNextLocalMonth(now);

  for (const cn of creditNotes) {
    if (cn.status !== 'issued') {
      continue;
    }
    const issued = getIssuedAt(cn);
    if (issued == null || issued < monthStart || issued >= monthEnd) {
      continue;
    }
    const code = currencyOf(cn, fallbackCurrency);
    if (!byCurrency[code]) {
      byCurrency[code] = {
        outstanding: 0,
        overdue: 0,
        paidThisMonth: 0,
        creditedThisMonth: 0,
        creditNoteCount: 0,
        draftCount: 0,
        overdueCount: 0,
        outstandingCount: 0,
        currency: currencyObjectOf(cn, fallbackCurrency),
        _newest: 0,
      };
    }
    const bucket = byCurrency[code];
    bucket.creditedThisMonth += cn.grandTotal ?? 0;
    bucket.creditNoteCount += 1;
  }

  for (const inv of invoices) {
    const code = currencyOf(inv, fallbackCurrency);
    if (!byCurrency[code]) {
      byCurrency[code] = {
        outstanding: 0,
        overdue: 0,
        paidThisMonth: 0,
        creditedThisMonth: 0,
        creditNoteCount: 0,
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

    const linked = creditByInvoice.get(inv._id) ?? [];
    const display = getDisplayStatus(inv, now, linked);
    const stored = inv.status ?? 'pending';
    const balance = getBalanceDue(inv, linked);

    if (stored === 'draft') {
      bucket.draftCount += 1;
      draft += 1;
      continue;
    }
    if (stored === 'refunded' || stored === 'cancelled') {
      continue;
    }

    for (const event of getPaymentEvents(inv)) {
      if (event.date == null) {
        continue;
      }
      if (event.date >= monthStart && event.date < monthEnd) {
        bucket.paidThisMonth += event.amount;
      }
    }

    if (balance <= 0) {
      continue;
    }

    if (display === 'overdue') {
      bucket.overdue += balance;
      bucket.overdueCount += 1;
      bucket.outstanding += balance;
      bucket.outstandingCount += 1;
      overdue += 1;
    } else if (display === 'pending' || display === 'partial') {
      bucket.outstanding += balance;
      bucket.outstandingCount += 1;
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
  invoices = onlyInvoices(invoices);
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
    const stored = inv.status ?? 'pending';
    if (stored !== 'pending' && stored !== 'paid') {
      continue;
    }
    for (const event of getPaymentEvents(inv)) {
      if (event.date == null) {
        continue;
      }
      const paidMonth = startOfLocalMonth(event.date);
      if (paidMonth < startMonthStart || paidMonth > endMonthStart) {
        continue;
      }
      const code = currencyOf(inv, fallbackCurrency);
      ensureBuckets(code);
      const key = monthKey(paidMonth);
      const row = result[code].find(r => r.key === key);
      if (row) {
        row.total += event.amount;
      }
    }
  }

  return result;
}

function getNeedsAttention(allSalesDocs, now, days = 7) {
  const creditByInvoice = groupCreditNotesByInvoice(allSalesDocs);
  const invoices = onlyInvoices(allSalesDocs);
  const startToday = startOfLocalDay(now);
  const endExclusive = addLocalDays(startToday, days + 1);

  const overdueList = [];
  const upcoming = [];

  for (const inv of invoices) {
    const linked = creditByInvoice.get(inv._id) ?? [];
    const display = getDisplayStatus(inv, now, linked);
    const due = getDueDate(inv);
    if (due === null) {
      continue;
    }
    if (display === 'overdue') {
      overdueList.push(inv);
    } else if (display === 'pending' || display === 'partial') {
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
  invoices = onlyInvoices(invoices);
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
