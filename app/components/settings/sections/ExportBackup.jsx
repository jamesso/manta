import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import * as dialog from '@/lib/dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const ipc = window.manta.ipc;

export default function ExportBackup({
  invoice,
  general,
  onSaveInvoice,
  onSaveGeneral,
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const onNoAccess = (_event, message) => {
      dialog.alert({
        type: 'warning',
        title: t('dialog:noAccess:title'),
        message: `${message}. ${t('dialog:noAccess:message')}`,
      });
    };
    const onConfirmed = (_event, path) => {
      onSaveInvoice({ ...invoice, exportDir: path });
    };
    ipc.on('no-access-directory', onNoAccess);
    ipc.on('confirmed-export-directory', onConfirmed);
    return () => {
      ipc.removeAllListeners('no-access-directory');
      ipc.removeAllListeners('confirmed-export-directory');
    };
  }, [t, invoice, onSaveInvoice]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:export:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:export:description')}
        </p>
      </div>
      <Field>
        <FieldLabel>{t('settings:fields:pdfExportDir')}</FieldLabel>
        <div className="flex gap-2">
          <Input readOnly value={invoice.exportDir ?? ''} className="flex-1" />
          <Button
            type="button"
            variant="outline"
            onClick={() => ipc.send('select-export-directory')}
          >
            {t('settings:sections:export:chooseFolder')}
          </Button>
        </div>
      </Field>
      <Field className="flex flex-row items-center justify-between gap-4">
        <FieldLabel htmlFor="preview-pdf">
          {t('settings:fields:openPDFReader')}
        </FieldLabel>
        <Switch
          id="preview-pdf"
          checked={Boolean(general.previewPDF)}
          onCheckedChange={previewPDF =>
            onSaveGeneral({ ...general, previewPDF })
          }
        />
      </Field>
    </div>
  );
}
