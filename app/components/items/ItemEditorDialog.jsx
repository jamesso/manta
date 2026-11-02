import { useEffect, useId, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import * as ItemsActions from '../../actions/items';

const emptyValues = {
  name: '',
  description: '',
  unitPrice: '',
  unitCode: 'C62',
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('items:dialog:editTitle') : t('items:dialog:newTitle')}
          </DialogTitle>
        </DialogHeader>
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
              onValueChange={v => setField('unitCode', v)}
            >
              <SelectTrigger id={`${formId}-unit`} className="w-full">
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
            {errors.unitCode ? (
              <FieldError>{t(errors.unitCode)}</FieldError>
            ) : null}
          </Field>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('items:dialog:cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {t('items:dialog:save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
