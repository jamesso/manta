import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Draggable } from '@hello-pangea/dnd';
import { cn } from 'cn';
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
  const { errors, currency, settings, taxMode } = useSelector(
    state => state.form
  );
  const invoiceSettings = useSelector(
    state => state.settings.saved?.invoice ?? state.form.savedSettings
  );
  const displayCurrency = settings.required_fields.currency
    ? currency
    : invoiceSettings?.currency;
  const showTaxColumn = taxMode === 'line' && settings.required_fields.tax;
  const draggable = count > 1;

  const unitCode = getUnitCode(item.unitCode);
  const unitOptions = [...UNIT_CODES];
  if (!isKnownUnit(unitCode) && !unitOptions.includes(unitCode)) {
    unitOptions.push(unitCode);
  }
  const unitItems = unitOptions.map(code => ({
    value: code,
    label: isKnownUnit(code) ? t(`items:units:${code}`) : code,
  }));

  const canSaveAsItem = Boolean(item.description?.trim());
  const fieldError = name => {
    const key = errors[`rows.${item.id}.${name}`];
    return key ? <FieldError>{t(key)}</FieldError> : null;
  };

  return (
    <Draggable
      draggableId={String(item.id)}
      index={index}
      isDragDisabled={!draggable}
    >
      {provided => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="grid grid-cols-(--line-cols-narrow) items-start gap-2 border-t pt-3 first:border-t-0 first:pt-0 @4xl:grid-cols-(--line-cols) @4xl:gap-x-3 @4xl:border-t-0 @4xl:pt-0"
        >
          {draggable ? (
            <button
              type="button"
              className="flex h-8 cursor-grab items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
              {...provided.dragHandleProps}
              aria-label={t('form:fields:items:reorder', { number: index + 1 })}
            >
              <GripVertical className="size-4" />
            </button>
          ) : null}
          <div className="min-w-0">
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
            {fieldError('description')}
          </div>
          <div className="flex items-center justify-end @4xl:order-last">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    disabled={!canSaveAsItem}
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
            {draggable ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={t('form:fields:items:remove', {
                  number: index + 1,
                })}
                onClick={() => dispatch(removeItem(item.id))}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
          {/* Slim card: a sub-grid below the description. Wide card: the
              fields join the row grid as table columns. */}
          <div
            className={cn(
              'grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] items-start gap-2 @4xl:contents',
              draggable ? 'col-start-2 col-end-4' : 'col-span-full'
            )}
          >
            {['price', 'quantity'].map(name => (
              <LineField key={name} label={t(`form:fields:items:${name}`)}>
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
                {fieldError(name)}
              </LineField>
            ))}
            <LineField label={t('form:fields:items:unit')}>
              <Select
                value={unitCode}
                items={unitItems}
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
                  {unitItems.map(unit => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LineField>
            {showTaxColumn ? (
              <LineField label={t('form:fields:tax:rate')}>
                <TaxRateSelect row={item} index={index} />
                {fieldError('taxRate')}
              </LineField>
            ) : null}
            <LineField label={t('form:fields:items:amount')} end>
              <div className="flex h-8 items-center justify-end text-sm font-medium tabular-nums">
                {item.subtotal === '' || item.subtotal == null
                  ? '—'
                  : formatAmount(item.subtotal, displayCurrency)}
              </div>
            </LineField>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// The visible label shows only in the slim layout, where there is no
// column header. The inputs keep their own per-row aria-label.
function LineField({ label, end = false, children }) {
  return (
    <div className={cn('min-w-0', end && 'text-end')}>
      <span
        aria-hidden="true"
        className="mb-1 block text-xs text-muted-foreground @4xl:hidden"
      >
        {label}
      </span>
      {children}
    </div>
  );
}
