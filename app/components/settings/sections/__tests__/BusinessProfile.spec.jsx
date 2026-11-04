import React from 'react';
import { render, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../../i18n/i18n';
import BusinessProfile from '../BusinessProfile';

let addressRenders = 0;
vi.mock('../../../shared/PostalAddressFields.jsx', () => ({
  default: () => {
    addressRenders += 1;
    // The loop runs inside act() and never yields, so stop it here.
    if (addressRenders > 20) {
      throw new Error('BusinessProfile keeps re-rendering');
    }
    return null;
  },
}));
vi.mock('../../_partials/profile/Logo', () => ({ default: () => null }));

// Regression: an unstable `value` for useDebouncedSave re-rendered the page
// without end, and opening the country combobox crashed it (React #185).
it('stops rendering once mounted', async () => {
  const props = {
    value: { fullname: 'Ada', postalAddress: { countryCode: 'DE' } },
    invoiceSettings: { taxRates: [] },
    onSave: vi.fn(),
    errors: {},
    saveMessage: '',
    registerFlush: vi.fn(),
  };
  render(
    <I18nextProvider i18n={i18n}>
      <BusinessProfile {...props} />
    </I18nextProvider>
  );
  await act(() => new Promise(resolve => setTimeout(resolve, 50)));
  const settled = addressRenders;
  await act(() => new Promise(resolve => setTimeout(resolve, 50)));
  expect(addressRenders).toBe(settled);
  expect(settled).toBeLessThan(5);
});
