import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Plus, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import ClientDetailSheet from '../components/contacts/ClientDetailSheet';
import ClientEditorDialog from '../components/contacts/ClientEditorDialog';
import ClientsTable from '../components/contacts/ClientsTable';
import {
  SelectionBar,
  usePagination,
  useRowSelection,
} from '../components/table/DataTable';
import { deleteContact } from '../actions/contacts';
import {
  FacetFilter,
  FilterBar,
  FilterSearch,
  NoResults,
  ResetFilters,
} from '../components/filters/FilterBar';
import { ListPage, PageHeader } from '../components/layout/PageHeader';
import { matchesAny } from '../helpers/listFilters';
import { useListRequest } from '../components/filters/useListRequest';
import InvoiceDetailSheet from '../components/invoices/InvoiceDetailSheet';
import { useNow } from '../components/invoices/useNow';
import {
  CLIENT_BALANCE_FILTERS,
  getClientBalanceStatus,
  matchesClientQuery,
  summarizeClients,
} from '../helpers/clients';
import { getContacts } from '../reducers/ContactsReducer';
import { getInvoices, getAllSalesDocs } from '../reducers/InvoicesReducer';
import { getDateFormat } from '../reducers/SettingsReducer';

export default function Contacts() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const contacts = useSelector(getContacts);
  const invoices = useSelector(getInvoices);
  const allSalesDocs = useSelector(getAllSalesDocs);
  const dateFormat = useSelector(getDateFormat);
  const now = useNow();

  const [query, setQuery] = useState('');
  const [balances, setBalances] = useState([]);
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [detailId, setDetailId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContact, setEditorContact] = useState(null);
  const [invoiceDetailId, setInvoiceDetailId] = useState(null);

  const summaryMap = useMemo(
    () => summarizeClients(contacts, allSalesDocs, now),
    [contacts, allSalesDocs, now]
  );

  const searchedRows = useMemo(() => {
    return contacts
      .filter(c => matchesClientQuery(c, query))
      .map(c => {
        const summary = summaryMap.get(c._id) ?? {
          invoiceCount: 0,
          outstanding: {},
          invoices: [],
        };
        return { ...c, summary, balance: getClientBalanceStatus(summary) };
      });
  }, [contacts, query, summaryMap]);

  const balanceOptions = CLIENT_BALANCE_FILTERS.map(key => ({
    value: key,
    label: t(`contacts:balance:${key}`),
    count: searchedRows.filter(row => row.balance === key).length,
  }));
  const tableRows = useMemo(
    () =>
      searchedRows.filter(row => matchesAny(balances, b => row.balance === b)),
    [searchedRows, balances]
  );
  const visibleIds = useMemo(() => tableRows.map(row => row._id), [tableRows]);
  const { rowSelection, setRowSelection, selectedIds, clearSelection } =
    useRowSelection(visibleIds);
  const [pagination, setPagination] = usePagination([query, balances, sorting]);
  const hasFilters = query.trim() !== '' || balances.length > 0;
  const clearFilters = () => {
    setQuery('');
    setBalances([]);
  };

  const detailContact = detailId
    ? contacts.find(c => c._id === detailId) || null
    : null;
  const detailSummary = detailId ? summaryMap.get(detailId) : null;

  useListRequest('contacts', request => {
    setQuery(request.query ?? '');
    setBalances([]);
    if (request.openId) setDetailId(request.openId);
  });

  const openEditor = useCallback(contact => {
    setEditorContact(contact ?? null);
    setEditorOpen(true);
  }, []);

  useEffect(() => {
    if (detailId && !contacts.some(c => c._id === detailId)) {
      setDetailId(null);
    }
  }, [contacts, detailId]);

  useEffect(() => {
    if (invoiceDetailId && !invoices.some(i => i._id === invoiceDetailId)) {
      setInvoiceDetailId(null);
    }
  }, [invoices, invoiceDetailId]);

  const invoiceDetail = invoiceDetailId
    ? invoices.find(i => i._id === invoiceDetailId) || null
    : null;

  const showEmptyNone = contacts.length === 0;
  const showEmptySearch = !showEmptyNone && tableRows.length === 0;

  return (
    <ListPage>
      <PageHeader
        title={t('contacts:header')}
        count={t('contacts:count', { count: contacts.length })}
      >
        <Button type="button" onClick={() => openEditor(null)}>
          <Plus />
          {t('contacts:newClient')}
        </Button>
      </PageHeader>

      {!showEmptyNone ? (
        <FilterBar>
          <FilterSearch
            value={query}
            onChange={setQuery}
            label={t('contacts:searchLabel')}
            placeholder={t('contacts:searchPlaceholder')}
          />
          <FacetFilter
            title={t('common:filters:balance')}
            options={balanceOptions}
            selected={balances}
            onChange={setBalances}
          />
          {hasFilters ? <ResetFilters onClick={clearFilters} /> : null}
        </FilterBar>
      ) : null}

      {showEmptyNone ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{t('contacts:empty:title')}</EmptyTitle>
            <EmptyDescription>
              {t('contacts:empty:description')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => openEditor(null)}>
              {t('contacts:newClient')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : showEmptySearch ? (
        <NoResults
          title={t('contacts:empty:noResultsFiltered')}
          onClear={clearFilters}
        />
      ) : (
        <ClientsTable
          contacts={tableRows}
          sorting={sorting}
          onSortingChange={setSorting}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          pagination={pagination}
          onPaginationChange={setPagination}
          onOpen={setDetailId}
          onEdit={contact => {
            const latest = contacts.find(c => c._id === contact._id) || contact;
            openEditor(latest);
          }}
        />
      )}

      <SelectionBar
        count={selectedIds.length}
        onClear={clearSelection}
        actions={[
          {
            label: t('common:delete'),
            variant: 'destructive',
            onClick: () => dispatch(deleteContact(selectedIds)),
          },
        ]}
      />

      <ClientEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contact={editorContact}
      />

      <ClientDetailSheet
        contact={detailContact}
        summary={detailSummary}
        open={Boolean(detailContact && detailSummary)}
        onOpenChange={open => {
          if (!open) {
            setDetailId(null);
          }
        }}
        dateFormat={dateFormat}
        onEdit={contact => {
          const latest = contacts.find(c => c._id === contact._id) || contact;
          setDetailId(null);
          openEditor(latest);
        }}
        onOpenInvoice={id => setInvoiceDetailId(id)}
      />

      <InvoiceDetailSheet
        invoice={invoiceDetail}
        open={Boolean(invoiceDetail)}
        onOpenChange={open => {
          if (!open) {
            setInvoiceDetailId(null);
          }
        }}
        dateFormat={dateFormat}
        t={t}
        now={now}
      />
    </ListPage>
  );
}
