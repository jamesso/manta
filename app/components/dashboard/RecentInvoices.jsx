import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import * as UIActions from '../../actions/ui';
import {
  formatInvoiceAmount,
  getDisplayStatus,
  getInvoiceNumber,
  getIssuedAt,
} from '../../helpers/invoice';
import { groupCreditNotesByInvoice } from '../../helpers/creditNotes';
import { getAllSalesDocs } from '../../reducers/InvoicesReducer';
import StatusBadge from '../invoices/StatusBadge';

function clientName(invoice) {
  const r = invoice.recipient || {};
  return r.fullname || r.company || r.email || '—';
}

export default function RecentInvoices({ invoices, now, dateFormat, onOpen }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const allSalesDocs = useSelector(getAllSalesDocs) ?? [];
  const creditByInvoice = groupCreditNotesByInvoice(allSalesDocs);

  if (invoices.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t('dashboard:recent:title')}</EmptyTitle>
          <EmptyDescription>{t('dashboard:recent:empty')}</EmptyDescription>
        </EmptyHeader>
        <EmptyMedia>
          <Button
            type="button"
            onClick={() => dispatch(UIActions.newInvoice())}
          >
            {t('dashboard:recent:newInvoice')}
          </Button>
        </EmptyMedia>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-foreground">
        {t('dashboard:recent:title')}
      </h2>
      <ul className="divide-y rounded-lg border">
        {invoices.map(inv => {
          const issued = getIssuedAt(inv) ?? inv.created_at;
          const linked = creditByInvoice.get(inv._id) ?? [];
          const display = getDisplayStatus(inv, now, linked);
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
                    {issued != null
                      ? ` · ${moment(issued).format(dateFormat)}`
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
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="link"
        className="px-0"
        onClick={() => dispatch(UIActions.changeActiveTab('invoices'))}
      >
        {t('dashboard:recent:viewAll')}
      </Button>
    </div>
  );
}
