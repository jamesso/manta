import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDebouncedSave } from '../useDebouncedSave';
import { SettingsGroup, SettingsPage, SettingsRow } from '../SettingsLayout';

export default function Appearance({
  value,
  onSave,
  saveMessage,
  registerFlush,
}) {
  const { t } = useTranslation();
  const { draft, saveNow, flush } = useDebouncedSave(value, onSave);
  const theme = draft?.theme || 'system';

  useEffect(() => {
    registerFlush(flush);
  }, [flush, registerFlush]);

  return (
    <SettingsPage
      title={t('settings:sections:appearance:title')}
      description={t('settings:sections:appearance:description')}
      error={saveMessage}
    >
      <SettingsGroup>
        <SettingsRow label={t('settings:fields:theme:name')}>
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[theme]}
            onValueChange={groupValue => {
              const next = Array.isArray(groupValue) ? groupValue[0] : null;
              if (next) {
                saveNow(current => ({ ...current, theme: next }));
              }
            }}
          >
            <ToggleGroupItem value="system">
              <Monitor />
              {t('settings:fields:theme:system')}
            </ToggleGroupItem>
            <ToggleGroupItem value="light">
              <Sun />
              {t('settings:fields:theme:light')}
            </ToggleGroupItem>
            <ToggleGroupItem value="dark">
              <Moon />
              {t('settings:fields:theme:dark')}
            </ToggleGroupItem>
          </ToggleGroup>
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
