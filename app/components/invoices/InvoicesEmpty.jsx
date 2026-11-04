import { FileText } from 'lucide-react';
import { useDispatch } from 'react-redux';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import * as UIActions from '../../actions/ui';

export default function InvoicesEmpty({ t, creditNotesTab }) {
  const dispatch = useDispatch();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>
          {t(
            creditNotesTab
              ? 'invoices:creditNotes:empty:title'
              : 'invoices:empty:title'
          )}
        </EmptyTitle>
        <EmptyDescription>
          {t(
            creditNotesTab
              ? 'invoices:creditNotes:empty:description'
              : 'invoices:empty:description'
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" onClick={() => dispatch(UIActions.newInvoice())}>
          {t('invoices:newInvoice')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
