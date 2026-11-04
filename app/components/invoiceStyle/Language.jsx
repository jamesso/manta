import React from 'react';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CODES = ['de', 'en', 'fr', 'id', 'it', 'sk', 'ur-PK', 'vi', 'zh-CN'];

export default function Language({ t, language, update, UILang }) {
  const items = CODES.map(code => ({
    value: code,
    label: t(`settings:fields:language:${code}`, { lng: code }),
  }));
  return (
    <Field>
      <FieldLabel>
        {t('settings:fields:language:name', { lng: UILang })}
      </FieldLabel>
      <Select
        value={language}
        items={items}
        onValueChange={value => {
          if (value) update('language', value);
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
