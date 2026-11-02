import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { addItem, moveRow } from '../../../actions/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import LineItemRow from './LineItemRow';

export default function LineItems() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { rows, errors } = useSelector(state => state.form);
  const inputs = useRef({});
  const previousCount = useRef(rows.length);
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
      <CardContent className="space-y-3 overflow-x-auto">
        <div className="min-w-[38rem] space-y-2">
          <div className="grid grid-cols-[1.5rem_minmax(8rem,1fr)_7rem_6rem_7rem_2rem] gap-2 text-xs text-muted-foreground">
            <span />
            {['description', 'price', 'quantity', 'amount'].map(name => (
              <span key={name}>{t(`form:fields:items:${name}`)}</span>
            ))}
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
                  className="space-y-2"
                >
                  {rows.map((item, index) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      count={rows.length}
                      registerInput={(id, node) => {
                        inputs.current[id] = node;
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
    </Card>
  );
}
