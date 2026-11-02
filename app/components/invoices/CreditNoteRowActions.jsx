import { MoreHorizontal } from 'lucide-react';

import * as dialog from '@/lib/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export default function CreditNoteRowActions({ creditNote, dispatch, t }) {
  const stored = getStoredStatus(creditNote);
  const ipc = window.manta.ipc;
  const number = getInvoiceNumber(creditNote);

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
        {stored !== 'draft' ? (
          <DropdownMenuItem
            onClick={() => ipc.send('preview-invoice', creditNote)}
          >
            {t('invoices:creditNotes:actions:preview')}
          </DropdownMenuItem>
        ) : null}
        {stored === 'draft' ? (
          <>
            <DropdownMenuItem onClick={() => dispatch(editInvoice(creditNote))}>
              {t('invoices:creditNotes:actions:edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => dispatch(issueCreditNote(creditNote._id))}
            >
              {t('invoices:creditNotes:actions:issue')}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
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
              }}
            >
              {t('invoices:creditNotes:actions:delete')}
            </DropdownMenuItem>
          </>
        ) : null}
        {stored === 'issued' ? (
          <DropdownMenuItem
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
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
