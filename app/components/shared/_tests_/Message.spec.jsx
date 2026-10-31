// Libs
import React from 'react';
import { render, screen } from '@testing-library/react';

// Component
import Message from '../Message';

describe('Renders correct content passed via props', () => {
  it('prints out Hello, World', () => {
    render(<Message text="Hello, World" />);
    expect(screen.getByText('Hello, World')).toBeInTheDocument();
  });
  it('prints out Bye, World', () => {
    render(<Message text="Bye, World" />);
    expect(screen.getByText('Bye, World')).toBeInTheDocument();
  });
});
