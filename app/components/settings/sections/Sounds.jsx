import { useEffect } from 'react';
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
import { useDebouncedSave } from '../useDebouncedSave';

export default function Sounds({ value, onSave, saveMessage, registerFlush }) {
  const { t } = useTranslation();
  const { draft, saveNow, flush } = useDebouncedSave(value, onSave);

  useEffect(() => {
    registerFlush(flush);
  }, [flush, registerFlush]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:sounds:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:sounds:description')}
        </p>
        {saveMessage ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {saveMessage}
          </p>
        ) : null}
      </div>
      <Field>
        <FieldLabel>{t('settings:fields:sound')}</FieldLabel>
        <Select
          value={draft.sound}
          onValueChange={sound => saveNow({ ...draft, sound })}
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
          checked={Boolean(draft.muted)}
          onCheckedChange={muted => saveNow({ ...draft, muted })}
        />
      </Field>
    </div>
  );
}
