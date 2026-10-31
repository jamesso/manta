// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Component
import { InvoiceID } from '../InvoiceID.jsx';

// Mocks
const t = vi.fn();
const updateFieldData = vi.fn();
const invoiceID = 'Invoice: 123-456-789';

beforeEach(() => {
  updateFieldData.mockClear();
});

describe('InvoiceID component', () => {
  it('handleInputChange correctly', () => {
    const spy = vi.spyOn(InvoiceID.prototype, 'handleInputChange');
    const { container } = render(
      <InvoiceID
        t={t}
        invoiceID={invoiceID}
        updateFieldData={updateFieldData}
      />
    );
    fireEvent.change(container.querySelector('input'), {
      target: { value: 'Invoice: 987-654-321' },
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('clears the input when the invoice id prop is cleared', () => {
    const { container, rerender } = render(
      <InvoiceID t={t} invoiceID="start" updateFieldData={updateFieldData} />
    );
    const input = container.querySelector('input[name="invoiceID"]');
    fireEvent.change(input, { target: { value: 'ABC' } });
    expect(input.value).toBe('ABC');
    rerender(
      <InvoiceID t={t} invoiceID="" updateFieldData={updateFieldData} />
    );
    expect(container.querySelector('input[name="invoiceID"]').value).toBe('');
  });
});
