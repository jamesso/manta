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
  NUMBER_FORMATS,
  formatInvoiceNumber,
  normalizeNumbering,
} from '../../../helpers/numbering';
import { useDebouncedSave } from '../useDebouncedSave';
import TaxRates from './TaxRates';
import EInvoiceSettings from './EInvoiceSettings.jsx';
import EmailTemplates from './EmailTemplates.jsx';
import { getTaxRates } from '../../../helpers/tax';
import Template from '../../invoiceStyle/Template';
import Alignment from '../../invoiceStyle/Alignment';
import FontSize from '../../invoiceStyle/FontSize';
import LogoSize from '../../invoiceStyle/LogoSize';
import AccentColor from '../../invoiceStyle/AccentColor';
import { STYLE_TOGGLES } from '../../invoiceStyle/Toggler';
import {
  SettingsBlock,
  SettingsGroup,
  SettingsPage,
  SettingsRow,
} from '../SettingsLayout';
import { DEFAULT_INVOICE_STYLE } from '../../../../preview/constants/defaultConfigs';

const REQUIRED_LABELS = {
  invoiceID: 'invoices:fields:invoiceID',
  dueDate: 'form:fields:dueDate:name',
  currency: 'form:fields:currency',
  discount: 'form:fields:discount:name',
  tax: 'form:fields:tax:name',
  note: 'form:fields:note',
};
const REQUIRED_KEYS = Object.keys(REQUIRED_LABELS);
const NUMBERING_KEYS = ['prefix', 'next', 'padding'];
// Fixed example, so the sample does not change on each render.
const RANDOM_SAMPLE = '3f2a9b1c';

// Select needs `items` to show the label of the chosen value.
const currencyItems = sortBy(keys(currencies), key => currencies[key].name).map(
  key => ({ value: currencies[key].code, label: currencies[key].name })
);

export default function InvoiceDefaults({
  value,
  profile,
  onSave,
  errors,
  saveMessage,
  registerFlush,
}) {
  const { t, i18n } = useTranslation();
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

  const UILang = i18n.language;
  const separatorItems = ['commaDot', 'dotComma', 'spaceDot'].map(value => ({
    value,
    label: t(`settings:fields:currency:${value}`),
  }));
  const placementItems = [
    { value: 'before', label: t('settings:fields:currency:beforeAmount') },
    { value: 'after', label: t('settings:fields:currency:afterAmount') },
  ];
  const style = { ...DEFAULT_INVOICE_STYLE, ...draft.style };
  const setTemplate = (_name, template) =>
    saveNow(current => ({ ...current, template }));
  const patchStyle = (name, value) =>
    setDraft(prev => ({
      ...prev,
      style: { ...DEFAULT_INVOICE_STYLE, ...prev.style, [name]: value },
    }));

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
    if (name === 'prefix' || name === 'format') {
      next[name] = raw;
    } else {
      next[name] = raw.trim() === '' ? '' : Number(raw);
    }
    saveNow(current => ({ ...current, numbering: next }));
  };

  const patchEstimateNumbering = (name, raw) => {
    const next = { ...estimateNumbering };
    if (name === 'prefix' || name === 'format') {
      next[name] = raw;
    } else {
      next[name] = raw.trim() === '' ? '' : Number(raw);
    }
    saveNow(current => ({ ...current, estimateNumbering: next }));
  };

  const patchCreditNoteNumbering = (name, raw) => {
    const next = { ...creditNoteNumbering };
    if (name === 'prefix' || name === 'format') {
      next[name] = raw;
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

  const numberingField = (prefix, errorKey, value, onChange) => name => (
    <Field key={`${prefix}-${name}`}>
      <FieldLabel htmlFor={`${prefix}-num-${name}`}>
        {t(`form:numbering:${name}`)}
      </FieldLabel>
      <Input
        id={`${prefix}-num-${name}`}
        type={name === 'prefix' ? 'text' : 'number'}
        value={value[name] ?? ''}
        aria-invalid={Boolean(errors?.[`${errorKey}.${name}`])}
        onChange={e => onChange(name, e.target.value)}
      />
      {errors?.[`${errorKey}.${name}`] ? (
        <FieldError>{t(errors[`${errorKey}.${name}`])}</FieldError>
      ) : null}
    </Field>
  );

  const formatItems = NUMBER_FORMATS.map(format => ({
    value: format,
    label: t(`form:numbering:formats:${format}`),
  }));

  const formatField = (prefix, value, onChange) => (
    <Field>
      <FieldLabel htmlFor={`${prefix}-num-format`}>
        {t('form:numbering:format')}
      </FieldLabel>
      <Select
        items={formatItems}
        value={value.format}
        onValueChange={format => onChange('format', format)}
      >
        <SelectTrigger
          id={`${prefix}-num-format`}
          className="bg-background text-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {formatItems.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  const numberingBlock = (title, prefix, errorKey, value, onChange, extra) => {
    const isRandom = value.format === 'random';
    return (
      <SettingsBlock>
        <div className="flex items-baseline justify-between gap-4">
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
          <p className="text-sm text-muted-foreground">
            {t('form:numbering:sample', {
              number: isRandom ? RANDOM_SAMPLE : formatInvoiceNumber(value),
            })}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {formatField(prefix, value, onChange)}
          {isRandom
            ? null
            : NUMBERING_KEYS.map(
                numberingField(prefix, errorKey, value, onChange)
              )}
          {extra}
        </div>
      </SettingsBlock>
    );
  };

  return (
    <SettingsPage
      title={t('settings:sections:invoice:title')}
      description={t('settings:sections:invoice:description')}
      error={saveMessage}
    >
      <SettingsGroup title={t('settings:sections:invoice:numberingTitle')}>
        {numberingBlock(
          t('settings:sections:invoice:invoicesTitle'),
          'inv',
          'numbering',
          numbering,
          patchNumbering
        )}
        {numberingBlock(
          t('settings:sections:estimates:title'),
          'est',
          'estimateNumbering',
          estimateNumbering,
          patchEstimateNumbering,
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
        )}
        {numberingBlock(
          t('settings:sections:creditNotes:title'),
          'cn',
          'creditNoteNumbering',
          creditNoteNumbering,
          patchCreditNoteNumbering
        )}
      </SettingsGroup>

      <SettingsGroup
        title={t('settings:fields:style:title')}
        description={t('settings:fields:style:hint')}
      >
        <SettingsBlock className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <Template
            t={t}
            UILang={UILang}
            template={draft.template}
            update={setTemplate}
          />
          <Alignment
            t={t}
            UILang={UILang}
            alignItems={style.alignItems}
            update={patchStyle}
          />
          <FontSize
            t={t}
            UILang={UILang}
            fontSize={style.fontSize}
            update={patchStyle}
          />
          {style.showLogo ? (
            <LogoSize
              t={t}
              UILang={UILang}
              logoSize={style.logoSize}
              update={patchStyle}
            />
          ) : null}
        </SettingsBlock>
        {STYLE_TOGGLES.map(([name]) => (
          <SettingsRow
            key={name}
            label={t(`settings:fields:style:toggles:${name}`)}
            description={t(`settings:fields:style:toggles:${name}Hint`)}
            htmlFor={`style-${name}`}
          >
            <Switch
              id={`style-${name}`}
              checked={Boolean(style[name])}
              onCheckedChange={checked => patchStyle(name, checked)}
            />
          </SettingsRow>
        ))}
        {style.customAccentColor ? (
          <SettingsBlock>
            <AccentColor
              t={t}
              UILang={UILang}
              accentColor={style.accentColor}
              update={patchStyle}
              showLabel={false}
            />
          </SettingsBlock>
        ) : null}
      </SettingsGroup>

      <SettingsGroup title={t('form:fields:currency')}>
        <SettingsBlock className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>{t('form:fields:currency')}</FieldLabel>
            <Select
              items={currencyItems}
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
                {currencyItems.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{t('settings:fields:currency:separator')}</FieldLabel>
            <Select
              items={separatorItems}
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
              items={placementItems}
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
        </SettingsBlock>
      </SettingsGroup>

      <TaxRates
        value={getTaxRates(draft)}
        onChange={list => saveNow(current => ({ ...current, taxRates: list }))}
      />

      <SettingsGroup
        title={t('settings:fields:requiredFields')}
        description={t('settings:sections:invoice:requiredHint')}
      >
        <SettingsBlock className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {REQUIRED_KEYS.map(name => (
            <Field
              key={name}
              orientation="horizontal"
              className="items-center justify-between gap-4"
            >
              <FieldLabel htmlFor={`req-${name}`}>
                {t(REQUIRED_LABELS[name])}
              </FieldLabel>
              <Switch
                id={`req-${name}`}
                checked={Boolean(draft.required_fields?.[name])}
                onCheckedChange={checked => toggleRequired(name, checked)}
              />
            </Field>
          ))}
        </SettingsBlock>
      </SettingsGroup>

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
    </SettingsPage>
  );
}
