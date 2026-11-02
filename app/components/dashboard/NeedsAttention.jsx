import moment from 'moment';
import { useTranslation } from 'react-i18next';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  formatInvoiceAmount,
  getDisplayStatus,
  getDueDate,
  getInvoiceNumber,
} from '../../helpers/invoice';
import StatusBadge from '../invoices/StatusBadge';

function clientName(invoice) {
  const r = invoice.recipient || {};
  return r.fullname || r.company || r.email || '—';
}

export default function NeedsAttention({
  invoices,
  now,
  dateFormat,
  onOpen,
  max = 8,
}) {
  const { t } = useTranslation();
  const list = invoices.slice(0, max);

  if (list.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t('dashboard:needsAttention:title')}</EmptyTitle>
          <EmptyDescription>
            {t('dashboard:needsAttention:empty')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-foreground">
        {t('dashboard:needsAttention:title')}
      </h2>
      <ul className="divide-y rounded-lg border">
        {list.map(inv => {
          const due = getDueDate(inv);
          const display = getDisplayStatus(inv, now);
          return (
            <li key={inv._id}>
              <button
                type="button"
                className="flex w-full min-h-12 flex-wrap items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-muted/50"
                onClick={() => onOpen(inv._id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {clientName(inv)}
                  </span>
                  <span className="text-muted-foreground">
                    {getInvoiceNumber(inv)}
                    {due != null ? ` · ${moment(due).format(dateFormat)}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={display} t={t} />
                  <span className="tabular-nums">
                    {formatInvoiceAmount(inv)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
