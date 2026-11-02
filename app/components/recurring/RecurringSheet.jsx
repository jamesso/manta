import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import DatePickerField from '../form/editor/DatePickerField';
import * as UIActions from '../../actions/ui';
import * as Actions from '../../actions/recurring';
import {
  applyScheduleOnSave,
  getRecurringErrors,
} from '../../helpers/recurring';
import {
  DATE_KEY,
  firstPeriodOnOrAfter,
  nextDateAfter,
  toDateKey,
} from '../../helpers/recurringSchedule';
import { INTERVALS } from '../../helpers/recurringSchedule';
import { formatInvoiceAmount } from '../../helpers/invoice';

const emptyProfile = () => ({
  name: '',
  interval: 'monthly',
  every: 1,
  startDate: toDateKey(Date.now()),
  anchorDay: moment().date(),
  nextDate: toDateKey(Date.now()),
  endDate: null,
  active: true,
  template: {
    docType: 'invoice',
    recipient: { fullname: '', email: '' },
    rows: [],
    currency: window.manta.settings.get('invoice.currency'),
  },
});

export default function RecurringSheet() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const sheet = useSelector(s => s.ui.recurringSheet);
  const recurringList = useSelector(s => s.recurring);
  const existingProfile = useMemo(() => {
    if (sheet?.mode !== 'edit' || !sheet.id) {
      return null;
    }
    const profiles = recurringList ?? [];
    return profiles.find(p => p._id === sheet.id) ?? null;
  }, [recurringList, sheet?.id, sheet?.mode]);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!sheet) {
      setDraft(null);
      return;
    }
    if (sheet.mode === 'new') {
      setDraft({
        ...emptyProfile(),
        ...sheet.profile,
        template: sheet.profile?.template ?? emptyProfile().template,
      });
      return;
    }
    setDraft(existingProfile ? { ...existingProfile } : null);
  }, [sheet, existingProfile]);

  const errors = draft ? getRecurringErrors(draft) : {};
  const today = toDateKey(Date.now());

  const { nextPreview, scheduledNextDate } = useMemo(() => {
    if (!draft?.startDate) {
      return { nextPreview: [], scheduledNextDate: draft?.nextDate ?? null };
    }
    const schedule = applyScheduleOnSave(existingProfile, draft, Date.now());
    const profileForSeries = { ...draft, ...schedule };
    const keys = [];
    let d = firstPeriodOnOrAfter(profileForSeries, schedule.nextDate);
    for (let i = 0; i < 3; i += 1) {
      if (draft.endDate && d > draft.endDate) {
        break;
      }
      keys.push(d);
      d = nextDateAfter(d, draft.interval, draft.every, schedule.anchorDay);
    }
    return { nextPreview: keys, scheduledNextDate: schedule.nextDate };
  }, [draft, existingProfile]);

  if (!sheet || !draft) {
    return null;
  }

  const dateFormat =
    window.manta.settings.get('invoice.dateFormat') ?? 'MM/DD/YYYY';

  return (
    <Sheet
      open
      onOpenChange={open => {
        if (!open) {
          dispatch(UIActions.setRecurringSheet(null));
        }
      }}
    >
      <SheetContent
        side="right"
        className="bg-popover text-popover-foreground overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            {sheet.mode === 'new'
              ? t('recurring:sheet:titleNew')
              : t('recurring:sheet:titleEdit')}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 py-4">
          <Field>
            <FieldLabel>{t('recurring:sheet:name')}</FieldLabel>
            <Input
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? <FieldError>{t(errors.name)}</FieldError> : null}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>{t('recurring:sheet:every')}</FieldLabel>
              <Input
                type="number"
                min={1}
                max={99}
                value={draft.every}
                onChange={e =>
                  setDraft({ ...draft, every: Number(e.target.value) })
                }
              />
            </Field>
            <Field>
              <FieldLabel>{t('recurring:sheet:interval')}</FieldLabel>
              <Select
                value={draft.interval}
                onValueChange={v => setDraft({ ...draft, interval: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map(interval => (
                    <SelectItem key={interval} value={interval}>
                      {t(`recurring:interval:${interval}_one`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DatePickerField
            id="recurring-start"
            label={t('recurring:sheet:startDate')}
            value={
              draft.startDate
                ? moment(draft.startDate, DATE_KEY).toDate()
                : null
            }
            onChange={date => {
              const key = moment(date).format(DATE_KEY);
              setDraft({
                ...draft,
                startDate: key,
                anchorDay: moment(key, DATE_KEY).date(),
              });
            }}
            error={errors.startDate ? t(errors.startDate) : undefined}
          />
          <DatePickerField
            id="recurring-end"
            label={t('recurring:sheet:endDate')}
            value={
              draft.endDate ? moment(draft.endDate, DATE_KEY).toDate() : null
            }
            onChange={date =>
              setDraft({
                ...draft,
                endDate: date ? moment(date).format(DATE_KEY) : null,
              })
            }
            clearable
            error={errors.endDate ? t(errors.endDate) : undefined}
          />
          <Field orientation="horizontal">
            <FieldLabel>{t('recurring:sheet:active')}</FieldLabel>
            <Switch
              checked={draft.active}
              onCheckedChange={active => setDraft({ ...draft, active })}
            />
          </Field>
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            <p>{t('recurring:sheet:summary')}</p>
            <p>
              {draft.template?.recipient?.fullname ||
                draft.template?.recipient?.company ||
                '—'}
            </p>
            <p>
              {(draft.template?.rows?.length ?? 0) +
                ' items · ' +
                formatInvoiceAmount(draft.template || {})}
            </p>
            <p className="mt-2 font-medium text-foreground">
              {t('recurring:sheet:nextDates')}
            </p>
            <ul>
              {nextPreview.map(k => (
                <li key={k}>{moment(k, DATE_KEY).format(dateFormat)}</li>
              ))}
            </ul>
          </div>
          {scheduledNextDate === today ? (
            <p className="text-sm text-muted-foreground">
              {t('recurring:sheet:createsToday')}
            </p>
          ) : null}
        </div>
        <SheetFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => dispatch(UIActions.setRecurringSheet(null))}
          >
            {t('recurring:sheet:cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => dispatch(Actions.saveRecurring(draft))}
          >
            {t('recurring:sheet:save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
