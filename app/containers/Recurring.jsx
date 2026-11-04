import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as UIActions from '../actions/ui';
import * as ACTION_TYPES from '../constants/actions.jsx';
import RecurringEmpty from '../components/recurring/RecurringEmpty';
import RecurringTable from '../components/recurring/RecurringTable';
import {
  SelectionBar,
  usePagination,
  useRowSelection,
} from '../components/table/DataTable';
import { deleteRecurring } from '../actions/recurring';
import RecurringSheet from '../components/recurring/RecurringSheet';
import RecurringDetailSheet from '../components/recurring/RecurringDetailSheet';
import { ListPage, PageHeader } from '../components/layout/PageHeader';
import {
  FacetFilter,
  FilterBar,
  FilterSearch,
  NoResults,
  ResetFilters,
} from '../components/filters/FilterBar';
import { useListRequest } from '../components/filters/useListRequest';
import { facetOptions, matchesAny } from '../helpers/listFilters';
import {
  RECURRING_STATUSES,
  getRecurringClient,
  getRecurringStatus,
  matchesRecurringQuery,
} from '../helpers/recurring';

const NO_PROFILES = [];

export default function Recurring() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const profiles = useSelector(s => s.recurring ?? NO_PROFILES);
  const contacts = useSelector(s => s.contacts) || [];
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [clients, setClients] = useState([]);
  const [sorting, setSorting] = useState([{ id: 'nextDate', desc: false }]);
  const [detailId, setDetailId] = useState(null);
  const detailProfile = detailId
    ? profiles.find(p => p._id === detailId) || null
    : null;

  useEffect(() => {
    if (detailId && !profiles.some(p => p._id === detailId)) {
      setDetailId(null);
    }
  }, [profiles, detailId]);

  const openNewTemplate = () => {
    dispatch({
      type: ACTION_TYPES.FORM_LOAD_TEMPLATE,
      payload: {
        template: {
          rows: [
            {
              id: crypto.randomUUID(),
              description: '',
              price: '',
              quantity: '',
            },
          ],
          recipient: { fullname: '', email: '' },
        },
        profileId: null,
        contacts,
      },
    });
    dispatch(UIActions.changeActiveTab('form'));
  };

  // Each facet counts rows that match the other filters.
  const matchesStatus = useCallback(
    p => matchesAny(statuses, s => getRecurringStatus(p, Date.now()) === s),
    [statuses]
  );
  const matchesClient = useCallback(
    p => matchesAny(clients, c => getRecurringClient(p) === c),
    [clients]
  );

  const statusOptions = useMemo(() => {
    const rows = profiles.filter(
      p => matchesRecurringQuery(p, query) && matchesClient(p)
    );
    return RECURRING_STATUSES.map(key => ({
      value: key,
      label: t(`recurring:status:${key}`),
      count: rows.filter(p => getRecurringStatus(p, Date.now()) === key).length,
    }));
  }, [profiles, query, matchesClient, t]);

  const clientOptions = useMemo(
    () =>
      facetOptions(
        profiles.filter(
          p => matchesRecurringQuery(p, query) && matchesStatus(p)
        ),
        getRecurringClient,
        clients
      ),
    [profiles, query, matchesStatus, clients]
  );

  const visible = useMemo(
    () =>
      profiles.filter(
        p =>
          matchesRecurringQuery(p, query) &&
          matchesStatus(p) &&
          matchesClient(p)
      ),
    [profiles, query, matchesStatus, matchesClient]
  );
  const visibleIds = useMemo(() => visible.map(p => p._id), [visible]);
  const { rowSelection, setRowSelection, selectedIds, clearSelection } =
    useRowSelection(visibleIds);
  const [pagination, setPagination] = usePagination([
    query,
    statuses,
    clients,
    sorting,
  ]);

  const hasFilters =
    query.trim() !== '' || statuses.length > 0 || clients.length > 0;
  const clearFilters = () => {
    setQuery('');
    setStatuses([]);
    setClients([]);
  };

  useListRequest('recurring', request => {
    setQuery(request.query ?? '');
    setStatuses(
      RECURRING_STATUSES.includes(request.status) ? [request.status] : []
    );
    setClients([]);
  });

  return (
    <ListPage>
      <PageHeader
        title={t('recurring:header:name')}
        count={t('recurring:header:count', { count: profiles.length })}
      >
        <Button type="button" onClick={openNewTemplate}>
          <Plus />
          {t('recurring:header:new')}
        </Button>
      </PageHeader>

      {profiles.length > 0 ? (
        <FilterBar>
          <FilterSearch
            value={query}
            onChange={setQuery}
            label={t('recurring:search:label')}
            placeholder={t('recurring:search:placeholder')}
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

      {profiles.length === 0 ? (
        <RecurringEmpty onNew={openNewTemplate} />
      ) : visible.length === 0 ? (
        <NoResults
          title={t('recurring:empty:noResults')}
          onClear={clearFilters}
        />
      ) : (
        <RecurringTable
          profiles={visible}
          sorting={sorting}
          onSortingChange={setSorting}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          pagination={pagination}
          onPaginationChange={setPagination}
          onOpen={setDetailId}
        />
      )}

      <SelectionBar
        count={selectedIds.length}
        onClear={clearSelection}
        actions={[
          {
            label: t('common:delete'),
            variant: 'destructive',
            onClick: () => dispatch(deleteRecurring(selectedIds)),
          },
        ]}
      />
      <RecurringDetailSheet
        profile={detailProfile}
        open={Boolean(detailProfile)}
        onOpenChange={open => {
          if (!open) {
            setDetailId(null);
          }
        }}
        onEdit={profile => {
          setDetailId(null);
          dispatch(
            UIActions.setRecurringSheet({ mode: 'edit', id: profile._id })
          );
        }}
      />
      <RecurringSheet />
    </ListPage>
  );
}
