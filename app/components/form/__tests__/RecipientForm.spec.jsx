import React from 'react';
import { render } from '@testing-library/react';

import { RecipientForm } from '../RecipientForm.jsx';

const t = vi.fn(key => key);
const updateRecipientForm = vi.fn();

it('renders empty fields when formData is omitted', () => {
  const { container } = render(
    <RecipientForm t={t} updateRecipientForm={updateRecipientForm} />
  );
  expect(container.querySelector('input[name="fullname"]').value).toBe('');
  expect(container.querySelector('input[name="email"]').value).toBe('');
});
