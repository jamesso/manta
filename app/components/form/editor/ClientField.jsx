import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { updateRecipient } from '../../../actions/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';

export default function ClientField() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const contacts = useSelector(state => state.contacts);
  const { recipient, errors } = useSelector(state => state.form);
  const update = changes =>
    dispatch(updateRecipient({ ...recipient, ...changes }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('form:cards:client')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contacts.length === 0 || recipient.newRecipient ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {['fullname', 'company', 'email', 'phone'].map(name => (
                <Field key={name}>
                  <FieldLabel htmlFor={`client-${name}`}>
                    {t(`form:fields:recipient:${name}`)}
                    {['fullname', 'email'].includes(name) ? ' *' : ''}
                  </FieldLabel>
                  <Input
                    id={`client-${name}`}
                    value={recipient.new[name] ?? ''}
                    aria-invalid={Boolean(errors[`recipient.${name}`])}
                    onChange={e =>
                      update({
                        new: { ...recipient.new, [name]: e.target.value },
                      })
                    }
                  />
                  {errors[`recipient.${name}`] && (
                    <FieldError>{t(errors[`recipient.${name}`])}</FieldError>
                  )}
                </Field>
              ))}
            </div>
            {contacts.length > 0 && (
              <Button
                variant="link"
                onClick={() => update({ newRecipient: false })}
              >
                {t('form:fields:recipient:chooseExisting')}
              </Button>
            )}
          </>
        ) : (
          <>
            <Combobox
              items={contacts}
              value={recipient.select?._id ? recipient.select : null}
              onValueChange={value => update({ select: value || {} })}
              itemToStringLabel={c => c?.fullname || c?.company || ''}
              isItemEqualToValue={(a, b) => a?._id === b?._id}
            >
              <ComboboxInput
                aria-label={t('form:fields:recipient:search')}
                placeholder={t('form:fields:recipient:search')}
              />
              <ComboboxContent>
                <ComboboxEmpty>
                  {t('form:fields:recipient:noMatch')}
                </ComboboxEmpty>
                <ComboboxList>
                  {contact => (
                    <ComboboxItem key={contact._id} value={contact}>
                      {contact.fullname || contact.company}{' '}
                      {contact.email && `— ${contact.email}`}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <Button
              variant="link"
              onClick={() => update({ newRecipient: true })}
            >
              <UserPlus />
              {t('form:fields:recipient:addNew')}
            </Button>
          </>
        )}
        {errors.recipient && <FieldError>{t(errors.recipient)}</FieldError>}
      </CardContent>
    </Card>
  );
}
