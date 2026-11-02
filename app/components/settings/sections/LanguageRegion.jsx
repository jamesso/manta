import moment from 'moment';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebouncedSave } from '../useDebouncedSave';

const LANGS = ['de', 'en', 'fr', 'id', 'it', 'sk', 'ur-PK', 'vi', 'zh-CN'];

const DATE_FORMATS = [
  'dddd, MMMM Do, YYYY',
  'MMMM Do, YYYY',
  'MM/DD/YYYY',
  'MM/DD/YY',
  'dddd, DD MMMM YYYY',
  'DD/MMMM/YYYY',
  'DD/MM/YYYY',
  'DD/MM/YY',
  'dddd, Do MMMM YYYY',
  'Do MMMM YYYY',
  'DD.MM.YYYY',
  'DD.MM.YY',
];

export default function LanguageRegion({
  general,
  invoice,
  onSaveGeneral,
  onSaveInvoice,
  saveMessage,
  registerFlush,
}) {
  const { t } = useTranslation();
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

  useEffect(() => {
    registerFlush(async () => {
      const generalResult = await flushGeneral();
      if (generalResult?.ok === false) {
        return generalResult;
      }
      return flushInvoice();
    });
  }, [flushGeneral, flushInvoice, registerFlush]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:language:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:language:description')}
        </p>
        {saveMessage ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {saveMessage}
          </p>
        ) : null}
      </div>
      <Field>
        <FieldLabel>{t('settings:fields:language:name')}</FieldLabel>
        <Select
          value={generalDraft.language}
          onValueChange={language =>
            saveGeneralNow({ ...generalDraft, language })
          }
        >
          <SelectTrigger className="bg-background text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGS.map(code => (
              <SelectItem key={code} value={code}>
                {t(`settings:fields:language:${code}`, { lng: code })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>{t('settings:fields:dateFormat')}</FieldLabel>
        <Select
          value={invoiceDraft.dateFormat}
          onValueChange={dateFormat =>
            saveInvoiceNow({ ...invoiceDraft, dateFormat })
          }
        >
          <SelectTrigger className="bg-background text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMATS.map(fmt => (
              <SelectItem key={fmt} value={fmt}>
                {moment(Date.now()).format(fmt)} ({fmt})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
