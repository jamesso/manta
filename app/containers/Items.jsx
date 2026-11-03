import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ItemEditorDialog from '../components/items/ItemEditorDialog';
import ItemsEmpty from '../components/items/ItemsEmpty';
import ItemsTable from '../components/items/ItemsTable';
import { countItems, filterItems, ITEM_VIEWS } from '../helpers/items';
import { getItems } from '../reducers/ItemsReducer';

export default function Items() {
  const { t } = useTranslation();
  const items = useSelector(getItems);
  const [view, setView] = useState('active');
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const counts = useMemo(() => countItems(items), [items]);
  const visible = useMemo(
    () => filterItems(items, { view, query }),
    [items, view, query]
  );

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

  const showEmptyNone = items.length === 0;
  const showEmptySearch =
    !showEmptyNone && visible.length === 0 && query.trim() !== '';
  const showEmptyArchived =
    !showEmptyNone &&
    view === 'archived' &&
    visible.length === 0 &&
    query.trim() === '';

  return (
    <div className="flex h-full flex-col gap-5 px-8 pt-7 pb-8 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">
          {t('items:header')}
          {!showEmptyNone ? (
            <span className="ms-2 text-base font-normal text-muted-foreground">
              {t('items:count', { count: counts.active + counts.archived })}
            </span>
          ) : null}
        </h1>
        {!showEmptyNone ? (
          <Button type="button" onClick={openNew}>
            <Plus className="size-4" />
            {t('items:new')}
          </Button>
        ) : null}
      </div>

      {showEmptyNone ? (
        <ItemsEmpty variant="none" onNew={openNew} />
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="ps-9"
              placeholder={t('items:search:placeholder')}
              aria-label={t('items:search:label')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setQuery('');
                }
              }}
            />
          </div>
          <Tabs
            value={view}
            onValueChange={value => {
              if (ITEM_VIEWS.includes(value)) {
                setView(value);
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="active">
                {t('items:views:active')} ({counts.active})
              </TabsTrigger>
              <TabsTrigger value="archived">
                {t('items:views:archived')} ({counts.archived})
              </TabsTrigger>
            </TabsList>
            <TabsContent value={view} className="mt-4">
              {showEmptySearch ? (
                <ItemsEmpty
                  variant="noResults"
                  query={query}
                  onClearSearch={() => setQuery('')}
                />
              ) : showEmptyArchived ? (
                <ItemsEmpty variant="noArchived" />
              ) : (
                <ItemsTable
                  items={visible}
                  sorting={sorting}
                  onSortingChange={setSorting}
                  onRowOpen={openEdit}
                  onEdit={openEdit}
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <ItemEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        item={editing}
        onSaved={() => setEditing(null)}
      />
    </div>
  );
}
