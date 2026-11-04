import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetBody,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUT_GROUPS } from '../../constants/shortcuts';
import * as UIActions from '../../actions/ui';

export default function ShortcutsDialog() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const open = useSelector(s => s.ui.shortcutsOpen);
  const isMac = window.manta.platform === 'darwin';

  return (
    <Sheet
      open={open}
      onOpenChange={v => dispatch(UIActions.setShortcutsDialog(v))}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{t('app:shortcuts:title')}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {SHORTCUT_GROUPS.map(({ group, items }) => (
            <section key={group}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                {t(group)}
              </h3>
              <ul className="space-y-2">
                {items.map(item => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span>{t(item.label)}</span>
                    <Kbd>{isMac ? item.mac : item.other}</Kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
