import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_OMIT,
  buildTemplateFromInvoice,
  buildProfileFromInvoice,
  buildInvoiceFromProfile,
  applyScheduleOnSave,
  getRecurringErrors,
  getRecurringStatus,
  normalizeImportedRecurring,
  materializeDueDate,
} from '../recurring';
import { dateKeyToMs, toDateKey } from '../recurringSchedule';

const sampleInvoice = {
  _id: 'inv-1',
  _rev: '1-abc',
  status: 'pending',
  invoiceID: 'INV-0001',
  issuedAt: dateKeyToMs('2026-01-15'),
  created_at: 1,
  paidAt: 2,
  payments: [],
  recurringId: 'x',
  periodKey: 'y',
  docType: 'invoice',
  recipient: { fullname: 'Acme', email: 'a@acme.com' },
  rows: [
    {
      id: 'r1',
      description: 'Work',
      quantity: '1',
      price: '100',
      subtotal: 100,
    },
  ],
  currency: {
    code: 'USD',
    placement: 'before',
    separator: 'commaDot',
    fraction: 2,
  },
  dueDate: { useCustom: false, paymentTerm: 'NET_30' },
  grandTotal: 100,
  subtotal: 100,
};

describe('buildTemplateFromInvoice', () => {
  it('drops omit keys and clones rows', () => {
    const t = buildTemplateFromInvoice(sampleInvoice, 0);
    for (const key of TEMPLATE_OMIT) {
      expect(t).not.toHaveProperty(key);
    }
    expect(t.docType).toBe('invoice');
    expect(t.rows[0]).not.toBe(sampleInvoice.rows[0]);
  });

  it('converts custom due date to offsetDays', () => {
    const inv = {
      ...sampleInvoice,
      issuedAt: dateKeyToMs('2026-01-01'),
      dueDate: {
        useCustom: true,
        selectedDate: { year: 2026, month: 0, date: 15 },
        paymentTerm: null,
      },
    };
    const t = buildTemplateFromInvoice(inv, dateKeyToMs('2026-01-01'));
    expect(t.dueDate.offsetDays).toBe(14);
    expect(t.dueDate.paymentTerm).toBeNull();
  });

  it('keeps payment term', () => {
    const t = buildTemplateFromInvoice(sampleInvoice, 0);
    expect(t.dueDate.paymentTerm).toBe('NET_30');
  });
});

describe('buildInvoiceFromProfile', () => {
  const profile = {
    _id: 'prof-1',
    interval: 'monthly',
    every: 1,
    anchorDay: 1,
    template: buildTemplateFromInvoice(sampleInvoice, 0),
  };

  it('builds deterministic draft', () => {
    const now = 999;
    const inv = buildInvoiceFromProfile(
      profile,
      '2026-02-01',
      now,
      () => 'row-id'
    );
    expect(inv._id).toBe('rec-prof-1-2026-02-01');
    expect(inv.status).toBe('draft');
    expect(inv.invoiceID).toBeUndefined();
    expect(inv.recurringId).toBe('prof-1');
    expect(inv.periodKey).toBe('2026-02-01');
    expect(inv.issuedAt).toBe(dateKeyToMs('2026-02-01'));
    expect(inv.created_at).toBe(now);
    expect(inv.rows[0].id).toBe('row-id');
    expect(inv.grandTotal).toBe(100);
  });

  it('materializes offset due date', () => {
    const p = {
      ...profile,
      template: {
        ...profile.template,
        dueDate: { useCustom: true, offsetDays: 7, paymentTerm: null },
      },
    };
    const inv = buildInvoiceFromProfile(p, '2026-02-01', 1, () => 'x');
    expect(inv.dueDate.useCustom).toBe(true);
    expect(inv.dueDate.selectedDate.date).toBe(8);
  });
});

describe('applyScheduleOnSave', () => {
  const now = dateKeyToMs('2026-06-01');

  it('new profile with past start uses first period on or after today', () => {
    const edited = {
      startDate: '2026-01-01',
      interval: 'monthly',
      every: 1,
      active: true,
    };
    const r = applyScheduleOnSave(null, edited, now);
    expect(r.nextDate >= '2026-06-01').toBe(true);
    expect(r.anchorDay).toBe(1);
  });

  it('name-only edit keeps nextDate', () => {
    const prev = {
      startDate: '2026-01-01',
      interval: 'monthly',
      every: 1,
      active: true,
      nextDate: '2026-07-01',
    };
    const r = applyScheduleOnSave(prev, { ...prev, name: 'New' }, now);
    expect(r.nextDate).toBe('2026-07-01');
  });

  it('interval change recomputes', () => {
    const prev = {
      startDate: '2026-01-01',
      interval: 'monthly',
      every: 1,
      active: true,
      nextDate: '2026-07-01',
    };
    const r = applyScheduleOnSave(
      prev,
      { ...prev, interval: 'weekly', every: 1 },
      now
    );
    expect(r.nextDate).not.toBe('2026-07-01');
  });

  it('resume with old nextDate skips paused periods', () => {
    const prev = {
      startDate: '2026-01-01',
      interval: 'monthly',
      every: 1,
      active: false,
      nextDate: '2026-03-01',
    };
    const r = applyScheduleOnSave(prev, { ...prev, active: true }, now);
    expect(r.nextDate >= '2026-06-01').toBe(true);
  });

  it('resume with future nextDate keeps it', () => {
    const prev = {
      startDate: '2026-01-01',
      interval: 'monthly',
      every: 1,
      active: false,
      nextDate: '2026-12-01',
    };
    const r = applyScheduleOnSave(prev, { ...prev, active: true }, now);
    expect(r.nextDate).toBe('2026-12-01');
  });
});

describe('getRecurringErrors', () => {
  const valid = {
    name: 'Retainer',
    every: 1,
    interval: 'monthly',
    startDate: '2026-01-01',
    endDate: null,
    template: buildTemplateFromInvoice(sampleInvoice, 0),
  };

  it('flags missing name', () => {
    expect(getRecurringErrors({ ...valid, name: '  ' }).name).toBeDefined();
  });

  it('flags bad every', () => {
    expect(getRecurringErrors({ ...valid, every: 0 }).every).toBeDefined();
  });
});

describe('getRecurringStatus', () => {
  it('returns paused, ended, active', () => {
    expect(getRecurringStatus({ active: false }, 0)).toBe('paused');
    expect(
      getRecurringStatus(
        { active: true, endDate: '2026-01-01', nextDate: '2026-02-01' },
        0
      )
    ).toBe('ended');
    expect(
      getRecurringStatus(
        { active: true, endDate: null, nextDate: '2026-06-01' },
        0
      )
    ).toBe('active');
  });
});

describe('normalizeImportedRecurring', () => {
  it('fast-forwards old nextDate', () => {
    const now = dateKeyToMs('2026-06-01');
    const doc = {
      startDate: '2026-01-01',
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      nextDate: '2026-01-01',
    };
    const n = normalizeImportedRecurring(doc, now);
    expect(n.nextDate >= '2026-06-01').toBe(true);
  });

  it('keeps future nextDate', () => {
    const now = dateKeyToMs('2026-06-01');
    const doc = {
      startDate: '2026-01-01',
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      nextDate: '2026-12-01',
    };
    expect(normalizeImportedRecurring(doc, now).nextDate).toBe('2026-12-01');
  });
});

describe('materializeDueDate', () => {
  it('returns undefined when empty', () => {
    expect(materializeDueDate(undefined, 0)).toBeUndefined();
  });
});
