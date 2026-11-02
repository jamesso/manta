import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { isEqual } from 'lodash';
import moment from 'moment';
import currencies from '../../../../libs/currencies.json';
import { paymentTerms } from '../../../../libs/paymentTerms';
import { calTermDate } from '../../../../helpers/date';
import {
  updateFieldData,
  updateSavedFormSettings,
} from '../../../actions/form';
import { parseNumberInput } from '../../../helpers/form';
import { getDefaultValidUntil } from '../../../helpers/estimate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from '@/components/ui/field';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import DatePickerField from './DatePickerField';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const codes = Object.values(currencies).sort((a, b) =>
  a.name.localeCompare(b.name)
);
export default function DetailsCard() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const form = useSelector(state => state.form);
  const {
    invoiceID,
    issuedAt,
    dueDate,
    validUntil,
    currency,
    settings,
    savedSettings,
    errors,
    docType,
  } = form;
  const isEstimate = docType === 'estimate';
  const estimateValidDays =
    window.manta.settings.get('invoice.estimateValidDays') ?? 30;
  const defaultValidUntil = getDefaultValidUntil(
    issuedAt ?? Date.now(),
    estimateValidDays
  );
  const update = (field, value) => dispatch(updateFieldData(field, value));
  const currencyChange = (name, value) => update('currency', { [name]: value });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('form:cards:details')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field>
          <FieldLabel htmlFor="invoice-number">
            {t(
              isEstimate
                ? 'form:fields:estimateNumber:label'
                : 'form:fields:invoiceNumber:label'
            )}
          </FieldLabel>
          <Input
            id="invoice-number"
            value={invoiceID ?? ''}
            aria-invalid={Boolean(errors.invoiceID)}
            onChange={e => update('invoiceID', e.target.value)}
          />
          <FieldDescription>
            {t(
              isEstimate
                ? 'form:fields:estimateNumber:hint'
                : 'form:fields:invoiceNumber:hint'
            )}
          </FieldDescription>
          {errors.invoiceID && <FieldError>{t(errors.invoiceID)}</FieldError>}
        </Field>
        <DatePickerField
          id="issued-at"
          label={t('form:fields:issuedAt')}
          value={new Date(issuedAt ?? Date.now())}
          onChange={date => date && update('issuedAt', date.getTime())}
          error={errors.issuedAt}
        />
        {isEstimate ? (
          <DatePickerField
            id="valid-until"
            label={t('form:fields:validUntil')}
            value={new Date(validUntil ?? defaultValidUntil)}
            onChange={date =>
              date &&
              update('validUntil', moment(date).startOf('day').valueOf())
            }
            error={errors.validUntil}
          />
        ) : null}
        {!isEstimate && settings.required_fields.dueDate && (
          <div className="space-y-2">
            <FieldLabel>{t('form:fields:dueDate:name')}</FieldLabel>
            <ToggleGroup
              variant="outline"
              value={[dueDate.useCustom ? 'date' : 'terms']}
              onValueChange={values => {
                if (values.length)
                  update('dueDate', {
                    useCustom: values[0] === 'date',
                    paymentTerm: dueDate.paymentTerm || paymentTerms[0],
                  });
              }}
            >
              <ToggleGroupItem value="date">
                {t('form:fields:dueDate:modeDate')}
              </ToggleGroupItem>
              <ToggleGroupItem value="terms">
                {t('form:fields:dueDate:modeTerms')}
              </ToggleGroupItem>
            </ToggleGroup>
            {dueDate.useCustom ? (
              <DatePickerField
                id="due-date"
                label={t('form:fields:dueDate:name')}
                value={
                  dueDate.selectedDate
                    ? moment(dueDate.selectedDate).toDate()
                    : null
                }
                onChange={date =>
                  update('dueDate', {
                    selectedDate: date ? moment(date).toObject() : null,
                  })
                }
                placeholder={t('form:fields:dueDate:placeHolder')}
                error={errors.dueDate}
                clearable
              />
            ) : (
              <>
                <Select
                  value={dueDate.paymentTerm || paymentTerms[0]}
                  onValueChange={value =>
                    value && update('dueDate', { paymentTerm: value })
                  }
                >
                  <SelectTrigger
                    aria-label={t('form:fields:dueDate:paymentTerms:name')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTerms.map(term => (
                      <SelectItem key={term} value={term}>
                        {t(`form:fields:dueDate:paymentTerms:${term}:label`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {t('form:fields:dueDate:computed', {
                    date: moment(
                      calTermDate(
                        issuedAt ?? Date.now(),
                        dueDate.paymentTerm || paymentTerms[0]
                      )
                    ).format('LL'),
                  })}
                </p>
              </>
            )}
          </div>
        )}
        {settings.required_fields.currency && (
          <div className="space-y-3">
            <FieldLabel>{t('form:fields:currency')}</FieldLabel>
            <Combobox
              items={codes}
              value={codes.find(c => c.code === currency.code) || null}
              onValueChange={c => c && currencyChange('code', c.code)}
              itemToStringLabel={c => (c ? `${c.name} (${c.code})` : '')}
              isItemEqualToValue={(a, b) => a?.code === b?.code}
            >
              <ComboboxInput aria-label={t('form:fields:currency')} />
              <ComboboxContent>
                <ComboboxEmpty>
                  {t('form:fields:recipient:noMatch')}
                </ComboboxEmpty>
                <ComboboxList>
                  {c => (
                    <ComboboxItem key={c.code} value={c}>
                      {c.name} ({c.code})
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['separator', ['commaDot', 'dotComma', 'spaceDot']],
                ['placement', ['before', 'after']],
              ].map(([name, values]) => (
                <Field key={name}>
                  <FieldLabel htmlFor={`currency-${name}`}>
                    {t(`settings:fields:currency:${name}`)}
                  </FieldLabel>
                  <Select
                    value={currency[name] || values[0]}
                    onValueChange={value =>
                      value && currencyChange(name, value)
                    }
                  >
                    <SelectTrigger id={`currency-${name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {values.map(v => (
                        <SelectItem key={v} value={v}>
                          {t(
                            `settings:fields:currency:${v === 'before' ? 'beforeAmount' : v === 'after' ? 'afterAmount' : v}`
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
              <Field>
                <FieldLabel htmlFor="currency-fraction">
                  {t('settings:fields:currency:fraction')}
                </FieldLabel>
                <Input
                  id="currency-fraction"
                  type="number"
                  value={currency.fraction ?? ''}
                  aria-invalid={Boolean(errors['currency.fraction'])}
                  onChange={e =>
                    currencyChange(
                      'fraction',
                      parseNumberInput(e.target.value, { integer: true })
                    )
                  }
                />
                {errors['currency.fraction'] && (
                  <FieldError>{t(errors['currency.fraction'])}</FieldError>
                )}
              </Field>
            </div>
            {!isEqual(currency, savedSettings.currency) && (
              <Button
                variant="ghost"
                onClick={() =>
                  dispatch(updateSavedFormSettings('currency', currency))
                }
              >
                {t('common:saveAsDefault')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
