import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export default function ItemsEmpty({ variant, onNew }) {
  const { t } = useTranslation();

  if (variant === 'noArchived') {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('items:empty:noArchived')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Package />
        </EmptyMedia>
        <EmptyTitle>{t('items:empty:title')}</EmptyTitle>
        <EmptyDescription>{t('items:empty:description')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" onClick={onNew}>
          {t('items:new')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
