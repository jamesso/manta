import moment from 'moment';

export default function DueCell({ row, t, dateFormat }) {
  const { dueAt, dueInDays, displayStatus } = row.original;
  const invoice = row.original.invoice;
  const fmt = invoice.configs?.dateFormat ?? dateFormat;

  if (dueAt == null) {
    return (
      <div>
        <div>{t('invoices:due:none')}</div>
      </div>
    );
  }

  let relative = null;
  if (displayStatus === 'pending' || displayStatus === 'overdue') {
    if (dueInDays === 0) {
      relative = t('invoices:due:today');
    } else if (dueInDays > 0) {
      relative = t('invoices:due:inDays', { count: dueInDays });
    } else {
      relative = (
        <span className="text-status-overdue">
          {t('invoices:due:overdueDays', { count: -dueInDays })}
        </span>
      );
    }
  }

  return (
    <div>
      <div>{moment(dueAt).format(fmt)}</div>
      {relative ? (
        <div className="text-xs text-muted-foreground">{relative}</div>
      ) : null}
    </div>
  );
}
