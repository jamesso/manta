import { FileText } from 'lucide-react';

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

export default function EstimatesEmpty({
  variant,
  t,
  dispatch,
  onClearFilters,
}) {
  if (variant === 'noResults') {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>{t('estimates:empty:noResults')}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" onClick={onClearFilters}>
            {t('estimates:empty:clearFilters')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>{t('estimates:empty:title')}</EmptyTitle>
        <EmptyDescription>{t('estimates:empty:description')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" onClick={() => dispatch(UIActions.newEstimate())}>
          {t('estimates:newEstimate')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
