import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { COUNTRY_CODES } from '../../../helpers/einvoice/codes.js';

const emptyAddress = {
  street: '',
  additional: '',
  postcode: '',
  city: '',
  region: '',
  countryCode: '',
};

export default function PostalAddressFields({
  idPrefix,
  value,
  onChange,
  errors = {},
}) {
  const { i18n, t } = useTranslation();
  const address = { ...emptyAddress, ...(value ?? {}) };
  const countries = useMemo(() => {
    let display;
    try {
      display = new Intl.DisplayNames([i18n.language], { type: 'region' });
    } catch {
      display = null;
    }
    return COUNTRY_CODES.map(code => {
      let name = code;
      if (display) {
        try {
          name = display.of(code) ?? code;
        } catch {
          name = code;
        }
      }
      return { code, name };
    });
  }, [i18n.language]);
  const selected =
    countries.find(c => c.code === address.countryCode) ?? null;

  const patch = partial =>
    onChange({ ...address, ...partial });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        ['street', 'text'],
        ['additional', 'text'],
        ['postcode', 'text'],
        ['city', 'text'],
        ['region', 'text'],
      ].map(([name, type]) => (
        <Field key={name}>
          <FieldLabel htmlFor={`${idPrefix}-${name}`}>
            {t(`settings:fields:postalAddress:${name}`)}
          </FieldLabel>
          <Input
            id={`${idPrefix}-${name}`}
            type={type}
            value={address[name] ?? ''}
            autoComplete="off"
            onChange={e => patch({ [name]: e.target.value })}
          />
        </Field>
      ))}
      <Field className="md:col-span-2">
        <FieldLabel>{t('settings:fields:postalAddress:country')}</FieldLabel>
        <Combobox
          items={countries}
          value={selected}
          onValueChange={c => patch({ countryCode: c?.code ?? '' })}
          itemToStringLabel={c => (c ? `${c.name} (${c.code})` : '')}
          isItemEqualToValue={(a, b) => a?.code === b?.code}
        >
          <ComboboxInput
            id={`${idPrefix}-country`}
            aria-label={t('settings:fields:postalAddress:country')}
          />
          <ComboboxContent className="bg-popover text-popover-foreground">
            <ComboboxEmpty>{t('form:fields:recipient:noMatch')}</ComboboxEmpty>
            <ComboboxList>
              {c => (
                <ComboboxItem key={c.code} value={c}>
                  {c.name} ({c.code})
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {errors['postalAddress.countryCode'] ? (
          <p className="text-sm text-destructive" role="alert">
            {t(errors['postalAddress.countryCode'])}
          </p>
        ) : null}
      </Field>
    </div>
  );
}
