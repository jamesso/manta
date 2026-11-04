import moment from 'moment';
import { createColumnHelper } from '@tanstack/react-table';
import { formatNumber } from '../../../helpers/formatNumber';
import { STATUS_SORT_RANK } from '../../helpers/invoiceList';
import DueCell from './DueCell';
import InvoiceRowActions from './InvoiceRowActions';
import StatusBadge from './StatusBadge';
import { SortHeader, selectColumn } from '../table/DataTable';

const columnHelper = createColumnHelper();

export function getColumns({
  t,
  dateFormat,
  onOpen,
  dispatch,
  onRecordPayment,
}) {
  return [
    selectColumn({
      selectAllLabel: t('invoices:columns:selectAll'),
      getRowLabel: row => t('invoices:columns:select', { number: row.number }),
    }),
    columnHelper.accessor('number', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('invoices:columns:number')}</SortHeader>
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
      sortFn: 'alphanumeric',
    }),
    columnHelper.accessor('client', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('invoices:columns:client')}</SortHeader>
      ),
      sortFn: 'text',
    }),
    columnHelper.accessor('issuedAt', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('invoices:columns:issued')}</SortHeader>
      ),
      cell: ({ row }) => {
        const v = row.original.issuedAt;
        const fmt = row.original.invoice.configs?.dateFormat ?? dateFormat;
        return v ? moment(v).format(fmt) : '—';
      },
      sortFn: 'basic',
    }),
    columnHelper.accessor(row => row.dueAt ?? Number.POSITIVE_INFINITY, {
      id: 'dueAt',
      header: ({ column }) => (
        <SortHeader column={column}>{t('invoices:columns:due')}</SortHeader>
      ),
      cell: ({ row }) => <DueCell row={row} t={t} dateFormat={dateFormat} />,
      sortFn: 'basic',
    }),
    columnHelper.accessor('amount', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('invoices:columns:amount')}</SortHeader>
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
            <span className="font-medium tabular-nums">{amountText}</span>
            {showBalance ? (
              <div className="text-xs text-muted-foreground tabular-nums">
                {t('invoices:payments:balanceShort', { amount: balanceLabel })}
              </div>
            ) : null}
          </div>
        );
      },
      meta: { align: 'end' },
      sortFn: 'basic',
    }),
    columnHelper.accessor(row => STATUS_SORT_RANK[row.displayStatus], {
      id: 'status',
      header: ({ column }) => (
        <SortHeader column={column}>{t('invoices:columns:status')}</SortHeader>
      ),
      cell: ({ row }) => (
        <StatusBadge status={row.original.displayStatus} t={t} />
      ),
      sortFn: 'basic',
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
