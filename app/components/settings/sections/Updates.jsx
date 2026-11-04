import { useTranslation } from 'react-i18next';

import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SettingsGroup, SettingsPage, SettingsRow } from '../SettingsLayout';

const ipc = window.manta.ipc;

export default function Updates() {
  const { t } = useTranslation();

  return (
    <SettingsPage
      title={t('settings:sections:updates:title')}
      description={t('settings:sections:updates:description')}
    >
      <SettingsGroup>
        <SettingsRow
          label={t('settings:sections:updates:manual')}
          description={t('settings:sections:updates:manualHint')}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => ipc.send('check-for-updates')}
          >
            <RefreshCw />
            {t('settings:sections:updates:check')}
          </Button>
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
