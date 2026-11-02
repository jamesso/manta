import React, { useEffect, useSyncExternalStore } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCurrent, resolveCurrent, subscribe } from '@/lib/dialog';
import sounds from '../../../libs/sounds';
import i18n from '../../../i18n/i18n';
import { CircleX, Info, TriangleAlert } from 'lucide-react';

function dialogIcon(current) {
  if (current.kind === 'alert' && current.type === 'warning') {
    return <TriangleAlert className="size-6" />;
  }
  if (current.kind === 'alert' && current.type === 'error') {
    return <CircleX className="size-6" />;
  }
  return <Info className="size-6" />;
}

export default function DialogHost() {
  const current = useSyncExternalStore(subscribe, getCurrent);

  useEffect(() => {
    if (current?.id) sounds.play('DIALOG');
  }, [current?.id]);

  if (!current) return null;

  const requestId = current.id;
  const isConfirm = current.kind === 'confirm';

  return (
    <AlertDialog
      open
      onOpenChange={open => {
        if (!open) resolveCurrent(false, requestId);
      }}
      key={requestId}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>{dialogIcon(current)}</AlertDialogMedia>
          <AlertDialogTitle>{current.title}</AlertDialogTitle>
          <AlertDialogDescription className="max-h-60 overflow-auto whitespace-pre-wrap">
            {current.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isConfirm ? (
            <>
              <AlertDialogCancel
                onClick={() => resolveCurrent(false, requestId)}
              >
                {current.cancelLabel ?? i18n.t('common:cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                variant={current.destructive ? 'destructive' : 'default'}
                onClick={() => resolveCurrent(true, requestId)}
              >
                {current.confirmLabel ?? i18n.t('common:ok')}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction
              onClick={() => resolveCurrent(undefined, requestId)}
            >
              {i18n.t('common:ok')}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
