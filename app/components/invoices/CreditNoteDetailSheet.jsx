import moment from 'moment';
import { useDispatch } from 'react-redux';
import { ArrowUpRight } from 'lucide-react';

import * as dialog from '@/lib/dialog';
import { Button } from '@/components/ui/button';
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
import {
  deleteInvoice,
  editInvoice,
  issueCreditNote,
  voidCreditNote,
} from '../../actions/invoices';
import {
  formatInvoiceAmount,
  getInvoiceNumber,
  getIssuedAt,
  getStoredStatus,
} from '../../helpers/invoice';
import StatusBadge from './StatusBadge';
import { UNDO_TIMEOUT_MS } from '../../constants/invoices';
import { toast } from '@/components/ui/toast';
import { restoreInvoices } from '../../actions/invoices';
import * as UIActions from '../../actions/ui';

export default function CreditNoteDetailSheet({
  creditNote: openCreditNote,
  open,
  onOpenChange,
  dateFormat,
  t,
  onOpenInvoice,
  invoiceMissing: openInvoiceMissing,
}) {
  const dispatch = useDispatch();
  const creditNote = useSheetValue(open, openCreditNote);
  const invoiceMissing = useSheetValue(open, openInvoiceMissing);

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
  const credited = creditNote.creditedInvoice;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>
              {t('invoices:creditNotes:sheet:title', { number })}
            </SheetTitle>
            <StatusBadge status={stored} docType="creditNote" t={t} />
          </div>
          <SheetDescription>
            {creditNote.recipient?.fullname ||
              creditNote.recipient?.company ||
              number}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="text-sm text-muted-foreground">
              {t('invoices:creditNotes:sheet:totalCredit')}
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {formatInvoiceAmount(creditNote)}
            </div>
            {credited?.invoiceID ? (
              invoiceMissing ? (
                <div className="mt-2 text-sm text-muted-foreground">
                  {t('invoices:creditNotes:sheet:credits', {
                    number: credited.invoiceID,
                    date: credited.issuedAt
                      ? moment(credited.issuedAt).format(fmt)
                      : '',
                  })}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="mt-1 h-auto px-0 text-foreground"
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
          </div>

          <SheetSection>
            <SheetDetails>
              <SheetDetail label={t('invoices:sheet:client')}>
                {creditNote.recipient?.fullname ||
                  creditNote.recipient?.company ||
                  '—'}
              </SheetDetail>
              <SheetDetail label={t('invoices:sheet:issued')}>
                {issued ? moment(issued).format(fmt) : '—'}
              </SheetDetail>
            </SheetDetails>
          </SheetSection>

          {creditNote.note ? (
            <SheetSection title={t('invoices:sheet:note')}>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {creditNote.note}
              </p>
            </SheetSection>
          ) : null}
        </SheetBody>

        <SheetFooter>
          {stored === 'draft' ? (
            <Button
              type="button"
              variant="destructive"
              className="me-auto"
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
          ) : null}
          {stored === 'issued' ? (
            <Button
              type="button"
              variant="destructive"
              className="me-auto"
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
          <SheetClose render={<Button type="button" variant="ghost" />}>
            {t('common:close')}
          </SheetClose>
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
            </>
          ) : (
            <Button
              type="button"
              onClick={() => dispatch(UIActions.previewInvoice(creditNote))}
            >
              {t('invoices:creditNotes:actions:preview')}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
