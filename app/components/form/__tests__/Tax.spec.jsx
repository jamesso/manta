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

  it('restores saved settings when tax and saved settings are the same object', () => {
    const initial = { amount: 10, tin: '123', method: 'default' };
    const saved = { amount: 10, tin: '456', method: 'default' };
    const { container, rerender } = render(
      <Tax
        t={t}
        tax={initial}
        savedSettings={saved}
        updateFieldData={updateFieldData}
        updateSavedSettings={updateSavedSettings}
      />
    );
    fireEvent.change(container.querySelector('input[name="tin"]'), {
      target: { value: '999' },
    });
    updateFieldData.mockClear();
    const reset = { amount: 4, tin: 'ABC', method: 'reverse' };
    rerender(
      <Tax
        t={t}
        tax={reset}
        savedSettings={reset}
        updateFieldData={updateFieldData}
        updateSavedSettings={updateSavedSettings}
      />
    );
    expect(container.querySelector('input[name="tin"]').value).toBe('ABC');
    expect(container.querySelector('input[name="amount"]').value).toBe('4');
    expect(updateFieldData).toHaveBeenCalledWith('tax', reset);
  });
});
