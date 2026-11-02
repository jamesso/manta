import React from 'react';
import { Field, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';

const ROWS = [
  ['showLogo', 'preview:sidebar:toggle:logo'],
  ['useSymbol', 'preview:sidebar:toggle:symbol'],
  ['showRecipient', 'preview:sidebar:toggle:recipient'],
  ['customAccentColor', 'preview:sidebar:accentColor:name'],
];

export default function Toggler({ t, configs, update, UILang }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {t('preview:sidebar:toggle:name', { lng: UILang })}
      </p>
      {ROWS.map(([name, key]) => (
        <Field
          key={name}
          orientation="horizontal"
          className="items-center justify-between"
        >
          <FieldLabel htmlFor={`preview-${name}`}>
            {t(key, { lng: UILang })}
          </FieldLabel>
          <Switch
            id={`preview-${name}`}
            checked={Boolean(configs[name])}
            onCheckedChange={checked => update(name, checked)}
          />
        </Field>
      ))}
    </div>
  );
}
