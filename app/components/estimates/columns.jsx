import moment from 'moment';
import { createColumnHelper } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';

import { ESTIMATE_SORT_RANK } from '../../helpers/estimateList';
import { editInvoice } from '../../actions/invoices';
import EstimateRowActions from './EstimateRowActions';
import StatusBadge from '../invoices/StatusBadge';

const columnHelper = createColumnHelper();

const sortHeaderClass =
  'inline-flex min-h-6 items-center gap-1 bg-transparent text-foreground shadow-none';

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
    columnHelper.accessor('number', {
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('estimates:columns:number')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
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
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor('client', {
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('estimates:columns:client')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor('issuedAt', {
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('estimates:columns:issued')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ row }) => {
        const v = row.original.issuedAt;
        const fmt = row.original.invoice.configs?.dateFormat ?? dateFormat;
        return v ? moment(v).format(fmt) : '—';
      },
      sortingFn: 'basic',
    }),
    columnHelper.accessor(row => row.validUntil ?? Number.POSITIVE_INFINITY, {
      id: 'validUntil',
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('estimates:columns:validUntil')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ row }) => (
        <ValidUntilCell row={row} t={t} dateFormat={dateFormat} />
      ),
      sortingFn: 'basic',
    }),
    columnHelper.accessor('amount', {
      header: ({ column }) => (
        <button
          type="button"
          className={`${sortHeaderClass} w-full justify-end`}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('estimates:columns:amount')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="text-end tabular-nums">{row.original.amountText}</div>
      ),
      meta: { align: 'end' },
      sortingFn: 'basic',
    }),
    columnHelper.accessor(row => ESTIMATE_SORT_RANK[row.displayStatus], {
      id: 'status',
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('estimates:columns:status')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ row }) => (
        <StatusBadge status={row.original.displayStatus} t={t} />
      ),
      sortingFn: 'basic',
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
