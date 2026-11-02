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

export default function InvoicesEmpty({ variant, t, onClearFilters }) {
  const dispatch = useDispatch();

  if (variant === 'noResults') {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('invoices:empty:noResults')}</EmptyTitle>
          <EmptyDescription>
            {t('invoices:empty:noResultsDescription')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" onClick={onClearFilters}>
            {t('invoices:empty:clearFilters')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>{t('invoices:empty:title')}</EmptyTitle>
        <EmptyDescription>{t('invoices:empty:description')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" onClick={() => dispatch(UIActions.newInvoice())}>
          {t('invoices:newInvoice')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
