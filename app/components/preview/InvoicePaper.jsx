import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n/i18n';
import { InvoiceTemplate } from '../../../preview/templates';
import ErrorBoundary from '../shared/ErrorBoundary';

const PAPER_WIDTH = 794;
const PAPER_HEIGHT = 1123;

// One A4 page of the invoice, scaled down to fit the width of its container.
export default function InvoicePaper({
  invoice,
  configs,
  profile,
  UILang,
  resetKey,
}) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const paperRef = useRef(null);
  const [width, setWidth] = useState(PAPER_WIDTH);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0]?.contentRect?.width ?? PAPER_WIDTH);
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
  }, [invoice, configs, profile]);

  const scale = Math.max(0.01, Math.min(1, (width - 32) / PAPER_WIDTH));

  return (
    <div ref={containerRef} className="p-4">
      <div
        className="relative mx-auto overflow-hidden shadow-md"
        style={{ width: PAPER_WIDTH * scale, height: PAPER_HEIGHT * scale }}
      >
        <div
          className="origin-top-left"
          style={{ transform: `scale(${scale})` }}
        >
          <div ref={paperRef} className="paper [color-scheme:light]" dir="ltr">
            <ErrorBoundary
              resetKey={resetKey}
              fallback={
                <p className="p-4 text-sm">{t('form:preview:error')}</p>
              }
            >
              <InvoiceTemplate
                invoice={invoice}
                profile={profile}
                configs={configs}
                t={i18n.t.bind(i18n)}
                UILang={UILang}
              />
            </ErrorBoundary>
          </div>
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
