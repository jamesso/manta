import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Draggable } from '@hello-pangea/dnd';
import { GripVertical, Trash2 } from 'lucide-react';
import { addItem, removeItem, updateItem } from '../../../actions/form';
import { updateRowField } from '../../../helpers/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/ui/field';
import { formatAmount } from './formatAmount';

export default function LineItemRow({ item, index, count, registerInput }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { errors, currency, settings } = useSelector(state => state.form);
  const savedCurrency = useSelector(
    state => state.settings.saved?.invoice?.currency
  );
  const displayCurrency = settings.required_fields.currency
    ? currency
    : savedCurrency;
  return (
    <Draggable draggableId={String(item.id)} index={index}>
      {provided => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="grid grid-cols-[1.5rem_minmax(8rem,1fr)_7rem_6rem_7rem_2rem] items-start gap-2"
        >
          {count > 1 ? (
            <button
              type="button"
              className="min-h-8"
              {...provided.dragHandleProps}
              aria-label={t('form:fields:items:reorder', { number: index + 1 })}
            >
              <GripVertical className="size-4" />
            </button>
          ) : (
            <span />
          )}
          {['description', 'price', 'quantity'].map(name => (
            <div key={name}>
              <Input
                ref={
                  name === 'description'
                    ? node => registerInput(item.id, node)
                    : undefined
                }
                type={name === 'description' ? 'text' : 'number'}
                step={name === 'description' ? undefined : '0.01'}
                className={
                  name === 'description' ? '' : 'text-end tabular-nums'
                }
                value={item[name] ?? ''}
                aria-label={t(`form:fields:items:${name}Row`, {
                  number: index + 1,
                })}
                aria-invalid={Boolean(errors[`rows.${item.id}.${name}`])}
                onChange={e =>
                  dispatch(
                    updateItem(updateRowField(item, name, e.target.value))
                  )
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    dispatch(addItem());
                  }
                }}
              />
              {errors[`rows.${item.id}.${name}`] && (
                <FieldError>{t(errors[`rows.${item.id}.${name}`])}</FieldError>
              )}
            </div>
          ))}
          <div className="pt-2 text-end tabular-nums">
            {item.subtotal === '' || item.subtotal == null
              ? '—'
              : formatAmount(item.subtotal, displayCurrency)}
          </div>
          {count > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t('form:fields:items:remove', { number: index + 1 })}
              onClick={() => dispatch(removeItem(item.id))}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </Draggable>
  );
}
