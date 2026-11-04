import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { showExportedToast } from '../../helpers/exportToast';
import EInvoiceChecklist from '../einvoice/EInvoiceChecklist.jsx';
import { getEInvoiceDerived } from '../../helpers/einvoice.js';
import { toEn16931 } from '../../../helpers/einvoice/toEn16931.js';
import { getEInvoiceIssues } from '../../../helpers/einvoice/getEInvoiceIssues.js';

const ipc = window.manta.ipc;

// XRechnung / Factur-X export for the document in the preview drawer.
export default function EInvoiceExport({
  t,
  invoice,
  invoiceSettings,
  snapshot,
}) {
  const [exporting, setExporting] = useState(false);
  const { profile, language } = snapshot;
  const format = invoiceSettings?.eInvoice?.format ?? 'xrechnung-ubl';

  const derived = useMemo(
    () =>
      getEInvoiceDerived(invoice, { profile, invoiceSettings, lang: language }),
    [invoice, profile, invoiceSettings, language]
  );

  const issues = useMemo(() => {
    const model = toEn16931(
      invoice,
      { profile, invoice: invoiceSettings },
      derived
    );
    return getEInvoiceIssues(model, { format, invoice, derived });
  }, [invoice, profile, invoiceSettings, derived, format]);

  const errors = issues.filter(i => i.severity === 'error');
  const blocked = errors.length > 0 || exporting;

  const exportKind = async kind => {
    setExporting(true);
    try {
      const res = await ipc.invoke('einvoice-export', {
        kind,
        invoice,
        derived,
        snapshot,
      });
      if (res?.ok) {
        showExportedToast(t, res.path);
      } else if (!res?.canceled) {
        toast.add({
          title: t('preview:sidebar:einvoice:exportFailed'),
          description: res?.error,
          type: 'warning',
        });
      }
    } catch (err) {
      toast.add({
        title: t('preview:sidebar:einvoice:exportFailed'),
        description: err.message,
        type: 'warning',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <section
      className="flex flex-col gap-3 border-t pt-4"
      data-einvoice-export=""
    >
      <h3 className="text-sm font-medium text-foreground">
        {t('preview:sidebar:einvoice:title')}
      </h3>
      <p className="text-sm text-foreground">
        {errors.length
          ? t('preview:sidebar:einvoice:problems', { count: errors.length })
          : t('preview:sidebar:einvoice:ready')}
      </p>
      <EInvoiceChecklist issues={issues} />
      <Button
        type="button"
        variant={format === 'xrechnung-ubl' ? 'default' : 'outline'}
        disabled={blocked}
        onClick={() => exportKind('xrechnung')}
      >
        {exporting ? <Loader2 className="animate-spin" /> : null}
        {t('preview:sidebar:einvoice:exportXrechnung')}
      </Button>
      <Button
        type="button"
        variant={format === 'facturx-en16931' ? 'default' : 'outline'}
        disabled={blocked}
        onClick={() => exportKind('facturx')}
      >
        {exporting ? <Loader2 className="animate-spin" /> : null}
        {t('preview:sidebar:einvoice:exportFacturx')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t('preview:sidebar:einvoice:disclaimer')}
      </p>
    </section>
  );
}
