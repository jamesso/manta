// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Component
import { Tax } from '../Tax.jsx';

// Mocks
const tax = {
  amount: 10,
  tin: '123-456-789',
  mode: 'default',
};
const savedSettings = {
  amount: 10,
  tin: '123-456-789',
  mode: 'default',
};
const t = vi.fn();
const updateFieldData = vi.fn();
const updateSavedSettings = vi.fn();

beforeEach(() => {
  updateFieldData.mockClear();
  updateSavedSettings.mockClear();
});

describe('Note component', () => {
  it('handleInputChange correctly', () => {
    const spy = vi.spyOn(Tax.prototype, 'handleInputChange');
    const { container } = render(
      <Tax
        t={t}
        tax={tax}
        savedSettings={savedSettings}
        updateSavedSettings={updateSavedSettings}
        updateFieldData={updateFieldData}
      />
    );
    fireEvent.change(container.querySelector('input[name="amount"]'), {
      target: { value: '20' },
    });
    expect(spy).toHaveBeenCalled();
    fireEvent.change(container.querySelector('input[name="tin"]'), {
      target: { value: '987-654-321' },
    });
    expect(spy).toHaveBeenCalled();
    fireEvent.change(container.querySelector('select'), {
      target: { value: 'reverse' },
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
