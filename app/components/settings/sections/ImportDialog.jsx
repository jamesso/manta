import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function ImportDialog({
  open,
  onOpenChange,
  fileName,
  exportedAt,
  preview,
  invalid,
  duplicates,
  hasSettings,
  mode,
  onModeChange,
  includeSettings,
  onIncludeSettingsChange,
  importing,
  onConfirm,
}) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-background text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('settings:backup:importTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>{fileName}</p>
              {exportedAt ? <p>{exportedAt}</p> : null}
              <p>
                {t('settings:backup:previewCounts', {
                  invoices: preview.invoices.total,
                  contacts: preview.contacts.total,
                  added: preview.invoices.added + preview.contacts.added,
                  existing: preview.invoices.skipped + preview.contacts.skipped,
                })}
              </p>
              {invalid.invoices || invalid.contacts ? (
                <p>
                  {t('settings:backup:invalidCounts', {
                    invoices: invalid.invoices,
                    contacts: invalid.contacts,
                  })}
                </p>
              ) : null}
              {duplicates.invoices || duplicates.contacts ? (
                <p>
                  {t('settings:backup:duplicateCounts', {
                    invoices: duplicates.invoices,
                    contacts: duplicates.contacts,
                  })}
                </p>
              ) : null}
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={value => value && onModeChange(value)}
              >
                <ToggleGroupItem value="skip">
                  {t('settings:backup:modeSkip')}
                </ToggleGroupItem>
                <ToggleGroupItem value="overwrite">
                  {t('settings:backup:modeOverwrite')}
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="import-settings"
                  checked={includeSettings}
                  disabled={!hasSettings}
                  onCheckedChange={v => onIncludeSettingsChange(Boolean(v))}
                />
                <Label htmlFor="import-settings">
                  {t('settings:backup:includeSettings')}
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={importing}>
            {t('common:cancel')}
          </AlertDialogCancel>
          <AlertDialogAction disabled={importing} onClick={onConfirm}>
            {importing
              ? t('settings:backup:importing')
              : t('settings:backup:import')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
