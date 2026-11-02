import { createColumnHelper, useTable } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatInvoiceAmount } from '../../helpers/invoice';
import * as ContactsActions from '../../actions/contacts';
import * as InvoicesActions from '../../actions/invoices';
import { features } from './clientsTableFeatures';

const columnHelper = createColumnHelper();

const sortHeaderClass =
  'inline-flex min-h-6 items-center gap-1 bg-transparent text-foreground shadow-none';

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

function getColumns({ t, dispatch, onEdit, onOpenDetail }) {
  return [
    columnHelper.accessor(row => row.fullname, {
      id: 'name',
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('contacts:fields:nameCompany')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.fullname}</div>
          {row.original.company ? (
            <div className="text-sm text-muted-foreground">
              {row.original.company}
            </div>
          ) : null}
        </div>
      ),
      sortingFn: (a, b) =>
        a.original.fullname.localeCompare(b.original.fullname, undefined, {
          sensitivity: 'base',
        }),
    }),
    columnHelper.accessor('email', {
      header: t('contacts:fields:email'),
      cell: ({ getValue }) => getValue() || '—',
    }),
    columnHelper.accessor('phone', {
      header: t('contacts:fields:phone'),
      cell: ({ getValue }) => getValue() || '—',
    }),
    columnHelper.accessor(row => row.summary.invoiceCount, {
      id: 'invoiceCount',
      header: ({ column }) => (
        <button
          type="button"
          className={`${sortHeaderClass} ms-auto`}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('contacts:fields:invoices')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ getValue }) => (
        <span className="tabular-nums">{getValue()}</span>
      ),
    }),
    columnHelper.display({
      id: 'outstanding',
      header: () => (
        <span className="block text-end">
          {t('contacts:fields:outstanding')}
        </span>
      ),
      cell: ({ row }) => {
        const lines = formatOutstandingLines(
          row.original.summary.outstanding,
          row.original.summary.invoices
        );
        if (!lines) {
          return (
            <span className="block text-end text-muted-foreground">—</span>
          );
        }
        return (
          <div className="text-end tabular-nums">
            {lines.map(line => (
              <div key={line}>{line}</div>
            ))}
          </div>
        );
      },
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('contacts:actions:menuLabel', {
                    name: row.original.fullname,
                  })}
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() =>
                  dispatch(InvoicesActions.newInvoiceFromContact(row.original))
                }
              >
                {t('contacts:actions:newInvoice')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                {t('contacts:actions:edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  dispatch(ContactsActions.deleteContact(row.original._id))
                }
              >
                {t('contacts:actions:delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ];
}

export default function ClientsTable({
  contacts,
  sorting,
  onSortingChange,
  onRowOpen,
  onEdit,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const columns = useMemo(
    () => getColumns({ t, dispatch, onEdit, onOpenDetail: onRowOpen }),
    [t, dispatch, onEdit, onRowOpen]
  );

  const table = useTable({
    features,
    data: contacts,
    columns,
    getRowId: row => row._id,
    state: { sorting },
    onSortingChange,
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map(header => {
              const sorted = header.column.getIsSorted();
              const canSort = header.column.getCanSort();
              return (
                <TableHead
                  key={header.id}
                  aria-sort={
                    canSort
                      ? sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : 'none'
                      : undefined
                  }
                  className={
                    header.column.id === 'invoiceCount' ||
                    header.column.id === 'outstanding'
                      ? 'text-end'
                      : undefined
                  }
                >
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(row => (
          <TableRow
            key={row.id}
            className="cursor-pointer"
            onClick={() => onRowOpen(row.original)}
          >
            {row.getAllCells().map(cell => (
              <TableCell
                key={cell.id}
                className={
                  cell.column.id === 'invoiceCount' ||
                  cell.column.id === 'outstanding'
                    ? 'text-end tabular-nums'
                    : undefined
                }
              >
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
