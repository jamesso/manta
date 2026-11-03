import { vi } from 'vitest';
import * as emailPrompt from '../emailPrompt';
import { runEmailFlow } from '../emailFlow';

describe('runEmailFlow', () => {
  it('returns canceled when the user dismisses the prompt', async () => {
    vi.spyOn(emailPrompt, 'askEmail').mockResolvedValue(null);
    const result = await runEmailFlow(
      {
        invoice: {
          _id: 'i1',
          docType: 'invoice',
          invoiceID: 'INV-1',
          status: 'pending',
          recipient: { fullname: 'A' },
        },
        kind: 'invoice',
      },
      {
        dispatch: vi.fn(),
        contacts: [],
        allSalesDocs: [],
        ipc: { invoke: vi.fn() },
      }
    );
    expect(result).toBe('canceled');
    emailPrompt.askEmail.mockRestore();
  });

  it('uses invoice seller company for preview-origin drafts', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      fileName: 'INV-1.pdf',
    });
    await runEmailFlow(
      {
        invoice: {
          _id: 'i1',
          docType: 'invoice',
          invoiceID: 'INV-1',
          status: 'pending',
          recipient: { fullname: 'Client', email: 'client@example.com' },
          seller: { company: 'Old Company' },
          currency: {
            code: 'USD',
            fraction: 2,
            separator: 'commaDot',
            placement: 'before',
          },
          grandTotal: 50,
          rows: [{ subtotal: 50 }],
        },
        kind: 'invoice',
        source: 'preview',
        snapshot: {
          profile: { company: 'New Company' },
          configs: { language: 'en', dateFormat: 'MM/DD/YYYY' },
          language: 'en',
        },
        previewToken: '0123456789abcdef',
      },
      {
        dispatch: vi.fn(),
        contacts: [],
        allSalesDocs: [],
        ipc: { invoke },
        settings: {
          get: key => {
            if (key === 'invoice') {
              return {
                emailTemplate: { subject: '{company}', body: 'From {company}' },
              };
            }
            if (key === 'general') {
              return { language: 'en' };
            }
            if (key === 'profile') {
              return { company: 'New Company' };
            }
            return {};
          },
        },
      }
    );
    expect(invoke).toHaveBeenCalled();
    const payload = invoke.mock.calls[0][1];
    expect(payload.draft.subject).toBe('Old Company');
    expect(payload.draft.body).toContain('Old Company');
    expect(payload.draft.subject).not.toContain('New Company');
  });
});
