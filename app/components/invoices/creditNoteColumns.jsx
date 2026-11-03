import moment from 'moment';
import { createColumnHelper } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';

import CreditNoteRowActions from './CreditNoteRowActions';
import StatusBadge from './StatusBadge';

const columnHelper = createColumnHelper();

const sortHeaderClass =
  'inline-flex min-h-6 items-center gap-1 bg-transparent text-muted-foreground shadow-none transition-colors hover:text-foreground';

export function getCreditNoteColumns({
  t,
  dateFormat,
  onOpen,
  onOpenInvoice,
  dispatch,
}) {
  return [
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
          {row.original.number}
        </button>
      ),
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor('client', {
      header: t('invoices:columns:client'),
      cell: ({ row }) => row.original.client,
    }),
    columnHelper.accessor('issuedAt', {
      header: t('invoices:columns:issued'),
      cell: ({ row }) => {
        const ms = row.original.issuedAt;
        if (ms == null) return '—';
        return moment(ms).format(dateFormat);
      },
    }),
    columnHelper.accessor('creditedNumber', {
      header: t('invoices:creditNotes:columns:credits'),
      cell: ({ row }) => (
        <button
          type="button"
          className="min-h-6 bg-transparent text-start text-primary shadow-none underline-offset-4 hover:underline"
          onClick={event => {
            event.stopPropagation();
            if (row.original.creditedId) {
              onOpenInvoice(row.original.creditedId);
            }
          }}
        >
          {row.original.creditedNumber || '—'}
        </button>
      ),
    }),
    columnHelper.accessor('amount', {
      header: () => (
        <span className="block text-end">{t('invoices:columns:amount')}</span>
      ),
      cell: ({ row }) => (
        <span className="block text-end tabular-nums">
          {row.original.amountText}
        </span>
      ),
    }),
    columnHelper.accessor('displayStatus', {
      header: t('invoices:columns:status'),
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.displayStatus}
          docType="creditNote"
          t={t}
        />
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <CreditNoteRowActions
          creditNote={row.original.doc}
          dispatch={dispatch}
          t={t}
          onOpen={() => onOpen(row.id)}
        />
      ),
    }),
  ];
}
