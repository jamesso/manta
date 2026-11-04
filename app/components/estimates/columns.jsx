import moment from 'moment';
import { createColumnHelper } from '@tanstack/react-table';

import { ESTIMATE_SORT_RANK } from '../../helpers/estimateList';
import { editInvoice } from '../../actions/invoices';
import EstimateRowActions from './EstimateRowActions';
import StatusBadge from '../invoices/StatusBadge';
import { SortHeader, selectColumn } from '../table/DataTable';

const columnHelper = createColumnHelper();

function ValidUntilCell({ row, t, dateFormat }) {
  const { validUntil, validInDays, displayStatus } = row.original;
  const fmt = row.original.invoice.configs?.dateFormat ?? dateFormat;
  const dateText = validUntil ? moment(validUntil).format(fmt) : '—';
  let hint = null;
  if (
    validUntil != null &&
    (displayStatus === 'draft' ||
      displayStatus === 'sent' ||
      displayStatus === 'expired')
  ) {
    if (validInDays === 0) {
      hint = t('estimates:valid:today');
    } else if (validInDays > 0) {
      hint = t('estimates:valid:inDays', { count: validInDays });
    } else if (validInDays < 0) {
      hint = t('estimates:valid:expiredDays', { count: Math.abs(validInDays) });
    }
  }
  return (
    <div>
      <div>{dateText}</div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export function getColumns({ t, dateFormat, dispatch }) {
  return [
    selectColumn({
      selectAllLabel: t('common:table:selectAll'),
      getRowLabel: row => t('common:table:selectRow', { name: row.number }),
    }),
    columnHelper.accessor('number', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('estimates:columns:number')}</SortHeader>
      ),
      cell: ({ row }) => (
        <button
          type="button"
          className="min-h-6 bg-transparent text-start font-medium text-primary shadow-none underline-offset-4 hover:underline"
          onClick={event => {
            event.stopPropagation();
            dispatch(editInvoice(row.original.invoice));
          }}
        >
          {row.original.number}
        </button>
      ),
      sortFn: 'alphanumeric',
    }),
    columnHelper.accessor('client', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('estimates:columns:client')}</SortHeader>
      ),
      sortFn: 'text',
    }),
    columnHelper.accessor('issuedAt', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('estimates:columns:issued')}</SortHeader>
      ),
      cell: ({ row }) => {
        const v = row.original.issuedAt;
        const fmt = row.original.invoice.configs?.dateFormat ?? dateFormat;
        return v ? moment(v).format(fmt) : '—';
      },
      sortFn: 'basic',
    }),
    columnHelper.accessor(row => row.validUntil ?? Number.POSITIVE_INFINITY, {
      id: 'validUntil',
      header: ({ column }) => (
        <SortHeader column={column}>
          {t('estimates:columns:validUntil')}
        </SortHeader>
      ),
      cell: ({ row }) => (
        <ValidUntilCell row={row} t={t} dateFormat={dateFormat} />
      ),
      sortFn: 'basic',
    }),
    columnHelper.accessor('amount', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('estimates:columns:amount')}</SortHeader>
      ),
      cell: ({ row }) => row.original.amountText,
      meta: { align: 'end' },
      sortFn: 'basic',
    }),
    columnHelper.accessor(row => ESTIMATE_SORT_RANK[row.displayStatus], {
      id: 'status',
      header: ({ column }) => (
        <SortHeader column={column}>{t('estimates:columns:status')}</SortHeader>
      ),
      cell: ({ row }) => (
        <StatusBadge status={row.original.displayStatus} t={t} />
      ),
      sortFn: 'basic',
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <span className="sr-only">{t('estimates:columns:actions')}</span>
      ),
      cell: ({ row }) => (
        <div onClick={event => event.stopPropagation()} role="presentation">
          <EstimateRowActions row={row.original} dispatch={dispatch} t={t} />
        </div>
      ),
    }),
  ];
}
