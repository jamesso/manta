// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Component
import { DueDatePicker } from '../DueDatePicker.jsx';

// Mocks
const t = vi.fn();
const updateCustomDate = vi.fn();
const selectedDate = {
  milliseconds: 0,
  seconds: 0,
  minutes: 0,
  hours: 12,
  date: 20,
  months: 10,
  years: 2017,
};

function renderPicker() {
  return render(
    <DueDatePicker
      t={t}
      selectedDate={selectedDate}
      updateCustomDate={updateCustomDate}
    />
  );
}

beforeEach(() => {
  updateCustomDate.mockClear();
});

describe('Renders correctly to the DOM', () => {
  it('call clearDate when click clearDate Button', () => {
    const spy = vi.spyOn(DueDatePicker.prototype, 'clearDate');
    const { container } = renderPicker();
    fireEvent.click(container.querySelector('.clearDateBtn'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('clearDate clears selectedDate', () => {
    const spy = vi.spyOn(DueDatePicker.prototype, 'clearDate');
    const { container } = renderPicker();
    fireEvent.click(container.querySelector('.clearDateBtn'));
    expect(spy).toHaveBeenCalled();
    expect(updateCustomDate).toHaveBeenCalled();
    expect(updateCustomDate).toHaveBeenCalledWith(null);
    spy.mockRestore();
  });
});
