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
  createCreditNote,
  recordFullPayment,
  updateInvoice,
} from '../../actions/invoices';
import * as UIActions from '../../actions/ui';
import { getDocType } from '../../helpers/docType';
import { buildProfileFromInvoice } from '../../helpers/recurring';
import { FileMinus, Repeat, Mail, BellRing, Share } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { canEmail, canSendReminder } from '../../helpers/emailDraft';
import { captureAppSnapshot } from '../../helpers/emailFlow';
import { useEmailInvoice } from '../email/EmailHost';
import { markInvoiceSent } from '../../actions/invoices';
import {
  getAmountPaid,
  getBalanceDue,
  getCreditedTotal,
  getDisplayStatus,
  formatInvoiceAmount,
  getDueDate,
  getInvoiceNumber,
  getInvoiceTotals,
  getIssuedAt,
  getPayments,
  getStoredStatus,
} from '../../helpers/invoice';
import { canCreateCreditNote } from '../../helpers/creditNotes';
import { canRecordPayment } from '../../helpers/payments';
import DueCell from './DueCell';
import PaymentsList from './PaymentsList';
import RecordPaymentDialog from './RecordPaymentDialog';
import StatusBadge from './StatusBadge';
import { getAllSalesDocs } from '../../reducers/InvoicesReducer';
import { getCurrentSettings } from '../../reducers/SettingsReducer';
import { getContacts } from '../../reducers/ContactsReducer';
import EInvoiceChecklist from '../einvoice/EInvoiceChecklist.jsx';
import {
  getEInvoiceDerived,
  mergeRecipientFromContact,
} from '../../helpers/einvoice.js';
import { toEn16931 } from '../../../helpers/einvoice/toEn16931.js';
import { getEInvoiceIssues } from '../../../helpers/einvoice/getEInvoiceIssues.js';

export default function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
  dateFormat,
  t,
  now,
  linkedCreditNotes = [],
  onOpenCreditNote,
}) {
  const dispatch = useDispatch();
  const allDocs = useSelector(getAllSalesDocs) || [];
  const emailInvoice = useEmailInvoice();
  const settings = useSelector(getCurrentSettings);
  const contacts = useSelector(getContacts) || [];
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
  const displayStatus = getDisplayStatus(invoice, now, linkedCreditNotes);
  const fmt = invoice.configs?.dateFormat ?? dateFormat;
  const eInvoiceEnabled = Boolean(settings?.invoice?.eInvoice?.enabled);
  const profile = settings?.profile;
  const invoiceSettings = settings?.invoice;
  const derived =
    eInvoiceEnabled && profile
      ? getEInvoiceDerived(invoice, {
          profile,
          invoiceSettings,
          lang: invoice.configs?.language ?? 'en',
        })
      : null;
  const eInvoiceIssues =
    eInvoiceEnabled && profile && derived
      ? getEInvoiceIssues(
          toEn16931(invoice, { profile, invoice: invoiceSettings }, derived),
          {
            format: invoiceSettings?.eInvoice?.format ?? 'xrechnung-ubl',
            invoice,
            derived,
          }
        )
      : [];
  const contact =
    invoice.recipient?._id &&
    contacts.find(c => c._id === invoice.recipient._id);
  const copyClientVisible = Boolean(
    contact &&
    eInvoiceIssues.some(i => i.fix === 'client') &&
    (contact.postalAddress?.street || contact.buyerReference || contact.taxId)
  );
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
  const credited = getCreditedTotal(invoice, linkedCreditNotes);
  const balanceDue = getBalanceDue(invoice, linkedCreditNotes);
  const showPayments = amountPaid > 0;
  const canPay = canRecordPayment(invoice, linkedCreditNotes);
  const showCreateCredit = canCreateCreditNote(invoice, linkedCreditNotes);
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
          {invoice.sentAt ? (
            <div className="text-muted-foreground">
              {t('email:sheet:sentOn', {
                date: moment(invoice.sentAt).format(fmt),
              })}
            </div>
          ) : null}
          {invoice.remindedAt ? (
            <div className="text-muted-foreground">
              {t('email:sheet:remindedOn', {
                date: moment(invoice.remindedAt).format(fmt),
              })}
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
          {showPayments || credited > 0 ? (
            <>
              {credited > 0 ? (
                <div className="flex justify-between">
                  <dt>{t('invoices:sheet:credited')}</dt>
                  <dd className="tabular-nums">{formatMoney(credited)}</dd>
                </div>
              ) : null}
              {showPayments ? (
                <div className="flex justify-between">
                  <dt>{t('invoices:payments:amountPaid')}</dt>
                  <dd className="tabular-nums">{formatMoney(amountPaid)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between font-medium">
                <dt>
                  {balanceDue < 0
                    ? t('invoices:sheet:refundDue')
                    : t('invoices:sheet:balanceDue')}
                </dt>
                <dd className="tabular-nums">
                  {formatMoney(Math.abs(balanceDue))}
                </dd>
              </div>
            </>
          ) : null}
        </dl>

        {linkedCreditNotes.length > 0 ? (
          <div className="mt-4 px-4">
            <h3 className="mb-2 text-sm font-medium">
              {t('invoices:sheet:creditNotes')}
            </h3>
            <ul className="space-y-2">
              {linkedCreditNotes.map(cn => {
                const cnIssued = getIssuedAt(cn);
                return (
                  <li key={cn._id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-start text-sm hover:bg-muted/50"
                      onClick={() => onOpenCreditNote?.(cn._id)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">
                          {getInvoiceNumber(cn)}
                        </span>
                        {cnIssued ? (
                          <span className="ms-2 text-muted-foreground">
                            {moment(cnIssued).format(fmt)}
                          </span>
                        ) : null}
                      </span>
                      <StatusBadge
                        status={getStoredStatus(cn)}
                        docType="creditNote"
                        t={t}
                      />
                      <span className="tabular-nums shrink-0">
                        {formatInvoiceAmount(cn)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

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

        {eInvoiceEnabled ? (
          <div className="mt-4 px-4">
            <h3 className="mb-2 text-sm font-medium text-foreground">
              {t('invoices:sheet:einvoiceTitle')}
            </h3>
            <EInvoiceChecklist
              issues={eInvoiceIssues}
              copyClientVisible={copyClientVisible}
              onCopyClient={() => {
                if (!contact) {
                  return;
                }
                const recipient = mergeRecipientFromContact(
                  invoice.recipient,
                  contact
                );
                dispatch(updateInvoice({ ...invoice, recipient }));
              }}
            />
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
          {getDocType(invoice) === 'invoice' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                dispatch(
                  UIActions.setRecurringSheet({
                    mode: 'new',
                    profile: buildProfileFromInvoice(invoice, Date.now()),
                  })
                );
                dispatch(UIActions.changeActiveTab('recurring'));
              }}
            >
              <Repeat />
              {t('invoices:actions:makeRecurring')}
            </Button>
          ) : null}
          {showCreateCredit ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => dispatch(createCreditNote(invoice))}
            >
              <FileMinus />
              {t('invoices:actions:createCreditNote')}
            </Button>
          ) : null}
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
          {canEmail(invoice) ? (
            <Button
              type="button"
              variant="outline"
              className="bg-background text-foreground"
              onClick={() => emailInvoice(invoice, 'invoice')}
            >
              <Mail />
              {t('email:actions:email')}
            </Button>
          ) : null}
          {canSendReminder(invoice, now, allDocs) ? (
            <Button
              type="button"
              variant="outline"
              className="bg-background text-foreground"
              onClick={() => emailInvoice(invoice, 'reminder')}
            >
              <BellRing />
              {t('email:actions:reminder')}
            </Button>
          ) : null}
          {canEmail(invoice) && !invoice.sentAt ? (
            <Button
              type="button"
              variant="outline"
              className="bg-background text-foreground"
              onClick={() => dispatch(markInvoiceSent(invoice._id, 'invoice'))}
            >
              {t('email:actions:markSent')}
            </Button>
          ) : null}
          {window.manta.platform === 'darwin' && canEmail(invoice) ? (
            <Button
              type="button"
              variant="outline"
              className="bg-background text-foreground"
              onClick={async () => {
                const snapshot = captureAppSnapshot(
                  invoice,
                  window.manta.settings
                );
                const res = await window.manta.ipc.invoke('share-invoice-pdf', {
                  invoiceId: invoice._id,
                  invoice,
                  fileBase: getInvoiceNumber(invoice),
                  source: 'app',
                  snapshot,
                });
                if (!res?.ok) {
                  toast.add({
                    title: t('email:toast:failed', { reason: res?.error }),
                    type: 'warning',
                  });
                }
              }}
            >
              <Share />
              {t('email:actions:share')}
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
        <RecordPaymentDialog
          invoice={invoice}
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
        />
      </SheetContent>
    </Sheet>
  );
}
