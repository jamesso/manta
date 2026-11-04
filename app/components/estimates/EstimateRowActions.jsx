import {
  CircleCheck,
  CircleX,
  Copy,
  Eye,
  FilePlus,
  FileText,
  MailCheck,
  Pencil,
  Trash2,
} from 'lucide-react';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ActionsMenu from '../shared/ActionsMenu';
import {
  deleteInvoice,
  duplicateInvoice,
  editInvoice,
  setInvoiceStatus,
} from '../../actions/invoices';
import { convertEstimate } from '../../actions/estimates';
import { getEstimateStoredStatus } from '../../helpers/estimate';
import * as UIActions from '../../actions/ui';

export default function EstimateRowActions({ row, dispatch, t }) {
  const e = row.invoice;
  const stored = getEstimateStoredStatus(e);
  const hasStatusActions =
    ['draft', 'sent', 'accepted', 'declined'].includes(stored) ||
    row.canConvert ||
    row.convertedInvoice;

  return (
    <ActionsMenu label={t('estimates:actions:open')}>
      <DropdownMenuItem onClick={() => dispatch(UIActions.previewInvoice(e))}>
        <Eye />
        {t('estimates:actions:preview')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => dispatch(editInvoice(e))}>
        <Pencil />
        {t('estimates:actions:edit')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => dispatch(duplicateInvoice(e))}>
        <Copy />
        {t('estimates:actions:duplicate')}
      </DropdownMenuItem>
      {hasStatusActions ? <DropdownMenuSeparator /> : null}
      {stored === 'draft' ? (
        <DropdownMenuItem
          onClick={() => dispatch(setInvoiceStatus(e._id, 'sent'))}
        >
          <MailCheck />
          {t('estimates:actions:markSent')}
        </DropdownMenuItem>
      ) : null}
      {['draft', 'sent', 'declined'].includes(stored) ? (
        <DropdownMenuItem
          onClick={() => dispatch(setInvoiceStatus(e._id, 'accepted'))}
        >
          <CircleCheck />
          {t('estimates:actions:markAccepted')}
        </DropdownMenuItem>
      ) : null}
      {['draft', 'sent', 'accepted'].includes(stored) ? (
        <DropdownMenuItem
          onClick={() => dispatch(setInvoiceStatus(e._id, 'declined'))}
        >
          <CircleX />
          {t('estimates:actions:markDeclined')}
        </DropdownMenuItem>
      ) : null}
      {row.canConvert ? (
        <DropdownMenuItem onClick={() => dispatch(convertEstimate(e))}>
          <FilePlus />
          {t('estimates:actions:convert')}
        </DropdownMenuItem>
      ) : null}
      {row.convertedInvoice ? (
        <DropdownMenuItem
          onClick={() =>
            dispatch(UIActions.previewInvoice(row.convertedInvoice))
          }
        >
          <FileText />
          {t('estimates:actions:openInvoice')}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => dispatch(deleteInvoice(e._id))}
      >
        <Trash2 />
        {t('estimates:actions:delete')}
      </DropdownMenuItem>
    </ActionsMenu>
  );
}
