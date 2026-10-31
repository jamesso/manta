import { handleActions, combineActions } from 'redux-actions';
import * as Actions from '../actions/contacts';

const ContactsReducer = handleActions(
  {
    [combineActions(
      Actions.getAllContacts,
      Actions.saveContact,
      Actions.deleteContact
    )]: (state, action) => action.payload,
  },
  []
);

export default ContactsReducer;

// Selector
export const getContacts = state => state.contacts;
