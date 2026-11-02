import moment from 'moment';
import { useDispatch } from 'react-redux';

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
  duplicateInvoice,
  editInvoice,
  setInvoiceStatus,
} from '../../actions/invoices';
import {
  getDisplayStatus,
  formatInvoiceAmount,
  getDueDate,
  getInvoiceNumber,
  getInvoiceValue,
  getIssuedAt,
  getStoredStatus,
} from '../../helpers/invoice';
import DueCell from './DueCell';
import StatusBadge from './StatusBadge';

export default function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
  dateFormat,
  t,
  now,
}) {
  const dispatch = useDispatch();
  const ipc = window.manta.ipc;

  if (!invoice) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const number = getInvoiceNumber(invoice);
  const stored = getStoredStatus(invoice);
  const displayStatus = getDisplayStatus(invoice, now);
  const fmt = invoice.configs?.dateFormat ?? dateFormat;
  const issued = getIssuedAt(invoice);
  const due = getDueDate(invoice);
  const values = getInvoiceValue(invoice);
  const currency = invoice.currency;
  const row = {
    original: {
      invoice,
      dueAt: due,
      dueInDays:
        due == null
          ? null
          : moment(due).startOf('day').diff(moment(now).startOf('day'), 'days'),
      displayStatus,
    },
  };

  const formatMoney = n =>
    formatNumber(n, currency?.fraction ?? 2, currency?.separator ?? 'commaDot');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="flex-row flex-wrap items-center gap-2">
          <SheetTitle>{t('invoices:sheet:title', { number })}</SheetTitle>
          <StatusBadge status={displayStatus} t={t} />
          <SheetDescription className="sr-only">{number}</SheetDescription>
        </SheetHeader>

        <dl className="grid gap-3 px-4 text-sm">
          <div>
            <dt className="text-muted-foreground">
              {t('invoices:sheet:client')}
            </dt>
            <dd>
              {invoice.recipient?.fullname}
              {invoice.recipient?.company ? (
                <div className="text-muted-foreground">
                  {invoice.recipient.company}
                </div>
              ) : null}
              {invoice.recipient?.email ? (
                <div className="text-muted-foreground">
                  {invoice.recipient.email}
                </div>
              ) : null}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted-foreground">
                {t('invoices:sheet:issued')}
              </dt>
              <dd>{issued ? moment(issued).format(fmt) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t('invoices:sheet:due')}
              </dt>
              <dd>
                <DueCell row={row} t={t} dateFormat={dateFormat} />
              </dd>
            </div>
          </div>
          {currency?.code ? (
            <div>
              <dt className="text-muted-foreground">
                {t('invoices:sheet:currency')}
              </dt>
              <dd>{currency.code}</dd>
            </div>
          ) : null}
        </dl>

        <div className="px-4 pt-4">
          <h3 className="mb-2 text-sm font-medium">
            {t('invoices:sheet:items')}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-start text-muted-foreground">
                <th className="pb-2 pe-2 font-medium">
                  {t('invoices:sheet:description')}
                </th>
                <th className="pb-2 pe-2 font-medium">
                  {t('invoices:sheet:quantity')}
                </th>
                <th className="pb-2 pe-2 font-medium text-end">
                  {t('invoices:sheet:price')}
                </th>
                <th className="pb-2 font-medium text-end">
                  {t('invoices:sheet:subtotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(invoice.rows || []).map(rowItem => (
                <tr
                  key={rowItem.id || rowItem.description}
                  className="border-b"
                >
                  <td className="py-2 pe-2">{rowItem.description}</td>
                  <td className="py-2 pe-2">{rowItem.quantity}</td>
                  <td className="py-2 pe-2 text-end tabular-nums">
                    {formatMoney(Number(rowItem.price))}
                  </td>
                  <td className="py-2 text-end tabular-nums">
                    {formatMoney(rowItem.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 grid gap-1 px-4 text-sm">
          <div className="flex justify-between">
            <dt>{t('invoices:sheet:subtotal')}</dt>
            <dd className="tabular-nums">{formatMoney(values.subtotal)}</dd>
          </div>
          {values.discount != null ? (
            <div className="flex justify-between">
              <dt>{t('invoices:sheet:discount')}</dt>
              <dd className="tabular-nums">{formatMoney(values.discount)}</dd>
            </div>
          ) : null}
          {values.taxAmount != null ? (
            <div className="flex justify-between">
              <dt>{t('invoices:sheet:tax')}</dt>
              <dd className="tabular-nums">{formatMoney(values.taxAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t pt-2 font-medium">
            <dt>{t('invoices:sheet:total')}</dt>
            <dd className="tabular-nums">{formatInvoiceAmount(invoice)}</dd>
          </div>
        </dl>

        {invoice.note ? (
          <div className="mt-4 px-4 text-sm">
            <h3 className="font-medium">{t('invoices:sheet:note')}</h3>
            <p className="mt-1 text-muted-foreground">{invoice.note}</p>
          </div>
        ) : null}

        <SheetFooter className="flex-row flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => ipc.send('preview-invoice', invoice)}
          >
            {t('invoices:actions:preview')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => dispatch(editInvoice(invoice))}
          >
            {t('invoices:actions:edit')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => dispatch(duplicateInvoice(invoice))}
          >
            {t('invoices:actions:duplicate')}
          </Button>
          {stored !== 'paid' ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => dispatch(setInvoiceStatus(invoice._id, 'paid'))}
            >
              {t('invoices:actions:markAsPaid')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              dispatch(deleteInvoice(invoice._id));
            }}
          >
            {t('invoices:actions:delete')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
