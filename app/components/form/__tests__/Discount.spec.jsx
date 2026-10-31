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
