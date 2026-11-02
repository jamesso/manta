vi.mock('electron', () => ({
  clipboard: { writeText: vi.fn() },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  shell: { openExternal: vi.fn(), showItemInFolder: vi.fn() },
  BrowserWindow: { fromId: vi.fn(), fromWebContents: vi.fn() },
  ShareMenu: vi.fn(),
}));

vi.mock('../settings', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../print-invoice-pdf.js', () => ({
  writeInvoicePdf: vi.fn(),
}));

vi.mock('../preview-pdf-coordinator', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    runPreviewPdfJob: vi.fn(),
    getPreviewWindow: vi.fn(),
  };
});

import {
  buildMailto,
  validateCaptureSnapshotPayload,
  validateEmailRequest,
  validateShareRequest,
} from '../../helpers/email';
import {
  consumePreviewToken,
  createPreviewToken,
  restorePreviewToken,
} from '../preview-pdf-coordinator';
import { getEmailVars } from '../../app/helpers/emailDraft';
import { clipboard, ipcMain, shell, BrowserWindow } from 'electron';
import appConfig from '../settings';
import { runPreviewPdfJob } from '../preview-pdf-coordinator';

describe('email request validation', () => {
  const basePayload = {
    invoiceId: 'inv1',
    kind: 'invoice',
    invoice: {
      _id: 'inv1',
      docType: 'invoice',
      invoiceID: 'INV-1',
      status: 'pending',
    },
    draft: {
      to: 'user@example.com',
      subject: 'Hello',
      body: 'Body',
    },
    fileBase: 'INV-1',
    source: 'app',
    snapshot: {
      profile: { fullname: 'Co', logo: 'data:image/png;base64,abc' },
      configs: { language: 'en' },
      language: 'en',
    },
  };

  it('accepts a large profile logo data url', () => {
    expect(() => validateEmailRequest(basePayload)).not.toThrow();
  });

  it('rejects malformed logo data', () => {
    expect(() =>
      validateEmailRequest({
        ...basePayload,
        snapshot: {
          ...basePayload.snapshot,
          profile: { logo: 'data:text/plain;base64,abc' },
        },
      })
    ).toThrow('invalid-request');
  });
});

describe('preview token handoff', () => {
  it('returns null on second consume', () => {
    const token = createPreviewToken({
      invoiceId: 'inv-1',
      invoice: { _id: 'inv-1' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
    });
    expect(consumePreviewToken(token, 'inv-1')).toBeTruthy();
    expect(consumePreviewToken(token, 'inv-1')).toBeNull();
  });

  it('restores a preview token after a failed handoff', () => {
    const token = createPreviewToken({
      invoiceId: 'inv-1',
      invoice: { _id: 'inv-1' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
    });
    const entry = consumePreviewToken(token, 'inv-1');
    restorePreviewToken(token, entry);
    expect(consumePreviewToken(token, 'inv-1')).toBeTruthy();
  });
});

describe('truncated mail draft metadata', () => {
  it('does not write the clipboard when building mailto', () => {
    buildMailto({
      to: 'user@example.com',
      subject: 'Hi',
      body: 'x'.repeat(5000),
    });
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('builds fullMessage from the original draft when truncated', () => {
    const draft = { subject: 'Subj', body: 'B'.repeat(5000) };
    const { truncated } = buildMailto({
      to: 'user@example.com',
      subject: draft.subject,
      body: draft.body,
    });
    expect(truncated).toBe(true);
    const fullMessage = `${draft.subject}\n\n${draft.body}`;
    expect(fullMessage).toContain(draft.body.slice(0, 20));
  });
});

describe('reminder balance with issued credit', () => {
  it('uses raw sales docs to reduce balance in template vars', () => {
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
        grandTotal: 40,
      },
    ];
    const vars = getEmailVars(invoice, {
      profile: { company: 'Co' },
      dateFormat: 'MM/DD/YYYY',
      t: key => key,
      allSalesDocs,
    });
    expect(vars.balance).toBe('USD 60.00');
  });
});

describe('capture preview snapshot payload', () => {
  it('validates invoice and snapshot shape', () => {
    const out = validateCaptureSnapshotPayload({
      invoice: { _id: 'x', docType: 'invoice', invoiceID: '1' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
    });
    expect(out.invoice._id).toBe('x');
  });
});

describe('email-invoice ipc handler', () => {
  let emailHandler;
  const mainWin = { id: 1, isDestroyed: () => false };
  const trustedEvent = {
    sender: { mainFrame: 'frame' },
    senderFrame: 'frame',
  };

  beforeAll(async () => {
    ipcMain.handle.mockImplementation((channel, fn) => {
      if (channel === 'email-invoice') {
        emailHandler = fn;
      }
    });
    appConfig.get.mockImplementation(key => {
      if (key === 'mainWindowID') {
        return 1;
      }
      if (key === 'previewWindowID') {
        return 2;
      }
      if (key === 'invoice.exportDir') {
        return '/tmp/manta-export';
      }
      return undefined;
    });
    BrowserWindow.fromWebContents.mockReturnValue(mainWin);
    await import('../email-invoice.js');
  });

  beforeEach(() => {
    shell.openExternal.mockClear();
    shell.showItemInFolder.mockClear();
    runPreviewPdfJob.mockReset();
  });

  const basePayload = {
    invoiceId: 'inv1',
    kind: 'invoice',
    invoice: {
      _id: 'inv1',
      docType: 'invoice',
      invoiceID: 'INV-1',
      status: 'pending',
    },
    draft: {
      to: 'user@example.com',
      subject: 'Hello',
      body: 'Body',
    },
    fileBase: 'INV-1',
    source: 'app',
    snapshot: {
      profile: { fullname: 'Co' },
      configs: { language: 'en' },
      language: 'en',
    },
  };

  it('rejects an untrusted sender without opening mail or writing pdf', async () => {
    BrowserWindow.fromWebContents.mockReturnValueOnce({
      id: 99,
      isDestroyed: () => false,
    });
    const res = await emailHandler(trustedEvent, basePayload);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('untrusted-sender');
    expect(shell.openExternal).not.toHaveBeenCalled();
    expect(runPreviewPdfJob).not.toHaveBeenCalled();
  });

  it('returns fullMessage when the draft is truncated', async () => {
    runPreviewPdfJob.mockResolvedValueOnce('/tmp/manta-export/INV-1.pdf');
    const res = await emailHandler(trustedEvent, {
      ...basePayload,
      draft: {
        to: 'user@example.com',
        subject: 'S'.repeat(400),
        body: 'B'.repeat(5000),
      },
    });
    expect(res.ok).toBe(true);
    expect(res.truncated).toBe(true);
    expect(res.fullMessage).toContain('B'.repeat(20));
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });
});

describe('share-invoice-pdf validation', () => {
  it('rejects malformed share payloads before print', () => {
    expect(() =>
      validateShareRequest({
        invoiceId: 'inv1',
        invoice: { _id: 'inv1', docType: 'estimate', invoiceID: 'E-1' },
        fileBase: 'E-1',
        source: 'preview',
        snapshot: { profile: {}, configs: {}, language: 'en' },
        previewToken: 'tok',
      })
    ).toThrow('invalid-request');
  });
});
