import { vi } from 'vitest';

export const validateFormData = vi.fn(
  currentFormData => currentFormData.validation
);
export const validateCurrency = vi.fn((required, currency) => true);
export const validateTax = vi.fn((required, currency) => true);
export const getInvoiceData = vi.fn(currentFormData => currentFormData);
