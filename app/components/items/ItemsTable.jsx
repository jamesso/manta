import { createColumnHelper, useTable } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '../../../helpers/formatNumber';
import { getUnitCode, isKnownUnit } from '../../helpers/items';
import ItemRowActions from './ItemRowActions';
import { features } from './itemTableFeatures';

const columnHelper = createColumnHelper();

const sortHeaderClass =
  'inline-flex min-h-6 items-center gap-1 bg-transparent text-foreground shadow-none';

function getColumns({ t, currency, onEdit }) {
  return [
    columnHelper.accessor('name', {
      id: 'name',
      header: ({ column }) => (
        <button
          type="button"
          className={sortHeaderClass}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('items:columns:name')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.description ? (
            <div className="line-clamp-1 text-sm text-muted-foreground">
              {row.original.description}
            </div>
          ) : null}
        </div>
      ),
      sortingFn: (a, b) =>
        a.original.name.localeCompare(b.original.name, undefined, {
          sensitivity: 'base',
        }),
    }),
    columnHelper.accessor(row => getUnitCode(row.unitCode), {
      id: 'unit',
      header: t('items:columns:unit'),
      cell: ({ getValue }) => {
        const code = getValue();
        return isKnownUnit(code) ? t(`items:units:${code}`) : code;
      },
    }),
    columnHelper.accessor('unitPrice', {
      header: ({ column }) => (
        <button
          type="button"
          className={`${sortHeaderClass} ms-auto`}
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t('items:columns:unitPrice')}
          <ArrowUpDown className="size-3.5 opacity-50" />
        </button>
      ),
      cell: ({ getValue }) => (
        <span className="block text-end tabular-nums">
          {formatNumber(
            getValue(),
            currency.fraction ?? 2,
            currency.separator ?? 'commaDot'
          )}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <span className="sr-only">{t('items:columns:actions')}</span>
      ),
      cell: ({ row }) => (
        <div
          className="text-end"
          onClick={e => e.stopPropagation()}
          role="presentation"
        >
          <ItemRowActions item={row.original} onEdit={onEdit} />
        </div>
      ),
    }),
  ];
}

export default function ItemsTable({
  items,
  sorting,
  onSortingChange,
  onRowOpen,
  onEdit,
}) {
  const { t } = useTranslation();
  const currency = useSelector(
    s =>
      s.settings.saved?.invoice?.currency ?? {
        fraction: 2,
        separator: 'commaDot',
      }
  );

  const columns = useMemo(
    () => getColumns({ t, currency, onEdit }),
    [t, currency, onEdit]
  );

  const table = useTable({
    features,
    data: items,
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
                >
                  {header.isPlaceholder
                    ? null
                    : typeof header.column.columnDef.header === 'function'
                      ? header.column.columnDef.header(header.getContext())
                      : header.column.columnDef.header}
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
            {row.getVisibleCells().map(cell => (
              <TableCell key={cell.id}>
                {typeof cell.column.columnDef.cell === 'function'
                  ? cell.column.columnDef.cell(cell.getContext())
                  : cell.getValue()}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
