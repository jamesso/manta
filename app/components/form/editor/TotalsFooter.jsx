import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { saveFormData } from '../../../actions/form';
import { formToPreviewInvoice } from '../../../helpers/preview';
import { getCreditableAmount } from '../../../helpers/creditNotes';
import { getAllSalesDocs } from '../../../reducers/InvoicesReducer';
import {
  getInvoiceTotals,
  getAmountPaid,
  getBalanceDue,
  getPayments,
} from '../../../helpers/invoice';
import { formatAmount } from './formatAmount';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
export default function TotalsFooter() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const form = useSelector(state => state.form);
  const allDocs = useSelector(getAllSalesDocs);
  const saved = useSelector(state => state.settings.saved);
  const invoiceSettings = saved?.invoice ?? form.savedSettings;
  const generalSettings = saved?.general ?? { language: 'en' };
  const profile = saved?.profile ?? {};
  const { invoice } = formToPreviewInvoice(form, {
    invoiceSettings,
    generalSettings,
    profile,
    now: Date.now(),
  });
  const totals = getInvoiceTotals(invoice);
  const currency = invoice.currency || {};
  const fields = form.settings.required_fields;
  const lineTaxLines =
    form.taxMode === 'line' && fields.tax
      ? totals.taxBreakdown.map(group => [
          `tax-${group.key}`,
          group.amount,
          group,
        ])
      : [];
  const draftAvailable =
    !form.settings.editMode.active ||
    form.settings.editMode.data?.status === 'draft';
  const lines = [
    ['subtotal', totals.subtotal],
    ...(fields.discount ? [['discount', totals.discount]] : []),
    ...(form.taxMode === 'invoice' && fields.tax
      ? [['tax', totals.taxTotal]]
      : []),
    ...lineTaxLines,
    ['total', totals.grandTotal],
  ];
  const isCreditNote = form.docType === 'creditNote';
  const editData = form.settings.editMode.active
    ? form.settings.editMode.data
    : null;
  const excludeId = editData?._id;
  let remainingLine = null;
  let totalOverCredit = false;
  if (isCreditNote && form.creditedInvoiceId) {
    const original = allDocs.find(d => d._id === form.creditedInvoiceId);
    const linked = allDocs.filter(
      d =>
        d.docType === 'creditNote' &&
        d.creditedInvoiceId === form.creditedInvoiceId
    );
    if (original) {
      const remaining = getCreditableAmount(original, linked, { excludeId });
      remainingLine = remaining;
      totalOverCredit = totals.grandTotal > remaining;
    }
  }
  const paymentInvoice =
    editData && getPayments(editData).length > 0
      ? { ...invoice, payments: editData.payments }
      : null;
  const extraLines =
    form.docType !== 'estimate' &&
    paymentInvoice &&
    getAmountPaid(paymentInvoice) > 0
      ? [
          ['amountPaid', getAmountPaid(paymentInvoice)],
          ['balanceDue', getBalanceDue(paymentInvoice)],
        ]
      : [];
  return (
    <footer className="sticky bottom-0 border-t bg-background p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {lines.map(([name, value, group]) => (
            <React.Fragment key={name}>
              <span>
                {group
                  ? `${t(`preview:tax:category:${group.category}`)} ${group.rate}% · ${t('preview:tax:on', { amount: formatAmount(group.base, currency) })}`
                  : t(`form:totals:${name}`)}
              </span>
              <span
                className={`text-end tabular-nums${name === 'total' && totalOverCredit ? ' text-destructive' : ''}`}
              >
                {currency.code} {formatAmount(value, currency)}
              </span>
            </React.Fragment>
          ))}
          {remainingLine != null ? (
            <React.Fragment key="remaining">
              <span>{t('form:creditNote:remaining')}</span>
              <span className="text-end tabular-nums">
                {currency.code} {formatAmount(remainingLine, currency)}
              </span>
            </React.Fragment>
          ) : null}
          {extraLines.map(([name, value]) => (
            <React.Fragment key={name}>
              <span>{t(`form:totals:${name}`)}</span>
              <span className="text-end tabular-nums">
                {currency.code} {formatAmount(value, currency)}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div className="flex flex-col items-end gap-2">
          {form.errors.creditTotal ? (
            <FieldError>{t(form.errors.creditTotal)}</FieldError>
          ) : null}
          <div className="flex gap-2">
            {draftAvailable && (
              <Button
                variant="outline"
                disabled={form.savePending}
                onClick={() => dispatch(saveFormData('draft'))}
              >
                {t('form:header:btns:saveDraft')}
              </Button>
            )}
            <Button
              disabled={form.savePending}
              onClick={() => dispatch(saveFormData('final'))}
            >
              {t(
                isCreditNote
                  ? 'form:header:btns:issueCreditNote'
                  : draftAvailable
                    ? 'form:header:btns:saveAndPreview'
                    : 'form:header:btns:update'
              )}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
