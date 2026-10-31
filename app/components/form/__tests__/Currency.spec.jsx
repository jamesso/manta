// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Component
import { Currency } from '../Currency';

// Mocks
const currency = {
  code: 'USD',
  placement: 'before',
  fraction: 2,
  separator: 'commaDot',
};
const savedSettings = {
  code: 'USD',
  placement: 'before',
  fraction: 2,
  separator: 'commaDot',
};
const t = vi.fn();
const updateFieldData = vi.fn();
const updateSavedSettings = vi.fn();

function renderCurrency() {
  return render(
    <Currency
      t={t}
      currency={currency}
      savedSettings={savedSettings}
      updateFieldData={updateFieldData}
      updateSavedSettings={updateSavedSettings}
    />
  );
}

beforeEach(() => {
  updateFieldData.mockClear();
  updateSavedSettings.mockClear();
});

describe('Renders correctly to the DOM', () => {
  it('handle change code correctly', async () => {
    const user = userEvent.setup();
    const { container } = renderCurrency();
    await user.selectOptions(
      container.querySelector('select[name="code"]'),
      'VND'
    );
    expect(updateFieldData).toHaveBeenCalled();
    expect(updateFieldData).toHaveBeenCalledWith(
      'currency',
      Object.assign({}, currency, {
        code: 'VND',
      })
    );
  });

  it('handle change sign placement correctly', async () => {
    const user = userEvent.setup();
    const { container } = renderCurrency();
    await user.selectOptions(
      container.querySelector('select[name="placement"]'),
      'after'
    );
    expect(updateFieldData).toHaveBeenCalled();
    expect(updateFieldData).toHaveBeenCalledWith(
      'currency',
      Object.assign({}, currency, {
        placement: 'after',
      })
    );
  });

  it('handle change fraction correctly', () => {
    const { container } = renderCurrency();
    fireEvent.change(container.querySelector('input[name="fraction"]'), {
      target: { value: '3' },
    });
    expect(updateFieldData).toHaveBeenCalled();
    expect(updateFieldData).toHaveBeenCalledWith(
      'currency',
      Object.assign({}, currency, {
        fraction: 3,
      })
    );
  });

  it('handle change separator correctly', async () => {
    const user = userEvent.setup();
    const { container } = renderCurrency();
    await user.selectOptions(
      container.querySelector('select[name="separator"]'),
      'spaceDot'
    );
    expect(updateFieldData).toHaveBeenCalled();
    expect(updateFieldData).toHaveBeenCalledWith(
      'currency',
      Object.assign({}, currency, {
        separator: 'spaceDot',
      })
    );
  });

  it('restores saved settings when currency and saved settings are the same object', () => {
    const initial = {
      code: 'USD',
      placement: 'before',
      fraction: 2,
      separator: 'commaDot',
    };
    const saved = {
      code: 'USD',
      placement: 'before',
      fraction: 2,
      separator: 'dotComma',
    };
    const { container, rerender } = render(
      <Currency
        t={t}
        currency={initial}
        savedSettings={saved}
        updateFieldData={updateFieldData}
        updateSavedSettings={updateSavedSettings}
      />
    );
    fireEvent.change(container.querySelector('select[name="separator"]'), {
      target: { value: 'spaceDot' },
    });
    updateFieldData.mockClear();
    const reset = {
      code: 'USD',
      placement: 'after',
      fraction: 2,
      separator: 'commaDot',
    };
    rerender(
      <Currency
        t={t}
        currency={reset}
        savedSettings={reset}
        updateFieldData={updateFieldData}
        updateSavedSettings={updateSavedSettings}
      />
    );
    expect(container.querySelector('select[name="separator"]').value).toBe(
      'commaDot'
    );
    expect(container.querySelector('select[name="placement"]').value).toBe(
      'after'
    );
    expect(updateFieldData).toHaveBeenCalledWith('currency', reset);
  });
});
