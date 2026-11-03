import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import Logo from '../_partials/profile/Logo';
import PostalAddressFields from '../../shared/PostalAddressFields.jsx';
import { useDebouncedSave } from '../useDebouncedSave';
import { getSellerTaxIds } from '../../../helpers/tax';
import {
  isValidBic,
  isValidIban,
} from '../../../../helpers/einvoice/identifiers.js';

const TEXT_FIELDS = ['fullname', 'company', 'email', 'phone', 'website'];

const emptyPostal = {
  street: '',
  additional: '',
  postcode: '',
  city: '',
  region: '',
  countryCode: '',
};

const emptyBank = { accountName: '', iban: '', bic: '' };

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
    legalName: value?.legalName ?? '',
    postalAddress: { ...emptyPostal, ...(value?.postalAddress ?? {}) },
    bank: { ...emptyBank, ...(value?.bank ?? {}) },
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
  const ibanError =
    draft.bank?.iban && !isValidIban(draft.bank.iban)
      ? t('settings:errors:ibanInvalid')
      : '';
  const bicError =
    draft.bank?.bic && !isValidBic(draft.bank.bic)
      ? t('settings:errors:bicInvalid')
      : '';

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
      <Field>
        <FieldLabel htmlFor="profile-legalName">
          {t('settings:fields:legalName')}
        </FieldLabel>
        <p className="text-sm text-muted-foreground">
          {t('settings:fields:legalNameHint')}
        </p>
        <Input
          id="profile-legalName"
          value={draft.legalName ?? ''}
          autoComplete="organization"
          onBlur={onBlur}
          onChange={e => setField('legalName', e.target.value)}
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
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="profile-address">
            {t('settings:fields:printedAddress')}
          </FieldLabel>
          <Input
            id="profile-address"
            value={draft.address ?? ''}
            autoComplete="street-address"
            onBlur={onBlur}
            onChange={e => setField('address', e.target.value)}
          />
        </Field>
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
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {t('settings:fields:postalAddress:title')}
        </h3>
        <PostalAddressFields
          idPrefix="profile-postal"
          value={draft.postalAddress}
          errors={errors}
          onChange={postalAddress =>
            setDraft(prev => ({ ...prev, postalAddress }))
          }
        />
      </div>
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {t('settings:fields:bank:title')}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="profile-bank-name">
              {t('settings:fields:bank:accountName')}
            </FieldLabel>
            <Input
              id="profile-bank-name"
              value={draft.bank?.accountName ?? ''}
              onChange={e =>
                setDraft(prev => ({
                  ...prev,
                  bank: { ...prev.bank, accountName: e.target.value },
                }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-bank-iban">
              {t('settings:fields:bank:iban')}
            </FieldLabel>
            <Input
              id="profile-bank-iban"
              value={draft.bank?.iban ?? ''}
              onChange={e =>
                setDraft(prev => ({
                  ...prev,
                  bank: { ...prev.bank, iban: e.target.value },
                }))
              }
            />
            {ibanError ? <FieldError>{ibanError}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-bank-bic">
              {t('settings:fields:bank:bic')}
            </FieldLabel>
            <Input
              id="profile-bank-bic"
              value={draft.bank?.bic ?? ''}
              onChange={e =>
                setDraft(prev => ({
                  ...prev,
                  bank: { ...prev.bank, bic: e.target.value },
                }))
              }
            />
            {bicError ? <FieldError>{bicError}</FieldError> : null}
          </Field>
        </div>
      </div>
    </div>
  );
}
