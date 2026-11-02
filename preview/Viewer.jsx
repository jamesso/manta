import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { Notify } from '../helpers/notify';
import SideBar from './containers/SideBar';
import MainContent from './containers/MainContent';
import * as ActionsCreator from './actions';
import { getConfigs, getInvoice, getProfile, getUILang } from './reducers';

const ipc = window.manta.ipc;

export default function Viewer() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const configs = useSelector(getConfigs);
  const invoice = useSelector(getInvoice);
  const profile = useSelector(getProfile);
  const UILang = useSelector(getUILang);
  const exportFrozenRef = useRef(false);
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

  const exportBlocked = () =>
    exportFrozenRef.current ||
    window.__mantaExportFrozen === true ||
    (window.__mantaExportFrozenCount || 0) > 0;

  useEffect(() => {
    const blocked = exportBlocked;

    const onPreview = (_event, invoiceData) => {
      if (invoiceData?.requestId) {
        const active = window.manta.getActivePreviewRequestId?.() ?? null;
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
      if (blocked()) {
        return;
      }
      dispatch(ActionsCreator.updateInvoice(invoiceData));
    };
    const onLanguage = (_event, newLang) => {
      dispatch(ActionsCreator.changeUILanguage(newLang));
    };
    const onProfile = (_event, newProfile) => {
      if (blocked()) {
        return;
      }
      dispatch(ActionsCreator.updateProfile(newProfile));
    };
    const onFreeze = (_event, frozen) => {
      if (frozen) {
        exportFrozenRef.current = true;
        window.__mantaExportFrozen = true;
      } else {
        exportFrozenRef.current = (window.__mantaExportFrozenCount || 0) > 0;
        window.__mantaExportFrozen = exportFrozenRef.current;
      }
    };
    const onExported = (_event, options) => {
      const noti = Notify(options);
      noti.onclick = () => {
        ipc.send('reveal-file', options.location);
      };
    };
    ipc.on('update-preview', onPreview);
    ipc.on('change-preview-window-language', onLanguage);
    ipc.on('change-preview-window-profile', onProfile);
    ipc.on('preview-export-freeze', onFreeze);
    ipc.on('pfd-exported', onExported);
    return () => {
      ipc.removeAllListeners([
        'update-preview',
        'change-preview-window-language',
        'change-preview-window-profile',
        'preview-export-freeze',
        'pfd-exported',
      ]);
    };
  }, [dispatch]);

  const updateConfigs = config => {
    if (exportBlocked()) {
      return;
    }
    dispatch(
      ActionsCreator.updateConfigs({ name: config.name, value: config.value })
    );
  };

  const title = invoice._id
    ? invoice.invoiceID || invoice._id
    : t('preview:common:chooseInvoiceToPreview', { lng: UILang });

  return (
    <div
      dir={i18n.dir(UILang)}
      className="flex h-screen flex-col bg-background text-foreground"
    >
      <header className="titlebar titlebar-inset titlebar-mac-traffic drag-region flex h-10 shrink-0 items-center gap-2 border-b bg-background text-foreground">
        <h1 className="truncate text-sm font-medium text-foreground">
          {title}
        </h1>
      </header>
      <div className="flex min-h-0 flex-1">
        <SideBar
          UILang={UILang}
          configs={configs}
          invoice={invoice}
          profile={profile}
          updateConfigs={updateConfigs}
          t={t}
        />
        <MainContent
          invoice={invoice}
          configs={configs}
          profile={profile}
          UILang={UILang}
          t={t}
        />
      </div>
    </div>
  );
}
