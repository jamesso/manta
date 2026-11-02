import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import Logo from '../_partials/profile/Logo';
import { useDebouncedSave } from '../useDebouncedSave';
import { getSellerTaxIds } from '../../../helpers/tax';

const TEXT_FIELDS = [
  'fullname',
  'company',
  'address',
  'email',
  'phone',
  'website',
];

export default function BusinessProfile({
  value,
  invoiceSettings,
  onSave,
  errors,
  saveMessage,
  registerFlush,
}) {
  const { t } = useTranslation();
  const mergedValue = {
    ...value,
    taxId: value?.taxId ?? getSellerTaxIds(value, invoiceSettings).taxId,
    vatId: value?.vatId ?? getSellerTaxIds(value, invoiceSettings).vatId,
  };
  const { draft, setDraft, onBlur, flush, saveNow } = useDebouncedSave(
    mergedValue,
    onSave
  );

  useEffect(() => {
    registerFlush(flush);
  }, [flush, registerFlush]);

  const setField = (name, val) => setDraft(prev => ({ ...prev, [name]: val }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:profile:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:profile:description')}
        </p>
        {saveMessage ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {saveMessage}
          </p>
        ) : null}
      </div>
      <Field>
        <FieldLabel>{t('settings:fields:logo:name')}</FieldLabel>
        <p className="text-sm text-muted-foreground">
          {t('settings:fields:logo:hint')}
        </p>
        <Logo
          logo={draft.logo}
          handleLogoChange={logo => saveNow(current => ({ ...current, logo }))}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        {TEXT_FIELDS.map(name => (
          <Field key={name}>
            <FieldLabel htmlFor={`profile-${name}`}>
              {t(`common:fields:${name}`)}
            </FieldLabel>
            <Input
              id={`profile-${name}`}
              value={draft[name] ?? ''}
              autoComplete="off"
              aria-invalid={Boolean(errors?.[name])}
              onBlur={onBlur}
              onChange={e => setField(name, e.target.value)}
            />
            {errors?.[name] ? <FieldError>{t(errors[name])}</FieldError> : null}
          </Field>
        ))}
        <Field>
          <FieldLabel htmlFor="profile-taxId">
            {t('settings:fields:taxId')}
          </FieldLabel>
          <Input
            id="profile-taxId"
            value={draft.taxId ?? ''}
            autoComplete="off"
            onBlur={onBlur}
            onChange={e => setField('taxId', e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="profile-vatId">
            {t('settings:fields:vatId')}
          </FieldLabel>
          <Input
            id="profile-vatId"
            value={draft.vatId ?? ''}
            autoComplete="off"
            onBlur={onBlur}
            onChange={e => setField('vatId', e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
