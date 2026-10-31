// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Component
import { Note } from '../Note.jsx';

// Mocks
const t = vi.fn();
const updateFieldData = vi.fn();
const note = {
  required: true,
  content: 'something',
};

beforeEach(() => {
  updateFieldData.mockClear();
});

describe('Note component', () => {
  it('handleInputChange correctly', () => {
    const spy = vi.spyOn(Note.prototype, 'handleInputChange');
    const { container } = render(
      <Note t={t} note={note} updateFieldData={updateFieldData} />
    );
    fireEvent.change(container.querySelector('textarea'), {
      target: { value: 'Something Else' },
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('clears the note when the content prop is removed', () => {
    const { container, rerender } = render(
      <Note
        t={t}
        note={{ content: 'hello' }}
        updateFieldData={updateFieldData}
      />
    );
    rerender(<Note t={t} note={{}} updateFieldData={updateFieldData} />);
    expect(container.querySelector('textarea').value).toBe('');
    expect(updateFieldData).toHaveBeenCalledWith('note', { content: '' });
  });
});
