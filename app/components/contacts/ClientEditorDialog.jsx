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
import PostalAddressFields from '../shared/PostalAddressFields.jsx';
import { buildContact, getContactErrors } from '../../helpers/clients';
import { leitwegCheck } from '../../../helpers/einvoice/identifiers.js';
import * as ContactsActions from '../../actions/contacts';

const emptyValues = {
  fullname: '',
  company: '',
  email: '',
  phone: '',
  taxId: '',
  buyerReference: '',
  postalAddress: {
    street: '',
    additional: '',
    postcode: '',
    city: '',
    region: '',
    countryCode: '',
  },
};

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
        taxId: contact.taxId ?? '',
        buyerReference: contact.buyerReference ?? '',
        postalAddress: {
          ...emptyValues.postalAddress,
          ...(contact.postalAddress ?? {}),
        },
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
            <FieldLabel htmlFor={`${formId}-taxId`}>
              {t('contacts:fields:taxId')}
            </FieldLabel>
            <Input
              id={`${formId}-taxId`}
              autoComplete="off"
              maxLength={40}
              value={values.taxId}
              onChange={e => setField('taxId', e.target.value)}
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
          <Field>
            <FieldLabel htmlFor={`${formId}-buyerReference`}>
              {t('contacts:fields:buyerReference')}
            </FieldLabel>
            <p className="text-sm text-muted-foreground">
              {t('contacts:fields:buyerReferenceHint')}
            </p>
            <Input
              id={`${formId}-buyerReference`}
              value={values.buyerReference}
              onChange={e => setField('buyerReference', e.target.value)}
            />
            {leitwegCheck(values.buyerReference) === 'bad-check-digits' ? (
              <p className="text-sm text-amber-600 dark:text-amber-400" role="status">
                {t('contacts:fields:buyerReferenceWarning')}
              </p>
            ) : null}
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t('contacts:fields:addressTitle')}
            </p>
            <PostalAddressFields
              idPrefix={`${formId}-postal`}
              value={values.postalAddress}
              errors={errors}
              onChange={postalAddress => setField('postalAddress', postalAddress)}
            />
          </div>
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
