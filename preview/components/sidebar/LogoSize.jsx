import React from 'react';
import { Field, FieldLabel } from '@/components/ui/field';
import { Slider } from '@/components/ui/slider';
import { toConfigValue } from '../../helper';

export default function LogoSize({ t, logoSize, update, UILang }) {
  return (
    <Field>
      <FieldLabel className="flex items-center justify-between">
        <span>{t('preview:sidebar:logoSize', { lng: UILang })}</span>
        <span>{`${logoSize}%`}</span>
      </FieldLabel>
      <Slider
        min={5}
        max={50}
        step={2.5}
        value={[Number(logoSize)]}
        onValueChange={value =>
          update('logoSize', toConfigValue('logoSize', value))
        }
      />
    </Field>
  );
}
