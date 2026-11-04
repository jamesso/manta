import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { buildMailto, fillTemplate } from '../../../../helpers/email';
import {
  getEmailTemplate,
  getEmailVars,
  TEMPLATE_KEYS,
} from '../../../helpers/emailDraft';
import { useDebouncedSave } from '../useDebouncedSave';
import { SettingsBlock, SettingsGroup } from '../SettingsLayout';

const PLACEHOLDERS = [
  'number',
  'client',
  'total',
  'balance',
  'dueDate',
  'company',
];

const SAMPLE_INVOICE = {
  _id: 'sample0001',
  docType: 'invoice',
  invoiceID: 'INV-0001',
  status: 'pending',
  recipient: { fullname: 'Sample Client', company: 'Sample Co' },
  currency: {
    code: 'USD',
    fraction: 2,
    separator: 'commaDot',
    placement: 'before',
  },
  grandTotal: 100,
};

export default function EmailTemplates({
  value,
  profile,
  onSave,
  errors,
  registerFlush,
  sampleInvoice,
}) {
  const { t } = useTranslation();
  const { draft, setDraft, onBlur, flush } = useDebouncedSave(value, onSave);

  useEffect(() => {
    registerFlush(flush);
  }, [flush, registerFlush]);

  const previewInvoice = sampleInvoice ?? SAMPLE_INVOICE;
  const dateFormat = draft.dateFormat ?? 'MM/DD/YYYY';

  const renderKind = kind => {
    const key = TEMPLATE_KEYS[kind];
    const stored = draft[key] ?? { subject: '', body: '' };
    const effective = getEmailTemplate(draft, kind, t);
    const subjectEmpty = String(stored.subject ?? '').trim() === '';
    const bodyEmpty = String(stored.body ?? '').trim() === '';
    const vars = getEmailVars(previewInvoice, {
      profile,
      dateFormat,
      t,
      allSalesDocs: [],
    });
    const previewSubject = fillTemplate(effective.subject, vars);
    const previewBody = fillTemplate(effective.body, vars);
    const truncated = buildMailto({
      to: 'client@example.com',
      subject: previewSubject,
      body: previewBody,
    }).truncated;

    const patchField = (field, next) => {
      setDraft(prev => ({
        ...prev,
        [key]: { ...prev[key], [field]: next },
      }));
    };

    return (
      <div className="space-y-4">
        <Field>
          <FieldLabel className="flex items-center gap-2">
            {t('settings:sections:invoice:email:subject')}
            {subjectEmpty ? (
              <Badge variant="secondary">
                {t('settings:sections:invoice:email:defaultBadge')}
              </Badge>
            ) : null}
          </FieldLabel>
          <Input
            className="bg-background text-foreground"
            value={stored.subject ?? ''}
            onChange={e => patchField('subject', e.target.value)}
            onBlur={() => onBlur()}
          />
          {errors?.[`${key}.subject`] ? (
            <FieldError>{t(errors[`${key}.subject`])}</FieldError>
          ) : null}
        </Field>
        <Field>
          <FieldLabel className="flex items-center gap-2">
            {t('settings:sections:invoice:email:body')}
            {bodyEmpty ? (
              <Badge variant="secondary">
                {t('settings:sections:invoice:email:defaultBadge')}
              </Badge>
            ) : null}
          </FieldLabel>
          <Textarea
            className="bg-background text-foreground"
            rows={8}
            value={stored.body ?? ''}
            onChange={e => patchField('body', e.target.value)}
            onBlur={() => onBlur()}
          />
          {errors?.[`${key}.body`] ? (
            <FieldError>{t(errors[`${key}.body`])}</FieldError>
          ) : null}
        </Field>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">
            {t('settings:sections:invoice:email:placeholders')}
          </p>
          <ul className="space-y-1 text-muted-foreground">
            {PLACEHOLDERS.map(name => (
              <li key={name}>
                <code className="text-foreground">{`{${name}}`}</code>{' '}
                {t(`email:placeholders:${name}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="mb-2 font-medium text-foreground">
            {t('settings:sections:invoice:email:preview')}
          </p>
          <pre className="whitespace-pre-wrap text-muted-foreground">
            {previewSubject}
            {'\n\n'}
            {previewBody}
          </pre>
        </div>
        {truncated ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {t('settings:sections:invoice:email:lengthWarning')}
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDraft(prev => ({
              ...prev,
              [key]: { subject: '', body: '' },
            }));
            onBlur();
          }}
        >
          <RotateCcw />
          {t('settings:sections:invoice:email:reset')}
        </Button>
      </div>
    );
  };

  return (
    <SettingsGroup
      title={t('settings:sections:invoice:email:title')}
      description={t('settings:sections:invoice:email:description')}
    >
      <SettingsBlock>
        <Tabs defaultValue="invoice">
          <TabsList className="bg-background text-foreground">
            <TabsTrigger value="invoice">
              {t('settings:sections:invoice:email:tabInvoice')}
            </TabsTrigger>
            <TabsTrigger value="reminder">
              {t('settings:sections:invoice:email:tabReminder')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="invoice" className="pt-4">
            {renderKind('invoice')}
          </TabsContent>
          <TabsContent value="reminder" className="pt-4">
            {renderKind('reminder')}
          </TabsContent>
        </Tabs>
      </SettingsBlock>
    </SettingsGroup>
  );
}
