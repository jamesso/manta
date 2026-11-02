import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import EInvoiceChecklist from '../../../app/components/einvoice/EInvoiceChecklist.jsx';
import { getEInvoiceDerived } from '../../../app/helpers/einvoice.js';
import { toEn16931 } from '../../../helpers/einvoice/toEn16931.js';
import { getEInvoiceIssues } from '../../../helpers/einvoice/getEInvoiceIssues.js';
import { exportKey } from '../../../helpers/einvoice/exportKey.js';

const ipc = window.manta.ipc;
const settings = window.manta.settings;

export default function EInvoiceSidebar({ t, UILang, invoice, profile }) {
  const invoiceSettings = settings.get('invoice');
  const enabled = Boolean(invoiceSettings?.eInvoice?.enabled);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const derived = useMemo(() => {
    if (!enabled || !invoice?._id) {
      return null;
    }
    return getEInvoiceDerived(invoice, {
      profile,
      invoiceSettings,
      lang: invoice.configs?.language ?? UILang,
    });
  }, [enabled, invoice, profile, invoiceSettings, UILang]);

  const issues = useMemo(() => {
    if (!enabled || !invoice._id || !derived) {
      return [];
    }
    const model = toEn16931(
      invoice,
      { profile, invoice: invoiceSettings },
      derived
    );
    return getEInvoiceIssues(model, {
      format: invoiceSettings?.eInvoice?.format ?? 'xrechnung-ubl',
      invoice,
      derived,
    });
  }, [enabled, invoice, profile, invoiceSettings, derived]);

  if (!enabled) {
    return null;
  }

  const errors = issues.filter(i => i.severity === 'error');
  const defaultFormat = invoiceSettings?.eInvoice?.format ?? 'xrechnung-ubl';
  const exportBlocked = errors.length > 0;

  const exportKind = async kind => {
    if (!derived) {
      return;
    }
    setExporting(true);
    setResult(null);
    try {
      const res = await ipc.invoke('einvoice-export', {
        kind,
        invoice,
        derived,
        exportKey: exportKey(invoice, profile),
      });
      setResult(res);
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <section
      className="space-y-3 border-t pt-4"
      data-einvoice-export=""
    >
      <h3 className="text-sm font-medium text-foreground">
        {t('preview:sidebar:einvoice:title', { lng: UILang })}
      </h3>
      <p className="text-sm text-foreground">
        {errors.length
          ? t('preview:sidebar:einvoice:problems', {
              lng: UILang,
              count: errors.length,
            })
          : t('preview:sidebar:einvoice:ready', { lng: UILang })}
      </p>
      <EInvoiceChecklist issues={issues} />
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          variant={defaultFormat === 'xrechnung-ubl' ? 'default' : 'outline'}
          disabled={!invoice._id || exporting || exportBlocked}
          onClick={() => exportKind('xrechnung')}
        >
          {exporting ? <Loader2 className="animate-spin" /> : null}
          {t('preview:sidebar:einvoice:exportXrechnung', { lng: UILang })}
        </Button>
        <Button
          type="button"
          className="w-full bg-background text-foreground"
          variant={defaultFormat === 'facturx-en16931' ? 'default' : 'outline'}
          disabled={!invoice._id || exporting || exportBlocked}
          onClick={() => exportKind('facturx')}
        >
          {exporting ? <Loader2 className="animate-spin" /> : null}
          {t('preview:sidebar:einvoice:exportFacturx', { lng: UILang })}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('preview:sidebar:einvoice:disclaimer', { lng: UILang })}
      </p>
      {result?.ok ? (
        <p className="text-xs text-foreground">
          {result.path}{' '}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => ipc.send('reveal-file', result.path)}
          >
            {t('preview:sidebar:einvoice:reveal', { lng: UILang })}
          </button>
        </p>
      ) : null}
      {result && !result.ok && !result.canceled ? (
        <p className="text-xs text-destructive" role="alert">
          {result.error ??
            t('preview:sidebar:einvoice:exportFailed', { lng: UILang })}
        </p>
      ) : null}
    </section>
  );
}
