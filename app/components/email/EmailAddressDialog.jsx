import React, { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Sheet,
  SheetContent,
  SheetBody,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { isValidEmail } from '../../../helpers/email';
import {
  getCurrent,
  resolveCurrent,
  subscribe,
} from '../../helpers/emailPrompt';

export default function EmailAddressDialog() {
  const { t } = useTranslation();
  const current = useSyncExternalStore(subscribe, getCurrent);
  const [value, setValue] = useState('');
  const [saveToClient, setSaveToClient] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (current) {
      setValue(current.email ?? '');
      setSaveToClient(true);
      setError('');
    }
  }, [current]);

  if (!current) {
    return null;
  }

  const requestId = current.id;

  const onContinue = () => {
    if (!isValidEmail(value)) {
      setError(t('email:ask:invalid'));
      return;
    }
    resolveCurrent({ email: value.trim(), saveToClient }, requestId);
  };

  return (
    <Sheet
      open
      onOpenChange={open => {
        if (!open) {
          resolveCurrent(null, requestId);
        }
      }}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {t('email:ask:title', { client: current.client })}
          </SheetTitle>
          <SheetDescription>{t('email:ask:description')}</SheetDescription>
        </SheetHeader>
        <SheetBody className="gap-4">
          <Field>
            <FieldLabel htmlFor="email-address-input">
              {t('email:ask:label')}
            </FieldLabel>
            <Input
              id="email-address-input"
              type="email"
              className="bg-background text-foreground"
              value={value}
              onChange={e => {
                setValue(e.target.value);
                setError('');
              }}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          {current.canSave ? (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={saveToClient}
                onCheckedChange={checked => setSaveToClient(checked === true)}
              />
              {t('email:ask:save')}
            </label>
          ) : null}
        </SheetBody>
        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            className="bg-background text-foreground"
            onClick={() => resolveCurrent(null, requestId)}
          >
            {t('common:cancel')}
          </Button>
          <Button type="button" onClick={onContinue}>
            {t('email:ask:confirm')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
