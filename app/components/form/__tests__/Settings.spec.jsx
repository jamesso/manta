// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Component
import Settings from '../Settings.jsx';

// Mocks
const currentInvoice = {
  recipient: {
    newRecipient: true,
    new: {},
    select: {},
  },
  rows: [],
  dueDate: {},
  currency: {},
  discount: {},
  tax: {},
  note: {},
  settings: {
    open: false,
    required_fields: {
      invoiceID: false,
      dueDate: false,
      currency: false,
      discount: false,
      tax: false,
      note: false,
    },
  },
  savedSettings: {
    tax: {},
    currency: 'USD',
    required_fields: {
      invoiceID: false,
      dueDate: false,
      currency: false,
      discount: false,
      tax: false,
      note: false,
    },
  },
};
const toggleField = vi.fn();
const toggleFormSettings = vi.fn();
const updateSavedSettings = vi.fn();
const t = vi.fn();

const fieldNames = [
  'invoiceID',
  'dueDate',
  'currency',
  'discount',
  'tax',
  'note',
];

beforeEach(() => {
  toggleField.mockClear();
  toggleFormSettings.mockClear();
  updateSavedSettings.mockClear();
});

describe('Settings component', () => {
  it('toggle field correctly', () => {
    const { container } = render(
      <Settings
        t={t}
        settings={currentInvoice.settings}
        savedSettings={currentInvoice.savedSettings.required_fields}
        toggleField={toggleField}
        toggleFormSettings={toggleFormSettings}
        updateSavedSettings={updateSavedSettings}
      />
    );

    fieldNames.forEach(name => {
      fireEvent.click(container.querySelector(`input[name="${name}"]`));
      expect(toggleField).toHaveBeenCalled();
      expect(toggleField).toHaveBeenCalledWith(name);
      expect(toggleField).not.toHaveBeenCalledWith('something-else');
    });
  });
});
