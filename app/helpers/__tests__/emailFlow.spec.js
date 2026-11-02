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
});
