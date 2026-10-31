// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Component
import { Recipient } from '../Recipient.jsx';

// Mocks
const contacts = [
  {
    _id: 'first-contact',
    fullname: 'Jon Snow',
    company: 'HBO',
    email: 'john@hbo.com',
  },
  {
    _id: 'second-contact',
    fullname: 'Ned Stark',
    company: 'HBO',
    email: 'ned@hbo.com',
  },
];
const recipient = {
  new: {
    fullname: 'Jon Snow',
    email: 'john@hbo.com',
  },
  select: {},
  newRecipient: true,
};

const t = vi.fn();
const dispatch = vi.fn();

beforeEach(() => {
  dispatch.mockClear();
});

describe('Recipient component', () => {
  it('handle toggleForm correctly', () => {
    const spy = vi.spyOn(Recipient.prototype, 'toggleForm');
    const { container } = render(
      <Recipient
        t={t}
        contacts={contacts}
        recipient={recipient}
        dispatch={dispatch}
      />
    );
    fireEvent.click(container.querySelector('input[value="select"]'));
    expect(spy).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled();
    spy.mockRestore();
  });
});
