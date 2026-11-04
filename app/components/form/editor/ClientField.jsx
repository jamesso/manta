import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateRecipient } from '../../../actions/form';
import {
  recipientFromContact,
  recipientWithTypedName,
} from '../../../helpers/form';
import ClientAutocomplete, { contactLabel } from './ClientAutocomplete';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';

const DETAIL_FIELDS = ['company', 'taxId', 'email', 'phone'];

export default function ClientField() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const contacts = useSelector(state => state.contacts);
  const { recipient, errors, docType } = useSelector(state => state.form);
  const update = changes =>
    dispatch(updateRecipient({ ...recipient, ...changes }));

  if (docType === 'creditNote') {
    const name =
      recipient?.select?.fullname ||
      recipient?.select?.company ||
      recipient?.new?.fullname ||
      recipient?.new?.company ||
      '';
    const email = recipient?.select?.email || recipient?.new?.email || '';
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('form:cards:client')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{name || '—'}</p>
          {email ? <p className="text-muted-foreground">{email}</p> : null}
          {errors.recipient && <FieldError>{t(errors.recipient)}</FieldError>}
        </CardContent>
      </Card>
    );
  }

  const linked = !recipient.newRecipient && Boolean(recipient.select?._id);
  const details = linked ? recipient.select : recipient.new;
  const fieldError = name =>
    errors[`recipient.${name}`] ? (
      <FieldError>{t(errors[`recipient.${name}`])}</FieldError>
    ) : null;
  const label = name =>
    t(`form:fields:recipient:${name}`) +
    (['fullname', 'email'].includes(name) ? ' *' : '');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('form:cards:client')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field>
          <FieldLabel htmlFor="client-fullname">{label('fullname')}</FieldLabel>
          <ClientAutocomplete
            id="client-fullname"
            value={linked ? contactLabel(details) : (details.fullname ?? '')}
            contacts={contacts}
            onTextChange={text =>
              dispatch(updateRecipient(recipientWithTypedName(recipient, text)))
            }
            onPick={contact =>
              dispatch(
                updateRecipient(recipientFromContact(recipient, contact))
              )
            }
            inputProps={{
              'aria-invalid': Boolean(errors['recipient.fullname']),
            }}
          />
          {fieldError('fullname')}
        </Field>
        {linked ? (
          <div className="space-y-0.5 text-sm">
            {DETAIL_FIELDS.map(name =>
              details[name] ? (
                <p key={name} className="text-muted-foreground">
                  {details[name]}
                </p>
              ) : null
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              {t('form:fields:recipient:linked')}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {DETAIL_FIELDS.map(name => (
              <Field key={name}>
                <FieldLabel htmlFor={`client-${name}`}>
                  {label(name)}
                </FieldLabel>
                <Input
                  id={`client-${name}`}
                  autoComplete="off"
                  maxLength={name === 'taxId' ? 40 : undefined}
                  value={details[name] ?? ''}
                  aria-invalid={Boolean(errors[`recipient.${name}`])}
                  onChange={e =>
                    update({
                      newRecipient: true,
                      new: { ...recipient.new, [name]: e.target.value },
                    })
                  }
                />
                {fieldError(name)}
              </Field>
            ))}
          </div>
        )}
        {errors.recipient && <FieldError>{t(errors.recipient)}</FieldError>}
      </CardContent>
    </Card>
  );
}
