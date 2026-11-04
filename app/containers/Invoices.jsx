import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTable } from '@tanstack/react-table';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import * as UIActions from '../actions/ui';
import { deleteInvoice, recordFullPayment } from '../actions/invoices';
import { getDateFormat } from '../reducers/SettingsReducer';
import {
  getAllSalesDocs,
  getCreditNotes,
  getInvoices,
} from '../reducers/InvoicesReducer';
import {
  INVOICE_STATUS_FILTERS,
  countByTab,
  matchesSearch,
  matchesTab,
  toCreditNoteRow,
  toInvoiceRow,
} from '../helpers/invoiceList';
import { groupCreditNotesByInvoice } from '../helpers/creditNotes';
import { facetOptions, matchesAny } from '../helpers/listFilters';
import { isCreditNote } from '../helpers/docType';
import { getColumns } from '../components/invoices/columns';
import { getCreditNoteColumns } from '../components/invoices/creditNoteColumns';
import InvoiceDetailSheet from '../components/invoices/InvoiceDetailSheet';
import CreditNoteDetailSheet from '../components/invoices/CreditNoteDetailSheet';
import RecordPaymentDialog from '../components/invoices/RecordPaymentDialog';
import InvoicesEmpty from '../components/invoices/InvoicesEmpty';
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
import {
  ListPage,
  PageHeader,
  ViewTabs,
} from '../components/layout/PageHeader';
import { useListRequest } from '../components/filters/useListRequest';

export default function Invoices() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const invoices = useSelector(getInvoices);
  const creditNotes = useSelector(getCreditNotes);
  const allSalesDocs = useSelector(getAllSalesDocs);
  const dateFormat = useSelector(getDateFormat);
  const now = useNow();

  const [view, setView] = useState('invoices');
  const [statuses, setStatuses] = useState([]);
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState([{ id: 'issuedAt', desc: true }]);
  const [openId, setOpenId] = useState(null);
  const [paymentForId, setPaymentForId] = useState(null);

  const creditByInvoice = useMemo(
    () => groupCreditNotesByInvoice(allSalesDocs),
    [allSalesDocs]
  );

  const invoiceRows = useMemo(
    () =>
      invoices.map(i => toInvoiceRow(i, now, creditByInvoice.get(i._id) ?? [])),
    [invoices, now, creditByInvoice]
  );

  const creditNoteRows = useMemo(
    () => creditNotes.map(cn => toCreditNoteRow(cn)),
    [creditNotes]
  );

  const isCreditNotes = view === 'creditNotes';
  const rows = isCreditNotes ? creditNoteRows : invoiceRows;

  // Each facet counts rows that match the other filters.
  const matchesStatus = useCallback(
    row => isCreditNotes || matchesAny(statuses, s => matchesTab(row, s)),
    [isCreditNotes, statuses]
  );
  const matchesClient = useCallback(
    row => matchesAny(clients, c => row.client === c),
    [clients]
  );

  const statusOptions = useMemo(() => {
    const counts = countByTab(
      rows.filter(row => matchesSearch(row, query) && matchesClient(row))
    );
    return INVOICE_STATUS_FILTERS.map(key => ({
      value: key,
      label: t(`invoices:tabs:${key}`),
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
    view,
    query,
    statuses,
    clients,
    sorting,
  ]);

  const onOpen = useCallback(id => setOpenId(id), []);
  const onOpenInvoice = useCallback(id => setOpenId(id), []);
  const onRecordPayment = useCallback(id => setPaymentForId(id), []);

  const columns = useMemo(() => {
    if (isCreditNotes) {
      return getCreditNoteColumns({
        t,
        dateFormat,
        onOpen,
        onOpenInvoice,
        dispatch,
      });
    }
    return getColumns({ t, dateFormat, onOpen, dispatch, onRecordPayment });
  }, [
    isCreditNotes,
    t,
    dateFormat,
    onOpen,
    onOpenInvoice,
    dispatch,
    onRecordPayment,
  ]);

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

  useListRequest('invoices', request => {
    setView(request.status === 'creditNotes' ? 'creditNotes' : 'invoices');
    setStatuses(
      INVOICE_STATUS_FILTERS.includes(request.status) ? [request.status] : []
    );
    setClients([]);
    setQuery(request.query ?? '');
    if (request.openId) setOpenId(request.openId);
  });

  useEffect(() => {
    if (openId && !rows.some(r => r.id === openId)) {
      setOpenId(null);
    }
  }, [rows, openId]);

  const openDoc = openId ? allSalesDocs.find(d => d._id === openId) : null;
  const openInvoice = openDoc && !isCreditNote(openDoc) ? openDoc : null;
  const openCreditNote = openDoc && isCreditNote(openDoc) ? openDoc : null;
  const paymentInvoice = paymentForId
    ? invoices.find(inv => inv._id === paymentForId) || null
    : null;

  const hasFilters =
    query.trim() !== '' ||
    clients.length > 0 ||
    (!isCreditNotes && statuses.length > 0);
  const clearFilters = () => {
    setStatuses([]);
    setClients([]);
    setQuery('');
  };

  const showEmptyNone = isCreditNotes
    ? creditNotes.length === 0
    : invoices.length === 0;
  const showEmptyResults = !showEmptyNone && visible.length === 0;

  return (
    <ListPage>
      <PageHeader
        title={t('invoices:header:name')}
        count={t('invoices:header:count', { count: invoices.length })}
      >
        <ViewTabs
          value={view}
          onChange={setView}
          options={[
            {
              value: 'invoices',
              label: t('invoices:views:invoices'),
              count: invoices.length,
            },
            {
              value: 'creditNotes',
              label: t('invoices:views:creditNotes'),
              count: creditNotes.length,
            },
          ]}
        />
        <Button type="button" onClick={() => dispatch(UIActions.newInvoice())}>
          <Plus />
          {t('invoices:newInvoice')}
        </Button>
      </PageHeader>

      {!showEmptyNone ? (
        <FilterBar>
          <FilterSearch
            value={query}
            onChange={setQuery}
            label={t('invoices:search:label')}
            placeholder={t('invoices:search:placeholder')}
          />
          {!isCreditNotes ? (
            <FacetFilter
              title={t('common:filters:status')}
              options={statusOptions}
              selected={statuses}
              onChange={setStatuses}
            />
          ) : null}
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
        <InvoicesEmpty t={t} creditNotesTab={isCreditNotes} />
      ) : showEmptyResults ? (
        <NoResults
          title={t('invoices:empty:noResults')}
          onClear={clearFilters}
        />
      ) : (
        <DataTable table={table} onOpen={onOpen} />
      )}

      <SelectionBar
        count={selectedIds.length}
        onClear={clearSelection}
        actions={[
          ...(isCreditNotes
            ? []
            : [
                {
                  label: t('invoices:bulk:markPaidInFull'),
                  onClick: () => dispatch(recordFullPayment(selectedIds)),
                },
              ]),
          {
            label: t('common:delete'),
            variant: 'destructive',
            onClick: () => dispatch(deleteInvoice(selectedIds)),
          },
        ]}
      />

      <InvoiceDetailSheet
        invoice={openInvoice}
        open={Boolean(openInvoice)}
        onOpenChange={open => {
          if (!open) setOpenId(null);
        }}
        dateFormat={dateFormat}
        t={t}
        now={now}
        linkedCreditNotes={creditByInvoice.get(openInvoice?._id) ?? []}
        onOpenCreditNote={id => setOpenId(id)}
      />
      <CreditNoteDetailSheet
        creditNote={openCreditNote}
        open={Boolean(openCreditNote)}
        onOpenChange={open => {
          if (!open) setOpenId(null);
        }}
        dateFormat={dateFormat}
        t={t}
        onOpenInvoice={onOpenInvoice}
        invoiceMissing={
          openCreditNote &&
          !allSalesDocs.some(d => d._id === openCreditNote.creditedInvoiceId)
        }
      />
      <RecordPaymentDialog
        invoice={paymentInvoice}
        open={Boolean(paymentForId)}
        onOpenChange={open => {
          if (!open) setPaymentForId(null);
        }}
        creditNotes={creditByInvoice.get(paymentForId) ?? []}
      />
    </ListPage>
  );
}
