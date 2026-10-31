// Libs
import React from 'react';
import { render, screen } from '@testing-library/react';

// Component
import Button from '../Button';

describe('Renders correctly to the DOM', () => {
  it('renders its children element', () => {
    render(<Button>A Button</Button>);
    expect(screen.getByRole('button', { name: 'A Button' })).toBeInTheDocument();
  });
});
