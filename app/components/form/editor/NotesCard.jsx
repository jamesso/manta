import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateFieldData } from '../../../actions/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { FieldError } from '@/components/ui/field';
export default function NotesCard() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { note, errors } = useSelector(state => state.form);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('form:cards:notes')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          aria-label={t('form:fields:note')}
          aria-invalid={Boolean(errors.note)}
          value={note.content ?? ''}
          onChange={e =>
            dispatch(updateFieldData('note', { content: e.target.value }))
          }
        />
        {errors.note && <FieldError>{t(errors.note)}</FieldError>}
      </CardContent>
    </Card>
  );
}
