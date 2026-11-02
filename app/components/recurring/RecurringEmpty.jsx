import { useTranslation } from 'react-i18next';
import { Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export default function RecurringEmpty({ onNew }) {
  const { t } = useTranslation();
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Repeat />
        </EmptyMedia>
        <EmptyTitle>{t('recurring:empty:title')}</EmptyTitle>
        <EmptyDescription>{t('recurring:empty:description')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" onClick={onNew}>
          {t('recurring:header:new')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
