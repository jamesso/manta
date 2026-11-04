import React from 'react';
import { Field, FieldLabel } from '@/components/ui/field';
import { Slider } from '@/components/ui/slider';
import { toConfigValue } from '../../../preview/helper';

export default function FontSize({ t, fontSize, update, UILang }) {
  return (
    <Field>
      <FieldLabel className="flex items-center justify-between">
        <span>{t('preview:sidebar:fontSize', { lng: UILang })}</span>
        <span>{Number(fontSize) / 100}</span>
      </FieldLabel>
      <Slider
        min={100}
        max={500}
        step={100}
        value={[Number(fontSize)]}
        onValueChange={value =>
          update('fontSize', toConfigValue('fontSize', value))
        }
      />
    </Field>
  );
}
