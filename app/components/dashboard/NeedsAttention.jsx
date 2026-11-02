import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { BellRing } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { canSendReminder } from '../../helpers/emailDraft';
import { useEmailInvoice } from '../email/EmailHost';
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
  allSalesDocs = invoices,
  max = 8,
}) {
  const { t } = useTranslation();
  const emailInvoice = useEmailInvoice();
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
          const display = getDisplayStatus(inv, now, allSalesDocs);
          const number = getInvoiceNumber(inv);
          const showReminder = canSendReminder(inv, now, allSalesDocs);
          return (
            <li key={inv._id}>
              <div className="flex items-stretch">
                <button
                  type="button"
                  className="flex min-h-12 flex-1 flex-wrap items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-muted/50"
                  onClick={() => onOpen(inv._id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {clientName(inv)}
                    </span>
                    <span className="text-muted-foreground">
                      {number}
                      {due != null
                        ? ` · ${moment(due).format(dateFormat)}`
                        : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={display} t={t} />
                    <span className="tabular-nums">
                      {formatInvoiceAmount(inv)}
                    </span>
                  </span>
                </button>
                {showReminder ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 bg-background text-foreground"
                          aria-label={t('email:actions:reminder', {
                            number,
                          })}
                          onClick={() => emailInvoice(inv, 'reminder')}
                        />
                      }
                    >
                      <BellRing />
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('email:actions:reminder')}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
