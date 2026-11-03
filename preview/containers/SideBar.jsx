import React from 'react';
import AccentColor from '../components/sidebar/AccentColor';
import Actions from '../components/sidebar/Actions';
import Alignment from '../components/sidebar/Alignment';
import DateFormat from '../components/sidebar/DateFormat';
import FontSize from '../components/sidebar/FontSize';
import LogoSize from '../components/sidebar/LogoSize';
import Language from '../components/sidebar/Language';
import Template from '../components/sidebar/Template';
import Toggler from '../components/sidebar/Toggler';
import EInvoiceSidebar from '../components/sidebar/EInvoice.jsx';

const ipc = window.manta.ipc;
import {
  getDocType,
  getDocTitleKey,
  isEstimate,
} from '../../app/helpers/docType';
import { getDefaultValidUntil } from '../../app/helpers/estimate';
import { canEmail } from '../../app/helpers/emailDraft';

export default function SideBar({
  t,
  configs,
  invoice,
  profile,
  UILang,
  updateConfigs,
}) {
  const update = (name, value) => {
    updateConfigs({ name, value });
  };

  const saveConfigs = () => {
    ipc.send('save-configs-to-invoice', invoice._id, configs);
  };

  const savePDF = () => {
    ipc.send('save-pdf', {
      invoice,
      snapshot: emailSnapshot,
      docType: getDocType(invoice),
    });
    saveConfigs();
  };

  const emailSnapshot = {
    profile,
    configs,
    language: configs.language,
  };

  const emailInvoice = () => {
    ipc.send('request-email-invoice', {
      invoiceId: invoice._id,
      invoice,
      snapshot: emailSnapshot,
    });
  };

  const sharePdf = async () => {
    const captured = await ipc.invoke('capture-preview-snapshot', {
      invoice,
      snapshot: emailSnapshot,
    });
    if (!captured?.ok) {
      return;
    }
    await ipc.invoke('share-invoice-pdf', {
      invoiceId: invoice._id,
      invoice,
      fileBase: invoice.invoiceID,
      source: 'preview',
      snapshot: emailSnapshot,
      previewToken: captured.previewToken,
    });
  };

  const emailable = canEmail(invoice);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground">
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <Template
          t={t}
          UILang={UILang}
          template={configs.template}
          update={update}
        />
        <Language
          t={t}
          UILang={UILang}
          language={configs.language}
          update={update}
        />
        <DateFormat
          t={t}
          UILang={UILang}
          language={configs.language}
          dateFormat={configs.dateFormat}
          update={update}
        />
        <Alignment
          t={t}
          UILang={UILang}
          alignItems={configs.alignItems}
          update={update}
        />
        <FontSize
          t={t}
          UILang={UILang}
          fontSize={configs.fontSize}
          update={update}
        />
        {configs.showLogo ? (
          <LogoSize
            t={t}
            UILang={UILang}
            logoSize={configs.logoSize}
            update={update}
          />
        ) : null}
        <Toggler t={t} UILang={UILang} configs={configs} update={update} />
        {configs.customAccentColor ? (
          <AccentColor
            t={t}
            UILang={UILang}
            accentColor={configs.accentColor}
            update={update}
          />
        ) : null}
        <EInvoiceSidebar
          t={t}
          UILang={UILang}
          invoice={invoice}
          profile={profile}
          configs={configs}
        />
      </div>
      <Actions
        t={t}
        UILang={UILang}
        disabled={!invoice._id}
        savePDF={savePDF}
        saveConfigs={saveConfigs}
        emailInvoice={emailInvoice}
        sharePdf={sharePdf}
        showEmail={emailable}
        showShare={emailable && window.manta.platform === 'darwin'}
      />
    </aside>
  );
}
