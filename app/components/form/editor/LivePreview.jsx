import React, { useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { getSavedSettings } from '../../../reducers/SettingsReducer';
import { formToPreviewInvoice } from '../../../helpers/preview';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import InvoicePaper from '../../preview/InvoicePaper';
import { safeCurrencyFraction } from './formatAmount';

export default function LivePreview() {
  const form = useSelector(state => state.form);
  const debouncedForm = useDebouncedValue(form);
  const saved = useSelector(getSavedSettings);
  const nowRef = useRef(new Date(new Date().setHours(0, 0, 0, 0)).getTime());

  const preview = useMemo(() => {
    if (!saved?.invoice) return null;
    const next = formToPreviewInvoice(debouncedForm, {
      invoiceSettings: saved.invoice,
      generalSettings: saved.general,
      profile: saved.profile,
      now: nowRef.current,
    });
    const { invoice } = next;
    return {
      ...next,
      invoice: {
        ...invoice,
        currency: {
          ...invoice.currency,
          fraction: safeCurrencyFraction(invoice.currency?.fraction),
        },
      },
    };
  }, [debouncedForm, saved]);

  if (!preview) {
    return null;
  }

  const { invoice, configs, profile } = preview;

  return (
    <div className="h-full">
      <InvoicePaper
        invoice={invoice}
        configs={configs}
        profile={profile}
        UILang={saved.general?.language ?? 'en'}
        resetKey={debouncedForm}
      />
    </div>
  );
}
