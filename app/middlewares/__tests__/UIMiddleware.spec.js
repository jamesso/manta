import * as UIActions from '../../actions/ui';
import * as FormActions from '../../actions/form';
import UIMiddleware from '../UIMiddleware';

vi.mock('../../../libs/sounds');
import sounds from '../../../libs/sounds';

vi.mock('@/components/ui/toast', () => ({
  toast: { add: vi.fn() },
}));
import { toast } from '@/components/ui/toast';

vi.mock('@/lib/dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
}));
import * as dialog from '@/lib/dialog';

describe('UI Middleware', () => {
  let next;
  let dispatch;
  let getState;
  let middleware;

  beforeEach(() => {
    next = vi.fn();
    dispatch = vi.fn();
    getState = vi.fn(() => ({
      ui: { activeTab: 'form' },
      form: { settings: { editMode: { active: false } } },
    }));
    middleware = UIMiddleware({ dispatch, getState })(next);
    toast.add.mockClear();
    dialog.confirm.mockClear();
  });

  describe('UI_TAB_CHANGE', () => {
    it('should NOT update active tab when unchanged', () => {
      middleware(UIActions.changeActiveTab('form'));
      expect(next.mock.calls.length).toBe(0);
    });

    it('should update active tab', () => {
      const action = UIActions.changeActiveTab('settings');
      middleware(action);
      expect(next).toHaveBeenCalledWith(action);
      expect(sounds.play).toBeCalledWith('TAP');
    });
  });

  describe('UI_NOTIFICATION_NEW', () => {
    it('shows toast without calling next for success', () => {
      middleware(
        UIActions.newNoti('success', 'Invoice has been created successfully!')
      );
      expect(next).not.toHaveBeenCalled();
      expect(toast.add).toHaveBeenCalledWith({
        title: 'Invoice has been created successfully!',
        type: 'success',
      });
      expect(sounds.play).toBeCalledWith('SUCCESS');
    });

    it('shows warning toast', () => {
      middleware(UIActions.newNoti('warning', 'Missing Doc'));
      expect(next).not.toHaveBeenCalled();
      expect(toast.add).toHaveBeenCalledWith({
        title: 'Missing Doc',
        type: 'warning',
      });
    });
  });

  it('persists sidebar collapsed preference', () => {
    middleware(UIActions.setSidebarCollapsed(true));
    expect(window.manta.settings.set).toHaveBeenCalledWith(
      'ui.sidebarCollapsed',
      true
    );
    expect(next).toHaveBeenCalled();
  });

  describe('UI_NEW_INVOICE', () => {
    it('only switches tab when not editing', () => {
      middleware(UIActions.newInvoice());
      expect(dialog.confirm).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith(UIActions.changeActiveTab('form'));
    });

    it('does nothing when edit confirm is declined', async () => {
      getState.mockReturnValue({
        ui: { activeTab: 'form' },
        form: { settings: { editMode: { active: true } } },
      });
      dialog.confirm.mockResolvedValueOnce(false);
      middleware(UIActions.newInvoice());
      await Promise.resolve();
      expect(dispatch).not.toHaveBeenCalledWith(
        FormActions.clearForm(null, true)
      );
    });

    it('clears form when edit confirm is accepted', async () => {
      getState.mockReturnValue({
        ui: { activeTab: 'invoices' },
        form: { settings: { editMode: { active: true } } },
      });
      dialog.confirm.mockResolvedValueOnce(true);
      middleware(UIActions.newInvoice());
      await Promise.resolve();
      expect(dispatch).toHaveBeenCalledWith(FormActions.clearForm(null, true));
      expect(dispatch).toHaveBeenCalledWith(UIActions.changeActiveTab('form'));
    });

    it('asks before leaving a recurring template, then clears the form', async () => {
      getState.mockReturnValue({
        ui: { activeTab: 'form' },
        form: {
          templateTarget: { profileId: 'rec-1' },
          settings: { editMode: { active: false } },
        },
      });
      dialog.confirm.mockResolvedValueOnce(true);
      middleware(UIActions.newInvoice());
      expect(dialog.confirm).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(dispatch).toHaveBeenCalledWith(FormActions.clearForm(null, true));
      expect(dispatch).toHaveBeenCalledWith(
        FormActions.setFormDocType('invoice')
      );
    });

    it('keeps the recurring template when the confirm is declined', async () => {
      getState.mockReturnValue({
        ui: { activeTab: 'form' },
        form: {
          templateTarget: { profileId: 'rec-1' },
          settings: { editMode: { active: false } },
        },
      });
      dialog.confirm.mockResolvedValueOnce(false);
      middleware(UIActions.newInvoice());
      await Promise.resolve();
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  it('let other actions pass through', () => {
    const action = { type: 'TEST' };
    middleware(action);
    expect(next).toHaveBeenCalledWith(action);
  });
});
