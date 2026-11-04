import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const PAGE_SIZES = [25, 50, 100];

const isEnd = column => column.columnDef.meta?.align === 'end';

function ariaSort(column) {
  if (!column.getCanSort()) {
    return undefined;
  }
  const sorted = column.getIsSorted();
  return sorted === 'asc'
    ? 'ascending'
    : sorted === 'desc'
      ? 'descending'
      : 'none';
}

// Header button that toggles the column sort.
export function SortHeader({ column, children }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-6 items-center gap-1 bg-transparent text-muted-foreground shadow-none transition-colors hover:text-foreground ${isEnd(column) ? 'w-full justify-end' : ''}`}
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {children}
      <ArrowUpDown className="size-3.5 opacity-50" />
    </button>
  );
}

// Checkbox column. Clicks on the checkbox do not open the row. The header
// checkbox selects the rows on the current page.
export function selectColumn({ selectAllLabel, getRowLabel }) {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        className="size-4.5"
        aria-label={selectAllLabel}
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <div onClick={event => event.stopPropagation()} role="presentation">
        <Checkbox
          className="size-4.5"
          aria-label={getRowLabel(row.original)}
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
        />
      </div>
    ),
  };
}

// Row selection that only keeps rows which are still in `rowIds`, so a bulk
// action never touches a row that a filter or a data change has hidden.
export function useRowSelection(rowIds) {
  const [rowSelection, setRowSelection] = useState({});

  useEffect(() => {
    const visible = new Set(rowIds);
    setRowSelection(prev => {
      const keys = Object.keys(prev);
      const kept = keys.filter(id => prev[id] && visible.has(id));
      return kept.length === keys.length
        ? prev
        : Object.fromEntries(kept.map(id => [id, true]));
    });
  }, [rowIds]);

  const selectedIds = useMemo(
    () => rowIds.filter(id => rowSelection[id]),
    [rowIds, rowSelection]
  );
  const clearSelection = useCallback(() => setRowSelection({}), []);

  return { rowSelection, setRowSelection, selectedIds, clearSelection };
}

// Page state for a table. Pass it to `useTable` with
// `autoResetPageIndex: false`: TanStack would otherwise go back to page 1 each
// time the rows refresh (for example every minute on Invoices). This goes back
// to page 1 only when one of `resetOn` (search, filters, view, sort) changes.
export function usePagination(resetOn) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZES[1],
  });
  const resetKey = JSON.stringify(resetOn);

  useEffect(() => {
    setPagination(prev =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    );
  }, [resetKey]);

  return [pagination, setPagination];
}

function Pagination({ table }) {
  const { t } = useTranslation();
  const { pageIndex, pageSize } = table.state.pagination;
  const rowCount = table.getRowCount();
  const pageCount = table.getPageCount();

  // Rows were deleted or filtered away: stay on the last page that exists.
  useEffect(() => {
    if (pageCount > 0 && pageIndex >= pageCount) {
      table.setPageIndex(pageCount - 1);
    }
  }, [table, pageCount, pageIndex]);

  if (rowCount <= PAGE_SIZES[0]) {
    return null;
  }

  const first = pageIndex * pageSize + 1;
  const last = Math.min(rowCount, first + pageSize - 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {t('common:table:range', { first, last, total: rowCount })}
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span>{t('common:table:rowsPerPage')}</span>
          <Select
            items={PAGE_SIZES.map(size => ({ value: size, label: `${size}` }))}
            value={pageSize}
            onValueChange={size => table.setPageSize(size)}
          >
            <SelectTrigger
              size="sm"
              className="w-20"
              aria-label={t('common:table:rowsPerPage')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map(size => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="tabular-nums">
          {t('common:table:page', { page: pageIndex + 1, count: pageCount })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t('common:table:previousPage')}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t('common:table:nextPage')}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Floating bar with bulk actions for the selected rows. Each action clears
// the selection after it runs. Render it after the table: it sits at the
// page bottom and sticks to the bottom of the view, so the table never moves.
export function SelectionBar({ count, actions, onClear }) {
  const { t } = useTranslation();
  if (!count) {
    return null;
  }
  return (
    <div
      role="region"
      aria-label={t('common:bulk:label')}
      className="sticky bottom-6 z-20 mt-auto flex flex-wrap items-center gap-2 self-center rounded-xl border bg-popover py-2 ps-4 pe-2 text-popover-foreground shadow-lg duration-150 animate-in fade-in-0 slide-in-from-bottom-2"
    >
      <span className="text-sm text-muted-foreground">
        {t('common:bulk:selected', { count })}
      </span>
      {actions.map(action => (
        <Button
          key={action.label}
          type="button"
          size="sm"
          variant={action.variant ?? 'secondary'}
          onClick={() => {
            action.onClick();
            onClear();
          }}
        >
          {action.label}
        </Button>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={onClear}>
        {t('common:bulk:clear')}
      </Button>
    </div>
  );
}

export default function DataTable({ table, onOpen }) {
  const rows = table.getRowModel().rows;
  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  aria-sort={ariaSort(header.column)}
                  className={isEnd(header.column) ? 'text-end' : undefined}
                >
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map(row => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={() => onOpen(row.id)}
              >
                {row.getAllCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className={
                      isEnd(cell.column) ? 'text-end tabular-nums' : undefined
                    }
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getAllColumns().length}
                className="h-24 text-center"
              >
                —
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Pagination table={table} />
    </>
  );
}
