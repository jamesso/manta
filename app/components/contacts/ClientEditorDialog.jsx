import { useEffect, useId, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { buildContact, getContactErrors } from '../../helpers/clients';
import * as ContactsActions from '../../actions/contacts';

const emptyValues = { fullname: '', company: '', email: '', phone: '' };

export default function ClientEditorDialog({ open, onOpenChange, contact }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const formId = useId();
  const fullnameRef = useRef(null);
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(contact);

  useEffect(() => {
    if (!open) {
      return;
    }
    setErrors({});
    if (contact) {
      setValues({
        fullname: contact.fullname ?? '',
        company: contact.company ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
      });
    } else {
      setValues(emptyValues);
    }
  }, [open, contact]);

  const setField = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
  };

  const onSubmit = async event => {
    event.preventDefault();
    const nextErrors = getContactErrors(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.fullname && fullnameRef.current) {
        fullnameRef.current.focus();
      }
      return;
    }
    setSaving(true);
    const payload = buildContact(values, contact, Date.now());
    const action = isEdit
      ? ContactsActions.updateContact(payload)
      : ContactsActions.saveContact(payload);
    const ok = await dispatch(action);
    setSaving(false);
    if (ok) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('contacts:editor:editTitle')
              : t('contacts:editor:createTitle')}
          </DialogTitle>
          {isEdit ? (
            <DialogDescription>{t('contacts:editor:hint')}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form id={formId} className="space-y-4" onSubmit={onSubmit}>
          <Field>
            <FieldLabel htmlFor={`${formId}-fullname`}>
              {t('contacts:editor:fullname')} *
            </FieldLabel>
            <Input
              ref={fullnameRef}
              id={`${formId}-fullname`}
              autoComplete="off"
              value={values.fullname}
              aria-invalid={Boolean(errors.fullname)}
              onChange={e => setField('fullname', e.target.value)}
            />
            {errors.fullname ? (
              <FieldError>{t(errors.fullname)}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-company`}>
              {t('contacts:editor:company')}
            </FieldLabel>
            <Input
              id={`${formId}-company`}
              autoComplete="off"
              value={values.company}
              onChange={e => setField('company', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-email`}>
              {t('contacts:editor:email')} *
            </FieldLabel>
            <Input
              id={`${formId}-email`}
              type="email"
              autoComplete="off"
              value={values.email}
              aria-invalid={Boolean(errors.email)}
              onChange={e => setField('email', e.target.value)}
            />
            {errors.email ? <FieldError>{t(errors.email)}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${formId}-phone`}>
              {t('contacts:editor:phone')}
            </FieldLabel>
            <Input
              id={`${formId}-phone`}
              type="tel"
              autoComplete="off"
              value={values.phone}
              onChange={e => setField('phone', e.target.value)}
            />
          </Field>
        </form>
        <DialogFooter>
          <Button type="submit" form={formId} disabled={saving}>
            {t('contacts:editor:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
