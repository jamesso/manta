import moment from 'moment';
import { useTranslation } from 'react-i18next';

import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {t('settings:sections:language:title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:language:description')}
        </p>
      </div>
      <Field>
        <FieldLabel>{t('settings:fields:language:name')}</FieldLabel>
        <Select
          value={general.language}
          onValueChange={language => onSaveGeneral({ ...general, language })}
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
          value={invoice.dateFormat}
          onValueChange={dateFormat =>
            onSaveInvoice({ ...invoice, dateFormat })
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
