import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { SidebarTrigger } from '@/components/ui/sidebar';

export default function TitleBar({ activeTab }) {
  const { t } = useTranslation();
  const editMode = useSelector(
    s => s.form?.settings?.editMode?.active === true
  );
  const formDocType = useSelector(s => s.form?.docType || 'invoice');

  let title = t('app:titles:newInvoice');
  if (activeTab === 'dashboard') {
    title = t('app:titles:dashboard');
  } else if (activeTab === 'form' && editMode) {
    title =
      formDocType === 'estimate'
        ? t('app:titles:editEstimate')
        : t('app:titles:editInvoice');
  } else if (activeTab === 'form' && formDocType === 'estimate') {
    title = t('app:titles:newEstimate');
  } else if (activeTab === 'invoices') {
    title = t('app:nav:invoices');
  } else if (activeTab === 'estimates') {
    title = t('app:nav:estimates');
  } else if (activeTab === 'recurring') {
    title = t('app:nav:recurring');
  } else if (activeTab === 'contacts') {
    title = t('app:nav:clients');
  } else if (activeTab === 'items') {
    title = t('app:nav:items');
  } else if (activeTab === 'settings') {
    title = t('app:nav:settings');
  }

  return (
    <header className="titlebar titlebar-inset titlebar-mac-traffic drag-region flex h-10 shrink-0 items-center gap-2 border-b bg-background text-foreground">
      <SidebarTrigger />
      <h1 className="truncate text-sm font-medium text-foreground">{title}</h1>
    </header>
  );
}
