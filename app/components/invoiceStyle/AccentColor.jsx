import React from 'react';
import { Pipette } from 'lucide-react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const SWATCHES = [
  '#D9E3F0',
  '#F47373',
  '#697689',
  '#37D67A',
  '#2CCCE4',
  '#555555',
  '#dce775',
  '#ff8a65',
];

export default function AccentColor({
  t,
  accentColor,
  update,
  UILang,
  showLabel = true,
}) {
  const setColor = hex => update('accentColor', hex);
  return (
    <Field>
      <FieldLabel className={showLabel ? undefined : 'sr-only'}>
        {t('preview:sidebar:accentColor:name', { lng: UILang })}
      </FieldLabel>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map(hex => {
          const selected = accentColor?.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              aria-pressed={selected}
              className={cn(
                'size-6 rounded-sm border border-black/15',
                selected && 'ring-2 ring-ring ring-offset-2 ring-offset-sidebar'
              )}
              style={{ backgroundColor: hex }}
              onClick={() => setColor(hex)}
            />
          );
        })}
      </div>
      <Popover>
        <PopoverTrigger
          render={<Button type="button" variant="outline" className="w-full" />}
        >
          <Pipette />
          {t('preview:sidebar:accentColor:custom', { lng: UILang })}
        </PopoverTrigger>
        <PopoverContent className="w-auto bg-popover text-popover-foreground">
          <HexColorPicker color={accentColor} onChange={setColor} />
          <HexColorInput
            color={accentColor}
            onChange={setColor}
            prefixed
            className="mt-2 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}
