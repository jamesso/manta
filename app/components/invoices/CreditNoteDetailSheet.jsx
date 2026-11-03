import moment from 'moment';
import { useDispatch } from 'react-redux';
import { ArrowUpRight } from 'lucide-react';

import * as dialog from '@/lib/dialog';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatNumber } from '../../../helpers/formatNumber';
import {
  deleteInvoice,
  editInvoice,
  issueCreditNote,
  voidCreditNote,
} from '../../actions/invoices';
import {
  formatInvoiceAmount,
  getInvoiceNumber,
  getInvoiceTotals,
  getIssuedAt,
  getStoredStatus,
} from '../../helpers/invoice';
import StatusBadge from './StatusBadge';
import { UNDO_TIMEOUT_MS } from '../../constants/invoices';
import { toast } from '@/components/ui/toast';
import { restoreInvoices } from '../../actions/invoices';

export default function CreditNoteDetailSheet({
  creditNote,
  open,
  onOpenChange,
  dateFormat,
  t,
  onOpenInvoice,
  invoiceMissing,
}) {
  const dispatch = useDispatch();
  const ipc = window.manta.ipc;

  if (!creditNote) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const number = getInvoiceNumber(creditNote);
  const stored = getStoredStatus(creditNote);
  const fmt = creditNote.configs?.dateFormat ?? dateFormat;
  const issued = getIssuedAt(creditNote);
  const values = getInvoiceTotals(creditNote);
  const currency = creditNote.currency;
  const formatMoney = n =>
    formatNumber(n, currency?.fraction ?? 2, currency?.separator ?? 'commaDot');
  const credited = creditNote.creditedInvoice;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto bg-background text-foreground sm:max-w-lg w-full"
      >
        <SheetHeader className="flex-row flex-wrap items-center gap-2">
          <SheetTitle>
            {t('invoices:creditNotes:sheet:title', { number })}
          </SheetTitle>
          <StatusBadge status={stored} docType="creditNote" t={t} />
          <SheetDescription className="sr-only">{number}</SheetDescription>
        </SheetHeader>

        {credited?.invoiceID ? (
          invoiceMissing ? (
            <p className="px-4 text-sm text-muted-foreground">
              {t('invoices:creditNotes:sheet:credits', {
                number: credited.invoiceID,
                date: credited.issuedAt
                  ? moment(credited.issuedAt).format(fmt)
                  : '',
              })}
            </p>
          ) : (
            <Button
              type="button"
              variant="link"
              className="mx-4 h-auto justify-start px-0 text-foreground"
              onClick={() => onOpenInvoice(creditNote.creditedInvoiceId)}
            >
              <ArrowUpRight className="size-4" />
              {t('invoices:creditNotes:sheet:credits', {
                number: credited.invoiceID,
                date: credited.issuedAt
                  ? moment(credited.issuedAt).format(fmt)
                  : '',
              })}
            </Button>
          )
        ) : null}

        <dl className="grid gap-3 px-4 text-sm">
          <div>
            <dt className="text-muted-foreground">
              {t('invoices:sheet:client')}
            </dt>
            <dd>
              {creditNote.recipient?.fullname || creditNote.recipient?.company}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t('invoices:sheet:issued')}
            </dt>
            <dd>{issued ? moment(issued).format(fmt) : '—'}</dd>
          </div>
        </dl>

        <div className="mt-4 flex justify-between border-t px-4 pt-4 font-medium">
          <span>{t('invoices:creditNotes:sheet:totalCredit')}</span>
          <span className="tabular-nums">
            {formatInvoiceAmount(creditNote)}
          </span>
        </div>

        {creditNote.note ? (
          <div className="mt-4 px-4 text-sm">
            <h3 className="text-sm font-medium">{t('invoices:sheet:note')}</h3>
            <p className="mt-1 text-muted-foreground">{creditNote.note}</p>
          </div>
        ) : null}

        <SheetFooter className="flex-row flex-wrap gap-2">
          {stored !== 'draft' ? (
            <Button
              type="button"
              onClick={() => ipc.send('preview-invoice', creditNote)}
            >
              {t('invoices:creditNotes:actions:preview')}
            </Button>
          ) : null}
          {stored === 'draft' ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => dispatch(editInvoice(creditNote))}
              >
                {t('invoices:creditNotes:actions:edit')}
              </Button>
              <Button
                type="button"
                onClick={() => dispatch(issueCreditNote(creditNote._id))}
              >
                {t('invoices:creditNotes:actions:issue')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const removed = creditNote;
                  onOpenChange(false);
                  dispatch(deleteInvoice(creditNote._id));
                  const toastId = toast.add({
                    title: t('invoices:toast:deleted', { count: 1 }),
                    timeout: UNDO_TIMEOUT_MS,
                    actionProps: {
                      children: t('invoices:toast:undo'),
                      onClick: () => {
                        toast.close(toastId);
                        dispatch(restoreInvoices([removed]));
                      },
                    },
                  });
                }}
              >
                {t('invoices:creditNotes:actions:delete')}
              </Button>
            </>
          ) : null}
          {stored === 'issued' ? (
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                const ok = await dialog.confirm({
                  title: t('invoices:creditNotes:void:title', { number }),
                  message: t('invoices:creditNotes:void:description'),
                  confirmLabel: t('invoices:creditNotes:void:confirm'),
                  cancelLabel: t('common:cancel'),
                });
                if (ok) {
                  dispatch(voidCreditNote(creditNote._id));
                }
              }}
            >
              {t('invoices:creditNotes:actions:void')}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
