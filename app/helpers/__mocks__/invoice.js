import { vi } from 'vitest';

export const getInvoiceValue = vi.fn(() => ({
  subtotal: 'subTotal',
  grandTotal: 'grandTotal',
}));
