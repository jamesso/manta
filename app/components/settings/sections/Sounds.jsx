import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSave } from '../useDebouncedSave';
import { SettingsGroup, SettingsPage, SettingsRow } from '../SettingsLayout';

export default function Sounds({ value, onSave, saveMessage, registerFlush }) {
  const { t } = useTranslation();
  const { draft, saveNow, flush } = useDebouncedSave(value, onSave);

  useEffect(() => {
    registerFlush(flush);
  }, [flush, registerFlush]);

  return (
    <SettingsPage
      title={t('settings:sections:sounds:title')}
      description={t('settings:sections:sounds:description')}
      error={saveMessage}
    >
      <SettingsGroup>
        <SettingsRow label={t('settings:fields:sound')}>
          <Select
            items={[
              { value: 'default', label: t('common:default') },
              { value: 'cs', label: 'Counter Strike' },
            ]}
            value={draft.sound}
            onValueChange={sound => saveNow(current => ({ ...current, sound }))}
          >
            <SelectTrigger className="w-56 bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{t('common:default')}</SelectItem>
              <SelectItem value="cs">Counter Strike</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow label={t('settings:fields:mute')} htmlFor="settings-muted">
          <Switch
            id="settings-muted"
            checked={Boolean(draft.muted)}
            onCheckedChange={muted =>
              saveNow(current => ({ ...current, muted }))
            }
          />
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
