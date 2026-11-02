import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTable } from '@tanstack/react-table';
import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as UIActions from '../actions/ui';
import { editInvoice } from '../actions/invoices';
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
import { getColumns } from '../components/estimates/columns';
import EstimatesEmpty from '../components/estimates/EstimatesEmpty';
import InvoicesTable from '../components/invoices/InvoicesTable';
import { features } from '../components/invoices/invoiceTableFeatures';
import { useNow } from '../components/invoices/useNow';

export default function Estimates() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const estimates = useSelector(getEstimates);
  const allDocs = useSelector(getAllSalesDocs);
  const dateFormat = useSelector(getDateFormat);
  const now = useNow();

  const index = useMemo(() => buildLinkIndex(allDocs), [allDocs]);

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState([{ id: 'issuedAt', desc: true }]);

  const rows = useMemo(
    () => estimates.map(e => toEstimateRow(e, now, index)),
    [estimates, now, index]
  );
  const counts = useMemo(() => countByEstimateTab(rows), [rows]);

  const visible = useMemo(
    () =>
      rows.filter(
        row =>
          matchesEstimateTab(row.displayStatus, tab) &&
          matchesSearch(row, query)
      ),
    [rows, tab, query]
  );

  const columns = useMemo(
    () => getColumns({ t, dateFormat, dispatch }),
    [t, dateFormat, dispatch]
  );

  const table = useTable({
    features,
    data: visible,
    columns,
    getRowId: row => row.id,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const clearFilters = () => {
    setTab('all');
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
    <div className="flex h-full flex-col gap-4 p-4 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('estimates:header:name')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('estimates:header:count', { count: estimates.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:w-64">
            <Search className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="ps-8"
              aria-label={t('estimates:search:label')}
              placeholder={t('estimates:search:placeholder')}
            />
          </div>
          <Button
            type="button"
            onClick={() => dispatch(UIActions.newEstimate())}
          >
            <Plus />
            {t('estimates:newEstimate')}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {ESTIMATE_TABS.map(tabKey => (
            <TabsTrigger key={tabKey} value={tabKey}>
              {t(`estimates:tabs:${tabKey}`)}
              <span className="ms-1 text-muted-foreground">
                ({counts[tabKey]})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {showEmptyNone ? (
        <EstimatesEmpty variant="none" t={t} dispatch={dispatch} />
      ) : showEmptyResults ? (
        <EstimatesEmpty
          variant="noResults"
          t={t}
          dispatch={dispatch}
          onClearFilters={clearFilters}
        />
      ) : (
        <InvoicesTable table={table} onOpen={onOpen} />
      )}
    </div>
  );
}
