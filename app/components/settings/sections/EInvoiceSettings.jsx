import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirm } from '@/lib/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import EInvoiceChecklist from '../../einvoice/EInvoiceChecklist.jsx';
import { getEInvoiceDerived } from '../../../helpers/einvoice.js';
import { toEn16931 } from '../../../../helpers/einvoice/toEn16931.js';
import { getEInvoiceIssues } from '../../../../helpers/einvoice/getEInvoiceIssues.js';

export default function EInvoiceSettings({ profile, value, onSave, saveNow }) {
  const { t } = useTranslation();
  const eInvoice = value?.eInvoice ?? { enabled: false, format: 'xrechnung-ubl' };
  const [busy, setBusy] = useState(false);

  const profileIssues = useMemo(() => {
    const sampleInvoice = {
      status: 'pending',
      invoiceID: 'SAMPLE-1',
      currency: value?.currency ?? { fraction: 2, code: 'EUR' },
      taxMode: 'line',
      rows: [{ taxCategory: 'S', taxRate: 19, price: 1, quantity: 1 }],
      recipient: {
        fullname: 'Sample',
        email: 'sample@buyer.de',
        postalAddress: {
          street: 'X',
          city: 'Y',
          postcode: '1',
          countryCode: 'DE',
        },
        buyerReference: '04011000-1234512345-06',
      },
    };
    const derived = getEInvoiceDerived(sampleInvoice, {
      profile,
      invoiceSettings: value,
      lang: 'en',
    });
    const model = toEn16931(
      sampleInvoice,
      { profile, invoice: value },
      derived
    );
    return getEInvoiceIssues(model, {
      format: eInvoice.format ?? 'xrechnung-ubl',
      invoice: sampleInvoice,
      derived,
    }).filter(i => i.fix === 'profile' || i.fix === 'bank');
  }, [profile, value, eInvoice.format]);

  const toggleEnabled = async checked => {
    if (!checked) {
      saveNow(current => ({
        ...current,
        eInvoice: { ...eInvoice, enabled: false },
      }));
      return;
    }
    setBusy(true);
    const ok = await confirm({
      title: t('settings:sections:eInvoice.confirmTitle'),
      message: t('settings:sections:eInvoice.disclaimer'),
      confirmLabel: t('settings:sections:eInvoice.confirmAccept'),
      cancelLabel: t('common:cancel'),
    });
    setBusy(false);
    if (!ok) {
      return;
    }
    saveNow(current => ({
      ...current,
      eInvoice: { ...eInvoice, enabled: true },
    }));
  };

  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h3 className="font-medium text-foreground">
          {t('settings:sections:eInvoice.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('settings:sections:eInvoice.description')}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('settings:sections:eInvoice.disclaimer')}
      </p>
      <Field className="flex flex-row items-center justify-between gap-4">
        <FieldLabel htmlFor="einvoice-enabled">
          {t('settings:sections:eInvoice.enable')}
        </FieldLabel>
        <Switch
          id="einvoice-enabled"
          checked={Boolean(eInvoice.enabled)}
          disabled={busy}
          onCheckedChange={toggleEnabled}
        />
      </Field>
      <Field>
        <FieldLabel>{t('settings:sections:eInvoice.defaultFormat')}</FieldLabel>
        <Select
          value={eInvoice.format ?? 'xrechnung-ubl'}
          onValueChange={format =>
            saveNow(current => ({
              ...current,
              eInvoice: { ...current.eInvoice, format },
            }))
          }
        >
          <SelectTrigger className="bg-background text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground">
            <SelectItem value="xrechnung-ubl">
              {t('settings:sections:eInvoice.formats.xrechnung')}
            </SelectItem>
            <SelectItem value="facturx-en16931">
              {t('settings:sections:eInvoice.formats.facturx')}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <EInvoiceChecklist issues={profileIssues} />
    </div>
  );
}
