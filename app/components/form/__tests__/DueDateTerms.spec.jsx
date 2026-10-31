// Libs
import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Component
import { DueDateTerms } from '../DueDateTerms.jsx';

// Mocks
const t = vi.fn();
const updatePaymentTerm = vi.fn();
const paymentTerm = 'net10';

beforeEach(() => {
  updatePaymentTerm.mockClear();
});

describe('Renders correctly to the DOM', () => {
  it('handle input change correctly', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(DueDateTerms.prototype, 'handleInputChange');
    const { container } = render(
      <DueDateTerms
        t={t}
        paymentTerm={paymentTerm}
        updatePaymentTerm={updatePaymentTerm}
      />
    );
    await user.selectOptions(container.querySelector('select'), 'net90');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
