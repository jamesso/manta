// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Component
import Contact from '../Contact';

// Mocks
const contact = {
  _id: 'id-string',
  fullname: 'Jon Snow',
  email: 'jon@snow.hbo',
  phone: '000-000-000',
};
const newInvoice = vi.fn();
const deleteContact = vi.fn();

function renderContact() {
  return render(
    <Contact
      contact={contact}
      newInvoice={newInvoice}
      deleteContact={deleteContact}
    />
  );
}

beforeEach(() => {
  newInvoice.mockClear();
  deleteContact.mockClear();
});

describe('Renders correctly to the DOM', () => {
  describe('renders buttons correctly', () => {
    it('handle click correctly', () => {
      const { container } = renderContact();
      fireEvent.click(container.querySelector('.ion-plus-round').closest('button'));
      expect(newInvoice).toHaveBeenCalled();
      expect(newInvoice).toHaveBeenCalledWith(contact);

      fireEvent.click(
        container.querySelector('.ion-close-circled').closest('button')
      );
      expect(deleteContact).toHaveBeenCalled();
      expect(deleteContact).toHaveBeenCalledWith('id-string');
    });
  });
});
