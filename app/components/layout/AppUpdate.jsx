import React from 'react';
import i18n from '../../../i18n/i18n';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Download, RefreshCw } from 'lucide-react';
import { useUpdate } from './UpdateProvider';

export default function AppUpdate() {
  const { checking, downloading, progress, checkForUpdates } = useUpdate();

  const label = checking
    ? i18n.t('app:update:checking')
    : downloading
      ? i18n.t('app:update:downloading', {
          percent: Math.round(progress || 0),
        })
      : i18n.t('app:update:check');

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={label}
        disabled={checking || downloading}
        onClick={checkForUpdates}
      >
        {downloading ? (
          <Download />
        ) : (
          <RefreshCw className={checking ? 'animate-spin' : undefined} />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate">{label}</span>
          {downloading && (
            <div className="group-data-[collapsible=icon]:hidden h-1 rounded bg-sidebar-accent">
              <div
                className="h-1 rounded bg-primary"
                style={{ width: `${progress || 0}%` }}
              />
            </div>
          )}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
