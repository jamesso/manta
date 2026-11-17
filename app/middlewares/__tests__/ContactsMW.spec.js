import * as ACTION_TYPES from '../../constants/actions.jsx';
import * as Actions from '../../actions/contacts';
import ContactsMW from '../ContactsMW';
import { faker } from '@faker-js/faker';
import i18n from '../../../i18n/i18n';

// Mocks
import {
  saveDoc,
  deleteDoc,
  updateDoc,
  getAllDocs,
  removeDocs,
  restoreDocs,
  mockData,
  resetMockPouchData,
} from '../../helpers/pouchDB';
vi.mock('../../helpers/pouchDB');
vi.mock('@/components/ui/toast', () => ({
  toast: {
    add: vi.fn(() => 'toast-id'),
    close: vi.fn(),
  },
}));
Date.now = vi.fn(() => 'now');

describe('Contacts Middleware', () => {
  let next, dispatch, middleware;
  beforeEach(() => {
    resetMockPouchData();
    next = vi.fn();
    dispatch = vi.fn();
    middleware = ContactsMW({ dispatch })(next);
  });

  describe('should handle CONTACT_GET_ALL action', () => {
    it('retrieves data correct DB', async () => {
      // Execute
      await middleware(Actions.getAllContacts());
      // Expect
      // Call correct function
      expect(getAllDocs).toHaveBeenCalled();
      expect(getAllDocs).toHaveBeenCalledWith('contacts');
      expect(getAllDocs).not.toHaveBeenCalledWith('invoices');
      expect(getAllDocs).not.toHaveBeenCalledWith('');
      // Correctly resolves
      await expect(getAllDocs('contacts')).resolves.toBe(
        mockData.contactsRecords
      );
    });

    it('calls next after the promised is returned', async () => {
      const action = Actions.getAllContacts();
      await middleware(action);
      expect(dispatch.mock.calls.length).toBe(0);
      // Calling next with resolved data
      const data = await getAllDocs('contacts');
      expect(next.mock.calls.length).toBe(1);
      expect(next).toHaveBeenCalledWith(
        Object.assign({}, action, {
          payload: data,
        })
      );
    });

    it('handle error correctly', () => {
      // Make sure getAllDocs will be called with incorrect dbName
      getAllDocs.mockImplementationOnce(() => getAllDocs('random-string'));
      const expectedError = new Error('Incorrect database!');
      // Execute
      return middleware(Actions.getAllContacts()).then(() => {
        expect(next).toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: {
            type: 'warning',
            message: expectedError.message,
          },
        });
      });
    });

    it('handle unknown error correctly', async () => {
      const unknownError = new Error('Something broke');
      getAllDocs.mockImplementationOnce(() => Promise.reject(unknownError));
      await middleware(Actions.getAllContacts());
      await getAllDocs().catch(err => {
        expect(next).toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: {
            type: 'warning',
            message: unknownError.message,
          },
        });
      });
    });
  });

  describe('should handle CONTACT_SAVE action', () => {
    it('addes id and timestamp to contact data', () => {
      // Setup
      const newContact = {
        fullname: faker.person.fullName(),
        email: faker.internet.email(),
      };
      // Execute
      const pending = middleware(Actions.saveContact(newContact));
      // Expect
      expect(saveDoc).toHaveBeenCalled();
      expect(saveDoc).toHaveBeenCalledWith('contacts', newContact);
      return pending;
    });

    it('should save records to DB', async () => {
      // Setup
      const newContact = {
        fullname: faker.person.fullName(),
        email: faker.internet.email(),
      };
      // Execute
      await middleware(Actions.saveContact(newContact));
      const data = await saveDoc('contacts', newContact);
      // Expect
      expect(data).toEqual([...mockData.contactsRecords, newContact]);
    });

    it('should call next and dispatch notification ', async () => {
      // Setup
      const newContact = {
        _id: 'id-string',
        created_at: 'now',
        fullname: faker.person.fullName(),
        email: faker.internet.email(),
      };
      const action = Actions.saveContact(newContact);

      // Execute
      await middleware(action);
      await saveDoc('contacts', newContact);
      // Expect calling next
      expect(next.mock.calls.length).toBe(1);
      expect(next).toHaveBeenCalledWith(
        Object.assign({}, action, {
          payload: [...mockData.contactsRecords, newContact],
        })
      );
      // Dispatch success notification
      expect(dispatch.mock.calls.length).toBe(1);
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'success',
          message: i18n.t('messages:contact:saved'),
        },
      });
    });

    it('handle syntax error correctly', async () => {
      const newContact = {
        fullname: faker.person.fullName(),
        email: faker.internet.email(),
      };
      await middleware(Actions.saveContact(newContact));
      const dbError = new Error('No database found!');
      const docError = new Error('No doc found!');
      await expect(saveDoc()).rejects.toEqual(dbError);
      await expect(saveDoc('invoices')).rejects.toEqual(docError);
    });

    it('handle unknown error correctly', () => {
      // Setup
      const newContact = {
        fullname: faker.person.fullName(),
        email: faker.internet.email(),
      };
      const expectedError = new Error('Something Broken!');
      saveDoc.mockImplementationOnce(() => Promise.reject(expectedError));
      // Execute
      return middleware(Actions.saveContact(newContact)).then(() => {
        // Expect
        expect(next).toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: {
            type: 'warning',
            message: expectedError.message,
          },
        });
      });
    });
  });

  describe('should handle CONTACT_DELETE action', () => {
    it('should remove record from DB correctly', async () => {
      const contactID = 'jon-snow';
      removeDocs.mockResolvedValueOnce({
        removed: [{ _id: contactID }],
        failed: [],
        docs: [],
      });
      await middleware(Actions.deleteContact(contactID));
      expect(removeDocs).toHaveBeenCalledWith('contacts', [contactID]);
    });

    it('should call next after delete', async () => {
      const contactID = 'jon-snow';
      const action = Actions.deleteContact(contactID);
      removeDocs.mockResolvedValueOnce({
        removed: [{ _id: contactID }],
        failed: [],
        docs: [],
      });
      await middleware(action);
      expect(next).toHaveBeenCalledWith(
        Object.assign({}, action, {
          payload: [],
        })
      );
    });

    it('handle error correctly', async () => {
      const contactID = 'ned-stark';
      const expectedError = new Error('No contact found!');
      removeDocs.mockRejectedValueOnce(expectedError);
      await middleware(Actions.deleteContact(contactID));
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: expectedError.message,
        },
      });
    });
  });

  describe('CONTACT_UPDATE', () => {
    it('calls updateDoc and next with updated list', async () => {
      const doc = { _id: 'c1', _rev: '1-x', fullname: 'A', email: 'a@b.co' };
      const list = [doc];
      updateDoc.mockResolvedValueOnce(list);
      const action = Actions.updateContact(doc);
      await middleware(action);
      expect(updateDoc).toHaveBeenCalledWith('contacts', doc);
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.CONTACT_UPDATE,
        payload: list,
      });
    });

    it('warns on rejected updateDoc', async () => {
      const doc = { _id: 'c1', fullname: 'A', email: 'a@b.co' };
      const err = new Error('409 conflict');
      updateDoc.mockRejectedValueOnce(err);
      await middleware(Actions.updateContact(doc));
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: err.message,
        },
      });
    });
  });

  describe('CONTACT_RESTORE', () => {
    it('restores contacts after delete', async () => {
      const docs = [{ _id: 'x', fullname: 'X', email: 'x@y.z' }];
      restoreDocs.mockResolvedValueOnce(docs);
      await middleware(Actions.restoreContacts(docs));
      expect(restoreDocs).toHaveBeenCalledWith('contacts', docs);
      expect(next).toHaveBeenCalledWith({
        type: ACTION_TYPES.CONTACT_RESTORE,
        payload: docs,
      });
    });
  });

  it('let other actions pass through', () => {
    const action = { type: 'TEST' };
    const pending = middleware(action);
    expect(next).toHaveBeenCalledWith(action);
    return pending;
  });
});
