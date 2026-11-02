import moment from 'moment';
import { getIssuedAt, getInvoiceTotals } from './invoice';
import {
  DATE_KEY,
  firstPeriodOnOrAfter,
  isDateKey,
  nextDateAfter,
  toDateKey,
} from './recurringSchedule';

export const TEMPLATE_OMIT = [
  '_id',
  '_rev',
  'status',
  'paidAt',
  'issuedAt',
  'created_at',
  'invoiceID',
  'payments',
  'recurringId',
  'periodKey',
  'sourceEstimateId',
  'convertedInvoiceId',
  'creditedInvoiceId',
  'creditedInvoice',
  'sentAt',
  'remindedAt',
  'recurringTombstone',
];

function omitKeys(obj, keys) {
  const next = structuredClone(obj);
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

export function buildTemplateFromInvoice(invoice, now) {
  const template = omitKeys(invoice, TEMPLATE_OMIT);
  template.docType = 'invoice';
  template.rows = (template.rows ?? []).map(row => ({ ...row }));

  const dueDate = template.dueDate;
  if (dueDate?.useCustom && dueDate.selectedDate) {
    const issueMs = getIssuedAt(invoice) ?? now;
    const issueDay = moment(issueMs).startOf('day');
    const dueDay = moment(dueDate.selectedDate).startOf('day');
    const offsetDays = Math.max(0, dueDay.diff(issueDay, 'days'));
    template.dueDate = {
      useCustom: true,
      offsetDays,
      paymentTerm: null,
      selectedDate: null,
    };
  }
  return template;
}

export function buildProfileFromInvoice(invoice, now) {
  const recipient = invoice.recipient ?? {};
  const name =
    recipient.fullname?.trim() ||
    recipient.company?.trim() ||
    recipient.name?.trim() ||
    '';
  const issueKey = toDateKey(getIssuedAt(invoice) ?? now);
  const anchorDay = moment(issueKey, DATE_KEY, true).date();
  const startDate = nextDateAfter(issueKey, 'monthly', 1, anchorDay);
  return {
    name,
    interval: 'monthly',
    every: 1,
    startDate,
    anchorDay: moment(startDate, DATE_KEY, true).date(),
    nextDate: startDate,
    endDate: null,
    active: true,
    lastRunAt: null,
    template: buildTemplateFromInvoice(invoice, now),
    sourceInvoiceId: invoice._id,
  };
}

export function materializeDueDate(dueDate, issuedAtMs) {
  if (!dueDate) {
    return undefined;
  }
  if (dueDate.useCustom && Number.isFinite(dueDate.offsetDays)) {
    return {
      useCustom: true,
      selectedDate: moment(issuedAtMs)
        .add(dueDate.offsetDays, 'days')
        .toObject(),
      paymentTerm: null,
    };
  }
  return structuredClone(dueDate);
}

export function buildInvoiceFromProfile(
  profile,
  periodKey,
  now,
  makeId = () => crypto.randomUUID()
) {
  const issuedAt = moment(periodKey, DATE_KEY, true).startOf('day').valueOf();
  const template = structuredClone(profile.template);
  const rows = (template.rows ?? []).map(row => ({
    ...row,
    id: makeId(),
  }));
  const dueDate = materializeDueDate(template.dueDate, issuedAt);
  const draft = {
    ...template,
    rows,
    _id: `rec-${profile._id}-${periodKey}`,
    status: 'draft',
    docType: 'invoice',
    issuedAt,
    created_at: now,
    recurringId: profile._id,
    periodKey,
    dueDate,
  };
  delete draft.invoiceID;
  const totals = getInvoiceTotals(draft);
  return {
    ...draft,
    subtotal: totals.subtotal,
    grandTotal: totals.grandTotal,
  };
}

export function getRecurringErrors(profile) {
  const errors = {};
  if (!profile.name?.trim()) {
    errors.name = 'recurring:errors:name';
  }
  const every = profile.every;
  if (!Number.isInteger(every) || every < 1 || every > 99) {
    errors.every = 'recurring:errors:every';
  }
  if (
    !['weekly', 'monthly', 'quarterly', 'yearly'].includes(profile.interval)
  ) {
    errors.interval = 'recurring:errors:interval';
  }
  if (!isDateKey(profile.startDate)) {
    errors.startDate = 'recurring:errors:startDate';
  }
  if (profile.endDate != null && profile.endDate !== '') {
    if (!isDateKey(profile.endDate)) {
      errors.endDate = 'recurring:errors:endDate';
    } else if (
      isDateKey(profile.startDate) &&
      profile.endDate < profile.startDate
    ) {
      errors.endDate = 'recurring:errors:endDate';
    }
  }
  const template = profile.template;
  if (!template?.recipient?.fullname && !template?.recipient?.company) {
    errors.template = 'recurring:errors:template';
  } else if (!Array.isArray(template?.rows) || template.rows.length === 0) {
    errors.template = 'recurring:errors:template';
  }
  return errors;
}

export function getRecurringStatus(profile, _now) {
  if (!profile.active) {
    return 'paused';
  }
  if (
    profile.endDate != null &&
    isDateKey(profile.endDate) &&
    profile.nextDate > profile.endDate
  ) {
    return 'ended';
  }
  return 'active';
}

function scheduleFieldsChanged(previous, edited) {
  if (!previous) {
    return true;
  }
  return (
    previous.interval !== edited.interval ||
    previous.every !== edited.every ||
    previous.startDate !== edited.startDate
  );
}

export function applyScheduleOnSave(previous, edited, now) {
  const today = toDateKey(now);
  const anchorDay = moment(edited.startDate, DATE_KEY, true).date();
  const base = { anchorDay };

  const resumed =
    previous && !previous.active && edited.active && previous.nextDate < today;

  if (!previous || scheduleFieldsChanged(previous, edited) || resumed) {
    const fromKey = today > edited.startDate ? today : edited.startDate;
    const nextDate = firstPeriodOnOrAfter({ ...edited, anchorDay }, fromKey);
    return { ...base, nextDate };
  }

  return { ...base, nextDate: previous.nextDate };
}

export function normalizeImportedRecurring(doc, now) {
  const today = toDateKey(now);
  if (!isDateKey(doc.nextDate) || doc.nextDate < today) {
    return {
      ...doc,
      nextDate: firstPeriodOnOrAfter(doc, today),
    };
  }
  return doc;
}

export function isRecurringPeriodTaken(invoice, profileId, periodKey) {
  if (!invoice.recurringId || !invoice.periodKey) {
    return false;
  }
  if (invoice.recurringId !== profileId || invoice.periodKey !== periodKey) {
    return false;
  }
  return true;
}

export function buildRecurringTombstone(profileId, periodKey) {
  return {
    _id: `rec-${profileId}-${periodKey}`,
    docType: 'invoice',
    recurringId: profileId,
    periodKey,
    recurringTombstone: true,
    status: 'draft',
  };
}
