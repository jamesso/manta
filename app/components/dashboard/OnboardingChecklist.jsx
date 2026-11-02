import { Circle, CircleCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import * as SettingsActions from '../../actions/settings';
import * as UIActions from '../../actions/ui';
import { getRecentInvoices } from '../../helpers/dashboard';

const ipc = window.manta.ipc;

export default function OnboardingChecklist({
  checklist,
  invoices,
  onDismiss,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const newest = getRecentInvoices(invoices, 1)[0];

  const goSettings = () => {
    dispatch(UIActions.changeActiveTab('settings'));
    dispatch(UIActions.requestSettingsSection('profile'));
  };

  const links = {
    profile: goSettings,
    logo: goSettings,
    client: () => dispatch(UIActions.changeActiveTab('contacts')),
    invoice: () => dispatch(UIActions.newInvoice()),
    pdf: () => {
      if (newest) {
        ipc.send('preview-invoice', newest);
      }
    },
  };

  const handleDismiss = () => {
    dispatch(SettingsActions.updateOnboarding({ dismissed: true }));
    onDismiss?.();
    toast.add({
      title: t('dashboard:checklist:toastHidden'),
      actionProps: {
        children: t('dashboard:checklist:undo'),
        onClick: () =>
          dispatch(SettingsActions.updateOnboarding({ dismissed: false })),
      },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{t('dashboard:checklist:heading')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {checklist.allDone
              ? t('dashboard:checklist:allDone')
              : t('dashboard:checklist:progress', {
                  done: checklist.doneCount,
                  total: checklist.total,
                })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label={t('dashboard:checklist:dismiss')}
          onClick={handleDismiss}
        >
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ol aria-label="Setup steps" className="space-y-3">
          {checklist.items.map(item => {
            const done = item.done;
            const Icon = done ? CircleCheck : Circle;
            const label = t(`dashboard:checklist:items:${item.id}`);
            const linkLabel = t(`dashboard:checklist:links:${item.id}`);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <Icon
                  className={
                    done
                      ? 'size-5 text-status-paid'
                      : 'size-5 text-muted-foreground'
                  }
                  aria-hidden
                />
                <span className={done ? 'text-muted-foreground' : ''}>
                  {label}
                </span>
                {!done && item.id === 'pdf' && !newest ? (
                  <span className="text-xs text-muted-foreground">
                    ({t('dashboard:checklist:pdfHint')})
                  </span>
                ) : null}
                {!done && (item.id !== 'pdf' || newest) ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto min-h-6 px-1 py-0"
                    disabled={item.id === 'pdf' && !newest}
                    onClick={links[item.id]}
                  >
                    {linkLabel}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
