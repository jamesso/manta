import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import InvoiceDetailSheet from '../components/invoices/InvoiceDetailSheet';
import KpiCards from '../components/dashboard/KpiCards';
import NeedsAttention from '../components/dashboard/NeedsAttention';
import OnboardingChecklist from '../components/dashboard/OnboardingChecklist';
import PaidChart from '../components/dashboard/PaidChart';
import RecentInvoices from '../components/dashboard/RecentInvoices';
import { useNow } from '../components/invoices/useNow';
import {
  getDashboardStats,
  getMonthlyPaid,
  getNeedsAttention,
  getRecentInvoices,
} from '../helpers/dashboard';
import { getChecklistState } from '../helpers/onboarding';
import { getContacts } from '../reducers/ContactsReducer';
import { isBootstrapReady } from '../reducers/BootstrapReducer';
import { getInvoices } from '../reducers/InvoicesReducer';
import { getCurrentSettings, getDateFormat } from '../reducers/SettingsReducer';
import rawLogo from '../../static/imgs/default_logo.svg?raw';

const defaultLogoDataUrl = 'data:image/svg+xml;base64,' + btoa(rawLogo);

export default function Dashboard() {
  const { t } = useTranslation();
  const now = useNow();
  const ready = useSelector(isBootstrapReady);
  const invoices = useSelector(getInvoices);
  const contacts = useSelector(getContacts);
  const settings = useSelector(getCurrentSettings);
  const dateFormat = useSelector(getDateFormat);
  const [openId, setOpenId] = useState(null);
  const [currencyCode, setCurrencyCode] = useState('USD');

  const fallbackCurrency = useMemo(
    () =>
      settings?.invoice?.currency ?? {
        code: 'USD',
        placement: 'before',
        separator: 'commaDot',
        fraction: 2,
      },
    [settings?.invoice?.currency]
  );

  const stats = useMemo(
    () => getDashboardStats(invoices, now, fallbackCurrency),
    [invoices, now, fallbackCurrency]
  );

  const monthly = useMemo(
    () => getMonthlyPaid(invoices, now, 6, fallbackCurrency),
    [invoices, now, fallbackCurrency]
  );

  const needs = useMemo(
    () => getNeedsAttention(invoices, now, 7),
    [invoices, now]
  );

  const recent = useMemo(() => getRecentInvoices(invoices, 5), [invoices]);

  const checklist = useMemo(() => {
    if (!ready || !settings) {
      return null;
    }
    return getChecklistState(
      {
        profile: settings.profile,
        onboarding: settings.onboarding,
      },
      invoices,
      contacts,
      defaultLogoDataUrl
    );
  }, [ready, settings, invoices, contacts]);

  useEffect(() => {
    const codes = stats.currencies;
    if (!codes.length) {
      setCurrencyCode(fallbackCurrency.code);
      return;
    }
    setCurrencyCode(prev => {
      if (codes.includes(prev)) {
        return prev;
      }
      const preferred = fallbackCurrency.code;
      if (codes.includes(preferred)) {
        return preferred;
      }
      return codes[0];
    });
  }, [stats.currencies, fallbackCurrency.code]);

  const openInvoice = openId
    ? invoices.find(inv => inv._id === openId) || null
    : null;

  const monthlyRows = monthly[currencyCode] || [];
  const bucket = stats.byCurrency[currencyCode];
  const hasInvoices = invoices.length > 0;

  if (!ready) {
    return (
      <div className="space-y-4 p-4 text-foreground">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(n => (
            <Skeleton key={n} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('dashboard:heading')}
      </h1>

      {checklist && !checklist.dismissed ? (
        <OnboardingChecklist checklist={checklist} invoices={invoices} />
      ) : null}

      {stats.currencies.length > 1 ? (
        <div className="flex max-w-xs flex-col gap-1">
          <label
            className="text-sm text-muted-foreground"
            htmlFor="dash-currency"
          >
            {t('dashboard:currency:label')}
          </label>
          <Select value={currencyCode} onValueChange={setCurrencyCode}>
            <SelectTrigger id="dash-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stats.currencies.map(code => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <KpiCards
        stats={stats}
        currencyCode={currencyCode}
        hasInvoices={hasInvoices}
      />

      <PaidChart
        monthlyRows={monthlyRows}
        currency={bucket?.currency ?? fallbackCurrency}
        hasInvoices={hasInvoices}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <NeedsAttention
          invoices={needs}
          now={now}
          dateFormat={dateFormat}
          onOpen={setOpenId}
        />
        <RecentInvoices
          invoices={recent}
          now={now}
          dateFormat={dateFormat}
          onOpen={setOpenId}
        />
      </div>

      <InvoiceDetailSheet
        invoice={openInvoice}
        open={Boolean(openInvoice)}
        onOpenChange={open => {
          if (!open) setOpenId(null);
        }}
        dateFormat={dateFormat}
        t={t}
        now={now}
      />
    </div>
  );
}
