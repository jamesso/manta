import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  CircleHelp,
  FileText,
  Plus,
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
              isActive={activeTab === 'form'}
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
                tab: 'invoices',
                label: t('app:nav:invoices'),
                icon: FileText,
                badge: overdue,
                tooltipExtra:
                  overdue > 0
                    ? ` · ${t('invoices:nav:overdueBadge', { count: overdue })}`
                    : '',
              },
              { tab: 'contacts', label: t('app:nav:clients'), icon: Users },
              { tab: 'settings', label: t('app:nav:settings'), icon: Settings },
            ].map(({ tab, label, icon: Icon, badge, tooltipExtra }) => (
              <SidebarMenuItem key={tab}>
                <SidebarMenuButton
                  isActive={activeTab === tab}
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
                <DropdownMenuItem onClick={() => ipc.send('start-tour')}>
                  {t('app:nav:tutorial')}
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
