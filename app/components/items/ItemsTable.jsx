import { createColumnHelper, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { formatNumber } from '../../../helpers/formatNumber';
import { getUnitCode, isKnownUnit } from '../../helpers/items';
import DataTable, { SortHeader, selectColumn } from '../table/DataTable';
import { features } from '../table/features';
import ItemRowActions from './ItemRowActions';

const columnHelper = createColumnHelper();

function getColumns({ t, currency, onEdit }) {
  return [
    selectColumn({
      selectAllLabel: t('common:table:selectAll'),
      getRowLabel: row => t('common:table:selectRow', { name: row.name }),
    }),
    columnHelper.accessor('name', {
      id: 'name',
      header: ({ column }) => (
        <SortHeader column={column}>{t('items:columns:name')}</SortHeader>
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
      sortFn: (a, b) =>
        a.original.name.localeCompare(b.original.name, undefined, {
          sensitivity: 'base',
        }),
    }),
    columnHelper.accessor(
      row => {
        const code = getUnitCode(row.unitCode);
        return isKnownUnit(code) ? t(`items:units:${code}`) : code;
      },
      {
        id: 'unit',
        header: ({ column }) => (
          <SortHeader column={column}>{t('items:columns:unit')}</SortHeader>
        ),
        sortFn: 'text',
      }
    ),
    // Items stored by an older import can have no price; they sort first.
    columnHelper.accessor(
      row =>
        Number.isFinite(row.unitPrice)
          ? row.unitPrice
          : Number.NEGATIVE_INFINITY,
      {
        id: 'unitPrice',
        header: ({ column }) => (
          <SortHeader column={column}>
            {t('items:columns:unitPrice')}
          </SortHeader>
        ),
        cell: ({ row }) =>
          Number.isFinite(row.original.unitPrice)
            ? formatNumber(
                row.original.unitPrice,
                currency.fraction ?? 2,
                currency.separator ?? 'commaDot'
              )
            : '—',
        meta: { align: 'end' },
        sortFn: 'basic',
      }
    ),
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
  rowSelection,
  onRowSelectionChange,
  pagination,
  onPaginationChange,
  onOpen,
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
    state: { sorting, rowSelection, pagination },
    onSortingChange,
    onRowSelectionChange,
    onPaginationChange,
    autoResetPageIndex: false,
  });

  return <DataTable table={table} onOpen={onOpen} />;
}
