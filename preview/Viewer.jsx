import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import MainContent from './containers/MainContent';
import * as ActionsCreator from './actions';
import { getConfigs, getInvoice, getProfile, getUILang } from './reducers';

const ipc = window.manta.ipc;

// Hidden PDF render engine. The main process sends `update-preview` with a
// requestId, this page renders the invoice and answers with
// `preview-rendered` when fonts and images are ready. The window never
// shows, so there is no UI around the paper.
export default function Viewer() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const configs = useSelector(getConfigs);
  const invoice = useSelector(getInvoice);
  const profile = useSelector(getProfile);
  const UILang = useSelector(getUILang);
  const pendingRenderRef = useRef(null);

  useEffect(() => {
    if (!UILang) return;
    i18n.changeLanguage(UILang);
  }, [UILang]);

  useEffect(() => {
    const pending = pendingRenderRef.current;
    if (!pending) {
      return;
    }
    let cancelled = false;

    async function signalReady() {
      await document.fonts.ready;
      const imgs = Array.from(document.querySelectorAll('.print-area img'));
      await Promise.all(
        imgs.map(img =>
          img.complete
            ? Promise.resolve()
            : new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
              })
        )
      );
      if (!cancelled) {
        ipc.send('preview-rendered', {
          requestId: pending.requestId,
          invoiceId: pending.invoiceId,
        });
        pendingRenderRef.current = null;
      }
    }

    signalReady().catch(() => {
      if (!cancelled) {
        pendingRenderRef.current = null;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [invoice, profile, configs, UILang]);

  useEffect(() => {
    const onPreview = (_event, invoiceData) => {
      const active = window.manta.getActivePreviewRequestId?.() ?? null;
      if (invoiceData?.requestId) {
        if (!active || invoiceData.requestId !== active) {
          return;
        }
        pendingRenderRef.current = {
          requestId: invoiceData.requestId,
          invoiceId: invoiceData.invoice?._id,
        };
        dispatch(ActionsCreator.updateCoordinatedPreview(invoiceData));
        return;
      }
      // Plain payload (scripts/pdf-snapshot.mjs, e2e). Do not replace the
      // invoice while a PDF job prints.
      if (active) {
        return;
      }
      dispatch(ActionsCreator.updateInvoice(invoiceData));
    };
    ipc.on('update-preview', onPreview);
    return () => {
      ipc.removeAllListeners(['update-preview']);
    };
  }, [dispatch]);

  return (
    <div dir={i18n.dir(UILang)} className="flex h-screen flex-col bg-white">
      <MainContent
        invoice={invoice}
        configs={configs}
        profile={profile}
        UILang={UILang}
        t={t}
      />
    </div>
  );
}
