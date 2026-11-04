import {
  BadgeCheck,
  BellRing,
  CircleDot,
  Copy,
  Eye,
  FileMinus,
  HandCoins,
  Mail,
  Pencil,
  Repeat,
  Trash2,
} from 'lucide-react';

import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import ActionsMenu from '../shared/ActionsMenu';
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
  const showPayment = canRecordPayment(invoice, linked);
  const showCredit = canCreateCreditNote(invoice, linked);

  return (
    <ActionsMenu label={t('invoices:actions:open')}>
      <DropdownMenuItem
        onClick={() => dispatch(UIActions.previewInvoice(invoice))}
      >
        <Eye />
        {t('invoices:actions:preview')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => dispatch(editInvoice(invoice))}>
        <Pencil />
        {t('invoices:actions:edit')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => dispatch(duplicateInvoice(invoice))}>
        <Copy />
        {t('invoices:actions:duplicate')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
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
      {showPayment ? (
        <>
          <DropdownMenuItem onClick={() => onRecordPayment(invoice._id)}>
            <HandCoins />
            {t('invoices:actions:recordPayment')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => dispatch(recordFullPayment(invoice._id))}
          >
            <BadgeCheck />
            {t('invoices:actions:markPaidInFull')}
          </DropdownMenuItem>
        </>
      ) : null}
      {showCredit ? (
        <DropdownMenuItem onClick={() => dispatch(createCreditNote(invoice))}>
          <FileMinus />
          {t('invoices:actions:createCreditNote')}
        </DropdownMenuItem>
      ) : null}
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
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <CircleDot />
          {t('invoices:actions:setStatus')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={stored}>
            {SETTABLE.map(status => (
              <DropdownMenuRadioItem
                key={status}
                value={status}
                onClick={() => dispatch(setInvoiceStatus(invoice._id, status))}
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
        <Trash2 />
        {t('invoices:actions:delete')}
      </DropdownMenuItem>
    </ActionsMenu>
  );
}
