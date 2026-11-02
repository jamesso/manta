import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, XAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { formatMoney } from '../../helpers/dashboard';

export default function PaidChart({ monthlyRows, currency, hasInvoices }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';

  const rows = useMemo(
    () =>
      (monthlyRows || []).map(row => ({
        ...row,
        label: new Intl.DateTimeFormat(i18n.language, {
          month: 'short',
        }).format(row.start),
      })),
    [monthlyRows, i18n.language]
  );

  const allZero =
    !hasInvoices || rows.every(row => !row.total || row.total === 0);

  if (allZero) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t('dashboard:chart:title')}</EmptyTitle>
          <EmptyDescription>{t('dashboard:chart:empty')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-foreground">
        {t('dashboard:chart:title')}
      </h2>
      <ChartContainer
        className="h-56 w-full"
        config={{
          total: {
            label: t('dashboard:chart:paid'),
            color: 'var(--chart-1)',
          },
        }}
      >
        <BarChart accessibilityLayer data={rows}>
          <XAxis dataKey="label" reversed={rtl} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={value => formatMoney(Number(value), currency)}
              />
            }
          />
          <Bar dataKey="total" fill="var(--color-total)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
