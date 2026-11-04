import moment from 'moment';
import { createColumnHelper } from '@tanstack/react-table';

import CreditNoteRowActions from './CreditNoteRowActions';
import StatusBadge from './StatusBadge';
import { SortHeader, selectColumn } from '../table/DataTable';

const columnHelper = createColumnHelper();

export function getCreditNoteColumns({
  t,
  dateFormat,
  onOpen,
  onOpenInvoice,
  dispatch,
}) {
  return [
    selectColumn({
      selectAllLabel: t('common:table:selectAll'),
      getRowLabel: row => t('common:table:selectRow', { name: row.number }),
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
          {row.original.number}
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
        const ms = row.original.issuedAt;
        if (ms == null) return '—';
        return moment(ms).format(dateFormat);
      },
      sortFn: 'basic',
    }),
    columnHelper.accessor('creditedNumber', {
      header: ({ column }) => (
        <SortHeader column={column}>
          {t('invoices:creditNotes:columns:credits')}
        </SortHeader>
      ),
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
      sortFn: 'alphanumeric',
    }),
    columnHelper.accessor('amount', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('invoices:columns:amount')}</SortHeader>
      ),
      cell: ({ row }) => row.original.amountText,
      meta: { align: 'end' },
      sortFn: 'basic',
    }),
    columnHelper.accessor('displayStatus', {
      id: 'status',
      header: ({ column }) => (
        <SortHeader column={column}>{t('invoices:columns:status')}</SortHeader>
      ),
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.displayStatus}
          docType="creditNote"
          t={t}
        />
      ),
      sortFn: 'text',
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <span className="sr-only">{t('invoices:columns:actions')}</span>
      ),
      cell: ({ row }) => (
        <div onClick={event => event.stopPropagation()} role="presentation">
          <CreditNoteRowActions
            creditNote={row.original.doc}
            dispatch={dispatch}
            t={t}
            onOpen={() => onOpen(row.id)}
          />
        </div>
      ),
    }),
  ];
}
