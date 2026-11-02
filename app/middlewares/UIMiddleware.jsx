import * as ACTION_TYPES from '../constants/actions.jsx';
import * as UIActions from '../actions/ui';
import * as FormActions from '../actions/form';
import sounds from '../../libs/sounds';
import { toast } from '@/components/ui/toast';
import * as dialog from '@/lib/dialog';
import i18n from '../../i18n/i18n';

const TOAST_TYPE = {
  success: 'success',
  warning: 'warning',
  danger: 'error',
  error: 'error',
  info: 'info',
};

const UIMiddleware =
  ({ dispatch, getState }) =>
  next =>
  action => {
    switch (action.type) {
      case ACTION_TYPES.UI_TAB_CHANGE: {
        const currentState = getState();
        const currentTab = currentState.ui.activeTab;
        if (action.payload !== currentTab) {
          sounds.play('TAP');
          next(action);
        }
        break;
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
        const editMode = getState().form?.settings?.editMode?.active;
        if (!editMode) {
          dispatch(UIActions.changeActiveTab('form'));
          return undefined;
        }
        return dialog
          .confirm({
            title: i18n.t('app:newInvoice:confirmTitle'),
            message: i18n.t('app:newInvoice:confirmMessage'),
            confirmLabel: i18n.t('app:newInvoice:confirm'),
            cancelLabel: i18n.t('app:newInvoice:cancel'),
          })
          .then(ok => {
            if (!ok) return;
            dispatch(FormActions.clearForm(null, true));
            dispatch(UIActions.changeActiveTab('form'));
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
