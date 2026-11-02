import { MoreHorizontal } from 'lucide-react';

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
  setInvoiceStatus,
} from '../../actions/invoices';
import { getStoredStatus } from '../../helpers/invoice';

const SETTABLE = INVOICE_STATUSES.filter(s => s !== 'paid');

export default function InvoiceRowActions({ invoice, dispatch, t }) {
  const stored = getStoredStatus(invoice);
  const ipc = window.manta.ipc;

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
        <DropdownMenuItem onClick={() => dispatch(editInvoice(invoice))}>
          {t('invoices:actions:edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => dispatch(duplicateInvoice(invoice))}>
          {t('invoices:actions:duplicate')}
        </DropdownMenuItem>
        {stored !== 'paid' ? (
          <DropdownMenuItem
            onClick={() => dispatch(setInvoiceStatus(invoice._id, 'paid'))}
          >
            {t('invoices:actions:markAsPaid')}
          </DropdownMenuItem>
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
