import { useTranslation } from 'react-i18next';

import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function Sounds({ value, onSave }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:sounds:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:sounds:description')}
        </p>
      </div>
      <Field>
        <FieldLabel>{t('settings:fields:sound')}</FieldLabel>
        <Select
          value={value.sound}
          onValueChange={sound => onSave({ ...value, sound })}
        >
          <SelectTrigger className="bg-background text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t('common:default')}</SelectItem>
            <SelectItem value="cs">Counter Strike</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field className="flex flex-row items-center justify-between gap-4">
        <FieldLabel htmlFor="settings-muted">
          {t('settings:fields:mute')}
        </FieldLabel>
        <Switch
          id="settings-muted"
          checked={Boolean(value.muted)}
          onCheckedChange={muted => onSave({ ...value, muted })}
        />
      </Field>
    </div>
  );
}
