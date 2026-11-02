import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { formatInvoiceAmount } from '../../helpers/invoice';
import { dateKeyToMs } from '../../helpers/recurringSchedule';
import { getRecurringStatus } from '../../helpers/recurring';
import * as Actions from '../../actions/recurring';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import * as UIActions from '../../actions/ui';
import RecurringRowActions from './RecurringRowActions';

export default function RecurringTable({ profiles }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const dateFormat =
    window.manta.settings.get('invoice.dateFormat') ?? 'MM/DD/YYYY';

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('recurring:columns:name')}</TableHead>
          <TableHead>{t('recurring:columns:client')}</TableHead>
          <TableHead className="text-end">
            {t('recurring:columns:amount')}
          </TableHead>
          <TableHead>{t('recurring:columns:interval')}</TableHead>
          <TableHead>{t('recurring:columns:nextDate')}</TableHead>
          <TableHead>{t('recurring:columns:active')}</TableHead>
          <TableHead className="w-12">
            {t('recurring:columns:actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.map(profile => {
          const status = getRecurringStatus(profile, Date.now());
          const client =
            profile.template?.recipient?.fullname ||
            profile.template?.recipient?.company ||
            '';
          const intervalKey =
            profile.every === 1
              ? `recurring:interval:${profile.interval}_one`
              : `recurring:interval:${profile.interval}_other`;
          return (
            <TableRow key={profile._id}>
              <TableCell>
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() =>
                    dispatch(
                      UIActions.setRecurringSheet({
                        mode: 'edit',
                        id: profile._id,
                      })
                    )
                  }
                >
                  {profile.name}
                </button>
              </TableCell>
              <TableCell>{client}</TableCell>
              <TableCell className="tabular-nums text-end">
                {formatInvoiceAmount(profile.template || {})}
              </TableCell>
              <TableCell>{t(intervalKey, { count: profile.every })}</TableCell>
              <TableCell>
                {status === 'paused'
                  ? t('recurring:status:paused')
                  : status === 'ended'
                    ? t('recurring:status:ended')
                    : moment(dateKeyToMs(profile.nextDate)).format(dateFormat)}
              </TableCell>
              <TableCell>
                <Switch
                  checked={profile.active}
                  aria-label={profile.name}
                  onCheckedChange={checked =>
                    dispatch(
                      Actions.setRecurringActive({
                        id: profile._id,
                        active: checked,
                      })
                    )
                  }
                />
              </TableCell>
              <TableCell>
                <RecurringRowActions profile={profile} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
