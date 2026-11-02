import {
  ArrowRightLeft,
  CalendarX,
  CircleCheck,
  CircleX,
  FileCheck,
  FilePlus,
  MoreHorizontal,
  Send,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  deleteInvoice,
  duplicateInvoice,
  editInvoice,
  setInvoiceStatus,
} from '../../actions/invoices';
import { convertEstimate } from '../../actions/estimates';
import { getEstimateStoredStatus } from '../../helpers/estimate';

const ipc = window.manta.ipc;

export default function EstimateRowActions({ row, dispatch, t }) {
  const e = row.invoice;
  const stored = getEstimateStoredStatus(e);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('estimates:actions:open')}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => dispatch(editInvoice(e))}>
          {t('estimates:actions:edit')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => dispatch(duplicateInvoice(e))}>
          {t('estimates:actions:duplicate')}
        </DropdownMenuItem>
        {stored === 'draft' ? (
          <DropdownMenuItem
            onClick={() => dispatch(setInvoiceStatus(e._id, 'sent'))}
          >
            <Send className="size-4" />
            {t('estimates:actions:markSent')}
          </DropdownMenuItem>
        ) : null}
        {['draft', 'sent', 'declined'].includes(stored) ? (
          <DropdownMenuItem
            onClick={() => dispatch(setInvoiceStatus(e._id, 'accepted'))}
          >
            <CircleCheck className="size-4" />
            {t('estimates:actions:markAccepted')}
          </DropdownMenuItem>
        ) : null}
        {['draft', 'sent', 'accepted'].includes(stored) ? (
          <DropdownMenuItem
            onClick={() => dispatch(setInvoiceStatus(e._id, 'declined'))}
          >
            <CircleX className="size-4" />
            {t('estimates:actions:markDeclined')}
          </DropdownMenuItem>
        ) : null}
        {row.canConvert ? (
          <DropdownMenuItem onClick={() => dispatch(convertEstimate(e))}>
            <FilePlus className="size-4" />
            {t('estimates:actions:convert')}
          </DropdownMenuItem>
        ) : null}
        {row.convertedInvoice ? (
          <DropdownMenuItem
            onClick={() => ipc.send('preview-invoice', row.convertedInvoice)}
          >
            <FileCheck className="size-4" />
            {t('estimates:actions:openInvoice')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => ipc.send('preview-invoice', e)}>
          {t('estimates:actions:preview')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => dispatch(deleteInvoice(e._id))}
        >
          {t('estimates:actions:delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
