import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  CircleHelp,
  FileText,
  LayoutDashboard,
  Package,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
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

  return (
    <Sidebar collapsible="icon">
      <div className="titlebar drag-region h-10 shrink-0" />
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" tooltip={displayName} />}
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage src={profile.logo} alt="" />
                  <AvatarFallback className="rounded-lg">
                    {fallbackLetter}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => changeTab('settings')}>
                  {t('app:nav:businessProfile')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => dispatch(UIActions.setShortcutsDialog(true))}
                >
                  {t('app:nav:shortcuts')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeTab === 'form' && formDocType === 'invoice'}
              tooltip={t('app:nav:newInvoice')}
              onClick={() => dispatch(UIActions.newInvoice())}
            >
              <Plus />
              <span>{t('app:nav:newInvoice')}</span>
              <Kbd
                aria-hidden
                className="ms-auto group-data-[collapsible=icon]:hidden"
              >
                {modKey}N
              </Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t('app:nav:search')}
              onClick={() => dispatch(UIActions.setCommandPalette(true))}
            >
              <Search />
              <span>{t('app:nav:search')}</span>
              <Kbd
                aria-hidden
                className="ms-auto group-data-[collapsible=icon]:hidden"
              >
                {modKey}K
              </Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {[
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
              {
                tab: 'estimates',
                label: t('app:nav:estimates'),
                icon: FileText,
              },
              { tab: 'contacts', label: t('app:nav:clients'), icon: Users },
              { tab: 'items', label: t('app:nav:items'), icon: Package },
              { tab: 'settings', label: t('app:nav:settings'), icon: Settings },
            ].map(({ tab, label, icon: Icon, badge, tooltipExtra }) => (
              <SidebarMenuItem key={tab}>
                <SidebarMenuButton
                  isActive={
                    activeTab === tab ||
                    (tab === 'estimates' &&
                      activeTab === 'form' &&
                      formDocType === 'estimate')
                  }
                  tooltip={`${label}${tooltipExtra || ''}`}
                  onClick={() => changeTab(tab)}
                >
                  <Icon />
                  <span>{label}</span>
                  {badge > 0 ? (
                    <SidebarMenuBadge
                      aria-label={t('invoices:nav:overdueBadge', {
                        count: badge,
                      })}
                      className="bg-status-overdue-bg text-status-overdue"
                    >
                      {badge}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <AppUpdate />
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
