import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { confirm } from '@/lib/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import EInvoiceChecklist from '../../einvoice/EInvoiceChecklist.jsx';
import { SettingsBlock, SettingsGroup, SettingsRow } from '../SettingsLayout';
import { getEInvoiceDerived } from '../../../helpers/einvoice.js';
import { toEn16931 } from '../../../../helpers/einvoice/toEn16931.js';
import { getEInvoiceIssues } from '../../../../helpers/einvoice/getEInvoiceIssues.js';
import { isBuyerReferenceOn } from '../../../../helpers/einvoice/identifiers.js';

export default function EInvoiceSettings({ profile, value, onSave, saveNow }) {
  const { t } = useTranslation();
  const eInvoice = value?.eInvoice ?? {
    enabled: false,
    format: 'xrechnung-ubl',
  };
  const [busy, setBusy] = useState(false);
  const formatValue = eInvoice.format ?? 'xrechnung-ubl';
  const formatLabel =
    formatValue === 'facturx-en16931'
      ? t('settings:sections:eInvoice.formats.facturx')
      : t('settings:sections:eInvoice.formats.xrechnung');

  const enabled = Boolean(eInvoice.enabled);

  const profileIssues = useMemo(() => {
    if (!enabled) {
      return [];
    }
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
  }, [enabled, profile, value, eInvoice.format]);

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
    <SettingsGroup
      title={t('settings:sections:eInvoice.title')}
      description={t('settings:sections:eInvoice.description')}
    >
      <SettingsRow
        label={t('settings:sections:eInvoice.enable')}
        description={t('settings:sections:eInvoice.disclaimer')}
        htmlFor="einvoice-enabled"
      >
        <Switch
          id="einvoice-enabled"
          checked={enabled}
          disabled={busy}
          onCheckedChange={toggleEnabled}
        />
      </SettingsRow>
      {/* When off, only the switch shows. */}
      {enabled ? (
        <>
          <SettingsRow label={t('settings:sections:eInvoice.defaultFormat')}>
            <Select
              value={formatValue}
              onValueChange={format =>
                saveNow(current => ({
                  ...current,
                  eInvoice: { ...current.eInvoice, format },
                }))
              }
            >
              <SelectTrigger className="w-64 bg-background text-foreground">
                <SelectValue>{formatLabel}</SelectValue>
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
          </SettingsRow>
          <SettingsRow
            label={t('settings:sections:eInvoice.buyerReference')}
            description={t('settings:sections:eInvoice.buyerReferenceHint')}
            htmlFor="einvoice-buyerReference"
          >
            <Switch
              id="einvoice-buyerReference"
              checked={isBuyerReferenceOn(value)}
              onCheckedChange={checked =>
                saveNow(current => ({ ...current, useBuyerReference: checked }))
              }
            />
          </SettingsRow>
          {profileIssues?.length ? (
            <SettingsBlock>
              <EInvoiceChecklist issues={profileIssues} />
            </SettingsBlock>
          ) : null}
        </>
      ) : null}
    </SettingsGroup>
  );
}
