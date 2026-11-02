import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import * as UIActions from '../../actions/ui';
import * as Actions from '../../actions/recurring';
import * as ACTION_TYPES from '../../constants/actions.jsx';

export default function RecurringRowActions({ profile }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const contacts = useSelector(s => s.contacts) || [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('recurring:actions:open')}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            dispatch(
              UIActions.setRecurringSheet({ mode: 'edit', id: profile._id })
            )
          }
        >
          <Pencil />
          {t('recurring:actions:editSchedule')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            dispatch({
              type: ACTION_TYPES.FORM_LOAD_TEMPLATE,
              payload: {
                template: profile.template,
                profileId: profile._id,
                contacts,
              },
            });
            dispatch(UIActions.changeActiveTab('form'));
          }}
        >
          {t('recurring:actions:editTemplate')}
        </DropdownMenuItem>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
