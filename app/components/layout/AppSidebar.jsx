import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  ChevronsUpDown,
  CircleHelp,
  FileText,
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
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Kbd } from '@/components/ui/kbd';
import * as UIActions from '../../actions/ui';
import AppUpdate from './AppUpdate';
import { getOverdueCount } from '../../reducers/InvoicesReducer';
import { useNow } from '../invoices/useNow';

const ipc = window.manta.ipc;
const modKey = window.manta.platform === 'darwin' ? '⌘' : 'Ctrl+';

export default function AppSidebar({ activeTab }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const profile = useSelector(s => s.settings.saved?.profile) || {};
  const formDocType = useSelector(s => s.form?.docType || 'invoice');
  const now = useNow();
  const overdue = useSelector(state => getOverdueCount(state, now));

  const displayName = profile.company || profile.fullname || 'Manta';
  const fallbackLetter = (displayName.trim()[0] || 'M').toUpperCase();

  const changeTab = tab => dispatch(UIActions.changeActiveTab(tab));

  const isActive = tab =>
    activeTab === tab ||
    (tab === 'estimates' && activeTab === 'form' && formDocType === 'estimate');

  const renderItem = ({ tab, label, icon: Icon, badge, tooltipExtra }) => (
    <SidebarMenuItem key={tab}>
      <SidebarMenuButton
        isActive={isActive(tab)}
        tooltip={`${label}${tooltipExtra || ''}`}
        onClick={() => changeTab(tab)}
      >
        <Icon />
        <span>{label}</span>
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
    { tab: 'estimates', label: t('app:nav:estimates'), icon: FileText },
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
      <SidebarHeader className="pt-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeTab === 'form' && formDocType === 'invoice'}
              tooltip={t('app:nav:newInvoice')}
              onClick={() => dispatch(UIActions.newInvoice())}
              className="font-medium text-sidebar-accent-foreground [&_svg]:text-current! data-active:[&_svg]:text-current!"
            >
              <span className="-ms-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                <Plus className="size-3.5!" strokeWidth={2.5} />
              </span>
              <span>{t('app:nav:newInvoice')}</span>
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
          <AppUpdate />
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
          <SidebarMenuItem className="mt-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" tooltip={displayName} />}
              >
                <Avatar className="size-8 rounded-lg after:rounded-lg">
                  <AvatarImage
                    src={profile.logo}
                    alt=""
                    className="rounded-lg object-contain"
                  />
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                    {fallbackLetter}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-medium text-sidebar-accent-foreground">
                    {displayName}
                  </span>
                  {profile.email ? (
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {profile.email}
                    </span>
                  ) : null}
                </div>
                <ChevronsUpDown className="ms-auto size-4!" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem onClick={() => changeTab('settings')}>
                  {t('app:nav:businessProfile')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => dispatch(UIActions.setShortcutsDialog(true))}
                >
                  {t('app:nav:shortcuts')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => changeTab('settings')}>
                  <Settings />
                  {t('app:nav:settings')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
