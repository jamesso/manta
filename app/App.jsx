import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as UIActions from './actions/ui';
import * as FormActions from './actions/form';
import * as SettingsActions from './actions/settings';
import * as InvoicesActions from './actions/invoices';
import * as ContactsActions from './actions/contacts';
import * as ItemsActions from './actions/items';
import * as RecurringActions from './actions/recurring';
import AppMain from './components/layout/AppMain';
import AppSidebar from './components/layout/AppSidebar';
import TitleBar from './components/layout/TitleBar';
import CommandPalette from './components/layout/CommandPalette';
import ShortcutsDialog from './components/layout/ShortcutsDialog';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useMediaQuery } from '@/hooks/use-media-query';
import { startRecurringScheduler } from './helpers/recurringScheduler';

const ipc = window.manta.ipc;

const MENU_CHANNELS = [
  'menu-change-tab',
  'menu-new-invoice',
  'menu-open-command-palette',
  'menu-show-shortcuts',
  'menu-form-save',
  'menu-form-clear',
  'menu-form-add-item',
  'menu-form-toggle-dueDate',
  'menu-form-toggle-currency',
  'menu-form-toggle-vat',
  'menu-form-toggle-discount',
  'menu-form-toggle-note',
  'menu-form-toggle-settings',
  'save-configs-to-invoice',
  'onboarding-updated',
];

function App() {
  const dispatch = useDispatch();
  const activeTab = useSelector(s => s.ui.activeTab);
  const collapsedPref = useSelector(s => s.ui.sidebarCollapsed);
  const isNarrow = useMediaQuery('(max-width: 899px)');
  const [narrowOpen, setNarrowOpen] = useState(false);

  useEffect(() => {
    if (isNarrow) setNarrowOpen(false);
  }, [isNarrow]);

  const open = isNarrow ? narrowOpen : !collapsedPref;
  const onOpenChange = next =>
    isNarrow
      ? setNarrowOpen(next)
      : dispatch(UIActions.setSidebarCollapsed(!next));

  useEffect(() => {
    dispatch(ContactsActions.getAllContacts());
    dispatch(ItemsActions.getAllItems());
    dispatch(InvoicesActions.getInvoices());
    dispatch(SettingsActions.getInitalSettings());
    dispatch(RecurringActions.getRecurring());

    const stopRecurring = startRecurringScheduler({
      trigger: () => dispatch(RecurringActions.runRecurring()),
      subscribeResume: fn => {
        ipc.on('system-resumed', fn);
        return () => ipc.removeAllListeners('system-resumed');
      },
    });

    const onMenuChangeTab = (_e, tabName) => {
      dispatch(UIActions.changeActiveTab(tabName));
    };
    ipc.on('menu-change-tab', onMenuChangeTab);
    ipc.on('menu-new-invoice', () => dispatch(UIActions.newInvoice()));
    ipc.on('menu-open-command-palette', () =>
      dispatch(UIActions.setCommandPalette(true))
    );
    ipc.on('menu-show-shortcuts', () =>
      dispatch(UIActions.setShortcutsDialog(true))
    );
    ipc.on('menu-form-save', () => dispatch(FormActions.saveFormData()));
    ipc.on('menu-form-clear', () => dispatch(FormActions.clearForm()));
    ipc.on('menu-form-add-item', () => dispatch(FormActions.addItem()));
    ipc.on('menu-form-toggle-dueDate', () =>
      dispatch(FormActions.toggleField('dueDate'))
    );
    ipc.on('menu-form-toggle-currency', () =>
      dispatch(FormActions.toggleField('currency'))
    );
    ipc.on('menu-form-toggle-vat', () =>
      dispatch(FormActions.toggleField('tax'))
    );
    ipc.on('menu-form-toggle-discount', () =>
      dispatch(FormActions.toggleField('discount'))
    );
    ipc.on('menu-form-toggle-note', () =>
      dispatch(FormActions.toggleField('note'))
    );
    ipc.on('menu-form-toggle-settings', () =>
      dispatch(FormActions.toggleFormSettings())
    );
    ipc.on('save-configs-to-invoice', (_e, invoiceID, configs) => {
      dispatch(InvoicesActions.saveInvoiceConfigs(invoiceID, configs));
    });
    ipc.on('onboarding-updated', (_e, patch) => {
      dispatch(SettingsActions.updateOnboarding(patch));
    });

    return () => {
      stopRecurring();
      ipc.removeAllListeners(MENU_CHANNELS);
    };
  }, [dispatch]);

  return (
    <TooltipProvider>
      <SidebarProvider
        open={open}
        onOpenChange={onOpenChange}
        className="h-svh flex-col overflow-hidden bg-sidebar"
      >
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <AppSidebar activeTab={activeTab} />
          <SidebarInset className="m-2 mt-0 min-w-0 overflow-hidden rounded-2xl shadow-panel md:peer-data-[variant=inset]:mt-0 md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:shadow-panel">
            <AppMain activeTab={activeTab} />
          </SidebarInset>
        </div>
        <CommandPalette />
        <ShortcutsDialog />
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
