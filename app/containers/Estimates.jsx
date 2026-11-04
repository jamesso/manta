import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTable } from '@tanstack/react-table';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import * as UIActions from '../actions/ui';
import { deleteInvoice, editInvoice } from '../actions/invoices';
import { getDateFormat } from '../reducers/SettingsReducer';
import { getAllSalesDocs, getEstimates } from '../reducers/InvoicesReducer';
import {
  ESTIMATE_TABS,
  countByEstimateTab,
  matchesEstimateTab,
  matchesSearch,
  toEstimateRow,
} from '../helpers/estimateList';
import { buildLinkIndex } from '../helpers/estimate';
import { facetOptions, matchesAny } from '../helpers/listFilters';
import { getColumns } from '../components/estimates/columns';
import EstimatesEmpty from '../components/estimates/EstimatesEmpty';
import DataTable, {
  SelectionBar,
  usePagination,
  useRowSelection,
} from '../components/table/DataTable';
import { features } from '../components/table/features';
import { useNow } from '../components/invoices/useNow';
import {
  FacetFilter,
  FilterBar,
  FilterSearch,
  NoResults,
  ResetFilters,
} from '../components/filters/FilterBar';
import { ListPage, PageHeader } from '../components/layout/PageHeader';
import { useListRequest } from '../components/filters/useListRequest';

const STATUS_FILTERS = ESTIMATE_TABS.filter(key => key !== 'all');

export default function Estimates() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const estimates = useSelector(getEstimates);
  const allDocs = useSelector(getAllSalesDocs);
  const dateFormat = useSelector(getDateFormat);
  const now = useNow();

  const index = useMemo(() => buildLinkIndex(allDocs), [allDocs]);

  const [statuses, setStatuses] = useState([]);
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState([{ id: 'issuedAt', desc: true }]);

  const rows = useMemo(
    () => estimates.map(e => toEstimateRow(e, now, index)),
    [estimates, now, index]
  );

  // Each facet counts rows that match the other filters.
  const matchesStatus = useCallback(
    row => matchesAny(statuses, s => matchesEstimateTab(row.displayStatus, s)),
    [statuses]
  );
  const matchesClient = useCallback(
    row => matchesAny(clients, c => row.client === c),
    [clients]
  );

  const statusOptions = useMemo(() => {
    const counts = countByEstimateTab(
      rows.filter(row => matchesSearch(row, query) && matchesClient(row))
    );
    return STATUS_FILTERS.map(key => ({
      value: key,
      label: t(`estimates:tabs:${key}`),
      count: counts[key],
    }));
  }, [rows, query, matchesClient, t]);

  const clientOptions = useMemo(
    () =>
      facetOptions(
        rows.filter(row => matchesSearch(row, query) && matchesStatus(row)),
        row => row.client,
        clients
      ),
    [rows, query, matchesStatus, clients]
  );

  const visible = useMemo(
    () =>
      rows.filter(
        row =>
          matchesSearch(row, query) && matchesStatus(row) && matchesClient(row)
      ),
    [rows, query, matchesStatus, matchesClient]
  );

  const visibleIds = useMemo(() => visible.map(row => row.id), [visible]);
  const { rowSelection, setRowSelection, selectedIds, clearSelection } =
    useRowSelection(visibleIds);
  const [pagination, setPagination] = usePagination([
    query,
    statuses,
    clients,
    sorting,
  ]);

  useListRequest('estimates', request => {
    setStatuses(
      STATUS_FILTERS.includes(request.status) ? [request.status] : []
    );
    setClients([]);
    setQuery(request.query ?? '');
  });

  const columns = useMemo(
    () => getColumns({ t, dateFormat, dispatch }),
    [t, dateFormat, dispatch]
  );

  const table = useTable({
    features,
    data: visible,
    columns,
    getRowId: row => row.id,
    state: { sorting, rowSelection, pagination },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
  });

  const hasFilters =
    query.trim() !== '' || statuses.length > 0 || clients.length > 0;
  const clearFilters = () => {
    setStatuses([]);
    setClients([]);
    setQuery('');
  };

  const onOpen = useCallback(
    id => {
      const est = estimates.find(e => e._id === id);
      if (est) {
        dispatch(editInvoice(est));
      }
    },
    [dispatch, estimates]
  );

  const showEmptyNone = estimates.length === 0;
  const showEmptyResults = !showEmptyNone && visible.length === 0;

  return (
    <ListPage>
      <PageHeader
        title={t('estimates:header:name')}
        count={t('estimates:header:count', { count: estimates.length })}
      >
        <Button type="button" onClick={() => dispatch(UIActions.newEstimate())}>
          <Plus />
          {t('estimates:newEstimate')}
        </Button>
      </PageHeader>

      {!showEmptyNone ? (
        <FilterBar>
          <FilterSearch
            value={query}
            onChange={setQuery}
            label={t('estimates:search:label')}
            placeholder={t('estimates:search:placeholder')}
          />
          <FacetFilter
            title={t('common:filters:status')}
            options={statusOptions}
            selected={statuses}
            onChange={setStatuses}
          />
          <FacetFilter
            title={t('common:filters:client')}
            options={clientOptions}
            selected={clients}
            onChange={setClients}
            searchable
          />
          {hasFilters ? <ResetFilters onClick={clearFilters} /> : null}
        </FilterBar>
      ) : null}

      {showEmptyNone ? (
        <EstimatesEmpty t={t} dispatch={dispatch} />
      ) : showEmptyResults ? (
        <NoResults
          title={t('estimates:empty:noResults')}
          onClear={clearFilters}
        />
      ) : (
        <DataTable table={table} onOpen={onOpen} />
      )}

      <SelectionBar
        count={selectedIds.length}
        onClear={clearSelection}
        actions={[
          {
            label: t('common:delete'),
            variant: 'destructive',
            onClick: () => dispatch(deleteInvoice(selectedIds)),
          },
        ]}
      />
    </ListPage>
  );
}
