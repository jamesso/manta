import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '../../helpers/dashboard';

export default function KpiCards({ stats, currencyCode, hasInvoices }) {
  const { t } = useTranslation();
  const bucket = stats.byCurrency[currencyCode];
  const currency = bucket?.currency;
  const counts = stats.counts;

  const cards = [
    {
      key: 'outstanding',
      title: t('dashboard:kpi:outstanding'),
      amount: bucket?.outstanding,
      sub: bucket?.outstandingCount
        ? t('dashboard:kpi:invoiceCount', { count: bucket.outstandingCount })
        : null,
    },
    {
      key: 'overdue',
      title: t('dashboard:kpi:overdue'),
      amount: bucket?.overdue,
      sub: bucket?.overdueCount
        ? t('dashboard:kpi:invoiceCount', { count: bucket.overdueCount })
        : null,
      overdue: true,
    },
    {
      key: 'paid',
      title: t('dashboard:kpi:paidThisMonth'),
      amount: bucket?.paidThisMonth,
      sub: null,
    },
    {
      key: 'drafts',
      title: t('dashboard:kpi:drafts'),
      amount: null,
      sub: String(counts.draft),
      draftCount: true,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <Card key={card.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.overdue ? (
                <span className="inline-flex items-center gap-1.5 text-status-overdue">
                  <AlertCircle className="size-4" aria-hidden />
                  {card.title}
                </span>
              ) : (
                card.title
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {card.draftCount ? (
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {!hasInvoices ? '—' : card.sub}
              </p>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {!hasInvoices || card.amount == null
                    ? '—'
                    : formatMoney(card.amount, currency)}
                </p>
                {hasInvoices && card.sub ? (
                  <p className="text-sm text-muted-foreground">{card.sub}</p>
                ) : null}
                {card.key === 'paid' &&
                hasInvoices &&
                bucket?.creditedThisMonth > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard:kpi:creditedThisMonth', {
                      amount: formatMoney(-bucket.creditedThisMonth, currency),
                    })}
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
