// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Component
import { Discount } from '../Discount';

// Mocks
const t = vi.fn();
const updateFieldData = vi.fn();
const discount = {
  type: 'flat',
  amount: 100,
};

function renderDiscount() {
  return render(
    <Discount t={t} discount={discount} updateFieldData={updateFieldData} />
  );
}

beforeEach(() => {
  updateFieldData.mockClear();
});

describe('Renders correctly to the DOM', () => {
  describe('handle input change correctly', () => {
    it('convert amount input to number', () => {
      const { container } = renderDiscount();
      const amount = container.querySelector('input[name="amount"]');
      fireEvent.change(amount, { target: { value: '' } });
      fireEvent.change(amount, { target: { value: '100' } });
      expect(updateFieldData).toHaveBeenCalledWith('discount', {
        type: 'flat',
        amount: 100,
      });
    });

    it('keep type input as string', () => {
      const { container } = renderDiscount();
      fireEvent.click(
        container.querySelector('input[name="type"][value="percentage"]')
      );
      expect(updateFieldData).toHaveBeenCalledWith('discount', {
        type: 'percentage',
        amount: 100,
      });
    });
  });
});

describe('discount prop sync', () => {
  it('shows the given discount and resets when the discount is cleared', () => {
    const { container, rerender } = render(
      <Discount
        t={t}
        discount={{ amount: 10, type: 'flat' }}
        updateFieldData={updateFieldData}
      />
    );
    expect(container.querySelector('input[name="amount"]').value).toBe('10');
    expect(
      container.querySelector('input[name="type"][value="flat"]').checked
    ).toBe(true);

    rerender(
      <Discount t={t} discount={{}} updateFieldData={updateFieldData} />
    );
    expect(container.querySelector('input[name="amount"]').value).toBe('');
    expect(
      container.querySelector('input[name="type"][value="percentage"]').checked
    ).toBe(true);
  });

  it('does not reset when the next discount is not empty', () => {
    const { container, rerender } = render(
      <Discount
        t={t}
        discount={{ amount: 10, type: 'flat' }}
        updateFieldData={updateFieldData}
      />
    );
    rerender(
      <Discount
        t={t}
        discount={{ amount: 5, type: 'percentage' }}
        updateFieldData={updateFieldData}
      />
    );
    expect(container.querySelector('input[name="amount"]').value).toBe('10');
    expect(
      container.querySelector('input[name="type"][value="flat"]').checked
    ).toBe(true);
  });
});
