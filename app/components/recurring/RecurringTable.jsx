import moment from 'moment';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { createColumnHelper, useTable } from '@tanstack/react-table';

import { Switch } from '@/components/ui/switch';
import { formatInvoiceAmount } from '../../helpers/invoice';
import { dateKeyToMs } from '../../helpers/recurringSchedule';
import {
  formatRecurringInterval,
  getRecurringClient,
  getRecurringStatus,
  getRecurringTotal,
} from '../../helpers/recurring';
import * as Actions from '../../actions/recurring';
import DataTable, { SortHeader, selectColumn } from '../table/DataTable';
import { features } from '../table/features';
import RecurringRowActions from './RecurringRowActions';

const columnHelper = createColumnHelper();

// Approximate length in days, only to sort the repeat column.
const INTERVAL_DAYS = { weekly: 7, monthly: 30, quarterly: 91, yearly: 365 };

function getColumns({ t, dispatch, dateFormat, onOpen }) {
  return [
    selectColumn({
      selectAllLabel: t('common:table:selectAll'),
      getRowLabel: row => t('common:table:selectRow', { name: row.name }),
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <SortHeader column={column}>{t('recurring:columns:name')}</SortHeader>
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
          {row.original.name}
        </button>
      ),
      sortFn: 'text',
    }),
    columnHelper.accessor(getRecurringClient, {
      id: 'client',
      header: ({ column }) => (
        <SortHeader column={column}>{t('recurring:columns:client')}</SortHeader>
      ),
      sortFn: 'text',
    }),
    columnHelper.accessor(getRecurringTotal, {
      id: 'amount',
      header: ({ column }) => (
        <SortHeader column={column}>{t('recurring:columns:amount')}</SortHeader>
      ),
      cell: ({ row, getValue }) =>
        formatInvoiceAmount({
          grandTotal: getValue(),
          currency: row.original.template?.currency,
        }),
      meta: { align: 'end' },
      sortFn: 'basic',
    }),
    columnHelper.accessor(
      row => (INTERVAL_DAYS[row.interval] ?? 0) * (row.every ?? 1),
      {
        id: 'interval',
        header: ({ column }) => (
          <SortHeader column={column}>
            {t('recurring:columns:interval')}
          </SortHeader>
        ),
        cell: ({ row }) => {
          const { interval, every } = row.original;
          return formatRecurringInterval(t, interval, every);
        },
        sortFn: 'basic',
      }
    ),
    columnHelper.accessor(row => row.nextDate ?? '', {
      id: 'nextDate',
      header: ({ column }) => (
        <SortHeader column={column}>
          {t('recurring:columns:nextDate')}
        </SortHeader>
      ),
      cell: ({ row }) => {
        const status = getRecurringStatus(row.original, Date.now());
        if (status === 'paused' || status === 'ended') {
          return t(`recurring:status:${status}`);
        }
        return moment(dateKeyToMs(row.original.nextDate)).format(dateFormat);
      },
      sortFn: 'basic',
    }),
    columnHelper.accessor(row => (row.active ? 1 : 0), {
      id: 'active',
      header: ({ column }) => (
        <SortHeader column={column}>{t('recurring:columns:active')}</SortHeader>
      ),
      cell: ({ row }) => (
        <div onClick={event => event.stopPropagation()} role="presentation">
          <Switch
            checked={row.original.active}
            aria-label={row.original.name}
            onCheckedChange={checked =>
              dispatch(
                Actions.setRecurringActive({ id: row.id, active: checked })
              )
            }
          />
        </div>
      ),
      sortFn: 'basic',
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <span className="sr-only">{t('recurring:columns:actions')}</span>
      ),
      cell: ({ row }) => (
        <div onClick={event => event.stopPropagation()} role="presentation">
          <RecurringRowActions profile={row.original} />
        </div>
      ),
    }),
  ];
}

export default function RecurringTable({
  profiles,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  pagination,
  onPaginationChange,
  onOpen,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const dateFormat =
    window.manta.settings.get('invoice.dateFormat') ?? 'MM/DD/YYYY';

  const columns = useMemo(
    () => getColumns({ t, dispatch, dateFormat, onOpen }),
    [t, dispatch, dateFormat, onOpen]
  );

  const table = useTable({
    features,
    data: profiles,
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
