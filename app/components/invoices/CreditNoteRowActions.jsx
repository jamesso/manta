import { Ban, Eye, Pencil, Stamp, Trash2 } from 'lucide-react';

import * as dialog from '@/lib/dialog';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ActionsMenu from '../shared/ActionsMenu';
import {
  deleteInvoice,
  editInvoice,
  issueCreditNote,
  voidCreditNote,
  restoreInvoices,
} from '../../actions/invoices';
import { getStoredStatus } from '../../helpers/invoice';
import { UNDO_TIMEOUT_MS } from '../../constants/invoices';
import { toast } from '@/components/ui/toast';
import { getInvoiceNumber } from '../../helpers/invoice';
import * as UIActions from '../../actions/ui';

export default function CreditNoteRowActions({ creditNote, dispatch, t }) {
  const stored = getStoredStatus(creditNote);
  const number = getInvoiceNumber(creditNote);

  const remove = () => {
    const removed = creditNote;
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
  };

  const confirmVoid = async () => {
    const ok = await dialog.confirm({
      title: t('invoices:creditNotes:void:title', { number }),
      message: t('invoices:creditNotes:void:description'),
      confirmLabel: t('invoices:creditNotes:void:confirm'),
      cancelLabel: t('common:cancel'),
    });
    if (ok) {
      dispatch(voidCreditNote(creditNote._id));
    }
  };

  if (stored === 'draft') {
    return (
      <ActionsMenu label={t('invoices:actions:open')}>
        <DropdownMenuItem onClick={() => dispatch(editInvoice(creditNote))}>
          <Pencil />
          {t('invoices:creditNotes:actions:edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => dispatch(issueCreditNote(creditNote._id))}
        >
          <Stamp />
          {t('invoices:creditNotes:actions:issue')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={remove}>
          <Trash2 />
          {t('invoices:creditNotes:actions:delete')}
        </DropdownMenuItem>
      </ActionsMenu>
    );
  }

  return (
    <ActionsMenu label={t('invoices:actions:open')}>
      <DropdownMenuItem
        onClick={() => dispatch(UIActions.previewInvoice(creditNote))}
      >
        <Eye />
        {t('invoices:creditNotes:actions:preview')}
      </DropdownMenuItem>
      {stored === 'issued' ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={confirmVoid}>
            <Ban />
            {t('invoices:creditNotes:actions:void')}
          </DropdownMenuItem>
        </>
      ) : null}
    </ActionsMenu>
  );
}
