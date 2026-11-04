import moment from 'moment';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebouncedSave } from '../useDebouncedSave';
import { SettingsGroup, SettingsPage, SettingsRow } from '../SettingsLayout';

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
    <SettingsPage
      title={t('settings:sections:language:title')}
      description={t('settings:sections:language:description')}
      error={saveMessage}
    >
      <SettingsGroup>
        <SettingsRow
          label={t('settings:fields:language:name')}
          description={t('settings:sections:language:languageHint')}
        >
          <Select
            items={LANGS.map(code => ({
              value: code,
              label: t(`settings:fields:language:${code}`, { lng: code }),
            }))}
            value={generalDraft.language}
            onValueChange={language =>
              saveGeneralNow(current => ({ ...current, language }))
            }
          >
            <SelectTrigger className="w-56 bg-background text-foreground">
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
        </SettingsRow>
        <SettingsRow
          label={t('settings:fields:dateFormat')}
          description={t('settings:sections:language:dateFormatHint')}
        >
          <Select
            items={DATE_FORMATS.map(fmt => ({
              value: fmt,
              label: `${moment(Date.now()).format(fmt)} (${fmt})`,
            }))}
            value={invoiceDraft.dateFormat}
            onValueChange={dateFormat =>
              saveInvoiceNow(current => ({ ...current, dateFormat }))
            }
          >
            <SelectTrigger className="w-72 bg-background text-foreground">
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
        </SettingsRow>
      </SettingsGroup>
    </SettingsPage>
  );
}
