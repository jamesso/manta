import {
  MoreHorizontal,
  HandCoins,
  FileMinus,
  Repeat,
  Mail,
  BellRing,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { INVOICE_STATUSES } from '../../constants/invoices';
import {
  deleteInvoice,
  duplicateInvoice,
  editInvoice,
  createCreditNote,
  recordFullPayment,
  setInvoiceStatus,
} from '../../actions/invoices';
import { getStoredStatus } from '../../helpers/invoice';
import { getDocType } from '../../helpers/docType';
import { buildProfileFromInvoice } from '../../helpers/recurring';
import * as UIActions from '../../actions/ui';
import { canCreateCreditNote } from '../../helpers/creditNotes';
import { canRecordPayment } from '../../helpers/payments';
import { canEmail, canSendReminder } from '../../helpers/emailDraft';
import { useEmailInvoice } from '../email/EmailHost';
import { getAllSalesDocs } from '../../reducers/InvoicesReducer';
import { useSelector } from 'react-redux';

const SETTABLE = INVOICE_STATUSES.filter(s => s !== 'paid');

export default function InvoiceRowActions({
  invoice,
  dispatch,
  t,
  onRecordPayment,
  now = Date.now(),
}) {
  const stored = getStoredStatus(invoice);
  const allDocs = useSelector(getAllSalesDocs);
  const emailInvoice = useEmailInvoice();
  const linked = allDocs.filter(
    cn => cn.docType === 'creditNote' && cn.creditedInvoiceId === invoice._id
  );
  const ipc = window.manta.ipc;
  const showPayment = canRecordPayment(invoice, linked);
  const showCredit = canCreateCreditNote(invoice, linked);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('invoices:actions:open')}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => ipc.send('preview-invoice', invoice)}>
          {t('invoices:actions:preview')}
        </DropdownMenuItem>
        {canEmail(invoice) ? (
          <DropdownMenuItem onClick={() => emailInvoice(invoice, 'invoice')}>
            <Mail />
            {t('email:actions:email')}
          </DropdownMenuItem>
        ) : null}
        {canSendReminder(invoice, now, allDocs) ? (
          <DropdownMenuItem onClick={() => emailInvoice(invoice, 'reminder')}>
            <BellRing />
            {t('email:actions:reminder')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => dispatch(editInvoice(invoice))}>
          {t('invoices:actions:edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => dispatch(duplicateInvoice(invoice))}>
          {t('invoices:actions:duplicate')}
        </DropdownMenuItem>
        {getDocType(invoice) === 'invoice' ? (
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
        {showCredit ? (
          <DropdownMenuItem onClick={() => dispatch(createCreditNote(invoice))}>
            <FileMinus />
            {t('invoices:actions:createCreditNote')}
          </DropdownMenuItem>
        ) : null}
        {showPayment ? (
          <>
            <DropdownMenuItem onClick={() => onRecordPayment(invoice._id)}>
              <HandCoins />
              {t('invoices:actions:recordPayment')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => dispatch(recordFullPayment(invoice._id))}
            >
              {t('invoices:actions:markPaidInFull')}
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {t('invoices:actions:setStatus')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={stored}>
              {SETTABLE.map(status => (
                <DropdownMenuRadioItem
                  key={status}
                  value={status}
                  onClick={() =>
                    dispatch(setInvoiceStatus(invoice._id, status))
                  }
                >
                  {t(`invoices:status:${status}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => dispatch(deleteInvoice(invoice._id))}
        >
          {t('invoices:actions:delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
