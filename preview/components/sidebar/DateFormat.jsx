import React from 'react';
import moment from 'moment';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FORMATS = [
  'dddd, MMMM Do, YYYY',
  'MMMM Do, YYYY',
  'MM/DD/YYYY',
  'MM/DD/YY',
  'dddd, DD MMMM YYYY',
  'DD/MMMM/YYYY',
  'DD/MM/YYYY',
  'DD/MM/YY',
];

export default function DateFormat({
  t,
  dateFormat,
  language,
  update,
  UILang,
}) {
  const items = FORMATS.map(format => ({
    value: format,
    label: `${moment().locale(language).format(format)} (${format})`,
  }));
  return (
    <Field>
      <FieldLabel>
        {t('settings:fields:dateFormat', { lng: UILang })}
      </FieldLabel>
      <Select
        value={dateFormat}
        items={items}
        onValueChange={value => {
          if (value) update('dateFormat', value);
        }}
      >
        <SelectTrigger className="w-full bg-background text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
