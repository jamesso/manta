import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';

export default function DatePickerField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  clearable,
}) {
  const { t } = useTranslation();
  const dateFormat = useSelector(
    state => state.settings.saved?.invoice?.dateFormat ?? 'MM/DD/YYYY'
  );
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button id={id} variant="outline" aria-invalid={Boolean(error)} />
            }
          >
            <CalendarIcon />
            {value ? moment(value).format(dateFormat) : placeholder}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              weekStartsOn={1}
              selected={value || undefined}
              onSelect={onChange}
            />
          </PopoverContent>
        </Popover>
        {clearable && value && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('form:fields:clearDate')}
            onClick={() => onChange(null)}
          >
            <X />
          </Button>
        )}
      </div>
      {error && <FieldError>{t(error)}</FieldError>}
    </Field>
  );
}
