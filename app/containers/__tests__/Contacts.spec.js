import { Contacts } from '../Contacts';
import * as ContactsActions from '../../actions/contacts';

vi.mock('@/lib/dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(false)),
}));
import * as dialog from '@/lib/dialog';

const dispatch = vi.fn();
const t = vi.fn(k => k);

describe('Contacts deleteContact', () => {
  beforeEach(() => {
    dialog.confirm.mockClear();
    dispatch.mockClear();
  });

  it('does not dispatch when confirm is false', async () => {
    dialog.confirm.mockResolvedValueOnce(false);
    await Contacts.prototype.deleteContact.call(
      { props: { t, dispatch } },
      'contact-1'
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches delete when confirm is true', async () => {
    dialog.confirm.mockResolvedValueOnce(true);
    await Contacts.prototype.deleteContact.call(
      { props: { t, dispatch } },
      'contact-1'
    );
    expect(dispatch).toHaveBeenCalledWith(
      ContactsActions.deleteContact('contact-1')
    );
  });
});
