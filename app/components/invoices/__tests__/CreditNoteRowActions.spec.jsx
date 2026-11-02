import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CreditNoteRowActions from '../CreditNoteRowActions';

describe('CreditNoteRowActions', () => {
  it('does not offer preview for draft credit notes', () => {
    const ipc = { send: vi.fn() };
    window.manta.ipc = ipc;
    render(
      <CreditNoteRowActions
        creditNote={{
          _id: 'cn-1',
          docType: 'creditNote',
          status: 'draft',
          grandTotal: 10,
          currency: { code: 'USD', fraction: 2 },
        }}
        dispatch={vi.fn()}
        t={key => key}
      />
    );
    expect(
      screen.queryByText('invoices:creditNotes:actions:preview')
    ).toBeNull();
  });
});
