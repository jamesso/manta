import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Download, Sheet, Upload } from 'lucide-react';

import * as dialog from '@/lib/dialog';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import * as ContactsActions from '../../../actions/contacts';
import * as ItemsActions from '../../../actions/items';
import * as InvoicesActions from '../../../actions/invoices';
import * as SettingsActions from '../../../actions/settings';
import { parseBackup } from '../../../helpers/backup';
import {
  exportBackup,
  exportCsv,
  previewImport,
  runImport,
} from '../../../helpers/backupFlow';
import ImportDialog from './ImportDialog';
import { useDebouncedSave } from '../useDebouncedSave';

const ipc = window.manta.ipc;

const IMPORT_ERRORS = {
  'invalid-json': 'settings:backup:errors:invalidJson',
  'wrong-app': 'settings:backup:errors:wrongApp',
  'newer-version': 'settings:backup:errors:newerVersion',
  'invalid-format': 'settings:backup:errors:invalidFormat',
  'too-large': 'settings:backup:errors:tooLarge',
  'unsupported-data': 'settings:backup:errors:unsupportedData',
};

export default function ExportBackup({
  invoice,
  general,
  onSaveInvoice,
  onSaveGeneral,
  saveMessage,
  registerFlush,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const {
    draft: generalDraft,
    saveNow: saveGeneralNow,
    flush: flushGeneral,
  } = useDebouncedSave(general, onSaveGeneral);
  const {
    draft: invoiceDraft,
    saveNow: saveInvoiceNow,
    flush: flushInvoice,
  } = useDebouncedSave(invoice, onSaveInvoice);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importState, setImportState] = useState(null);
  const [mode, setMode] = useState('skip');
  const [includeSettings, setIncludeSettings] = useState(false);

  useEffect(() => {
    registerFlush(async () => {
      const generalResult = await flushGeneral();
      if (generalResult?.ok === false) {
        return generalResult;
      }
      return flushInvoice();
    });
  }, [flushGeneral, flushInvoice, registerFlush]);

  useEffect(() => {
    const onNoAccess = (_event, message) => {
      dialog.alert({
        type: 'warning',
        title: t('dialog:noAccess:title'),
        message: `${message}. ${t('dialog:noAccess:message')}`,
      });
    };
    const onConfirmed = (_event, path) => {
      saveInvoiceNow(current => ({ ...current, exportDir: path }));
    };
    ipc.on('no-access-directory', onNoAccess);
    ipc.on('confirmed-export-directory', onConfirmed);
    return () => {
      ipc.removeAllListeners('no-access-directory');
      ipc.removeAllListeners('confirmed-export-directory');
    };
  }, [t, invoiceDraft, saveInvoiceNow]);

  const onExportBackup = async () => {
    try {
      const result = await exportBackup();
      if (result.canceled) {
        return;
      }
      toast.add({
        title: t('settings:backup:exportSuccess'),
        actionProps: {
          children: t('settings:backup:showFile'),
          onClick: () => ipc.send('reveal-file', result.filePath),
        },
      });
    } catch (err) {
      toast.add({ title: err.message, variant: 'destructive' });
    }
  };

  const onExportCsv = async () => {
    try {
      const result = await exportCsv(Date.now());
      if (result.canceled) {
        return;
      }
      toast.add({
        title: t('settings:backup:csvSuccess'),
        actionProps: {
          children: t('settings:backup:showFile'),
          onClick: () => ipc.send('reveal-file', result.filePath),
        },
      });
    } catch (err) {
      toast.add({ title: err.message, variant: 'destructive' });
    }
  };

  const onImportPick = async () => {
    const picked = await ipc.invoke('backup-import');
    if (picked.canceled) {
      return;
    }
    if (picked.error === 'too-large') {
      await dialog.alert({
        title: t('settings:backup:importTitle'),
        message: t(IMPORT_ERRORS['too-large']),
      });
      return;
    }
    const parsed = parseBackup(picked.text);
    if (!parsed.ok) {
      await dialog.alert({
        title: t('settings:backup:importTitle'),
        message: t(
          IMPORT_ERRORS[parsed.error] || IMPORT_ERRORS['invalid-format']
        ),
      });
      return;
    }
    const preview = await previewImport(parsed.backup);
    setImportState({
      fileName: picked.filePath,
      exportedAt: parsed.backup.exportedAt,
      backup: parsed.backup,
      preview,
      invalid: parsed.invalid,
      duplicates: parsed.duplicates,
      creditWarnings: parsed.creditWarnings ?? [],
    });
    setMode('skip');
    setIncludeSettings(false);
    setImportOpen(true);
  };

  const onConfirmImport = async () => {
    if (!importState) {
      return;
    }
    setImporting(true);
    try {
      const result = await runImport(
        importState.backup,
        {
          mode,
          includeSettings,
        },
        {
          applySettings: async mergedSettings => {
            const failures = [];
            for (const section of ['profile', 'invoice', 'general']) {
              if (mergedSettings[section]) {
                const applyResult = await dispatch(
                  SettingsActions.updateSettings(
                    section,
                    mergedSettings[section],
                    true
                  )
                );
                if (applyResult?.ok === false) {
                  failures.push({
                    section,
                    message: applyResult.message,
                    errors: applyResult.errors,
                  });
                }
              }
            }
            return failures;
          },
        }
      );
      dispatch(ContactsActions.getAllContacts());
      dispatch(InvoicesActions.getInvoices());
      dispatch(ItemsActions.getAllItems());

      const settingsFailures = result.settingsFailures ?? [];

      const failedCount =
        result.failed.contacts.length +
        result.failed.invoices.length +
        result.failed.items.length;
      const partial =
        Boolean(result.batchError) ||
        failedCount > 0 ||
        settingsFailures.length > 0;

      let message = t('settings:backup:importSuccess', {
        added: result.counts.added,
        overwritten: result.counts.overwritten,
        skipped: result.counts.skipped,
      });
      if (result.batchError) {
        message += ` ${t('settings:backup:batchFailed', {
          batch: result.batchError.batch,
          detail: result.batchError.message,
        })}`;
      }
      if (failedCount) {
        message += ` ${t('settings:backup:importFailedDocs', {
          count: failedCount,
        })}`;
      }
      if (result.skippedSections.length) {
        message += ` ${t('settings:backup:skippedSettings', {
          sections: result.skippedSections.join(', '),
        })}`;
      }
      if (settingsFailures.length) {
        message += ` ${t('settings:backup:settingsApplyFailed', {
          sections: settingsFailures.map(item => item.section).join(', '),
        })}`;
      }
      if (result.snapshotWarning) {
        message += ` ${t('settings:backup:snapshotWarning', {
          detail: result.snapshotWarning,
        })}`;
      }

      toast.add({
        title: message,
        variant: partial ? 'destructive' : undefined,
        actionProps: result.snapshotPath
          ? {
              children: t('settings:backup:showSafety'),
              onClick: () => ipc.send('reveal-file', result.snapshotPath),
            }
          : undefined,
      });
      setImportOpen(false);
    } catch (err) {
      toast.add({ title: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:export:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:export:description')}
        </p>
        {saveMessage ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {saveMessage}
          </p>
        ) : null}
      </div>
      <Field>
        <FieldLabel>{t('settings:fields:pdfExportDir')}</FieldLabel>
        <div className="flex gap-2">
          <Input
            readOnly
            value={invoiceDraft.exportDir ?? ''}
            className="flex-1"
          />
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
          checked={Boolean(generalDraft.previewPDF)}
          onCheckedChange={previewPDF =>
            saveGeneralNow(current => ({ ...current, previewPDF }))
          }
        />
      </Field>
      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          {t('settings:backup:autoHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onExportBackup}>
            <Download className="size-4" />
            {t('settings:backup:export')}
          </Button>
          <Button type="button" variant="outline" onClick={onImportPick}>
            <Upload className="size-4" />
            {t('settings:backup:import')}
          </Button>
          <Button type="button" variant="outline" onClick={onExportCsv}>
            <Sheet className="size-4" />
            {t('settings:backup:exportCsv')}
          </Button>
        </div>
      </div>
      {importState ? (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          fileName={importState.fileName}
          exportedAt={importState.exportedAt}
          preview={{
            invoices: {
              total: importState.backup.invoices.length,
              added: importState.preview.skip.invoices.added,
              skipped: importState.preview.skip.invoices.skipped,
            },
            contacts: {
              total: importState.backup.contacts.length,
              added: importState.preview.skip.contacts.added,
              skipped: importState.preview.skip.contacts.skipped,
            },
            items: {
              total: (importState.backup.items ?? []).length,
              added: importState.preview.skip.items.added,
              skipped: importState.preview.skip.items.skipped,
            },
          }}
          invalid={importState.invalid}
          duplicates={importState.duplicates}
          creditWarnings={importState.creditWarnings}
          hasSettings={Boolean(importState.backup.settings)}
          mode={mode}
          onModeChange={setMode}
          includeSettings={includeSettings}
          onIncludeSettingsChange={setIncludeSettings}
          importing={importing}
          onConfirm={onConfirmImport}
        />
      ) : null}
    </div>
  );
}
