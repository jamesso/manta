import { useTranslation } from 'react-i18next';

import { AlertCircle, AlertTriangle } from 'lucide-react';

const FIX_ORDER = ['profile', 'bank', 'client', 'invoice', 'taxRates'];

export default function EInvoiceChecklist({
  issues,
  onCopyClient,
  copyClientVisible,
}) {
  const { t } = useTranslation();
  if (!issues?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('common:einvoice.readyHint')}
      </p>
    );
  }

  const groups = FIX_ORDER.map(fix => ({
    fix,
    items: issues.filter(i => i.fix === fix),
  })).filter(g => g.items.length);

  return (
    <ul className="space-y-3 text-sm">
      {groups.map(group => (
        <li key={group.fix}>
          <p className="font-medium text-foreground">
            {t(`common:einvoice.fixGroups.${group.fix}`)}
          </p>
          <ul className="mt-1 space-y-2">
            {group.items.map(item => (
              <li
                key={`${item.code}-${item.field}`}
                className="flex gap-2 text-foreground"
              >
                {item.severity === 'error' ? (
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <span>
                  {t(`common:einvoice.issues.${item.code}`, {
                    defaultValue: item.code,
                  })}
                  {item.rule ? (
                    <span className="block text-xs text-muted-foreground">
                      {item.rule}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {group.fix === 'client' && copyClientVisible && onCopyClient ? (
            <button
              type="button"
              className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={onCopyClient}
            >
              {t('common:einvoice.copyClientDetails')}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
