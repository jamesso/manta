import React from 'react';
import { InvoiceTemplate } from '../templates';

export default function MainContent({ t, invoice, configs, profile, UILang }) {
  return (
    <main className="min-w-0 flex-1 overflow-auto bg-muted/40 pt-8 pb-8">
      {invoice._id ? (
        <div className="print-area" data-invoice-id={invoice._id}>
          <div className="paper" dir="ltr">
            <InvoiceTemplate
              t={t}
              invoice={invoice}
              configs={configs}
              profile={profile}
              UILang={UILang}
            />
          </div>
        </div>
      ) : (
        <p className="flex h-full items-center justify-center text-xs tracking-wide text-foreground uppercase">
          {t('preview:common:chooseInvoiceToPreview', { lng: UILang })}
        </p>
      )}
    </main>
  );
}
