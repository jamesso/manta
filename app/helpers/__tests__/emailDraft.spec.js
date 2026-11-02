import {
  buildEmailDraft,
  canEmail,
  canSendReminder,
  getEmailTemplate,
  getEmailVars,
  resolveRecipient,
  withSentMark,
} from '../emailDraft';

const t = (key, opts) => {
  if (key === 'email:vars:noDueDate') {
    return 'on receipt';
  }
  if (key === 'email:defaults:invoice:subject') {
    return 'Invoice {number} from {company}';
  }
  if (key === 'email:defaults:invoice:body') {
    return 'Body {number}';
  }
  if (key === 'email:defaults:reminder:subject') {
    return 'Reminder {number}';
  }
  if (key === 'email:defaults:reminder:body') {
    return 'Rem {balance}';
  }
  return key;
};

describe('getEmailTemplate', () => {
  it('falls back to defaults for missing or blank fields', () => {
    expect(getEmailTemplate({}, 'invoice', t).subject).toContain('Invoice');
    expect(
      getEmailTemplate(
        { emailTemplate: { subject: '  ', body: '' } },
        'invoice',
        t
      ).isDefault
    ).toBe(true);
  });

  it('keeps custom template', () => {
    const out = getEmailTemplate(
      { emailTemplate: { subject: 'Custom', body: 'B' } },
      'invoice',
      t
    );
    expect(out.subject).toBe('Custom');
    expect(out.isDefault).toBe(false);
  });
});

describe('getEmailVars', () => {
  it('uses invoice number fallback and company fallback', () => {
    const vars = getEmailVars(
      {
        _id: 'abcdefgh1234',
        recipient: { company: 'Co' },
        currency: {
          code: 'USD',
          fraction: 2,
          separator: 'commaDot',
          placement: 'before',
        },
        grandTotal: 10,
      },
      {
        profile: { fullname: 'Ray' },
        dateFormat: 'MM/DD/YYYY',
        t,
        allSalesDocs: [],
      }
    );
    expect(vars.number).toBe('abcdefgh');
    expect(vars.client).toBe('Co');
    expect(vars.company).toBe('Ray');
    expect(vars.dueDate).toBe('on receipt');
  });

  it('includes credited balance from issued credit notes', () => {
    const invoice = {
      _id: 'inv1',
      docType: 'invoice',
      invoiceID: 'INV-1',
      status: 'pending',
      currency: {
        code: 'USD',
        fraction: 2,
        separator: 'commaDot',
        placement: 'before',
      },
      grandTotal: 100,
      payments: [],
    };
    const allSalesDocs = [
      invoice,
      {
        docType: 'creditNote',
        creditedInvoiceId: 'inv1',
        status: 'issued',
        currency: { code: 'USD', fraction: 2 },
        grandTotal: 25,
      },
    ];
    const vars = getEmailVars(invoice, {
      profile: { company: 'Co' },
      dateFormat: 'MM/DD/YYYY',
      t,
      allSalesDocs,
    });
    expect(vars.balance).toBe('USD 75.00');
  });
});

describe('resolveRecipient', () => {
  it('prefers contact email over invoice copy', () => {
    const { email } = resolveRecipient(
      { recipient: { _id: 'c1', email: 'old@example.com' } },
      [{ _id: 'c1', email: 'new@example.com' }]
    );
    expect(email).toBe('new@example.com');
  });

  it('falls back when contact email invalid', () => {
    const { email } = resolveRecipient(
      { recipient: { _id: 'c1', email: 'good@example.com' } },
      [{ _id: 'c1', email: 'bad' }]
    );
    expect(email).toBe('good@example.com');
  });

  it('returns empty when none valid', () => {
    expect(resolveRecipient({ recipient: {} }, []).email).toBe('');
  });
});

describe('canSendReminder', () => {
  const now = Date.parse('2026-06-15');

  it('is true only for overdue invoices', () => {
    const inv = {
      _id: 'i1',
      docType: 'invoice',
      invoiceID: 'INV-1',
      status: 'pending',
      issuedAt: Date.parse('2026-06-01'),
      dueDate: { useCustom: true, selectedDate: Date.parse('2026-06-01') },
      currency: {
        code: 'USD',
        fraction: 2,
        separator: 'commaDot',
        placement: 'before',
      },
      grandTotal: 1,
    };
    expect(canSendReminder(inv, now, [])).toBe(true);
    expect(canSendReminder({ ...inv, status: 'draft' }, now, [])).toBe(false);
    expect(canSendReminder({ ...inv, docType: 'estimate' }, now, [])).toBe(
      false
    );
  });
});

describe('withSentMark', () => {
  const doc = {
    _id: 'i1',
    docType: 'invoice',
    invoiceID: 'INV-1',
    status: 'pending',
    paidAt: 1,
  };

  it('rejects drafts', () => {
    expect(() =>
      withSentMark({ ...doc, status: 'draft', invoiceID: '' }, 'invoice', 5)
    ).toThrow();
  });

  it('sets sentAt without changing status or paidAt', () => {
    const next = withSentMark(doc, 'invoice', 99);
    expect(next.sentAt).toBe(99);
    expect(next.status).toBe('pending');
    expect(next.paidAt).toBe(1);
  });

  it('sets remindedAt for reminder kind', () => {
    const next = withSentMark(doc, 'reminder', 88);
    expect(next.remindedAt).toBe(88);
    expect(next.sentAt).toBeUndefined();
  });
});

describe('buildEmailDraft', () => {
  it('fills templates', () => {
    const draft = buildEmailDraft(
      {
        _id: 'x',
        invoiceID: 'INV-9',
        recipient: { fullname: 'Ann' },
        currency: {
          code: 'USD',
          fraction: 2,
          separator: 'commaDot',
          placement: 'before',
        },
        grandTotal: 1,
      },
      'invoice',
      {
        to: 'a@example.com',
        invoiceSettings: {},
        profile: { company: 'Co' },
        t,
        allSalesDocs: [],
        dateFormat: 'YYYY-MM-DD',
      }
    );
    expect(draft.to).toBe('a@example.com');
    expect(draft.subject).toContain('INV-9');
  });
});

describe('canEmail', () => {
  it('requires finalized invoice doc type', () => {
    expect(
      canEmail({
        _id: '1',
        docType: 'invoice',
        invoiceID: 'INV-1',
        status: 'pending',
      })
    ).toBe(true);
    expect(
      canEmail({
        _id: '1',
        docType: 'estimate',
        invoiceID: 'E',
        status: 'pending',
      })
    ).toBe(false);
  });
});
