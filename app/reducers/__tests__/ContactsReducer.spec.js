import ContactsReducer, { getContacts } from '../ContactsReducer';
import * as ACTION_TYPES from '../../constants/actions.jsx';
import { faker } from '@faker-js/faker';
const initialState = [];

describe('Contacts Reducer', () => {
  it('should handle initial state', () => {
    expect(ContactsReducer(undefined, {})).toEqual([]);
  });

  let docs;
  beforeEach(() => {
    docs = [
      { id: crypto.randomUUID(), name: faker.person.fullName() },
      { id: crypto.randomUUID(), name: faker.person.fullName() },
      { id: crypto.randomUUID(), name: faker.person.fullName() },
    ];
  });

  it('should handle get all contacts', () => {
    const action = {
      type: ACTION_TYPES.CONTACT_GET_ALL,
      payload: docs,
    };
    const newState = ContactsReducer(initialState, action);
    expect(newState).toEqual(docs);
  });

  it('should handle save contact', () => {
    const action = {
      type: ACTION_TYPES.CONTACT_SAVE,
      payload: docs,
    };
    const newState = ContactsReducer(initialState, action);
    expect(newState).toEqual(docs);
  });

  it('should handle get delete contact', () => {
    const action = {
      type: ACTION_TYPES.CONTACT_DELETE,
      payload: docs,
    };
    const newState = ContactsReducer(initialState, action);
    expect(newState).toEqual(docs);
  });
});

// Test Selectors
const state = {
  contacts: initialState,
};

describe('Contact Selector', () => {
  it('should return contacts list', () => {
    expect(getContacts(state)).toEqual(state.contacts);
  });
});
