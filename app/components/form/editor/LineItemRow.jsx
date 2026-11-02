import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Draggable } from '@hello-pangea/dnd';
import { BookmarkPlus, GripVertical, Trash2 } from 'lucide-react';
import { addItem, removeItem, updateItem } from '../../../actions/form';
import {
  applyItemToRow,
  getUnitCode,
  isKnownUnit,
} from '../../../helpers/items';
import {
  applyTaxRate,
  getTaxRates,
  resolveRowTaxRate,
} from '../../../helpers/tax';
import { updateRowField } from '../../../helpers/form';
import TaxRateSelect from './TaxRateSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UNIT_CODES } from '../../../constants/units';
import ItemAutocomplete from './ItemAutocomplete';
import { formatAmount } from './formatAmount';

export default function LineItemRow({
  item,
  index,
  count,
  registerInput,
  catalogItems,
  onSaveAsItem,
}) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { errors, currency, settings, taxMode } = useSelector(state => state.form);
  const invoiceSettings = useSelector(
    state => state.settings.saved?.invoice ?? state.form.savedSettings
  );
  const displayCurrency = settings.required_fields.currency
    ? currency
    : invoiceSettings?.currency;
  const showTaxColumn =
    taxMode === 'line' && settings.required_fields.tax;
  const gridClass = showTaxColumn
    ? 'grid grid-cols-[1.5rem_minmax(8rem,1fr)_7rem_6rem_6rem_8rem_7rem_4.5rem] items-start gap-2'
    : 'grid grid-cols-[1.5rem_minmax(8rem,1fr)_7rem_6rem_6rem_7rem_4.5rem] items-start gap-2';

  const unitCode = getUnitCode(item.unitCode);
  const unitOptions = [...UNIT_CODES];
  if (!isKnownUnit(unitCode) && !unitOptions.includes(unitCode)) {
    unitOptions.push(unitCode);
  }

  const showSaveAsItem = Boolean(item.description?.trim());

  return (
    <Draggable draggableId={String(item.id)} index={index}>
      {provided => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={gridClass}
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
          <div>
            <ItemAutocomplete
              id={`line-desc-${item.id}`}
              value={item.description ?? ''}
              items={catalogItems}
              currency={displayCurrency}
              onTextChange={text =>
                dispatch(updateItem(updateRowField(item, 'description', text)))
              }
              onPick={picked => {
                const rates = getTaxRates(invoiceSettings);
                let next = applyItemToRow(item, picked);
                if (taxMode === 'line' && settings.required_fields.tax) {
                  next = applyTaxRate(
                    next,
                    resolveRowTaxRate(picked.taxRateId, rates)
                  );
                }
                dispatch(updateItem(next));
              }}
              onEnterWithoutPick={() => dispatch(addItem())}
              inputProps={{
                ref: node => registerInput(item.id, node),
                'aria-label': t('form:fields:items:descriptionRow', {
                  number: index + 1,
                }),
                'aria-invalid': Boolean(errors[`rows.${item.id}.description`]),
              }}
            />
            {errors[`rows.${item.id}.description`] && (
              <FieldError>
                {t(errors[`rows.${item.id}.description`])}
              </FieldError>
            )}
          </div>
          {['price', 'quantity'].map(name => (
            <div key={name}>
              <Input
                type="number"
                step="0.01"
                className="text-end tabular-nums"
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
                  if (e.nativeEvent.isComposing) {
                    return;
                  }
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
          <div>
            <Select
              value={unitCode}
              onValueChange={v =>
                dispatch(updateItem({ ...item, unitCode: v }))
              }
            >
              <SelectTrigger
                className="w-full"
                aria-label={t('form:fields:items:unit', { n: index + 1 })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map(code => (
                  <SelectItem key={code} value={code}>
                    {isKnownUnit(code) ? t(`items:units:${code}`) : code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showTaxColumn ? (
            <div>
              <TaxRateSelect row={item} index={index} />
              {errors[`rows.${item.id}.taxRate`] && (
                <FieldError>
                  {t(errors[`rows.${item.id}.taxRate`])}
                </FieldError>
              )}
            </div>
          ) : null}
          <div className="pt-2 text-end tabular-nums">
            {item.subtotal === '' || item.subtotal == null
              ? '—'
              : formatAmount(item.subtotal, displayCurrency)}
          </div>
          <div className="flex items-start gap-0.5">
            {showSaveAsItem ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t('form:fields:items:saveAsItem', {
                        n: index + 1,
                      })}
                      onClick={() => onSaveAsItem(item)}
                    />
                  }
                >
                  <BookmarkPlus className="size-4" />
                </TooltipTrigger>
                <TooltipContent>
                  {t('form:fields:items:saveAsItem', { n: index + 1 })}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {count > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('form:fields:items:remove', {
                  number: index + 1,
                })}
                onClick={() => dispatch(removeItem(item.id))}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Draggable>
  );
}
