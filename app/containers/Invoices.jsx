import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTable } from '@tanstack/react-table';
import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as UIActions from '../actions/ui';
import { getDateFormat } from '../reducers/SettingsReducer';
import { getInvoices } from '../reducers/InvoicesReducer';
import {
  INVOICE_TABS,
  countByTab,
  matchesSearch,
  matchesTab,
  toInvoiceRow,
} from '../helpers/invoiceList';
import BulkActionsBar from '../components/invoices/BulkActionsBar';
import { getColumns } from '../components/invoices/columns';
import InvoiceDetailSheet from '../components/invoices/InvoiceDetailSheet';
import RecordPaymentDialog from '../components/invoices/RecordPaymentDialog';
import InvoicesEmpty from '../components/invoices/InvoicesEmpty';
import InvoicesTable from '../components/invoices/InvoicesTable';
import { features } from '../components/invoices/invoiceTableFeatures';
import { useNow } from '../components/invoices/useNow';

export default function Invoices() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const invoices = useSelector(getInvoices);
  const dateFormat = useSelector(getDateFormat);
  const now = useNow();

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState([{ id: 'issuedAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState({});
  const [openId, setOpenId] = useState(null);
  const [paymentForId, setPaymentForId] = useState(null);
  const searchRef = useRef(null);

  const rows = useMemo(
    () => invoices.map(i => toInvoiceRow(i, now)),
    [invoices, now]
  );
  const counts = useMemo(() => countByTab(rows), [rows]);

  const visible = useMemo(
    () =>
      rows.filter(
        row => matchesTab(row.displayStatus, tab) && matchesSearch(row, query)
      ),
    [rows, tab, query]
  );

  const onOpen = useCallback(id => setOpenId(id), []);

  const onRecordPayment = useCallback(id => setPaymentForId(id), []);

  const columns = useMemo(
    () => getColumns({ t, dateFormat, onOpen, dispatch, onRecordPayment }),
    [t, dateFormat, onOpen, dispatch, onRecordPayment]
  );

  const table = useTable({
    features,
    data: visible,
    columns,
    getRowId: row => row.id,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
  });

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter(id => rowSelection[id]),
    [rowSelection]
  );

  useEffect(() => {
    setRowSelection({});
  }, [tab, query]);

  useEffect(() => {
    setRowSelection(prev => {
      const ids = new Set(rows.map(r => r.id));
      const next = {};
      let changed = false;
      for (const id of Object.keys(prev)) {
        if (ids.has(id) && prev[id]) {
          next[id] = true;
        } else if (prev[id]) {
          changed = true;
        }
      }
      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (openId && !rows.some(r => r.id === openId)) {
      setOpenId(null);
    }
  }, [rows, openId]);

  const openInvoice = openId
    ? invoices.find(inv => inv._id === openId) || null
    : null;
  const paymentInvoice = paymentForId
    ? invoices.find(inv => inv._id === paymentForId) || null
    : null;

  const clearFilters = () => {
    setTab('all');
    setQuery('');
  };

  const showEmptyNone = invoices.length === 0;
  const showEmptyResults = !showEmptyNone && visible.length === 0;

  return (
    <div className="flex h-full flex-col gap-4 p-4 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('invoices:header:name')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('invoices:header:count', { count: invoices.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:w-64">
            <Search className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setQuery('');
                  e.preventDefault();
                }
              }}
              className="ps-8"
              aria-label={t('invoices:search:label')}
              placeholder={t('invoices:search:placeholder')}
            />
          </div>
          <Button
            type="button"
            onClick={() => dispatch(UIActions.newInvoice())}
          >
            <Plus />
            {t('invoices:newInvoice')}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          variant="line"
          className="h-auto w-full flex-wrap justify-start"
        >
          {INVOICE_TABS.map(key => (
            <TabsTrigger key={key} value={key}>
              {t(`invoices:tabs:${key}`)}
              <span className="ms-1 text-muted-foreground">
                ({counts[key]})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <BulkActionsBar
        selectedIds={selectedIds}
        t={t}
        dispatch={dispatch}
        onClearSelection={() => setRowSelection({})}
      />

      {showEmptyNone ? (
        <InvoicesEmpty variant="none" t={t} />
      ) : showEmptyResults ? (
        <InvoicesEmpty
          variant="noResults"
          t={t}
          onClearFilters={clearFilters}
        />
      ) : (
        <InvoicesTable table={table} onOpen={onOpen} />
      )}

      <InvoiceDetailSheet
        invoice={openInvoice}
        open={Boolean(openId)}
        onOpenChange={open => {
          if (!open) setOpenId(null);
        }}
        dateFormat={dateFormat}
        t={t}
        now={now}
      />
      <RecordPaymentDialog
        invoice={paymentInvoice}
        open={Boolean(paymentForId)}
        onOpenChange={open => {
          if (!open) setPaymentForId(null);
        }}
      />
    </div>
  );
}
