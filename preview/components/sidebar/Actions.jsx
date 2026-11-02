import React from 'react';
import { FileDown, Mail, Save, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Actions({
  t,
  UILang,
  disabled,
  savePDF,
  saveConfigs,
  emailInvoice,
  sharePdf,
  showEmail,
  showShare,
}) {
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
      {showEmail ? (
        <Button
          type="button"
          variant="outline"
          className="w-full bg-background text-foreground"
          disabled={disabled}
          onClick={emailInvoice}
        >
          <Mail />
          {t('preview:sidebar:actions:emailInvoice', { lng: UILang })}
        </Button>
      ) : null}
      {showShare ? (
        <Button
          type="button"
          variant="outline"
          className="w-full bg-background text-foreground"
          disabled={disabled}
          onClick={sharePdf}
        >
          <Share />
          {t('preview:sidebar:actions:sharePdf', { lng: UILang })}
        </Button>
      ) : null}
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
