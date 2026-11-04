import { describe, it, expect } from 'vitest';
import {
  getRecurringClient,
  matchesRecurringQuery,
  TEMPLATE_OMIT,
  buildTemplateFromInvoice,
  buildProfileFromInvoice,
  buildInvoiceFromProfile,
  applyScheduleOnSave,
  getRecurringErrors,
  getRecurringStatus,
  previewRecurringDates,
  normalizeImportedRecurring,
  materializeDueDate,
  getRecurringTotal,
  formatRecurringInterval,
} from '../recurring';
import { dateKeyToMs, toDateKey } from '../recurringSchedule';
import i18next from 'i18next';
import en from '../../../i18n/en';
import sk from '../../../i18n/sk';
import zhCN from '../../../i18n/zh-CN';

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
    const inv = {
      ...sampleInvoice,
      seller: { version: 1, taxId: 'T', vatId: 'V' },
    };
    const t = buildTemplateFromInvoice(inv, 0);
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

  it('does not copy seller onto recurring draft', () => {
    const p = {
      ...profile,
      template: {
        ...profile.template,
        seller: { version: 1, taxId: 'OLD' },
      },
    };
    const inv = buildInvoiceFromProfile(p, '2026-02-01', 1, () => 'x');
    expect(inv.seller).toBeUndefined();
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

  it('does not throw when name is not a string', () => {
    expect(() => getRecurringErrors({ ...valid, name: 123 })).not.toThrow();
    expect(getRecurringErrors({ ...valid, name: 123 }).name).toBeDefined();
  });

  it('rejects null template rows and non-string recipient names', () => {
    const errors = getRecurringErrors({
      ...valid,
      template: { recipient: { fullname: 123 }, rows: [null] },
    });
    expect(errors.template).toBeDefined();
  });
});

describe('previewRecurringDates', () => {
  const profile = {
    name: 'P',
    every: 1,
    interval: 'monthly',
    startDate: '2026-11-02',
    nextDate: '2026-11-02',
    anchorDay: 2,
    endDate: null,
    active: true,
    template: {
      recipient: { fullname: 'Client' },
      rows: [{ quantity: 1, price: 1, subtotal: 1 }],
    },
  };

  it('returns empty preview when every is cleared or invalid', () => {
    expect(
      previewRecurringDates(null, { ...profile, every: '' }, Date.now())
        .nextPreview
    ).toEqual([]);
    expect(
      previewRecurringDates(null, { ...profile, every: 0 }, Date.now())
        .nextPreview
    ).toEqual([]);
    expect(
      previewRecurringDates(null, { ...profile, every: 1.5 }, Date.now())
        .nextPreview
    ).toEqual([]);
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

describe('matchesRecurringQuery', () => {
  const profile = {
    name: 'Monthly retainer',
    template: { recipient: { fullname: 'Jane Doe', company: 'Acme Corp' } },
  };

  it('needs every word, across the name and the client', () => {
    expect(matchesRecurringQuery(profile, '')).toBe(true);
    expect(matchesRecurringQuery(profile, 'retainer acme')).toBe(true);
    expect(matchesRecurringQuery(profile, 'retainer globex')).toBe(false);
  });

  it('reads the client from fullname, then company', () => {
    expect(getRecurringClient(profile)).toBe('Jane Doe');
    expect(
      getRecurringClient({ template: { recipient: { company: 'X' } } })
    ).toBe('X');
    expect(getRecurringClient({})).toBe('');
  });
});

describe('getRecurringTotal', () => {
  it('computes the total from template rows when none is stored', () => {
    const template = buildTemplateFromInvoice(sampleInvoice, 0);
    delete template.grandTotal;
    delete template.subtotal;
    expect(getRecurringTotal({ template })).toBe(100);
  });

  it('returns 0 for a profile without a template', () => {
    expect(getRecurringTotal({})).toBe(0);
  });
});

describe('formatRecurringInterval', () => {
  const tFor = lng => {
    const i18n = i18next.createInstance();
    i18n.init({
      initAsync: false,
      lng,
      fallbackLng: 'en',
      resources: { en, sk, 'zh-CN': zhCN },
    });
    return i18n.t.bind(i18n);
  };

  it('shows the period label when it repeats every 1 period', () => {
    expect(formatRecurringInterval(tFor('en'), 'weekly', 1)).toBe('Weekly');
    // zh-CN has no "one" plural form; it must not fall back to English.
    expect(formatRecurringInterval(tFor('zh-CN'), 'weekly', 1)).toBe('每周');
  });

  it('uses the plural rules of the language for counts', () => {
    expect(formatRecurringInterval(tFor('en'), 'monthly', 3)).toBe(
      'Every 3 months'
    );
    expect(formatRecurringInterval(tFor('zh-CN'), 'monthly', 3)).toBe(
      '每 3 个月'
    );
    // Slovak: 2-4 take the "few" form, 5+ take "other".
    expect(formatRecurringInterval(tFor('sk'), 'weekly', 3)).toBe(
      'Každé 3 týždne'
    );
    expect(formatRecurringInterval(tFor('sk'), 'weekly', 5)).toBe(
      'Každých 5 týždňov'
    );
  });
});
