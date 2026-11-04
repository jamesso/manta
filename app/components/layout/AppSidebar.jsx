import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Package,
  Plus,
  ReceiptText,
  Repeat,
  Settings,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import * as UIActions from '../../actions/ui';
import { getOverdueCount } from '../../reducers/InvoicesReducer';
import { useNow } from '../invoices/useNow';
import { getFormNavSection } from './navSection';

const ipc = window.manta.ipc;
const modKey = window.manta.platform === 'darwin' ? '⌘' : 'Ctrl+';

export default function AppSidebar({ activeTab }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const formDocType = useSelector(s => s.form?.docType || 'invoice');
  const templateTarget = useSelector(s => s.form?.templateTarget ?? null);
  const formEditActive = useSelector(
    s => s.form?.settings?.editMode?.active === true
  );
  const { isMobile } = useSidebar();
  const now = useNow();
  const overdue = useSelector(state => getOverdueCount(state, now));

  const changeTab = tab => dispatch(UIActions.changeActiveTab(tab));

  const formSection =
    activeTab === 'form'
      ? getFormNavSection({
          docType: formDocType,
          templateTarget,
          editActive: formEditActive,
        })
      : null;
  const isActive = tab => activeTab === tab || formSection === tab;

  const renderItem = ({ tab, label, icon: Icon, badge, tooltipExtra }) => (
    <SidebarMenuItem key={tab}>
      <SidebarMenuButton
        isActive={isActive(tab)}
        tooltip={`${label}${tooltipExtra || ''}`}
        onClick={() => changeTab(tab)}
      >
        <Icon />
        <span className="truncate">{label}</span>
        {badge > 0 ? (
          <span
            aria-label={t('invoices:nav:overdueBadge', { count: badge })}
            className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-status-overdue-bg px-1.5 text-[0.6875rem] font-semibold text-status-overdue tabular-nums group-data-[collapsible=icon]:hidden"
          >
            {badge}
          </span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const salesItems = [
    {
      tab: 'dashboard',
      label: t('app:nav:dashboard'),
      icon: LayoutDashboard,
    },
    {
      tab: 'invoices',
      label: t('app:nav:invoices'),
      icon: ReceiptText,
      badge: overdue,
      tooltipExtra:
        overdue > 0
          ? ` · ${t('invoices:nav:overdueBadge', { count: overdue })}`
          : '',
    },
    { tab: 'estimates', label: t('app:nav:estimates'), icon: ClipboardList },
    { tab: 'recurring', label: t('app:nav:recurring'), icon: Repeat },
  ];
  const libraryItems = [
    { tab: 'contacts', label: t('app:nav:clients'), icon: Users },
    { tab: 'items', label: t('app:nav:items'), icon: Package },
  ];

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="top-12! h-[calc(100svh-3rem)]! pt-0"
    >
      {isMobile ? (
        // The sheet starts at the window top: keep clear of the window controls.
        <div className="titlebar drag-region h-12 shrink-0" />
      ) : null}
      <SidebarHeader className="pt-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={formSection === 'newInvoice'}
              tooltip={t('app:nav:newInvoice')}
              onClick={() => dispatch(UIActions.newInvoice())}
              className="bg-background/60 font-medium text-sidebar-accent-foreground shadow-xs hover:bg-background hover:shadow-sm data-active:bg-background [&_svg]:text-current! data-active:[&_svg]:text-current! dark:bg-sidebar-accent/60 dark:hover:bg-sidebar-accent dark:data-active:bg-sidebar-accent"
            >
              <span className="-ms-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                <Plus className="size-3.5!" strokeWidth={2.5} />
              </span>
              <span className="truncate">{t('app:nav:newInvoice')}</span>
              <Kbd
                aria-hidden
                className="ms-auto bg-transparent text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden"
              >
                {modKey}N
              </Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="py-1">
          <SidebarMenu className="gap-0.5">
            {salesItems.map(renderItem)}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="py-1">
          <SidebarGroupLabel>{t('app:nav:library')}</SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {libraryItems.map(renderItem)}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="gap-0.5">
          {renderItem({
            tab: 'settings',
            label: t('app:nav:settings'),
            icon: Settings,
          })}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton tooltip={t('app:nav:help')} />}
              >
                <CircleHelp />
                <span>{t('app:nav:help')}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem
                  onClick={() => dispatch(UIActions.setShortcutsDialog(true))}
                >
                  {t('app:nav:shortcuts')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <a
                      href="https://github.com/jamesso/manta"
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  {t('app:nav:learnMore')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
