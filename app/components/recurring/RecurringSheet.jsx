import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { CalendarClock } from 'lucide-react';
import {
  Sheet,
  SheetBody,
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import DatePickerField from '../form/editor/DatePickerField';
import * as UIActions from '../../actions/ui';
import * as Actions from '../../actions/recurring';
import {
  getRecurringErrors,
  getRecurringTotal,
  previewRecurringDates,
} from '../../helpers/recurring';
import { DATE_KEY, toDateKey } from '../../helpers/recurringSchedule';
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
  const openSheet = useSelector(s => s.ui.recurringSheet);
  const recurringList = useSelector(s => s.recurring);
  const openProfile = useMemo(() => {
    if (openSheet?.mode !== 'edit' || !openSheet.id) {
      return null;
    }
    const profiles = recurringList ?? [];
    return profiles.find(p => p._id === openSheet.id) ?? null;
  }, [recurringList, openSheet?.id, openSheet?.mode]);
  const [openDraft, setDraft] = useState(null);

  useEffect(() => {
    if (!openSheet) {
      setDraft(null);
      return;
    }
    if (openSheet.mode === 'new') {
      setDraft({
        ...emptyProfile(),
        ...openSheet.profile,
        template: openSheet.profile?.template ?? emptyProfile().template,
      });
      return;
    }
    setDraft(openProfile ? { ...openProfile } : null);
  }, [openSheet, openProfile]);

  // Keep the last values while the sheet slides out.
  const open = Boolean(openSheet && openDraft);
  const sheet = useSheetValue(open, openSheet);
  const draft = useSheetValue(open, openDraft);
  const existingProfile = useSheetValue(open, openProfile);

  const errors = draft ? getRecurringErrors(draft) : {};
  const today = toDateKey(Date.now());

  const { nextPreview, scheduledNextDate } = useMemo(
    () => previewRecurringDates(existingProfile, draft, Date.now()),
    [draft, existingProfile]
  );

  const onOpenChange = next => {
    if (!next) {
      dispatch(UIActions.setRecurringSheet(null));
    }
  };

  // Stay mounted while closed so the sheet slides in when it opens.
  if (!sheet || !draft) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const dateFormat =
    window.manta.settings.get('invoice.dateFormat') ?? 'MM/DD/YYYY';
  const clientName =
    draft.template?.recipient?.fullname || draft.template?.recipient?.company;
  const itemCount = draft.template?.rows?.length ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {sheet.mode === 'new'
              ? t('recurring:sheet:titleNew')
              : t('recurring:sheet:titleEdit')}
          </SheetTitle>
          {clientName ? (
            <SheetDescription>{clientName}</SheetDescription>
          ) : null}
        </SheetHeader>
        <SheetBody>
          <SheetSection title={t('recurring:sheet:schedule')}>
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="recurring-name">
                  {t('recurring:sheet:name')}
                </FieldLabel>
                <Input
                  id="recurring-name"
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name ? <FieldError>{t(errors.name)}</FieldError> : null}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="recurring-every">
                    {t('recurring:sheet:every')}
                  </FieldLabel>
                  <Input
                    id="recurring-every"
                    type="number"
                    min={1}
                    max={99}
                    value={draft.every}
                    onChange={e => {
                      const raw = e.target.value;
                      setDraft({
                        ...draft,
                        every: raw === '' ? '' : Number(raw),
                      });
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t('recurring:sheet:interval')}</FieldLabel>
                  <Select
                    value={draft.interval}
                    onValueChange={v => setDraft({ ...draft, interval: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {t(`recurring:interval:${draft.interval}`)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVALS.map(interval => (
                        <SelectItem key={interval} value={interval}>
                          {t(`recurring:interval:${interval}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  placeholder={t('recurring:sheet:noEndDate')}
                  value={
                    draft.endDate
                      ? moment(draft.endDate, DATE_KEY).toDate()
                      : null
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
              </div>
              <Field orientation="horizontal" className="rounded-lg border p-3">
                <FieldContent>
                  <FieldLabel htmlFor="recurring-active">
                    {t('recurring:sheet:active')}
                  </FieldLabel>
                  <FieldDescription>
                    {t('recurring:sheet:activeHint')}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="recurring-active"
                  checked={draft.active}
                  onCheckedChange={active => setDraft({ ...draft, active })}
                />
              </Field>
            </div>
          </SheetSection>

          <SheetSection title={t('recurring:sheet:summary')}>
            <SheetDetails>
              <SheetDetail label={t('recurring:sheet:client')}>
                {clientName || '—'}
              </SheetDetail>
              <SheetDetail label={t('recurring:sheet:items')}>
                {t('recurring:sheet:itemsCount', { count: itemCount })}
              </SheetDetail>
              <SheetDetail label={t('recurring:sheet:amount')}>
                <span className="tabular-nums">
                  {formatInvoiceAmount({
                    grandTotal: getRecurringTotal(draft),
                    currency: draft.template?.currency,
                  })}
                </span>
              </SheetDetail>
            </SheetDetails>
          </SheetSection>

          <SheetSection title={t('recurring:sheet:nextDates')}>
            <ul className="divide-y rounded-lg border text-sm">
              {nextPreview.map(k => (
                <li key={k} className="flex items-center gap-2 px-3 py-2">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  <span className="tabular-nums">
                    {moment(k, DATE_KEY).format(dateFormat)}
                  </span>
                </li>
              ))}
            </ul>
            {scheduledNextDate === today ? (
              <p className="text-sm text-muted-foreground">
                {t('recurring:sheet:createsToday')}
              </p>
            ) : null}
          </SheetSection>
        </SheetBody>
        <SheetFooter>
          <Button
            type="button"
            variant="outline"
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
