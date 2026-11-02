import {
  Ban,
  ChartPie,
  CircleAlert,
  CircleCheck,
  Clock,
  PencilLine,
  Undo2,
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
};

const STATUS_ICONS = {
  draft: PencilLine,
  pending: Clock,
  partial: ChartPie,
  overdue: CircleAlert,
  paid: CircleCheck,
  refunded: Undo2,
  cancelled: Ban,
};

export default function StatusBadge({ status, t }) {
  const display = status;
  const Icon = STATUS_ICONS[display] || Clock;
  return (
    <Badge
      variant="outline"
      className={STATUS_STYLES[display] || STATUS_STYLES.pending}
    >
      <Icon aria-hidden className="size-3" />
      {t(`invoices:status:${display}`)}
    </Badge>
  );
}
