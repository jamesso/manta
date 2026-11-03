import { AlertTriangle, Clock, PencilLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function greetingKey(hour) {
  if (hour < 5 || hour >= 18) return 'evening';
  if (hour < 12) return 'morning';
  return 'afternoon';
}

function Pill({ icon: Icon, className, children }) {
  return (
    <span
      className={`mx-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 align-baseline text-sm font-medium ${className}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

// One line that tells the user what needs work today.
export default function GreetingSummary({ now, overdue, outstanding, drafts }) {
  const { t } = useTranslation();
  const greeting = t(
    `dashboard:greeting:${greetingKey(new Date(now).getHours())}`
  );

  const pills = [];
  if (overdue > 0) {
    pills.push(
      <Pill
        key="overdue"
        icon={AlertTriangle}
        className="bg-status-overdue-bg text-status-overdue"
      >
        {t('dashboard:greeting:overdue', { count: overdue })}
      </Pill>
    );
  }
  if (outstanding > 0) {
    pills.push(
      <Pill
        key="outstanding"
        icon={Clock}
        className="bg-status-pending-bg text-status-pending"
      >
        {t('dashboard:greeting:outstanding', { count: outstanding })}
      </Pill>
    );
  }
  if (drafts > 0) {
    pills.push(
      <Pill
        key="drafts"
        icon={PencilLine}
        className="bg-status-draft-bg text-status-draft"
      >
        {t('dashboard:greeting:drafts', { count: drafts })}
      </Pill>
    );
  }

  return (
    <div className="rounded-2xl border bg-card px-5 py-3.5 text-[0.9375rem] leading-8 font-medium shadow-xs">
      {pills.length === 0 ? (
        t('dashboard:greeting:clear', { greeting })
      ) : (
        <>
          {t('dashboard:greeting:lead', { greeting })}{' '}
          {pills.map((pill, i) => (
            <span key={pill.key}>
              {i > 0 && i === pills.length - 1 ? (
                <span className="text-muted-foreground">
                  {' '}
                  {t('dashboard:greeting:and')}{' '}
                </span>
              ) : i > 0 ? (
                ' '
              ) : null}
              {pill}
            </span>
          ))}
        </>
      )}
    </div>
  );
}
