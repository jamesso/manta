// Libs
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';

// Component
import { DueDatePicker } from '../DueDatePicker.jsx';

const t = vi.fn(key => key);
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

function renderPicker(date = selectedDate) {
  return render(
    <DueDatePicker
      t={t}
      selectedDate={date}
      updateCustomDate={updateCustomDate}
    />
  );
}

beforeEach(() => {
  updateCustomDate.mockClear();
});

describe('DueDatePicker', () => {
  it('shows the placeholder and no clear button when the date is empty', () => {
    renderPicker(null);
    expect(
      screen.getByRole('button', { name: 'form:fields:dueDate:placeHolder' })
    ).toBeInTheDocument();
    expect(document.querySelector('.clearDateBtn')).toBeNull();
  });

  it('shows the saved date as DD/MM/YYYY', () => {
    renderPicker();
    expect(
      screen.getByRole('button', { name: '20/11/2017' })
    ).toBeInTheDocument();
  });

  it('writes a moment object and closes the calendar when a day is picked', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: '20/11/2017' }));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /November 15/ }));
    expect(updateCustomDate).toHaveBeenCalled();
    const saved = updateCustomDate.mock.calls[0][0];
    expect(saved.years).toBe(2017);
    expect(saved.months).toBe(10);
    expect(saved.date).toBe(15);
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('clears the date from the clear button', () => {
    const { container } = renderPicker();
    fireEvent.click(container.querySelector('.clearDateBtn'));
    expect(updateCustomDate).toHaveBeenCalledWith(null);
  });

  it('closes the calendar when Escape is pressed', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: '20/11/2017' }));
    expect(screen.getByRole('grid')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
