import { Button } from '@/components/ui/button';
import { deleteInvoice, setInvoiceStatus } from '../../actions/invoices';

export default function BulkActionsBar({
  selectedIds,
  t,
  dispatch,
  onClearSelection,
}) {
  if (!selectedIds.length) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t('invoices:bulk:label')}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2"
    >
      <span className="text-sm text-muted-foreground">
        {t('invoices:bulk:selected', { count: selectedIds.length })}
      </span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => {
          dispatch(setInvoiceStatus(selectedIds, 'paid'));
          onClearSelection();
        }}
      >
        {t('invoices:bulk:markAsPaid')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => {
          dispatch(deleteInvoice(selectedIds));
          onClearSelection();
        }}
      >
        {t('invoices:bulk:delete')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onClearSelection}
      >
        {t('invoices:bulk:clear')}
      </Button>
    </div>
  );
}
