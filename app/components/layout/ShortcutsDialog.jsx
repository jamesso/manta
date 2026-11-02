import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { SHORTCUT_GROUPS } from '../../constants/shortcuts';
import * as UIActions from '../../actions/ui';

export default function ShortcutsDialog() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const open = useSelector(s => s.ui.shortcutsOpen);
  const isMac = window.manta.platform === 'darwin';

  return (
    <Dialog
      open={open}
      onOpenChange={v => dispatch(UIActions.setShortcutsDialog(v))}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('app:shortcuts:title')}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-6 overflow-auto pe-1">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
