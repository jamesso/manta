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
import GreetingSummary from '../components/dashboard/GreetingSummary';
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
  getDashboardCurrencyDisplay,
  pruneUserCurrencyPick,
  resolveDashboardCurrencySelection,
} from '../helpers/dashboard';
import { getChecklistState } from '../helpers/onboarding';
import { getContacts } from '../reducers/ContactsReducer';
import { isBootstrapReady } from '../reducers/BootstrapReducer';
import { getInvoices, getAllSalesDocs } from '../reducers/InvoicesReducer';
import { getCurrentSettings, getDateFormat } from '../reducers/SettingsReducer';
import rawLogo from '../../static/imgs/default_logo.svg?raw';

const defaultLogoDataUrl = 'data:image/svg+xml;base64,' + btoa(rawLogo);

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const ready = useSelector(isBootstrapReady);
  const invoices = useSelector(getInvoices);
  const allSalesDocs = useSelector(getAllSalesDocs);
  const contacts = useSelector(getContacts);
  const settings = useSelector(getCurrentSettings);
  const dateFormat = useSelector(getDateFormat);
  const [openId, setOpenId] = useState(null);
  const [userPickedCode, setUserPickedCode] = useState(null);

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
    () => getDashboardStats(allSalesDocs, now, fallbackCurrency),
    [allSalesDocs, now, fallbackCurrency]
  );

  const monthly = useMemo(
    () => getMonthlyPaid(invoices, now, 6, fallbackCurrency),
    [invoices, now, fallbackCurrency]
  );

  const needs = useMemo(
    () => getNeedsAttention(allSalesDocs, now, 7),
    [allSalesDocs, now]
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
    if (!ready) {
      return;
    }
    setUserPickedCode(prev =>
      pruneUserCurrencyPick(prev, stats.currencies, true)
    );
  }, [ready, stats.currencies]);

  const activeCurrencyCode = getDashboardCurrencyDisplay({
    dataReady: ready,
    userPickedCode,
    availableCodes: stats.currencies,
    configuredCode: fallbackCurrency.code,
  });

  const openInvoice = openId
    ? invoices.find(inv => inv._id === openId) || null
    : null;

  const monthlyRows = monthly[activeCurrencyCode] || [];
  const bucket = stats.byCurrency[activeCurrencyCode];
  const hasInvoices = invoices.length > 0;

  if (!ready) {
    return (
      <div className="space-y-4 px-8 pt-7 pb-8 text-foreground">
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
    <div className="space-y-6 px-8 pt-7 pb-8 text-foreground">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">
          {t('dashboard:heading')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {new Intl.DateTimeFormat(i18n.language, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }).format(now)}
        </p>
      </div>

      {hasInvoices ? (
        <GreetingSummary
          now={now}
          overdue={bucket?.overdueCount ?? 0}
          outstanding={Math.max(
            0,
            (bucket?.outstandingCount ?? 0) - (bucket?.overdueCount ?? 0)
          )}
          drafts={stats.counts.draft}
        />
      ) : null}

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
          <Select value={activeCurrencyCode} onValueChange={setUserPickedCode}>
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
        currencyCode={activeCurrencyCode}
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
          allSalesDocs={allSalesDocs}
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
