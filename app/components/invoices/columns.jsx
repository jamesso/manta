import moment from 'moment';
import { createColumnHelper } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { formatNumber } from '../../../helpers/formatNumber';
import { STATUS_SORT_RANK } from '../../helpers/invoiceList';
import DueCell from './DueCell';
import InvoiceRowActions from './InvoiceRowActions';
import StatusBadge from './StatusBadge';

const columnHelper = createColumnHelper();

const sortHeaderClass =
  'inline-flex min-h-6 items-center gap-1 bg-transparent text-foreground shadow-none';

export function getColumns({
  t,
  dateFormat,
  onOpen,
  dispatch,
  onRecordPayment,
}) {
  return [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          className="size-6"
          aria-label={t('invoices:columns:selectAll')}
          checked={table.getIsAllRowsSelected()}
          indeterminate={
            table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
          }
          onCheckedChange={value => table.toggleAllRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <div onClick={event => event.stopPropagation()} role="presentation">
          <Checkbox
            className="size-6"
            aria-label={t('invoices:columns:select', {
              number: row.original.number,
            })}
            checked={row.getIsSelected()}
            onCheckedChange={value => row.toggleSelected(!!value)}
          />
        </div>
      ),
    }),
    columnHelper.accessor('number', {
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('invoices:columns:number')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ row }) => (
        <button
          type="button"
          className="min-h-6 bg-transparent text-start font-medium text-primary shadow-none underline-offset-4 hover:underline"
          onClick={event => {
            event.stopPropagation();
            onOpen(row.id);
          }}
        >
          {row.original.number || (
            <span className="font-normal text-muted-foreground">
              {t('invoices:number:none')}
            </span>
          )}
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
          {t('invoices:columns:client')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      sortingFn: 'text',
    }),
    columnHelper.accessor('issuedAt', {
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('invoices:columns:issued')}
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
    columnHelper.accessor(row => row.dueAt ?? Number.POSITIVE_INFINITY, {
      id: 'dueAt',
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('invoices:columns:due')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ row }) => <DueCell row={row} t={t} dateFormat={dateFormat} />,
      sortingFn: 'basic',
    }),
    columnHelper.accessor('amount', {
      header: ({ column }) => (
        <button
          type="button"
          className={`${sortHeaderClass} w-full justify-end`}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('invoices:columns:amount')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ row }) => {
        const { displayStatus, amountPaid, balance, invoice, amountText } =
          row.original;
        const showBalance =
          (displayStatus === 'partial' || displayStatus === 'overdue') &&
          amountPaid > 0;
        const balanceLabel = showBalance
          ? formatNumber(
              balance,
              invoice.currency?.fraction ?? 2,
              invoice.currency?.separator ?? 'commaDot'
            )
          : null;
        return (
          <div className="text-end">
            <span className="tabular-nums">{amountText}</span>
            {showBalance ? (
              <div className="text-xs text-muted-foreground tabular-nums">
                {t('invoices:payments:balanceShort', { amount: balanceLabel })}
              </div>
            ) : null}
          </div>
        );
      },
      meta: { align: 'end' },
      sortingFn: 'basic',
    }),
    columnHelper.accessor(row => STATUS_SORT_RANK[row.displayStatus], {
      id: 'status',
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('invoices:columns:status')}
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
        <span className="sr-only">{t('invoices:columns:actions')}</span>
      ),
      cell: ({ row }) => (
        <div onClick={event => event.stopPropagation()} role="presentation">
          <InvoiceRowActions
            invoice={row.original.invoice}
            dispatch={dispatch}
            t={t}
            onRecordPayment={onRecordPayment}
          />
        </div>
      ),
    }),
  ];
}
