import React from 'react';
import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from 'lucide-react';
import { Field, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { firstOrNull } from '../../../preview/helper';

const OPTIONS = [
  ['top', AlignVerticalJustifyStart],
  ['middle', AlignVerticalJustifyCenter],
  ['bottom', AlignVerticalJustifyEnd],
];

export default function Alignment({ t, alignItems, update, UILang }) {
  return (
    <Field>
      <FieldLabel>
        {t('preview:sidebar:alignment:name', { lng: UILang })}
      </FieldLabel>
      <ToggleGroup
        variant="outline"
        spacing={0}
        className="w-full"
        value={[alignItems]}
        onValueChange={groupValue => {
          const next = firstOrNull(groupValue);
          if (next) update('alignItems', next);
        }}
      >
        {OPTIONS.map(([value, Icon]) => (
          <ToggleGroupItem key={value} value={value} className="flex-1">
            <Icon />
            <span>
              {t(`preview:sidebar:alignment:${value}`, { lng: UILang })}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}
