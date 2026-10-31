// Libs
import React from 'react';
import { render } from '@testing-library/react';

// Component
import { DueDate } from '../DueDate.jsx';

const t = vi.fn(key => key);
const updateFieldData = vi.fn();

beforeEach(() => {
  updateFieldData.mockClear();
});

describe('DueDate prop sync', () => {
  it('shows the custom date fields when the due date is reset', () => {
    const { container, rerender } = render(
      <DueDate
        t={t}
        updateFieldData={updateFieldData}
        dueDate={{ selectedDate: null, paymentTerm: 'net7', useCustom: false }}
      />
    );
    expect(container.querySelector('input[value="select"]').checked).toBe(true);

    rerender(
      <DueDate
        t={t}
        updateFieldData={updateFieldData}
        dueDate={{ selectedDate: null, paymentTerm: null, useCustom: true }}
      />
    );
    expect(container.querySelector('input[value="new"]').checked).toBe(true);
  });
});
