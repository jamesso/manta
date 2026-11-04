import { useTranslation } from 'react-i18next';
import { Check, ShieldCheck, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field';
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle,
  useSheetValue,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const ROWS = [
  { key: 'invoices', label: 'settings:backup:rowInvoices' },
  { key: 'contacts', label: 'app:nav:clients' },
  { key: 'items', label: 'app:nav:items' },
  { key: 'recurring', label: 'app:nav:recurring' },
];

// Make the chosen mode clear: a check mark and a stronger border.
const MODE_ITEM_CLASS =
  'h-9 justify-between aria-pressed:border-foreground/40 aria-pressed:bg-muted';

function fileBaseName(filePath) {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function formatExportedAt(value, language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function ImportSheet({
  open,
  onOpenChange,
  summary: openSummary,
  mode,
  onModeChange,
  includeSettings,
  onIncludeSettingsChange,
  importing,
  onConfirm,
}) {
  const { t, i18n } = useTranslation();
  const summary = useSheetValue(open, openSummary);
  // Do not close the drawer while the import runs.
  const onSheetOpenChange = next => {
    if (!importing) {
      onOpenChange(next);
    }
  };

  // Stay mounted while closed so the sheet slides in when it opens.
  if (!summary) {
    return (
      <Sheet open={open} onOpenChange={onSheetOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const { fileName, exportedAt, appVersion, counts, creditWarnings } = summary;
  const rows = ROWS.map(row => ({ ...row, ...counts[row.key] })).filter(
    row => row.total || row.skipped
  );
  const added = rows.reduce((sum, row) => sum + row.added, 0);
  const existing = rows.reduce((sum, row) => sum + row.existing, 0);
  const hasSkipped = rows.some(row => row.skipped);
  const writes = added + (mode === 'overwrite' ? existing : 0);
  const fileMeta = [
    exportedAt
      ? t('settings:backup:exportedOn', {
          date: formatExportedAt(exportedAt, i18n.language),
        })
      : null,
    appVersion
      ? t('settings:backup:fromVersion', { version: appVersion })
      : null,
  ].filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={onSheetOpenChange}>
      <SheetContent side="right" showCloseButton={!importing}>
        <SheetHeader>
          <SheetTitle>{t('settings:backup:importTitle')}</SheetTitle>
          <SheetDescription className="break-all" title={fileName}>
            {fileBaseName(fileName)}
          </SheetDescription>
          {fileMeta.length ? (
            <p className="text-sm text-muted-foreground">
              {fileMeta.join(' · ')}
            </p>
          ) : null}
        </SheetHeader>
        <SheetBody>
          <SheetSection>
            {rows.length ? (
              <Table className="tabular-nums">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-full" />
                    <TableHead className="text-end">
                      {t('settings:backup:colInFile')}
                    </TableHead>
                    <TableHead className="text-end">
                      {t('settings:backup:colNew')}
                    </TableHead>
                    <TableHead className="text-end">
                      {t('settings:backup:colExisting')}
                    </TableHead>
                    {hasSkipped ? (
                      <TableHead className="text-end">
                        {t('settings:backup:colSkipped')}
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">
                        {t(row.label)}
                      </TableCell>
                      <TableCell className="text-end">{row.total}</TableCell>
                      <TableCell className="text-end">{row.added}</TableCell>
                      <TableCell className="text-end">{row.existing}</TableCell>
                      {hasSkipped ? (
                        <TableCell className="text-end">
                          {row.skipped}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">
                {t('settings:backup:empty')}
              </p>
            )}
            {hasSkipped || creditWarnings.length ? (
              <div className="flex gap-2 rounded-lg bg-muted p-3 text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col gap-1">
                  {hasSkipped ? (
                    <p>{t('settings:backup:skippedHint')}</p>
                  ) : null}
                  {creditWarnings.length ? (
                    <p>
                      {t('settings:backup:creditWarnings', {
                        count: creditWarnings.length,
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </SheetSection>
          {existing ? (
            <SheetSection title={t('settings:backup:existingTitle')}>
              <ToggleGroup
                variant="outline"
                orientation="vertical"
                className="w-full"
                value={[mode]}
                onValueChange={values => {
                  if (values.length) onModeChange(values[0]);
                }}
                disabled={importing}
              >
                <ToggleGroupItem value="skip" className={MODE_ITEM_CLASS}>
                  {t('settings:backup:modeSkip')}
                  <Check className="invisible group-aria-pressed/toggle:visible" />
                </ToggleGroupItem>
                <ToggleGroupItem value="overwrite" className={MODE_ITEM_CLASS}>
                  {t('settings:backup:modeOverwrite')}
                  <Check className="invisible group-aria-pressed/toggle:visible" />
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-muted-foreground">
                {mode === 'overwrite'
                  ? t('settings:backup:replaceHint', { count: existing })
                  : t('settings:backup:keepHint', { count: existing })}
              </p>
            </SheetSection>
          ) : null}
          <Field
            orientation="horizontal"
            data-disabled={summary.hasSettings ? undefined : true}
            className="items-center justify-between gap-6 rounded-lg border border-input p-3 has-[>[data-slot=field-content]]:items-center"
          >
            <FieldContent className="min-w-0">
              <FieldLabel htmlFor="import-settings">
                {t('settings:backup:includeSettings')}
              </FieldLabel>
              <FieldDescription>
                {summary.hasSettings
                  ? t('settings:backup:settingsHint')
                  : t('settings:backup:noSettings')}
              </FieldDescription>
            </FieldContent>
            <Switch
              id="import-settings"
              checked={includeSettings}
              disabled={!summary.hasSettings || importing}
              onCheckedChange={v => onIncludeSettingsChange(Boolean(v))}
            />
          </Field>
          <p className="mt-auto flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" />
            {t('settings:backup:autoHint')}
          </p>
        </SheetBody>
        <SheetFooter>
          <SheetClose
            disabled={importing}
            render={<Button type="button" variant="outline" />}
          >
            {t('common:cancel')}
          </SheetClose>
          <Button
            type="button"
            disabled={importing || (!writes && !includeSettings)}
            onClick={onConfirm}
          >
            {importing
              ? t('settings:backup:importing')
              : t('settings:backup:import')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
