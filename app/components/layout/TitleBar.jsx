import React from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PanelLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import * as UIActions from '../../actions/ui';

const modKey = window.manta.platform === 'darwin' ? '⌘' : 'Ctrl+';

function ToolbarButton({ label, shortcut, onClick, children }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={onClick}
            className="bg-transparent text-foreground/70 hover:bg-foreground/[0.08] dark:bg-transparent dark:hover:bg-foreground/[0.11]"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <Kbd className="ms-1.5">{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

// Window toolbar: spans the full width above the sidebar and the page panel.
export default function TitleBar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { toggleSidebar } = useSidebar();

  return (
    <header className="titlebar titlebar-inset titlebar-mac-traffic drag-region grid h-12 shrink-0 grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-3 bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-1.5">
        <ToolbarButton
          label={t('app:nav:toggleSidebar')}
          onClick={toggleSidebar}
        >
          <PanelLeft className="rtl:rotate-180" />
        </ToolbarButton>
      </div>
      <button
        type="button"
        onClick={() => dispatch(UIActions.setCommandPalette(true))}
        className="group flex h-8 w-full min-w-0 items-center gap-2 rounded-full bg-foreground/[0.045] px-3 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.08] dark:bg-foreground/[0.07] dark:hover:bg-foreground/[0.1]"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{t('app:nav:searchPlaceholder')}</span>
        <Kbd aria-hidden className="ms-auto bg-foreground/[0.06]">
          {modKey}K
        </Kbd>
      </button>
      <div />
    </header>
  );
}
