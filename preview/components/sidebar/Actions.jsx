import React from 'react';
import { FileDown, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Actions({ t, UILang, disabled, savePDF, saveConfigs }) {
  return (
    <div className="flex flex-col gap-2 border-t p-4">
      <Button
        type="button"
        className="w-full"
        disabled={disabled}
        onClick={savePDF}
      >
        <FileDown />
        {t('preview:sidebar:actions:savePDF', { lng: UILang })}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full bg-background text-foreground"
        disabled={disabled}
        onClick={saveConfigs}
      >
        <Save />
        {t('preview:sidebar:actions:saveConfigs', { lng: UILang })}
      </Button>
    </div>
  );
}
