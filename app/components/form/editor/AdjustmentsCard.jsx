import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { isEqual } from 'lodash';
import {
  updateFieldData,
  updateSavedFormSettings,
  setTaxMode,
} from '../../../actions/form';
import { parseNumberInput } from '../../../helpers/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function AdjustmentsCard() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { discount, tax, settings, savedSettings, errors, taxMode } = useSelector(
    state => state.form
  );
  const update = (field, value) => dispatch(updateFieldData(field, value));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('form:cards:adjustments')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.required_fields.discount && (
          <Field>
            <FieldLabel htmlFor="discount">
              {t('form:fields:discount:name')}
            </FieldLabel>
            <Input
              id="discount"
              type="number"
              value={discount.amount ?? ''}
              aria-invalid={Boolean(errors.discount)}
              onChange={e =>
                update('discount', {
                  amount: parseNumberInput(e.target.value, { integer: true }),
                  type: discount.type || 'percentage',
                })
              }
            />
            <ToggleGroup
              variant="outline"
              value={[discount.type || 'percentage']}
              onValueChange={values => {
                if (values.length) update('discount', { type: values[0] });
              }}
            >
              {['percentage', 'flat'].map(type => (
                <ToggleGroupItem key={type} value={type}>
                  {t(`form:fields:discount:${type}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {errors.discount && <FieldError>{t(errors.discount)}</FieldError>}
          </Field>
        )}
        {settings.required_fields.tax && taxMode === 'invoice' && (
          <div className="space-y-3">
            <Field>
              <FieldLabel htmlFor="tax-id">
                {t('form:fields:tax:id')}
              </FieldLabel>
              <Input
                id="tax-id"
                value={tax.tin ?? ''}
                onChange={e => update('tax', { tin: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tax-amount">
                {t('common:amount')} (%)
              </FieldLabel>
              <Input
                id="tax-amount"
                type="number"
                step="0.01"
                value={tax.amount ?? ''}
                aria-invalid={Boolean(errors.tax)}
                onChange={e =>
                  update('tax', { amount: parseNumberInput(e.target.value) })
                }
              />
              {errors.tax && <FieldError>{t(errors.tax)}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="tax-method">
                {t('form:fields:tax:method')}
              </FieldLabel>
              <Select
                value={tax.method || 'default'}
                onValueChange={value =>
                  value && update('tax', { method: value })
                }
              >
                <SelectTrigger id="tax-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t('common:default')}</SelectItem>
                  <SelectItem value="reverse">
                    {t('form:fields:tax:reverse')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {!isEqual(tax, savedSettings.tax) && (
              <Button
                variant="ghost"
                onClick={() => dispatch(updateSavedFormSettings('tax', tax))}
              >
                {t('common:saveAsDefault')}
              </Button>
            )}
          </div>
        )}
        {settings.required_fields.tax && taxMode === 'invoice' ? (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => dispatch(setTaxMode('line'))}
            >
              {t('form:fields:tax:switchToLine')}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t('form:fields:tax:switchHint')}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
