import {
  Ban,
  CalendarX,
  ChartPie,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  PencilLine,
  Send,
  Undo2,
  ArrowRightLeft,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';

const STATUS_STYLES = {
  draft: 'bg-status-draft-bg text-status-draft',
  pending: 'bg-status-pending-bg text-status-pending',
  partial: 'bg-status-partial-bg text-status-partial',
  overdue: 'bg-status-overdue-bg text-status-overdue',
  paid: 'bg-status-paid-bg text-status-paid',
  refunded: 'bg-status-refunded-bg text-status-refunded',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled',
  sent: 'bg-status-pending-bg text-status-pending',
  accepted: 'bg-status-paid-bg text-status-paid',
  declined: 'bg-status-cancelled-bg text-status-cancelled',
  expired: 'bg-status-overdue-bg text-status-overdue',
  converted: 'bg-status-refunded-bg text-status-refunded',
};

const STATUS_ICONS = {
  draft: PencilLine,
  pending: Clock,
  partial: ChartPie,
  overdue: CircleAlert,
  paid: CircleCheck,
  refunded: Undo2,
  cancelled: Ban,
  sent: Send,
  accepted: CircleCheck,
  declined: CircleX,
  expired: CalendarX,
  converted: ArrowRightLeft,
  issued: CircleCheck,
  void: Ban,
};

const ESTIMATE_STATUSES = new Set([
  'sent',
  'accepted',
  'declined',
  'expired',
  'converted',
]);

export default function StatusBadge({ status, t, docType = 'invoice' }) {
  const display = status;
  const Icon = STATUS_ICONS[display] || Clock;
  let labelKey = `invoices:status:${display}`;
  if (ESTIMATE_STATUSES.has(display)) {
    labelKey = `estimates:status:${display}`;
  } else if (docType === 'creditNote') {
    labelKey = `invoices:creditNotes:status:${display}`;
  }
  return (
    <Badge
      variant="outline"
      className={STATUS_STYLES[display] || STATUS_STYLES.pending}
    >
      <Icon aria-hidden className="size-3" />
      {t(labelKey)}
    </Badge>
  );
}
