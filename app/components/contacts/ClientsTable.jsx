import { createColumnHelper, useTable } from '@tanstack/react-table';
import { FilePlus, Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ActionsMenu from '../shared/ActionsMenu';
import { formatInvoiceAmount } from '../../helpers/invoice';
import * as ContactsActions from '../../actions/contacts';
import * as InvoicesActions from '../../actions/invoices';
import DataTable, { SortHeader, selectColumn } from '../table/DataTable';
import { features } from '../table/features';

const columnHelper = createColumnHelper();

// Soft tints from the status palette, so they work in light and dark mode.
const AVATAR_TINTS = [
  'bg-status-partial-bg text-status-partial',
  'bg-status-paid-bg text-status-paid',
  'bg-status-pending-bg text-status-pending',
  'bg-status-refunded-bg text-status-refunded',
  'bg-status-overdue-bg text-status-overdue',
];

function ClientAvatar({ name = '' }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || '?';
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_TINTS[hash % AVATAR_TINTS.length]}`}
    >
      {initials}
    </span>
  );
}

function formatOutstandingLines(outstanding, invoices) {
  const codes = Object.keys(outstanding);
  if (!codes.length) {
    return null;
  }
  return codes.map(code => {
    const amount = outstanding[code];
    const ref = invoices.find(inv => (inv.currency?.code ?? 'USD') === code);
    const currency = ref?.currency ?? {
      code,
      fraction: 2,
      separator: 'commaDot',
      placement: 'before',
    };
    return formatInvoiceAmount({
      grandTotal: amount,
      currency,
    });
  });
}

// Sort key only: amounts in different currencies are added as plain numbers.
function totalOutstanding(outstanding) {
  return Object.values(outstanding).reduce((sum, amount) => sum + amount, 0);
}

function getColumns({ t, dispatch, onEdit }) {
  return [
    selectColumn({
      selectAllLabel: t('common:table:selectAll'),
      getRowLabel: row => t('common:table:selectRow', { name: row.fullname }),
    }),
    columnHelper.accessor(row => row.fullname, {
      id: 'name',
      header: ({ column }) => (
        <SortHeader column={column}>
          {t('contacts:fields:nameCompany')}
        </SortHeader>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <ClientAvatar name={row.original.fullname} />
          <div className="min-w-0">
            <div className="font-medium">{row.original.fullname}</div>
            {row.original.company ? (
              <div className="text-sm text-muted-foreground">
                {row.original.company}
              </div>
            ) : null}
          </div>
        </div>
      ),
      sortFn: (a, b) =>
        a.original.fullname.localeCompare(b.original.fullname, undefined, {
          sensitivity: 'base',
        }),
    }),
    columnHelper.accessor(row => row.email ?? '', {
      id: 'email',
      header: ({ column }) => (
        <SortHeader column={column}>{t('contacts:fields:email')}</SortHeader>
      ),
      cell: ({ getValue }) => getValue() || '—',
      sortFn: 'text',
    }),
    columnHelper.accessor(row => row.phone ?? '', {
      id: 'phone',
      header: ({ column }) => (
        <SortHeader column={column}>{t('contacts:fields:phone')}</SortHeader>
      ),
      cell: ({ getValue }) => getValue() || '—',
      sortFn: 'text',
    }),
    columnHelper.accessor(row => row.summary.invoiceCount, {
      id: 'invoiceCount',
      header: ({ column }) => (
        <SortHeader column={column}>{t('contacts:fields:invoices')}</SortHeader>
      ),
      meta: { align: 'end' },
      sortFn: 'basic',
    }),
    columnHelper.accessor(row => totalOutstanding(row.summary.outstanding), {
      id: 'outstanding',
      header: ({ column }) => (
        <SortHeader column={column}>
          {t('contacts:fields:outstanding')}
        </SortHeader>
      ),
      cell: ({ row }) => {
        const lines = formatOutstandingLines(
          row.original.summary.outstanding,
          row.original.summary.invoices
        );
        if (!lines) {
          return <span className="text-muted-foreground">—</span>;
        }
        return lines.map(line => <div key={line}>{line}</div>);
      },
      meta: { align: 'end' },
      sortFn: 'basic',
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <span className="sr-only">{t('contacts:fields:actions')}</span>
      ),
      cell: ({ row }) => (
        <div
          className="text-end"
          onClick={event => event.stopPropagation()}
          role="presentation"
        >
          <ActionsMenu
            label={t('contacts:actions:menuLabel', {
              name: row.original.fullname,
            })}
          >
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil />
              {t('contacts:actions:edit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                dispatch(InvoicesActions.newInvoiceFromContact(row.original))
              }
            >
              <FilePlus />
              {t('contacts:actions:newInvoice')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                dispatch(ContactsActions.deleteContact(row.original._id))
              }
            >
              <Trash2 />
              {t('contacts:actions:delete')}
            </DropdownMenuItem>
          </ActionsMenu>
        </div>
      ),
    }),
  ];
}

export default function ClientsTable({
  contacts,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  pagination,
  onPaginationChange,
  onOpen,
  onEdit,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const columns = useMemo(
    () => getColumns({ t, dispatch, onEdit }),
    [t, dispatch, onEdit]
  );

  const table = useTable({
    features,
    data: contacts,
    columns,
    getRowId: row => row._id,
    state: { sorting, rowSelection, pagination },
    onSortingChange,
    onRowSelectionChange,
    onPaginationChange,
    autoResetPageIndex: false,
  });

  return <DataTable table={table} onOpen={onOpen} />;
}
