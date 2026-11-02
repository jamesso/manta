import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../i18n/i18n';
import { getSavedSettings } from '../../../reducers/SettingsReducer';
import { formToPreviewInvoice } from '../../../helpers/preview';
import { InvoiceTemplate } from '../../../../preview/templates';
import ErrorBoundary from '../../shared/ErrorBoundary';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { safeCurrencyFraction } from './formatAmount';

const PAPER_WIDTH = 794;
const PAPER_HEIGHT = 1123;

export default function LivePreview() {
  const { t } = useTranslation();
  const form = useSelector(state => state.form);
  const debouncedForm = useDebouncedValue(form);
  const saved = useSelector(getSavedSettings);
  const nowRef = useRef(new Date(new Date().setHours(0, 0, 0, 0)).getTime());
  const containerRef = useRef(null);
  const [width, setWidth] = useState(PAPER_WIDTH);
  const paperRef = useRef(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width ?? PAPER_WIDTH;
      setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) return undefined;
    const check = () =>
      setOverflow(paper.scrollHeight > paper.clientHeight + 1);
    const observer = new ResizeObserver(check);
    observer.observe(paper);
    if (paper.firstElementChild) observer.observe(paper.firstElementChild);
    check();
    return () => observer.disconnect();
  }, [debouncedForm, saved]);

  const scale = Math.max(0.01, Math.min(1, (width - 32) / PAPER_WIDTH));

  const preview = useMemo(() => {
    if (!saved?.invoice) return null;
    return formToPreviewInvoice(debouncedForm, {
      invoiceSettings: saved.invoice,
      generalSettings: saved.general,
      profile: saved.profile,
      now: nowRef.current,
    });
  }, [debouncedForm, saved]);

  if (!preview) {
    return null;
  }

  const { invoice, configs, profile } = preview;
  const displayInvoice = {
    ...invoice,
    currency: {
      ...invoice.currency,
      fraction: safeCurrencyFraction(invoice.currency?.fraction),
    },
  };
  const UILang = saved.general?.language ?? 'en';

  return (
    <div ref={containerRef} className="h-full p-4">
      <div
        className="relative mx-auto overflow-hidden shadow-md"
        style={{
          width: PAPER_WIDTH * scale,
          height: PAPER_HEIGHT * scale,
        }}
      >
        <div
          ref={paperRef}
          className="flex w-[21cm] h-[29.7cm] origin-top-left bg-white text-neutral-900 [color-scheme:light]"
          style={{ transform: `scale(${scale})` }}
        >
          <ErrorBoundary
            resetKey={debouncedForm}
            fallback={<p className="p-4 text-sm">{t('form:preview:error')}</p>}
          >
            <InvoiceTemplate
              invoice={displayInvoice}
              profile={profile}
              configs={configs}
              t={i18n.t.bind(i18n)}
              UILang={UILang}
            />
          </ErrorBoundary>
        </div>
      </div>
      {overflow ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('form:preview:overflow')}
        </p>
      ) : null}
    </div>
  );
}
