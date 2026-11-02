import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';

import { Field, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function Appearance({ value, onSave }) {
  const { t } = useTranslation();
  const theme = value?.theme || 'system';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:appearance:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:appearance:description')}
        </p>
      </div>
      <Field>
        <FieldLabel>{t('settings:fields:theme:name')}</FieldLabel>
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={next => {
            if (next) {
              onSave({ ...value, theme: next });
            }
          }}
        >
          <ToggleGroupItem
            value="system"
            aria-label={t('settings:fields:theme:system')}
          >
            <Monitor className="size-4" />
            {t('settings:fields:theme:system')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="light"
            aria-label={t('settings:fields:theme:light')}
          >
            <Sun className="size-4" />
            {t('settings:fields:theme:light')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            aria-label={t('settings:fields:theme:dark')}
          >
            <Moon className="size-4" />
            {t('settings:fields:theme:dark')}
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>
    </div>
  );
}
