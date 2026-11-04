import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { CalendarClock, FilePen, Pause, Play, Trash2 } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ActionsMenu from '../shared/ActionsMenu';
import * as UIActions from '../../actions/ui';
import * as Actions from '../../actions/recurring';
import * as ACTION_TYPES from '../../constants/actions.jsx';

// Opens the profile's invoice template in the form editor.
export function openRecurringTemplate(dispatch, profile, contacts) {
  dispatch({
    type: ACTION_TYPES.FORM_LOAD_TEMPLATE,
    payload: { template: profile.template, profileId: profile._id, contacts },
  });
  dispatch(UIActions.changeActiveTab('form'));
}

export default function RecurringRowActions({ profile }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const contacts = useSelector(s => s.contacts) || [];

  return (
    <ActionsMenu label={t('recurring:actions:open')}>
      <DropdownMenuItem
        onClick={() =>
          dispatch(
            UIActions.setRecurringSheet({ mode: 'edit', id: profile._id })
          )
        }
      >
        <CalendarClock />
        {t('recurring:actions:editSchedule')}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => openRecurringTemplate(dispatch, profile, contacts)}
      >
        <FilePen />
        {t('recurring:actions:editTemplate')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() =>
          dispatch(
            Actions.setRecurringActive({
              id: profile._id,
              active: !profile.active,
            })
          )
        }
      >
        {profile.active ? <Pause /> : <Play />}
        {profile.active
          ? t('recurring:actions:pause')
          : t('recurring:actions:resume')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => dispatch(Actions.deleteRecurring([profile._id]))}
      >
        <Trash2 />
        {t('recurring:actions:delete')}
      </DropdownMenuItem>
    </ActionsMenu>
  );
}
