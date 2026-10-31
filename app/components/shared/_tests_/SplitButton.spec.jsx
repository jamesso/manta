// Libs
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Component
import SplitButton from '../SplitButton';

// Mocks
const mainAction = vi.fn();
const mainButton = {
  label: 'Main Action',
  action: mainAction,
};

const optionAction1 = vi.fn();
const optionAction2 = vi.fn();
const optionAction3 = vi.fn();
const options = [
  {
    label: 'Option A',
    action: optionAction1,
  },
  {
    label: 'Option B',
    action: optionAction2,
  },
  {
    label: 'Option C',
    action: optionAction3,
  },
];

function renderButton() {
  return render(<SplitButton mainButton={mainButton} options={options} />);
}

function openOptions(container) {
  fireEvent.click(container.querySelector('.ion-arrow-down-b').closest('a'));
}

beforeEach(() => {
  mainAction.mockClear();
  optionAction1.mockClear();
  optionAction2.mockClear();
  optionAction3.mockClear();
});

describe('Renders correctly to the DOM', () => {
  it('hide options by default', () => {
    renderButton();
    expect(screen.queryByText('Option A')).not.toBeInTheDocument();
    expect(screen.queryByText('Option B')).not.toBeInTheDocument();
    expect(screen.queryByText('Option C')).not.toBeInTheDocument();
  });

  it('renders options list correctly', () => {
    const { container } = renderButton();
    openOptions(container);
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
    openOptions(container);
  });
});

describe('Handles click correctly', () => {
  it('handle main button click correcrtly', () => {
    renderButton();
    fireEvent.click(screen.getByText('Main Action'));
    expect(mainAction).toHaveBeenCalled();
  });

  it('handle options click correcrtly', () => {
    const { container } = renderButton();
    openOptions(container);
    fireEvent.click(screen.getByText('Option A'));
    expect(optionAction1).toHaveBeenCalled();
    openOptions(container);
    fireEvent.click(screen.getByText('Option C'));
    expect(optionAction3).toHaveBeenCalled();
  });

  it('handle click outside correctly', () => {
    const { container } = renderButton();
    openOptions(container);
    fireEvent.click(screen.getByText('Main Action'));
    expect(screen.queryByText('Option A')).not.toBeInTheDocument();
    expect(screen.queryByText('Option B')).not.toBeInTheDocument();
    expect(screen.queryByText('Option C')).not.toBeInTheDocument();
  });
});
