import moment from 'moment';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  formatInvoiceAmount,
  getDisplayStatus,
  getInvoiceNumber,
  getIssuedAt,
} from '../../helpers/invoice';
import * as InvoicesActions from '../../actions/invoices';
import StatusBadge from '../invoices/StatusBadge';
import { useNow } from '../invoices/useNow';

function formatOutstandingLines(outstanding, invoices) {
  return Object.keys(outstanding).map(code => {
    const amount = outstanding[code];
    const ref = invoices.find(inv => (inv.currency?.code ?? 'USD') === code);
    const currency = ref?.currency ?? {
      code,
      fraction: 2,
      separator: 'commaDot',
      placement: 'before',
    };
    return formatInvoiceAmount({ grandTotal: amount, currency });
  });
}

export default function ClientDetailSheet({
  contact,
  summary,
  open,
  onOpenChange,
  dateFormat,
  onEdit,
  onOpenInvoice,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const now = useNow();

  if (!contact) {
    return null;
  }

  const outstandingLines = formatOutstandingLines(
    summary.outstanding,
    summary.invoices
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-background text-foreground sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{contact.fullname}</SheetTitle>
          {contact.company ? (
            <SheetDescription>{contact.company}</SheetDescription>
          ) : null}
          {contact.taxId ? (
            <SheetDescription>{contact.taxId}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm">
          <div>
            <div className="text-muted-foreground">
              {t('contacts:fields:email')}
            </div>
            <div>{contact.email || '—'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">
              {t('contacts:fields:phone')}
            </div>
            <div>{contact.phone || '—'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">
              {t('contacts:detail:outstanding')}
            </div>
            {outstandingLines.length ? (
              outstandingLines.map(line => <div key={line}>{line}</div>)
            ) : (
              <div>—</div>
            )}
          </div>
          <p className="text-muted-foreground">{t('contacts:editor:hint')}</p>
          <div>
            <div className="mb-2 font-medium">
              {t('contacts:fields:invoices')}
            </div>
            {summary.invoices.length === 0 ? (
              <p className="text-muted-foreground">
                {t('contacts:detail:noInvoices')}
              </p>
            ) : (
              <ul className="space-y-2">
                {summary.invoices.map(invoice => {
                  const issued = getIssuedAt(invoice);
                  const issuedLabel = issued
                    ? moment(issued).format(dateFormat)
                    : '—';
                  return (
                    <li key={invoice._id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-start text-foreground hover:bg-muted/50"
                        onClick={() => onOpenInvoice(invoice._id)}
                      >
                        <span className="font-medium">
                          {getInvoiceNumber(invoice)}
                        </span>
                        <span className="text-muted-foreground">
                          {issuedLabel}
                        </span>
                        <StatusBadge
                          status={getDisplayStatus(invoice, now)}
                          t={t}
                        />
                        <span className="tabular-nums">
                          {formatInvoiceAmount(invoice)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              dispatch(InvoicesActions.newInvoiceFromContact(contact))
            }
          >
            {t('contacts:detail:newInvoice')}
          </Button>
          <Button type="button" onClick={() => onEdit(contact)}>
            {t('contacts:detail:edit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
