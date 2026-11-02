import moment from 'moment';
import { Trash2 } from 'lucide-react';
import { useDispatch } from 'react-redux';

import { Button } from '@/components/ui/button';
import { formatNumber } from '../../../helpers/formatNumber';
import { removePayment } from '../../actions/invoices';
import { getPayments } from '../../helpers/invoice';

export default function PaymentsList({ invoice, dateFormat, t }) {
  const dispatch = useDispatch();
  const payments = [...getPayments(invoice)].sort((a, b) => b.date - a.date);
  const currency = invoice.currency ?? {};
  const fmt = amount =>
    formatNumber(
      amount,
      currency.fraction ?? 2,
      currency.separator ?? 'commaDot'
    );

  if (!payments.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('invoices:payments:empty')}
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {payments.map(p => {
        const amountLabel = fmt(p.amount);
        const dateLabel = moment(p.date).format(dateFormat);
        return (
          <li
            key={p.id}
            className="flex items-start justify-between gap-2 border-b pb-2 last:border-0"
          >
            <div>
              <div>{dateLabel}</div>
              <div className="text-muted-foreground">
                {t(`invoices:payments:methods:${p.method ?? 'other'}`)}
              </div>
              {p.note ? (
                <div className="text-muted-foreground">{p.note}</div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-end">{amountLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 min-w-6"
                aria-label={t('invoices:payments:remove', {
                  amount: amountLabel,
                  date: dateLabel,
                })}
                onClick={() => dispatch(removePayment(invoice._id, p.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
