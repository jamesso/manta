import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { facetOptions, matchesAny } from '../helpers/listFilters';
import { useListRequest } from '../components/filters/useListRequest';
import ItemDetailSheet from '../components/items/ItemDetailSheet';
import ItemEditorDialog from '../components/items/ItemEditorDialog';
import ItemsEmpty from '../components/items/ItemsEmpty';
import ItemsTable from '../components/items/ItemsTable';
import {
  SelectionBar,
  usePagination,
  useRowSelection,
} from '../components/table/DataTable';
import { deleteItem } from '../actions/items';
import {
  countItems,
  filterItems,
  getUnitCode,
  ITEM_VIEWS,
} from '../helpers/items';
import { getItems } from '../reducers/ItemsReducer';

export default function Items() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const items = useSelector(getItems);
  const [view, setView] = useState('active');
  const [query, setQuery] = useState('');
  const [units, setUnits] = useState([]);
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const detailItem = detailId
    ? items.find(i => i._id === detailId) || null
    : null;

  const counts = useMemo(() => countItems(items), [items]);
  const inView = useMemo(
    () => filterItems(items, { view, query }),
    [items, view, query]
  );
  const unitOptions = useMemo(
    () =>
      facetOptions(inView, item => getUnitCode(item.unitCode), units).map(
        option => ({
          ...option,
          label: t(`items:units:${option.value}`, {
            defaultValue: option.value,
          }),
        })
      ),
    [inView, units, t]
  );
  const visible = useMemo(
    () =>
      inView.filter(item =>
        matchesAny(units, u => getUnitCode(item.unitCode) === u)
      ),
    [inView, units]
  );
  const visibleIds = useMemo(() => visible.map(item => item._id), [visible]);
  const { rowSelection, setRowSelection, selectedIds, clearSelection } =
    useRowSelection(visibleIds);
  const [pagination, setPagination] = usePagination([
    view,
    query,
    units,
    sorting,
  ]);
  const hasFilters = query.trim() !== '' || units.length > 0;
  const clearFilters = () => {
    setQuery('');
    setUnits([]);
  };

  useListRequest('items', request => {
    setQuery(request.query ?? '');
    setUnits([]);
    const target = request.openId
      ? items.find(i => i._id === request.openId)
      : null;
    setView(target?.archived ? 'archived' : 'active');
    if (target) setDetailId(target._id);
  });

  const openNew = useCallback(() => {
    setEditing(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback(item => {
    setEditing(item);
    setEditorOpen(true);
  }, []);

  useEffect(() => {
    if (editing && !items.some(i => i._id === editing._id)) {
      setEditorOpen(false);
      setEditing(null);
    }
  }, [items, editing]);

  useEffect(() => {
    if (detailId && !items.some(i => i._id === detailId)) {
      setDetailId(null);
    }
  }, [items, detailId]);

  const showEmptyNone = items.length === 0;
  const showEmptyResults = !showEmptyNone && visible.length === 0;

  return (
    <ListPage>
      <PageHeader
        title={t('items:header')}
        count={t('items:count', { count: items.length })}
      >
        <ViewTabs
          value={view}
          onChange={value => {
            if (ITEM_VIEWS.includes(value)) {
              setView(value);
            }
          }}
          options={ITEM_VIEWS.map(key => ({
            value: key,
            label: t(`items:views:${key}`),
            count: counts[key],
          }))}
        />
        <Button type="button" onClick={openNew}>
          <Plus />
          {t('items:new')}
        </Button>
      </PageHeader>

      {!showEmptyNone ? (
        <FilterBar>
          <FilterSearch
            value={query}
            onChange={setQuery}
            label={t('items:search:label')}
            placeholder={t('items:search:placeholder')}
          />
          <FacetFilter
            title={t('common:filters:unit')}
            options={unitOptions}
            selected={units}
            onChange={setUnits}
          />
          {hasFilters ? <ResetFilters onClick={clearFilters} /> : null}
        </FilterBar>
      ) : null}

      {showEmptyNone ? (
        <ItemsEmpty variant="none" onNew={openNew} />
      ) : showEmptyResults && view === 'archived' && !hasFilters ? (
        <ItemsEmpty variant="noArchived" />
      ) : showEmptyResults ? (
        <NoResults
          title={t('items:empty:noResultsFiltered')}
          onClear={clearFilters}
        />
      ) : (
        <ItemsTable
          items={visible}
          sorting={sorting}
          onSortingChange={setSorting}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          pagination={pagination}
          onPaginationChange={setPagination}
          onOpen={setDetailId}
          onEdit={openEdit}
        />
      )}

      <SelectionBar
        count={selectedIds.length}
        onClear={clearSelection}
        actions={[
          {
            label: t('common:delete'),
            variant: 'destructive',
            onClick: () => dispatch(deleteItem(selectedIds)),
          },
        ]}
      />

      <ItemDetailSheet
        item={detailItem}
        open={Boolean(detailItem)}
        onOpenChange={open => {
          if (!open) {
            setDetailId(null);
          }
        }}
        onEdit={item => {
          setDetailId(null);
          openEdit(item);
        }}
      />
      <ItemEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        item={editing}
        onSaved={() => setEditing(null)}
      />
    </ListPage>
  );
}
