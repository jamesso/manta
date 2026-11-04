import React from 'react';
import { Field, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { firstOrNull } from '../../../preview/helper';

export default function Template({ t, template, update, UILang }) {
  const pressed = template === 'business' ? 'business' : 'minimal';
  return (
    <Field>
      <FieldLabel>{t('preview:sidebar:template', { lng: UILang })}</FieldLabel>
      <ToggleGroup
        variant="outline"
        spacing={0}
        className="w-full"
        value={[pressed]}
        onValueChange={groupValue => {
          const next = firstOrNull(groupValue);
          if (next) update('template', next);
        }}
      >
        <ToggleGroupItem value="minimal" className="flex-1">
          Minimal
        </ToggleGroupItem>
        <ToggleGroupItem value="business" className="flex-1">
          Business
        </ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}
