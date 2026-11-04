import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { addItem, moveRow } from '../../../actions/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import ItemEditorDialog from '../../items/ItemEditorDialog';
import { rowToItemValues, sortItemsByUsage } from '../../../helpers/items';
import { getActiveItems } from '../../../reducers/ItemsReducer';
import { getAllSalesDocs } from '../../../reducers/InvoicesReducer';
import LineItemRow from './LineItemRow';

export default function LineItems() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { rows, errors, taxMode, settings } = useSelector(state => state.form);
  const showTaxColumn = taxMode === 'line' && settings.required_fields.tax;
  const draggable = rows.length > 1;
  // Wide card: one table grid for the header and all rows. The handle column
  // shows only when there is more than one row to reorder.
  const columns = [
    draggable && '1rem',
    'minmax(10rem,1fr)',
    '6.5rem',
    '5rem',
    '7rem',
    showTaxColumn && '8rem',
    '6.5rem',
    draggable ? '4rem' : '2rem',
  ]
    .filter(Boolean)
    .join(' ');
  // Slim card: handle, description and actions on top, fields below.
  const narrowColumns = draggable
    ? '1rem minmax(0,1fr) auto'
    : 'minmax(0,1fr) auto';
  const activeItems = useSelector(getActiveItems);
  const salesDocs = useSelector(getAllSalesDocs);
  const catalogItems = useMemo(
    () => sortItemsByUsage(activeItems, salesDocs),
    [activeItems, salesDocs]
  );
  const inputs = useRef({});
  const previousCount = useRef(rows.length);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsValues, setSaveAsValues] = useState(null);

  useEffect(() => {
    if (!rows.length) dispatch(addItem());
  }, [dispatch, rows.length]);
  useEffect(() => {
    if (rows.length > previousCount.current)
      inputs.current[rows[rows.length - 1].id]?.focus();
    previousCount.current = rows.length;
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('form:cards:items')}</CardTitle>
      </CardHeader>
      <CardContent
        className="@container space-y-3"
        style={{ '--line-cols': columns, '--line-cols-narrow': narrowColumns }}
      >
        <div>
          <div className="mb-2 hidden grid-cols-(--line-cols) gap-x-3 text-xs text-muted-foreground @4xl:grid">
            {draggable ? <span /> : null}
            <span>{t('form:fields:items:description')}</span>
            {['price', 'quantity'].map(name => (
              <span key={name} className="text-end">
                {t(`form:fields:items:${name}`)}
              </span>
            ))}
            <span>{t('form:fields:items:unit')}</span>
            {showTaxColumn ? <span>{t('form:fields:tax:rate')}</span> : null}
            <span className="text-end">{t('form:fields:items:amount')}</span>
            <span />
          </div>
          <DragDropContext
            onDragEnd={({ source, destination }) => {
              if (destination && source.index !== destination.index)
                dispatch(moveRow(source.index, destination.index));
            }}
          >
            <Droppable droppableId="invoice-rows">
              {provided => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-3 @4xl:space-y-2"
                >
                  {rows.map((item, index) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      count={rows.length}
                      catalogItems={catalogItems}
                      registerInput={(id, node) => {
                        inputs.current[id] = node;
                      }}
                      onSaveAsItem={row => {
                        setSaveAsValues(rowToItemValues(row));
                        setSaveAsOpen(true);
                      }}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
        {errors.rows && <FieldError>{t(errors.rows)}</FieldError>}
        <Button variant="outline" onClick={() => dispatch(addItem())}>
          <Plus />
          {t('form:fields:items:add')}
        </Button>
      </CardContent>
      <ItemEditorDialog
        open={saveAsOpen}
        onOpenChange={setSaveAsOpen}
        item={null}
        initialValues={saveAsValues}
      />
    </Card>
  );
}
