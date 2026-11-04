import * as ACTION_TYPES from '../constants/actions.jsx';
import * as UIActions from '../actions/ui';
import * as FormActions from '../actions/form';
import sounds from '../../libs/sounds';
import { toast } from '@/components/ui/toast';
import * as dialog from '@/lib/dialog';
import i18n from '../../i18n/i18n';
import { listTabFor } from '../helpers/docType';
import { hasUnsavedChanges } from '../helpers/form';

const TOAST_TYPE = {
  success: 'success',
  warning: 'warning',
  danger: 'error',
  error: 'error',
  info: 'info',
};

const confirmDiscard = form =>
  dialog.confirm({
    title: i18n.t('form:cancel:title'),
    message: i18n.t(
      form.settings?.editMode?.active || form.templateTarget != null
        ? 'form:cancel:editMessage'
        : 'form:cancel:newMessage'
    ),
    confirmLabel: i18n.t('form:cancel:confirm'),
    cancelLabel: i18n.t('form:cancel:keep'),
    destructive: true,
  });

const UIMiddleware =
  ({ dispatch, getState }) =>
  next =>
  action => {
    // Runs proceed() at once, or after the user agrees to discard the
    // editor's unsaved changes when the move leaves the editor.
    const leaveForm = (target, proceed) => {
      const { ui, form } = getState();
      if (
        ui.activeTab !== 'form' ||
        target === 'form' ||
        !hasUnsavedChanges(form)
      ) {
        return proceed();
      }
      return confirmDiscard(form).then(ok => {
        if (!ok) return;
        dispatch(FormActions.clearForm(null, true));
        proceed();
      });
    };

    switch (action.type) {
      case ACTION_TYPES.UI_TAB_CHANGE: {
        if (action.payload === getState().ui.activeTab) {
          return undefined;
        }
        return leaveForm(action.payload, () => {
          sounds.play('TAP');
          next(action);
        });
      }

      case ACTION_TYPES.UI_LIST_REQUEST: {
        return leaveForm(action.payload.page, () => next(action));
      }

      case ACTION_TYPES.UI_NOTIFICATION_NEW: {
        switch (action.payload.type) {
          case 'success':
            sounds.play('SUCCESS');
            break;
          case 'warning':
            sounds.play('WARNING');
            break;
          default:
            break;
        }
        toast.add({
          title: action.payload.message,
          type: TOAST_TYPE[action.payload.type] ?? 'info',
        });
        return undefined;
      }

      case ACTION_TYPES.UI_SIDEBAR_COLLAPSED_SET: {
        window.manta.settings.set(
          'ui.sidebarCollapsed',
          Boolean(action.payload)
        );
        return next(action);
      }

      case ACTION_TYPES.UI_NEW_INVOICE: {
        const form = getState().form;
        const editMode = form?.settings?.editMode?.active;
        // A recurring template is also edited in the form. Leave it explicitly.
        const templateMode = form?.templateTarget != null;
        const apply = () => {
          dispatch(FormActions.setFormDocType('invoice'));
          dispatch(UIActions.changeActiveTab('form'));
        };
        if (!editMode && !templateMode) {
          apply();
          return undefined;
        }
        if (!hasUnsavedChanges(form)) {
          dispatch(FormActions.clearForm(null, true));
          apply();
          return undefined;
        }
        const copy = templateMode
          ? 'app:newInvoice:template'
          : 'app:newInvoice';
        return dialog
          .confirm({
            title: i18n.t(`${copy}:confirmTitle`),
            message: i18n.t(`${copy}:confirmMessage`),
            confirmLabel: i18n.t('app:newInvoice:confirm'),
            cancelLabel: i18n.t('app:newInvoice:cancel'),
          })
          .then(ok => {
            if (!ok) return;
            dispatch(FormActions.clearForm(null, true));
            apply();
          });
      }

      case ACTION_TYPES.UI_NEW_ESTIMATE: {
        const form = getState().form;
        const apply = () => {
          dispatch(FormActions.clearForm(null, true));
          dispatch(FormActions.setFormDocType('estimate'));
          dispatch(UIActions.changeActiveTab('form'));
        };
        if (!hasUnsavedChanges(form)) {
          apply();
          return undefined;
        }
        return confirmDiscard(form).then(ok => {
          if (ok) apply();
        });
      }

      case ACTION_TYPES.UI_FORM_CLOSE: {
        const form = getState().form;
        const target =
          form?.templateTarget != null
            ? 'recurring'
            : listTabFor(form?.docType);
        const leave = () => {
          dispatch(FormActions.clearForm(null, true));
          dispatch(UIActions.changeActiveTab(target));
        };
        if (!hasUnsavedChanges(form)) {
          leave();
          return undefined;
        }
        return confirmDiscard(form).then(ok => {
          if (ok) leave();
        });
      }

      case ACTION_TYPES.FORM_ITEM_ADD: {
        sounds.play('ADD');
        return next(action);
      }

      case ACTION_TYPES.FORM_ITEM_REMOVE: {
        sounds.play('REMOVE');
        return next(action);
      }

      case ACTION_TYPES.FORM_CLEAR: {
        if (!action.payload) {
          sounds.play('RELOAD');
        }
        return next(action);
      }

      default:
        return next(action);
    }
  };

export default UIMiddleware;
