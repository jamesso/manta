import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { FilePen, Pause, Play, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ActionsMenu from '../shared/ActionsMenu';
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetDetail,
  SheetDetails,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle,
  useSheetValue,
} from '@/components/ui/sheet';
import * as Actions from '../../actions/recurring';
import * as UIActions from '../../actions/ui';
import {
  formatInvoiceAmount,
  getDisplayStatus,
  getInvoiceNumber,
  getIssuedAt,
} from '../../helpers/invoice';
import { groupCreditNotesByInvoice } from '../../helpers/creditNotes';
import {
  formatRecurringInterval,
  getRecurringClient,
  getRecurringStatus,
  getRecurringTotal,
} from '../../helpers/recurring';
import { DATE_KEY } from '../../helpers/recurringSchedule';
import { getAllSalesDocs } from '../../reducers/InvoicesReducer';
import StatusBadge from '../invoices/StatusBadge';
import { useNow } from '../invoices/useNow';
import { openRecurringTemplate } from './RecurringRowActions';

const NO_DOCS = [];

export default function RecurringDetailSheet({
  profile: openProfile,
  open,
  onOpenChange,
  onEdit,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const now = useNow();
  const contacts = useSelector(s => s.contacts) || NO_DOCS;
  const allDocs = useSelector(getAllSalesDocs) || NO_DOCS;
  const profile = useSheetValue(open, openProfile);
  const profileId = profile?._id;

  // Invoices this profile created, newest period first.
  const created = useMemo(
    () =>
      allDocs
        .filter(d => d.recurringId === profileId && !d.recurringTombstone)
        .sort((a, b) =>
          String(b.periodKey ?? '').localeCompare(String(a.periodKey ?? ''))
        ),
    [allDocs, profileId]
  );

  // Stay mounted while closed so the sheet slides in when it opens.
  if (!profile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const creditByInvoice = groupCreditNotesByInvoice(allDocs);
  const dateFormat =
    window.manta.settings.get('invoice.dateFormat') ?? 'MM/DD/YYYY';
  const formatKey = key =>
    key ? moment(key, DATE_KEY).format(dateFormat) : '—';
  const status = getRecurringStatus(profile, now);
  const client = getRecurringClient(profile);
  const template = profile.template || {};
  const currency = template.currency;
  const repeat = formatRecurringInterval(t, profile.interval, profile.every);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{profile.name}</SheetTitle>
            {status !== 'active' ? (
              <Badge variant="secondary">
                {t(`recurring:status:${status}`)}
              </Badge>
            ) : null}
          </div>
          {client ? <SheetDescription>{client}</SheetDescription> : null}
        </SheetHeader>
        <SheetBody>
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="text-sm text-muted-foreground">
              {t('recurring:sheet:amount')}
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {formatInvoiceAmount({
                grandTotal: getRecurringTotal(profile),
                currency,
              })}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{repeat}</div>
          </div>
          <SheetSection title={t('recurring:sheet:schedule')}>
            <SheetDetails>
              <SheetDetail label={t('recurring:columns:nextDate')}>
                {status === 'active'
                  ? formatKey(profile.nextDate)
                  : t(`recurring:status:${status}`)}
              </SheetDetail>
              <SheetDetail label={t('recurring:detail:startDate')}>
                {formatKey(profile.startDate)}
              </SheetDetail>
              <SheetDetail label={t('recurring:detail:endDate')}>
                {profile.endDate
                  ? formatKey(profile.endDate)
                  : t('recurring:sheet:noEndDate')}
              </SheetDetail>
            </SheetDetails>
          </SheetSection>
          <SheetSection title={t('recurring:sheet:items')}>
            {(template.rows ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('recurring:detail:noItems')}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {template.rows.map((row, index) => (
                  <li
                    key={row.id ?? index}
                    className="flex items-start gap-2 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {row.description || '—'}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {row.quantity} ×{' '}
                      {formatInvoiceAmount({
                        grandTotal: Number(row.price) || 0,
                        currency,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SheetSection>
          <SheetSection title={t('recurring:detail:created')}>
            {created.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('recurring:detail:noneCreated')}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {created.map(invoice => {
                  const issued = getIssuedAt(invoice);
                  const linked = creditByInvoice.get(invoice._id) ?? [];
                  return (
                    <li key={invoice._id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-start text-foreground hover:bg-muted/50"
                        onClick={() =>
                          dispatch(
                            UIActions.openList('invoices', {
                              openId: invoice._id,
                            })
                          )
                        }
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">
                            {issued
                              ? moment(issued).format(dateFormat)
                              : formatKey(invoice.periodKey)}
                          </span>
                          <span className="ms-2 text-muted-foreground">
                            {getInvoiceNumber(invoice) ||
                              t('invoices:number:none')}
                          </span>
                        </span>
                        <StatusBadge
                          status={getDisplayStatus(invoice, now, linked)}
                          t={t}
                        />
                        <span className="shrink-0 tabular-nums">
                          {formatInvoiceAmount(invoice)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SheetSection>
        </SheetBody>
        <SheetFooter>
          <ActionsMenu placement="footer" label={t('recurring:actions:open')}>
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
          <SheetClose render={<Button type="button" variant="ghost" />}>
            {t('common:close')}
          </SheetClose>
          <Button type="button" onClick={() => onEdit(profile)}>
            {t('recurring:actions:editSchedule')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
