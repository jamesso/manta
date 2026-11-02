import moment from 'moment';
import { useDispatch, useSelector } from 'react-redux';
import { useState } from 'react';

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
  recordFullPayment,
} from '../../actions/invoices';
import {
  getAmountPaid,
  getBalanceDue,
  getDisplayStatus,
  formatInvoiceAmount,
  getDueDate,
  getInvoiceNumber,
  getInvoiceTotals,
  getIssuedAt,
  getPayments,
  getStoredStatus,
} from '../../helpers/invoice';
import { canRecordPayment } from '../../helpers/payments';
import DueCell from './DueCell';
import PaymentsList from './PaymentsList';
import RecordPaymentDialog from './RecordPaymentDialog';
import StatusBadge from './StatusBadge';
import { getAllSalesDocs } from '../../reducers/InvoicesReducer';

export default function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
  dateFormat,
  t,
  now,
}) {
  const dispatch = useDispatch();
  const allDocs = useSelector(getAllSalesDocs) || [];
  const ipc = window.manta.ipc;
  const [paymentOpen, setPaymentOpen] = useState(false);

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
  const values = getInvoiceTotals(invoice);
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
  const amountPaid = getAmountPaid(invoice);
  const balanceDue = getBalanceDue(invoice);
  const showPayments = amountPaid > 0;
  const canPay = canRecordPayment(invoice);
  const sourceEstimate = invoice.sourceEstimateId
    ? allDocs.find(d => d._id === invoice.sourceEstimateId)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto bg-background text-foreground sm:max-w-lg w-full"
      >
        <SheetHeader className="flex-row flex-wrap items-center gap-2">
          <SheetTitle>{t('invoices:sheet:title', { number })}</SheetTitle>
          <StatusBadge status={displayStatus} t={t} />
          {displayStatus === 'overdue' && getPayments(invoice).length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {t('invoices:payments:partiallyPaid')}
            </span>
          ) : null}
          <SheetDescription className="sr-only">{number}</SheetDescription>
        </SheetHeader>

        {sourceEstimate ? (
          <p className="px-4 text-sm text-muted-foreground">
            {t('invoices:sheet:fromEstimate', {
              number: getInvoiceNumber(sourceEstimate),
            })}
          </p>
        ) : null}

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
          {values.taxTotal != null && values.taxTotal !== 0 ? (
            <div className="flex justify-between">
              <dt>{t('invoices:sheet:tax')}</dt>
              <dd className="tabular-nums">{formatMoney(values.taxTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t pt-2 font-medium">
            <dt>{t('invoices:sheet:total')}</dt>
            <dd className="tabular-nums">{formatInvoiceAmount(invoice)}</dd>
          </div>
          {showPayments ? (
            <>
              <div className="flex justify-between">
                <dt>{t('invoices:payments:amountPaid')}</dt>
                <dd className="tabular-nums">{formatMoney(amountPaid)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>{t('invoices:payments:balanceDue')}</dt>
                <dd className="tabular-nums">{formatMoney(balanceDue)}</dd>
              </div>
            </>
          ) : null}
        </dl>

        <div className="mt-4 px-4">
          <h3 className="mb-2 text-sm font-medium">
            {t('invoices:payments:title')}
          </h3>
          <PaymentsList invoice={invoice} dateFormat={fmt} t={t} />
        </div>

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
          {canPay ? (
            <>
              <Button type="button" onClick={() => setPaymentOpen(true)}>
                {t('invoices:actions:recordPayment')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => dispatch(recordFullPayment(invoice._id))}
              >
                {t('invoices:actions:markPaidInFull')}
              </Button>
            </>
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
        <RecordPaymentDialog
          invoice={invoice}
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
        />
      </SheetContent>
    </Sheet>
  );
}
