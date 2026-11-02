import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

const ipc = window.manta.ipc;

export default function Updates() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:updates:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:updates:description')}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => ipc.send('check-for-updates')}
      >
        {t('settings:sections:updates:check')}
      </Button>
    </div>
  );
}
