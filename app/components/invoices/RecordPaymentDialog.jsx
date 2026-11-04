import React, { useEffect, useId, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetBody,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import DatePickerField from '../form/editor/DatePickerField';
import { recordPayment } from '../../actions/invoices';
import { PAYMENT_METHODS } from '../../constants/invoices';
import {
  formatInvoiceAmount,
  getBalanceDue,
  getInvoiceNumber,
} from '../../helpers/invoice';
import {
  formatAmountInput,
  getPaymentErrors,
  parseMoneyInput,
  startOfDay,
} from '../../helpers/payments';

export default function RecordPaymentDialog({
  invoice,
  open,
  onOpenChange,
  creditNotes = [],
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const formId = useId();
  const paymentIdRef = useRef(null);
  const [amountRaw, setAmountRaw] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [method, setMethod] = useState('bank');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open || !invoice) {
      return;
    }
    paymentIdRef.current = crypto.randomUUID();
    setAmountRaw(
      formatAmountInput(getBalanceDue(invoice, creditNotes), invoice.currency)
    );
    setDate(new Date());
    setMethod('bank');
    setNote('');
    setSubmitted(false);
  }, [open, invoice, creditNotes]);

  if (!invoice) {
    return null;
  }

  const errors = submitted
    ? getPaymentErrors(
        { amountRaw, date: startOfDay(date.getTime()) },
        invoice,
        Date.now(),
        creditNotes
      )
    : {};
  const currency = invoice.currency ?? {};
  const balanceText = formatInvoiceAmount({
    grandTotal: getBalanceDue(invoice, creditNotes),
    currency,
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    const dayMs = startOfDay(date.getTime());
    const fieldErrors = getPaymentErrors(
      { amountRaw, date: dayMs },
      invoice,
      Date.now(),
      creditNotes
    );
    if (Object.keys(fieldErrors).length) {
      return;
    }
    const parsed = parseMoneyInput(amountRaw, currency.separator ?? 'commaDot');
    if (!parsed) {
      return;
    }
    setPending(true);
    const ok = await dispatch(
      recordPayment(invoice._id, {
        id: paymentIdRef.current,
        amount: parsed.value,
        date: dayMs,
        method,
        note: note.trim(),
      })
    );
    setPending(false);
    if (ok === true) {
      onOpenChange(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{t('invoices:payments:dialog:title')}</SheetTitle>
          <SheetDescription>
            {t('invoices:payments:dialog:description', {
              number: getInvoiceNumber(invoice),
              balance: balanceText,
            })}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form id={formId} className="grid gap-4" onSubmit={handleSubmit}>
            <Field>
              <FieldLabel htmlFor={`${formId}-amount`}>
                {t('invoices:payments:dialog:amount')}
              </FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id={`${formId}-amount`}
                  inputMode="decimal"
                  autoFocus
                  value={amountRaw}
                  onChange={e => setAmountRaw(e.target.value)}
                  aria-invalid={Boolean(errors.amount)}
                />
                <span className="text-sm text-muted-foreground">
                  {currency.code}
                </span>
              </div>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  setAmountRaw(
                    formatAmountInput(
                      getBalanceDue(invoice, creditNotes),
                      invoice.currency
                    )
                  )
                }
              >
                {t('invoices:payments:dialog:payFull')}
              </Button>
              {errors.amount ? (
                <FieldError>
                  {t(errors.amount, {
                    count: currency.fraction ?? 2,
                    balance: balanceText,
                    example: formatAmountInput(10, currency),
                  })}
                </FieldError>
              ) : null}
            </Field>
            <DatePickerField
              id={`${formId}-date`}
              label={t('invoices:payments:dialog:date')}
              value={date}
              onChange={setDate}
              disabledDays={{ after: new Date() }}
              error={errors.date}
            />
            <Field>
              <FieldLabel>{t('invoices:payments:dialog:method')}</FieldLabel>
              <Select
                value={method}
                items={PAYMENT_METHODS.map(m => ({
                  value: m,
                  label: t(`invoices:payments:methods:${m}`),
                }))}
                onValueChange={setMethod}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m} value={m}>
                      {t(`invoices:payments:methods:${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-note`}>
                {t('invoices:payments:dialog:note')}
              </FieldLabel>
              <Textarea
                id={`${formId}-note`}
                maxLength={500}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t('invoices:payments:dialog:notePlaceholder')}
              />
              <FieldDescription>{note.length}/500</FieldDescription>
            </Field>
          </form>
        </SheetBody>
        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('invoices:payments:dialog:cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {t('invoices:payments:dialog:submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
