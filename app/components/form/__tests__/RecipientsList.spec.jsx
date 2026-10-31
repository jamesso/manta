// Libs
import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Component
import { RecipientsList } from '../RecipientsList.jsx';

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
const selectedContact = {};
const updateRecipientList = vi.fn();

beforeEach(() => {
  updateRecipientList.mockClear();
});

describe('Recipient List component', () => {
  it('handleInputChange correctly', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RecipientsList
        contacts={contacts}
        selectedContact={selectedContact}
        updateRecipientList={updateRecipientList}
      />
    );
    expect(updateRecipientList).toHaveBeenCalledTimes(1);
    expect(updateRecipientList).toHaveBeenCalledWith(contacts[0]);
    updateRecipientList.mockClear();
    await user.selectOptions(
      container.querySelector('select'),
      'second-contact'
    );
    expect(updateRecipientList).toHaveBeenCalled();
  });
});
