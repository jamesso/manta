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

export default function EstimatesEmpty({ t, dispatch }) {
  return (
    <Empty>
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
