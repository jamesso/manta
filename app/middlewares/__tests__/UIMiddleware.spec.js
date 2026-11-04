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
      form: {
        recipient: { newRecipient: true, new: {} },
        rows: [{ description: '' }],
        settings: { editMode: { active: false } },
      },
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
        form: { formRevision: 1, settings: { editMode: { active: true } } },
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
        form: { formRevision: 1, settings: { editMode: { active: true } } },
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
          formRevision: 3,
          cleanRevision: 1,
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
          formRevision: 3,
          cleanRevision: 1,
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

  describe('UI_FORM_CLOSE', () => {
    const formState = form => ({
      ui: { activeTab: 'form' },
      form: {
        docType: 'invoice',
        recipient: { newRecipient: true, new: {} },
        rows: [{ description: '' }],
        settings: { editMode: { active: false } },
        ...form,
      },
    });

    it('leaves an empty new document without asking', () => {
      getState.mockReturnValue(formState({ docType: 'estimate' }));
      middleware(UIActions.closeForm());
      expect(dialog.confirm).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith(FormActions.clearForm(null, true));
      expect(dispatch).toHaveBeenCalledWith(
        UIActions.changeActiveTab('estimates')
      );
    });

    it('asks before it discards a new document with content', async () => {
      getState.mockReturnValue(
        formState({ rows: [{ description: 'Design work' }] })
      );
      dialog.confirm.mockResolvedValueOnce(false);
      await middleware(UIActions.closeForm());
      expect(dialog.confirm).toHaveBeenCalledTimes(1);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('discards edits to a saved document and opens its list', async () => {
      getState.mockReturnValue(
        formState({
          docType: 'creditNote',
          formRevision: 2,
          settings: { editMode: { active: true } },
        })
      );
      dialog.confirm.mockResolvedValueOnce(true);
      await middleware(UIActions.closeForm());
      expect(dispatch).toHaveBeenCalledWith(FormActions.clearForm(null, true));
      expect(dispatch).toHaveBeenCalledWith(
        UIActions.changeActiveTab('invoices')
      );
    });

    it('returns to Recurring after it discards a template', async () => {
      getState.mockReturnValue(
        formState({ templateTarget: { profileId: null }, formRevision: 1 })
      );
      dialog.confirm.mockResolvedValueOnce(true);
      await middleware(UIActions.closeForm());
      expect(dispatch).toHaveBeenCalledWith(
        UIActions.changeActiveTab('recurring')
      );
    });
  });

  describe('leaving the editor', () => {
    const onForm = form => ({
      ui: { activeTab: 'form' },
      form: {
        docType: 'invoice',
        recipient: { newRecipient: true, new: {} },
        rows: [{ description: '' }],
        settings: { editMode: { active: false } },
        ...form,
      },
    });
    const withText = { rows: [{ description: 'Design work' }] };

    it('asks before a sidebar move discards a new document', async () => {
      getState.mockReturnValue(onForm(withText));
      dialog.confirm.mockResolvedValueOnce(false);
      const action = UIActions.changeActiveTab('invoices');
      await middleware(action);
      expect(dialog.confirm).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('clears the form, then moves, when the user discards', async () => {
      getState.mockReturnValue(onForm(withText));
      dialog.confirm.mockResolvedValueOnce(true);
      const action = UIActions.changeActiveTab('settings');
      await middleware(action);
      expect(dispatch).toHaveBeenCalledWith(FormActions.clearForm(null, true));
      expect(next).toHaveBeenCalledWith(action);
    });

    it('guards list requests from the command palette too', async () => {
      getState.mockReturnValue(onForm(withText));
      dialog.confirm.mockResolvedValueOnce(false);
      await middleware(UIActions.openList('contacts', { openId: 'c1' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('moves without asking when a saved document has no edits', () => {
      getState.mockReturnValue(
        onForm({
          formRevision: 4,
          cleanRevision: 4,
          settings: { editMode: { active: true } },
        })
      );
      const action = UIActions.changeActiveTab('invoices');
      middleware(action);
      expect(dialog.confirm).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(action);
    });

    it('moves without asking while a save runs', () => {
      getState.mockReturnValue(onForm({ ...withText, savePending: true }));
      const action = UIActions.changeActiveTab('invoices');
      middleware(action);
      expect(dialog.confirm).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(action);
    });

    it('asks before New Estimate discards a new invoice', async () => {
      getState.mockReturnValue(onForm(withText));
      dialog.confirm.mockResolvedValueOnce(false);
      await middleware(UIActions.newEstimate());
      expect(dialog.confirm).toHaveBeenCalledTimes(1);
      expect(dispatch).not.toHaveBeenCalled();
    });
  });
});
