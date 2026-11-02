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

  useEffect(() => {
    if (!UILang) return;
    i18n.changeLanguage(UILang);
  }, [UILang]);

  useEffect(() => {
    const onPreview = (_event, invoiceData) => {
      if (exportFrozenRef.current) {
        return;
      }
      dispatch(ActionsCreator.updateInvoice(invoiceData));
    };
    const onLanguage = (_event, newLang) => {
      dispatch(ActionsCreator.changeUILanguage(newLang));
    };
    const onProfile = (_event, newProfile) => {
      if (exportFrozenRef.current) {
        return;
      }
      dispatch(ActionsCreator.updateProfile(newProfile));
    };
    const onFreeze = (_event, frozen) => {
      exportFrozenRef.current = Boolean(frozen);
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
