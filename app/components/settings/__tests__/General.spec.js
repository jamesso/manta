import React from 'react';
import { render } from '@testing-library/react';
import General from '../General';

const t = vi.fn(key => key);
const updateSettings = vi.fn();

it('placeholder');

it('shows the language from general settings', () => {
  const { container } = render(
    React.createElement(General, {
      t,
      updateSettings,
      general: {
        sound: 'default',
        muted: false,
        language: 'fr',
        previewPDF: false,
      },
    })
  );
  expect(container.querySelector('select[name="language"]').value).toBe('fr');
});
