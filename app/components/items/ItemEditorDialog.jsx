import { useEffect, useId, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UNIT_CODES } from '../../constants/units';
import {
  buildItem,
  getItemErrors,
  getUnitCode,
  isKnownUnit,
} from '../../helpers/items';
import { getItems } from '../../reducers/ItemsReducer';
import { getActiveTaxRates, getTaxRates } from '../../helpers/tax';
import * as ItemsActions from '../../actions/items';

const emptyValues = {
  name: '',
  description: '',
  unitPrice: '',
  unitCode: 'C62',
  taxRateId: null,
};

export default function ItemEditorDialog({
  open,
  onOpenChange,
  item,
  initialValues,
  onSaved,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const items = useSelector(getItems);
  const invoiceSettings = useSelector(
    state => state.settings.saved?.invoice ?? {}
  );
  const taxRates = getTaxRates(invoiceSettings);
  const activeRates = getActiveTaxRates(taxRates);
  const formId = useId();
  const nameRef = useRef(null);
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(item);

  useEffect(() => {
    if (!open) {
      return;
    }
    setErrors({});
    if (item) {
      setValues({
        name: item.name ?? '',
        description: item.description ?? '',
        unitPrice: String(item.unitPrice ?? ''),
        unitCode: getUnitCode(item.unitCode),
        taxRateId: item.taxRateId ?? null,
      });
    } else {
      setValues(initialValues ?? emptyValues);
    }
  }, [open, item, initialValues]);

  const setField = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
  };

  const unitOptions = [...UNIT_CODES];
  const currentCode = getUnitCode(values.unitCode);
  if (!isKnownUnit(currentCode) && !unitOptions.includes(currentCode)) {
    unitOptions.push(currentCode);
  }
  const unitItems = unitOptions.map(code => ({
    value: code,
    label: isKnownUnit(code) ? t(`items:units:${code}`) : code,
  }));
  const rateOptions =
    item?.taxRateId && !activeRates.some(r => r.id === item.taxRateId)
      ? activeRates.concat(taxRates.filter(r => r.id === item.taxRateId))
      : activeRates;
  const taxRateItems = [
    { value: 'default', label: t('items:dialog:defaultTaxRate') },
    ...rateOptions.map(rate => ({
      value: rate.id,
      label:
        rate.active === false
          ? `${rate.name} (${t('settings:taxRates:inactive')})`
          : rate.name,
    })),
  ];

  const onSubmit = async event => {
    event.preventDefault();
    const nextErrors = getItemErrors(values, items, item?._id, {
      willBeActive: item ? !item.archived : true,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.name && nameRef.current) {
        nameRef.current.focus();
      }
      return;
    }
    setSaving(true);
    const payload = buildItem(values, item, Date.now());
    const action = isEdit
      ? ItemsActions.updateItem(payload)
      : ItemsActions.saveItem(payload);
    const ok = await dispatch(action);
    setSaving(false);
    if (ok) {
      onSaved?.(payload);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t('items:dialog:editTitle') : t('items:dialog:newTitle')}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <form id={formId} className="space-y-4" onSubmit={onSubmit}>
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>
                {t('items:dialog:name')} *
              </FieldLabel>
              <Input
                ref={nameRef}
                id={`${formId}-name`}
                autoComplete="off"
                maxLength={120}
                value={values.name}
                aria-invalid={Boolean(errors.name)}
                onChange={e => setField('name', e.target.value)}
              />
              {errors.name ? <FieldError>{t(errors.name)}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-description`}>
                {t('items:dialog:description')}
              </FieldLabel>
              <Textarea
                id={`${formId}-description`}
                rows={3}
                value={values.description}
                onChange={e => setField('description', e.target.value)}
              />
              <FieldDescription>
                {t('items:dialog:descriptionHint')}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-price`}>
                {t('items:dialog:unitPrice')} *
              </FieldLabel>
              <Input
                id={`${formId}-price`}
                type="number"
                step="0.01"
                className="text-end tabular-nums"
                value={values.unitPrice}
                aria-invalid={Boolean(errors.unitPrice)}
                onChange={e => setField('unitPrice', e.target.value)}
              />
              <FieldDescription>{t('items:dialog:priceHint')}</FieldDescription>
              {errors.unitPrice ? (
                <FieldError>{t(errors.unitPrice)}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-unit`}>
                {t('items:dialog:unit')}
              </FieldLabel>
              <Select
                value={currentCode}
                items={unitItems}
                onValueChange={v => setField('unitCode', v)}
              >
                <SelectTrigger id={`${formId}-unit`} className="w-full">
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
              {errors.unitCode ? (
                <FieldError>{t(errors.unitCode)}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-taxRate`}>
                {t('items:dialog:taxRate')}
              </FieldLabel>
              <Select
                value={values.taxRateId ?? 'default'}
                items={taxRateItems}
                onValueChange={v =>
                  setField('taxRateId', v === 'default' ? null : v)
                }
              >
                <SelectTrigger
                  id={`${formId}-taxRate`}
                  className="w-full bg-background text-foreground"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground">
                  {taxRateItems.map(rate => (
                    <SelectItem key={rate.value} value={rate.value}>
                      {rate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </form>
        </SheetBody>
        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('items:dialog:cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {t('items:dialog:save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
