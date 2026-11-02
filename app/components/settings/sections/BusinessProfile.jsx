import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import Logo from '../_partials/profile/Logo';
import { useDebouncedSave } from '../useDebouncedSave';

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
          handleLogoChange={logo => saveNow({ ...draft, logo })}
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
      </div>
    </div>
  );
}
