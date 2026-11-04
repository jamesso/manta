import moment from 'moment';
import { useDispatch, useSelector } from 'react-redux';
import { useState } from 'react';

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
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ActionsMenu from '../shared/ActionsMenu';
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
import {
  BadgeCheck,
  BellRing,
  Copy,
  FileMinus,
  HandCoins,
  Mail,
  MailCheck,
  Repeat,
  Share,
  Trash2,
} from 'lucide-react';
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
import { isBuyerReferenceOn } from '../../../helpers/einvoice/identifiers.js';
import { getEInvoiceIssues } from '../../../helpers/einvoice/getEInvoiceIssues.js';

export default function InvoiceDetailSheet({
  invoice: openInvoice,
  open,
  onOpenChange,
  dateFormat,
  t,
  now,
  linkedCreditNotes: openLinkedCreditNotes = [],
  onOpenCreditNote,
}) {
  const dispatch = useDispatch();
  const allDocs = useSelector(getAllSalesDocs) || [];
  const emailInvoice = useEmailInvoice();
  const settings = useSelector(getCurrentSettings);
  const contacts = useSelector(getContacts) || [];
  const [paymentOpen, setPaymentOpen] = useState(false);
  const invoice = useSheetValue(open, openInvoice);
  const linkedCreditNotes = useSheetValue(open, openLinkedCreditNotes);

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
  const buyerReferenceOn = isBuyerReferenceOn(invoiceSettings);
  const copyClientVisible = Boolean(
    contact &&
    eInvoiceIssues.some(i => i.fix === 'client') &&
    (contact.postalAddress?.street ||
      (buyerReferenceOn && contact.buyerReference) ||
      contact.taxId)
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

  const showBalance = showPayments || credited > 0;
  const isInvoice = getDocType(invoice) === 'invoice';
  const showEmail = canEmail(invoice);
  const showReminder = canSendReminder(invoice, now, allDocs);
  const showMarkSent = showEmail && !invoice.sentAt;
  const showShare = window.manta.platform === 'darwin' && showEmail;
  const hasMoreActions =
    showEmail || showReminder || canPay || showCreateCredit || isInvoice;
  const sharePdf = async () => {
    const snapshot = captureAppSnapshot(invoice, window.manta.settings);
    const res = await window.manta.ipc.invoke('share-invoice-pdf', {
      invoiceId: invoice._id,
      invoice,
      fileBase: getInvoiceNumber(invoice),
      snapshot,
    });
    if (!res?.ok) {
      toast.add({
        title: t('email:toast:failed', { reason: res?.error }),
        type: 'warning',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{t('invoices:sheet:title', { number })}</SheetTitle>
            <StatusBadge status={displayStatus} t={t} />
            {displayStatus === 'overdue' && getPayments(invoice).length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {t('invoices:payments:partiallyPaid')}
              </span>
            ) : null}
          </div>
          <SheetDescription>
            {invoice.recipient?.fullname ||
              invoice.recipient?.company ||
              number}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="text-sm text-muted-foreground">
              {showBalance
                ? balanceDue < 0
                  ? t('invoices:sheet:refundDue')
                  : t('invoices:sheet:balanceDue')
                : t('invoices:sheet:total')}
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {showBalance
                ? formatInvoiceAmount({
                    ...invoice,
                    grandTotal: Math.abs(balanceDue),
                  })
                : formatInvoiceAmount(invoice)}
            </div>
            {sourceEstimate ? (
              <div className="mt-2 text-sm text-muted-foreground">
                {t('invoices:sheet:fromEstimate', {
                  number: getInvoiceNumber(sourceEstimate),
                })}
              </div>
            ) : null}
          </div>

          <SheetSection>
            <SheetDetails>
              <SheetDetail label={t('invoices:sheet:client')}>
                {invoice.recipient?.fullname || '—'}
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
              </SheetDetail>
              <SheetDetail label={t('invoices:sheet:issued')}>
                {issued ? moment(issued).format(fmt) : '—'}
              </SheetDetail>
              <SheetDetail label={t('invoices:sheet:due')}>
                <DueCell row={row} t={t} dateFormat={dateFormat} />
              </SheetDetail>
              {currency?.code ? (
                <SheetDetail label={t('invoices:sheet:currency')}>
                  {currency.code}
                </SheetDetail>
              ) : null}
            </SheetDetails>
            {invoice.sentAt || invoice.remindedAt ? (
              <div className="text-sm text-muted-foreground">
                {invoice.sentAt ? (
                  <div>
                    {t('email:sheet:sentOn', {
                      date: moment(invoice.sentAt).format(fmt),
                    })}
                  </div>
                ) : null}
                {invoice.remindedAt ? (
                  <div>
                    {t('email:sheet:remindedOn', {
                      date: moment(invoice.remindedAt).format(fmt),
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </SheetSection>

          <SheetSection title={t('invoices:sheet:items')}>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">
                      {t('invoices:sheet:description')}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t('invoices:sheet:quantity')}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t('invoices:sheet:price')}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t('invoices:sheet:subtotal')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t">
                  {(invoice.rows || []).map(rowItem => (
                    <tr key={rowItem.id || rowItem.description}>
                      <td className="px-3 py-2 align-top">
                        {rowItem.description}
                      </td>
                      <td className="px-3 py-2 text-end align-top tabular-nums">
                        {rowItem.quantity}
                      </td>
                      <td className="px-3 py-2 text-end align-top tabular-nums">
                        {formatMoney(Number(rowItem.price))}
                      </td>
                      <td className="px-3 py-2 text-end align-top tabular-nums">
                        {formatMoney(rowItem.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ms-auto grid w-full max-w-64 gap-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t('invoices:sheet:subtotal')}
                </dt>
                <dd className="tabular-nums">{formatMoney(values.subtotal)}</dd>
              </div>
              {values.discount != null && values.discount !== 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {t('invoices:sheet:discount')}
                  </dt>
                  <dd className="tabular-nums">
                    {formatMoney(values.discount)}
                  </dd>
                </div>
              ) : null}
              {values.taxTotal != null && values.taxTotal !== 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {t('invoices:sheet:tax')}
                  </dt>
                  <dd className="tabular-nums">
                    {formatMoney(values.taxTotal)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t pt-1.5 font-medium">
                <dt>{t('invoices:sheet:total')}</dt>
                <dd className="tabular-nums">{formatInvoiceAmount(invoice)}</dd>
              </div>
              {credited > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {t('invoices:sheet:credited')}
                  </dt>
                  <dd className="tabular-nums">{formatMoney(credited)}</dd>
                </div>
              ) : null}
              {showPayments ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {t('invoices:payments:amountPaid')}
                  </dt>
                  <dd className="tabular-nums">{formatMoney(amountPaid)}</dd>
                </div>
              ) : null}
              {showBalance ? (
                <div className="flex justify-between gap-4 font-medium">
                  <dt>
                    {balanceDue < 0
                      ? t('invoices:sheet:refundDue')
                      : t('invoices:sheet:balanceDue')}
                  </dt>
                  <dd className="tabular-nums">
                    {formatMoney(Math.abs(balanceDue))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </SheetSection>

          <SheetSection
            title={t('invoices:payments:title')}
            action={
              canPay ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentOpen(true)}
                >
                  <HandCoins />
                  {t('invoices:actions:recordPayment')}
                </Button>
              ) : null
            }
          >
            <PaymentsList invoice={invoice} dateFormat={fmt} t={t} />
          </SheetSection>

          {linkedCreditNotes.length > 0 ? (
            <SheetSection title={t('invoices:sheet:creditNotes')}>
              <ul className="divide-y rounded-lg border">
                {linkedCreditNotes.map(cn => {
                  const cnIssued = getIssuedAt(cn);
                  return (
                    <li key={cn._id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted/50"
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
                        <span className="shrink-0 tabular-nums">
                          {formatInvoiceAmount(cn)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SheetSection>
          ) : null}

          {invoice.note ? (
            <SheetSection title={t('invoices:sheet:note')}>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {invoice.note}
              </p>
            </SheetSection>
          ) : null}

          {eInvoiceEnabled ? (
            <SheetSection title={t('invoices:sheet:einvoiceTitle')}>
              <EInvoiceChecklist
                issues={eInvoiceIssues}
                copyClientVisible={copyClientVisible}
                onCopyClient={() => {
                  if (!contact) {
                    return;
                  }
                  const recipient = mergeRecipientFromContact(
                    invoice.recipient,
                    contact,
                    { buyerReference: buyerReferenceOn }
                  );
                  dispatch(updateInvoice({ ...invoice, recipient }));
                }}
              />
            </SheetSection>
          ) : null}
        </SheetBody>

        <SheetFooter>
          <ActionsMenu placement="footer" label={t('invoices:actions:open')}>
            <DropdownMenuItem
              onClick={() => dispatch(duplicateInvoice(invoice))}
            >
              <Copy />
              {t('invoices:actions:duplicate')}
            </DropdownMenuItem>
            {hasMoreActions ? <DropdownMenuSeparator /> : null}
            {showEmail ? (
              <DropdownMenuItem
                onClick={() => emailInvoice(invoice, 'invoice')}
              >
                <Mail />
                {t('email:actions:email')}
              </DropdownMenuItem>
            ) : null}
            {showReminder ? (
              <DropdownMenuItem
                onClick={() => emailInvoice(invoice, 'reminder')}
              >
                <BellRing />
                {t('email:actions:reminder')}
              </DropdownMenuItem>
            ) : null}
            {showMarkSent ? (
              <DropdownMenuItem
                onClick={() =>
                  dispatch(markInvoiceSent(invoice._id, 'invoice'))
                }
              >
                <MailCheck />
                {t('email:actions:markSent')}
              </DropdownMenuItem>
            ) : null}
            {showShare ? (
              <DropdownMenuItem onClick={sharePdf}>
                <Share />
                {t('email:actions:share')}
              </DropdownMenuItem>
            ) : null}
            {canPay ? (
              <DropdownMenuItem
                onClick={() => dispatch(recordFullPayment(invoice._id))}
              >
                <BadgeCheck />
                {t('invoices:actions:markPaidInFull')}
              </DropdownMenuItem>
            ) : null}
            {showCreateCredit ? (
              <DropdownMenuItem
                onClick={() => dispatch(createCreditNote(invoice))}
              >
                <FileMinus />
                {t('invoices:actions:createCreditNote')}
              </DropdownMenuItem>
            ) : null}
            {isInvoice ? (
              <DropdownMenuItem
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
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                onOpenChange(false);
                dispatch(deleteInvoice(invoice._id));
              }}
            >
              <Trash2 />
              {t('invoices:actions:delete')}
            </DropdownMenuItem>
          </ActionsMenu>
          <SheetClose render={<Button type="button" variant="ghost" />}>
            {t('common:close')}
          </SheetClose>
          <Button
            type="button"
            variant="outline"
            onClick={() => dispatch(editInvoice(invoice))}
          >
            {t('invoices:actions:edit')}
          </Button>
          <Button
            type="button"
            onClick={() => dispatch(UIActions.previewInvoice(invoice))}
          >
            {t('invoices:actions:preview')}
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
