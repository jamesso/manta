import moment from 'moment';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetDetail,
  SheetDetails,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle,
  useSheetValue,
} from '@/components/ui/sheet';
import {
  formatInvoiceAmount,
  getDisplayStatus,
  getInvoiceNumber,
  getIssuedAt,
} from '../../helpers/invoice';
import { groupCreditNotesByInvoice } from '../../helpers/creditNotes';
import { getAllSalesDocs } from '../../reducers/InvoicesReducer';
import * as InvoicesActions from '../../actions/invoices';
import StatusBadge from '../invoices/StatusBadge';
import { useNow } from '../invoices/useNow';

function formatOutstandingLines(outstanding, invoices) {
  return Object.keys(outstanding).map(code => {
    const amount = outstanding[code];
    const ref = invoices.find(inv => (inv.currency?.code ?? 'USD') === code);
    const currency = ref?.currency ?? {
      code,
      fraction: 2,
      separator: 'commaDot',
      placement: 'before',
    };
    return formatInvoiceAmount({ grandTotal: amount, currency });
  });
}

export default function ClientDetailSheet({
  contact: openContact,
  summary: openSummary,
  open,
  onOpenChange,
  dateFormat,
  onEdit,
  onOpenInvoice,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const now = useNow();
  const allSalesDocs = useSelector(getAllSalesDocs) ?? [];
  const contact = useSheetValue(open, openContact);
  const summary = useSheetValue(open, openSummary);

  // Stay mounted while closed so the sheet slides in when it opens.
  if (!contact || !summary) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const outstandingLines = formatOutstandingLines(
    summary.outstanding,
    summary.invoices
  );
  const creditByInvoice = groupCreditNotesByInvoice(allSalesDocs);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{contact.fullname}</SheetTitle>
          {contact.company || contact.taxId ? (
            <SheetDescription>
              {[contact.company, contact.taxId].filter(Boolean).join(' · ')}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <SheetBody>
          <SheetSection>
            <SheetDetails>
              <SheetDetail label={t('contacts:fields:email')}>
                {contact.email || '—'}
              </SheetDetail>
              <SheetDetail label={t('contacts:fields:phone')}>
                {contact.phone || '—'}
              </SheetDetail>
              <SheetDetail label={t('contacts:detail:outstanding')}>
                {outstandingLines.length ? (
                  outstandingLines.map(line => (
                    <div key={line} className="tabular-nums">
                      {line}
                    </div>
                  ))
                ) : (
                  <div>—</div>
                )}
              </SheetDetail>
            </SheetDetails>
            <p className="text-sm text-muted-foreground">
              {t('contacts:editor:hint')}
            </p>
          </SheetSection>
          <SheetSection title={t('contacts:fields:invoices')}>
            {summary.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('contacts:detail:noInvoices')}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {summary.invoices.map(invoice => {
                  const issued = getIssuedAt(invoice);
                  const linked = creditByInvoice.get(invoice._id) ?? [];
                  const issuedLabel = issued
                    ? moment(issued).format(dateFormat)
                    : '—';
                  return (
                    <li key={invoice._id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-start text-foreground hover:bg-muted/50"
                        onClick={() => onOpenInvoice(invoice._id)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">
                            {getInvoiceNumber(invoice)}
                          </span>
                          <span className="ms-2 text-muted-foreground">
                            {issuedLabel}
                          </span>
                        </span>
                        <StatusBadge
                          status={getDisplayStatus(invoice, now, linked)}
                          t={t}
                        />
                        <span className="shrink-0 tabular-nums">
                          {formatInvoiceAmount(invoice)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SheetSection>
        </SheetBody>
        <SheetFooter>
          <SheetClose render={<Button type="button" variant="ghost" />}>
            {t('common:close')}
          </SheetClose>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              dispatch(InvoicesActions.newInvoiceFromContact(contact))
            }
          >
            {t('contacts:detail:newInvoice')}
          </Button>
          <Button type="button" onClick={() => onEdit(contact)}>
            {t('contacts:detail:edit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
