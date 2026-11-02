import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { saveFormData } from '../../../actions/form';
import { formToPreviewInvoice } from '../../../helpers/preview';
import { getInvoiceValue } from '../../../helpers/invoice';
import { formatAmount } from './formatAmount';
import { Button } from '@/components/ui/button';
export default function TotalsFooter() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const form = useSelector(state => state.form);
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
  const totals = getInvoiceValue(invoice);
  const currency = invoice.currency || {};
  const fields = form.settings.required_fields;
  const draftAvailable =
    !form.settings.editMode.active ||
    form.settings.editMode.data?.status === 'draft';
  const lines = [
    ['subtotal', totals.subtotal],
    ...(fields.discount ? [['discount', totals.discount]] : []),
    ...(fields.tax ? [['tax', totals.taxAmount]] : []),
    ['total', totals.grandTotal],
  ];
  return (
    <footer className="sticky bottom-0 border-t bg-background p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {lines.map(([name, value]) => (
            <React.Fragment key={name}>
              <span>{t(`form:totals:${name}`)}</span>
              <span className="text-end tabular-nums">
                {currency.code} {formatAmount(value, currency)}
              </span>
            </React.Fragment>
          ))}
        </div>
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
              draftAvailable
                ? 'form:header:btns:saveAndPreview'
                : 'form:header:btns:update'
            )}
          </Button>
        </div>
      </div>
    </footer>
  );
}
