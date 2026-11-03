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
  DEFAULT_ESTIMATE_NUMBERING,
  DEFAULT_NUMBERING,
  DEFAULT_CREDIT_NOTE_NUMBERING,
  formatInvoiceNumber,
  normalizeNumbering,
} from '../../../helpers/numbering';
import { useDebouncedSave } from '../useDebouncedSave';
import TaxRates from './TaxRates';
import EInvoiceSettings from './EInvoiceSettings.jsx';
import EmailTemplates from './EmailTemplates.jsx';
import { getTaxRates } from '../../../helpers/tax';

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
  profile,
  onSave,
  errors,
  saveMessage,
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
  const estimateNumbering = normalizeNumbering(
    draft.estimateNumbering,
    DEFAULT_ESTIMATE_NUMBERING
  );
  const creditNoteNumbering = normalizeNumbering(
    draft.creditNoteNumbering,
    DEFAULT_CREDIT_NOTE_NUMBERING
  );

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
    saveNow(current => ({ ...current, numbering: next }));
  };

  const patchEstimateNumbering = (name, raw) => {
    const next = { ...estimateNumbering };
    if (name === 'prefix') {
      next.prefix = raw;
    } else {
      next[name] = raw.trim() === '' ? '' : Number(raw);
    }
    saveNow(current => ({ ...current, estimateNumbering: next }));
  };

  const patchCreditNoteNumbering = (name, raw) => {
    const next = { ...creditNoteNumbering };
    if (name === 'prefix') {
      next.prefix = raw;
    } else {
      next[name] = raw.trim() === '' ? '' : Number(raw);
    }
    saveNow(current => ({ ...current, creditNoteNumbering: next }));
  };

  const toggleRequired = (name, checked) => {
    saveNow(current => ({
      ...current,
      required_fields: { ...current.required_fields, [name]: checked },
    }));
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
        {saveMessage ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {saveMessage}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">
          {t('form:numbering:title')}
        </h3>
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

      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">
          {t('settings:sections:estimates:title')}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {['prefix', 'next', 'padding'].map(name => (
            <Field key={`est-${name}`}>
              <FieldLabel htmlFor={`est-num-${name}`}>
                {t(`form:numbering:${name}`)}
              </FieldLabel>
              <Input
                id={`est-num-${name}`}
                type={name === 'prefix' ? 'text' : 'number'}
                value={estimateNumbering[name] ?? ''}
                aria-invalid={Boolean(errors?.[`estimateNumbering.${name}`])}
                onChange={e => patchEstimateNumbering(name, e.target.value)}
              />
              {errors?.[`estimateNumbering.${name}`] ? (
                <FieldError>
                  {t(errors[`estimateNumbering.${name}`])}
                </FieldError>
              ) : null}
            </Field>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('form:numbering:sample', {
            number: formatInvoiceNumber(estimateNumbering),
          })}
        </p>
        <Field>
          <FieldLabel htmlFor="estimate-valid-days">
            {t('settings:fields:estimateValidDays')}
          </FieldLabel>
          <Input
            id="estimate-valid-days"
            type="number"
            value={draft.estimateValidDays ?? ''}
            aria-invalid={Boolean(errors?.estimateValidDays)}
            onChange={e =>
              saveNow(current => ({
                ...current,
                estimateValidDays:
                  e.target.value.trim() === '' ? '' : Number(e.target.value),
              }))
            }
          />
          {errors?.estimateValidDays ? (
            <FieldError>{t(errors.estimateValidDays)}</FieldError>
          ) : null}
        </Field>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">
          {t('settings:sections:creditNotes:title')}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {['prefix', 'next', 'padding'].map(name => (
            <Field key={`cn-${name}`}>
              <FieldLabel htmlFor={`cn-num-${name}`}>
                {t(`form:numbering:${name}`)}
              </FieldLabel>
              <Input
                id={`cn-num-${name}`}
                type={name === 'prefix' ? 'text' : 'number'}
                value={creditNoteNumbering[name] ?? ''}
                aria-invalid={Boolean(errors?.[`creditNoteNumbering.${name}`])}
                onChange={e => patchCreditNoteNumbering(name, e.target.value)}
              />
              {errors?.[`creditNoteNumbering.${name}`] ? (
                <FieldError>
                  {t(errors[`creditNoteNumbering.${name}`])}
                </FieldError>
              ) : null}
            </Field>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('form:numbering:sample', {
            number: formatInvoiceNumber(creditNoteNumbering),
          })}
        </p>
      </div>

      <Field>
        <FieldLabel>{t('settings:fields:template')}</FieldLabel>
        <Select
          value={draft.template}
          onValueChange={template =>
            saveNow(current => ({ ...current, template }))
          }
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
        <h3 className="text-base font-semibold tracking-tight">
          {t('form:fields:currency')}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>{t('form:fields:currency')}</FieldLabel>
            <Select
              value={draft.currency?.code}
              onValueChange={code =>
                saveNow(current => ({
                  ...current,
                  currency: { ...current.currency, code },
                }))
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
                saveNow(current => ({
                  ...current,
                  currency: { ...current.currency, separator },
                }))
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
                saveNow(current => ({
                  ...current,
                  currency: { ...current.currency, placement },
                }))
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

      <TaxRates
        value={getTaxRates(draft)}
        onChange={list => saveNow(current => ({ ...current, taxRates: list }))}
      />

      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">
          {t('settings:fields:requiredFields')}
        </h3>
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

      <EInvoiceSettings
        profile={profile}
        value={draft}
        saveNow={saveNow}
        onSave={onSave}
      />

      <EmailTemplates
        value={draft}
        profile={profile}
        onSave={onSave}
        errors={errors}
        registerFlush={registerFlush}
      />
    </div>
  );
}
