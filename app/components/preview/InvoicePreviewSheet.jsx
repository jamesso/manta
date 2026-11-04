import React, { useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { isEqual } from 'lodash';
import { FileDown, Loader2, Mail, Share } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { showExportedToast } from '../../helpers/exportToast';
import * as UIActions from '../../actions/ui';
import { saveInvoiceConfigs } from '../../actions/invoices';
import { getAllSalesDocs } from '../../reducers/InvoicesReducer';
import { getSavedSettings } from '../../reducers/SettingsReducer';
import { getDocType } from '../../helpers/docType';
import { canEmail } from '../../helpers/emailDraft';
import { captureAppSnapshot } from '../../helpers/emailFlow';
import { getInvoiceNumber } from '../../helpers/invoice';
import {
  getConfigOverrides,
  getDefaultPreviewConfigs,
  resolveInvoiceConfigs,
} from '../../../preview/constants/defaultConfigs';
import { useEmailInvoice } from '../email/EmailHost';
import InvoiceStyleFields from '../invoiceStyle/InvoiceStyleFields';
import EInvoiceExport from './EInvoiceExport';
import InvoicePaper from './InvoicePaper';

const ipc = window.manta.ipc;

// The preview drawer: the document as it prints, its style, and the export
// actions. Opened with UIActions.previewInvoice(doc).
export default function InvoicePreviewSheet() {
  const dispatch = useDispatch();
  const requested = useSelector(state => state.ui.previewSheet);
  const allDocs = useSelector(getAllSalesDocs);
  // Keep the last document while the drawer animates closed.
  const lastRef = useRef(null);
  if (requested) {
    lastRef.current = requested;
  }
  const shown = lastRef.current;
  const doc = shown ? (allDocs?.find(d => d._id === shown._id) ?? shown) : null;

  return (
    <Sheet
      open={Boolean(requested)}
      onOpenChange={open => {
        if (!open) dispatch(UIActions.previewInvoice(null));
      }}
    >
      <SheetContent
        side="right"
        className="data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:sm:max-w-5xl"
      >
        {doc ? <PreviewBody key={doc._id} doc={doc} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function PreviewBody({ doc }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const emailInvoice = useEmailInvoice();
  const saved = useSelector(getSavedSettings);
  const invoiceSettings = saved?.invoice;
  const generalSettings = saved?.general;
  // Unsaved style changes; null means "show the saved style".
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  const defaults = useMemo(
    () => getDefaultPreviewConfigs(invoiceSettings, generalSettings),
    [invoiceSettings, generalSettings]
  );
  const effective = useMemo(
    () => resolveInvoiceConfigs(doc, invoiceSettings, generalSettings),
    [doc, invoiceSettings, generalSettings]
  );
  const configs = draft ?? effective;
  const dirty = draft != null && !isEqual(draft, effective);
  const hasOwnStyle = doc.configs != null;

  const snapshot = useMemo(
    () => captureAppSnapshot(doc, { get: key => saved?.[key] }, configs),
    [doc, saved, configs]
  );

  const update = (name, value) =>
    setDraft(current => ({ ...(current ?? effective), [name]: value }));

  const saveStyle = () => {
    dispatch(
      saveInvoiceConfigs(doc._id, getConfigOverrides(configs, defaults))
    );
    setDraft(null);
  };

  const resetStyle = () => {
    dispatch(saveInvoiceConfigs(doc._id, undefined));
    setDraft(null);
  };

  const run = async task => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const savePdf = () =>
    run(async () => {
      const res = await ipc.invoke('save-pdf', {
        invoice: doc,
        snapshot,
        docType: getDocType(doc),
      });
      if (res?.ok) {
        showExportedToast(t, res.pdfPath);
      } else {
        toast.add({
          title: t('preview:drawer:exportFailed', { reason: res?.error }),
          type: 'warning',
        });
      }
    });

  const sharePdf = () =>
    run(async () => {
      const res = await ipc.invoke('share-invoice-pdf', {
        invoiceId: doc._id,
        invoice: doc,
        fileBase: getInvoiceNumber(doc),
        snapshot,
      });
      if (!res?.ok) {
        toast.add({
          title: t('email:toast:failed', { reason: res?.error }),
          type: 'warning',
        });
      }
    });

  const emailable = canEmail(doc);
  const showShare = emailable && window.manta.platform === 'darwin';
  const showEInvoice = Boolean(invoiceSettings?.eInvoice?.enabled);
  const UILang = generalSettings?.language ?? 'en';

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {t('preview:drawer:title', { number: getInvoiceNumber(doc) })}
        </SheetTitle>
        <SheetDescription>
          {hasOwnStyle
            ? t('preview:drawer:ownStyle')
            : t('preview:drawer:defaultStyle')}
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto bg-muted/40">
          <InvoicePaper
            invoice={doc}
            configs={configs}
            profile={snapshot.profile}
            UILang={UILang}
            resetKey={configs}
          />
        </div>
        <aside
          aria-label={t('preview:drawer:style')}
          className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-s p-4"
        >
          <InvoiceStyleFields
            t={t}
            UILang={UILang}
            configs={configs}
            update={update}
            documentFields
          />
          {showEInvoice ? (
            <EInvoiceExport
              t={t}
              invoice={doc}
              invoiceSettings={invoiceSettings}
              snapshot={snapshot}
            />
          ) : null}
        </aside>
      </div>
      <SheetFooter>
        {hasOwnStyle ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={resetStyle}
          >
            {t('preview:drawer:useDefaults')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="me-auto"
          disabled={busy || !dirty}
          onClick={saveStyle}
        >
          {t('preview:drawer:saveStyle')}
        </Button>
        <SheetClose render={<Button type="button" variant="ghost" />}>
          {t('common:close')}
        </SheetClose>
        {showShare ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={sharePdf}
          >
            <Share />
            {t('preview:sidebar:actions:sharePdf')}
          </Button>
        ) : null}
        {emailable ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => emailInvoice(doc, 'invoice', configs)}
          >
            <Mail />
            {t('preview:sidebar:actions:emailInvoice')}
          </Button>
        ) : null}
        <Button type="button" disabled={busy} onClick={savePdf}>
          {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
          {t('preview:sidebar:actions:savePDF')}
        </Button>
      </SheetFooter>
    </>
  );
}
