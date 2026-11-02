import { keys, sortBy } from 'lodash';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import currencies from '../../../../libs/currencies.json';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  formatInvoiceNumber,
  normalizeNumbering,
} from '../../../helpers/numbering';
import { useDebouncedSave } from '../useDebouncedSave';

const REQUIRED_KEYS = [
  'invoiceID',
  'dueDate',
  'currency',
  'discount',
  'tax',
  'note',
];

function sortCurrencyOptions() {
  return sortBy(keys(currencies), key => currencies[key].name).map(key => ({
    code: currencies[key].code,
    name: currencies[key].name,
  }));
}

export default function InvoiceDefaults({
  value,
  onSave,
  errors,
  registerFlush,
}) {
  const { t } = useTranslation();
  const { draft, setDraft, onBlur, flush, saveNow } = useDebouncedSave(
    value,
    onSave
  );

  useEffect(() => {
    registerFlush(flush);
  }, [flush, registerFlush]);

  const numbering = normalizeNumbering(draft.numbering);

  const patch = partial => setDraft(prev => ({ ...prev, ...partial }));

  const patchTax = (name, raw) => {
    let amount = draft.tax?.amount;
    if (name === 'amount') {
      amount = raw.trim() === '' ? '' : Number(raw);
    } else {
      amount = draft.tax?.amount;
    }
    const nextTax = {
      ...draft.tax,
      [name]: name === 'amount' ? amount : raw,
    };
    setDraft(prev => ({ ...prev, tax: nextTax }));
  };

  const patchCurrency = (name, raw) => {
    let val = raw;
    if (name === 'fraction') {
      val = raw.trim() === '' ? '' : Number(raw);
    }
    setDraft(prev => ({
      ...prev,
      currency: { ...prev.currency, [name]: val },
    }));
  };

  const patchNumbering = (name, raw) => {
    const next = { ...numbering };
    if (name === 'prefix') {
      next.prefix = raw;
    } else {
      next[name] = raw.trim() === '' ? '' : Number(raw);
    }
    saveNow({ ...draft, numbering: next });
  };

  const toggleRequired = (name, checked) => {
    saveNow({
      ...draft,
      required_fields: { ...draft.required_fields, [name]: checked },
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:invoice:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:invoice:description')}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">{t('form:numbering:title')}</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {['prefix', 'next', 'padding'].map(name => (
            <Field key={name}>
              <FieldLabel htmlFor={`inv-num-${name}`}>
                {t(`form:numbering:${name}`)}
              </FieldLabel>
              <Input
                id={`inv-num-${name}`}
                type={name === 'prefix' ? 'text' : 'number'}
                value={numbering[name] ?? ''}
                aria-invalid={Boolean(errors?.[`numbering.${name}`])}
                onChange={e => patchNumbering(name, e.target.value)}
              />
              {errors?.[`numbering.${name}`] ? (
                <FieldError>{t(errors[`numbering.${name}`])}</FieldError>
              ) : null}
            </Field>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('form:numbering:sample', {
            number: formatInvoiceNumber(numbering),
          })}
        </p>
      </div>

      <Field>
        <FieldLabel>{t('settings:fields:template')}</FieldLabel>
        <Select
          value={draft.template}
          onValueChange={template => saveNow({ ...draft, template })}
        >
          <SelectTrigger className="bg-background text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minimal">Minimal</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="space-y-3">
        <h3 className="font-medium">{t('form:fields:currency')}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>{t('form:fields:currency')}</FieldLabel>
            <Select
              value={draft.currency?.code}
              onValueChange={code =>
                saveNow({
                  ...draft,
                  currency: { ...draft.currency, code },
                })
              }
            >
              <SelectTrigger className="bg-background text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortCurrencyOptions().map(c => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{t('settings:fields:currency:separator')}</FieldLabel>
            <Select
              value={draft.currency?.separator}
              onValueChange={separator =>
                saveNow({
                  ...draft,
                  currency: { ...draft.currency, separator },
                })
              }
            >
              <SelectTrigger className="bg-background text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="commaDot">
                  {t('settings:fields:currency:commaDot')}
                </SelectItem>
                <SelectItem value="dotComma">
                  {t('settings:fields:currency:dotComma')}
                </SelectItem>
                <SelectItem value="spaceDot">
                  {t('settings:fields:currency:spaceDot')}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{t('settings:fields:currency:placement')}</FieldLabel>
            <Select
              value={draft.currency?.placement}
              onValueChange={placement =>
                saveNow({
                  ...draft,
                  currency: { ...draft.currency, placement },
                })
              }
            >
              <SelectTrigger className="bg-background text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">
                  {t('settings:fields:currency:beforeAmount')}
                </SelectItem>
                <SelectItem value="after">
                  {t('settings:fields:currency:afterAmount')}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{t('settings:fields:currency:fraction')}</FieldLabel>
            <Input
              type="number"
              value={draft.currency?.fraction ?? ''}
              aria-invalid={Boolean(errors?.['currency.fraction'])}
              onBlur={onBlur}
              onChange={e => patchCurrency('fraction', e.target.value)}
            />
            {errors?.['currency.fraction'] ? (
              <FieldError>{t(errors['currency.fraction'])}</FieldError>
            ) : null}
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">{t('settings:fields:taxSettings')}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>{t('form:fields:tax:id')}</FieldLabel>
            <Input
              value={draft.tax?.tin ?? ''}
              onBlur={onBlur}
              onChange={e => patchTax('tin', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t('common:amount')}</FieldLabel>
            <Input
              type="number"
              step="0.01"
              value={draft.tax?.amount ?? ''}
              aria-invalid={Boolean(errors?.['tax.amount'])}
              onBlur={onBlur}
              onChange={e => patchTax('amount', e.target.value)}
            />
            {errors?.['tax.amount'] ? (
              <FieldError>{t(errors['tax.amount'])}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel>{t('form:fields:tax:method')}</FieldLabel>
            <Select
              value={draft.tax?.method}
              onValueChange={method =>
                saveNow({ ...draft, tax: { ...draft.tax, method } })
              }
            >
              <SelectTrigger className="bg-background text-foreground">
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
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">{t('settings:fields:requiredFields')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {REQUIRED_KEYS.map(name => (
            <Field
              key={name}
              className="flex flex-row items-center justify-between gap-4"
            >
              <FieldLabel htmlFor={`req-${name}`}>
                {t(
                  name === 'invoiceID'
                    ? 'invoices:fields:invoiceID'
                    : name === 'dueDate'
                      ? 'form:fields:dueDate:name'
                      : name === 'discount'
                        ? 'form:fields:discount:name'
                        : name === 'tax'
                          ? 'form:fields:tax:name'
                          : name === 'note'
                            ? 'form:fields:note'
                            : 'form:fields:currency'
                )}
              </FieldLabel>
              <Switch
                id={`req-${name}`}
                checked={Boolean(draft.required_fields?.[name])}
                onCheckedChange={checked => toggleRequired(name, checked)}
              />
            </Field>
          ))}
        </div>
      </div>
    </div>
  );
}
