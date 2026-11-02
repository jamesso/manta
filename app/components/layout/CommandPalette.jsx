import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { toast } from '@/components/ui/toast';
import * as UIActions from '../../actions/ui';
import * as SettingsActions from '../../actions/settings';
import { filterCommands, searchRecords } from '../../helpers/commandSearch';
import { nextTheme } from '../../helpers/theme';
import { getInvoices } from '../../reducers/InvoicesReducer';
import { getContacts } from '../../reducers/ContactsReducer';
import { getCurrentSettings } from '../../reducers/SettingsReducer';

const ipc = window.manta.ipc;
const modKey = window.manta.platform === 'darwin' ? '⌘' : 'Ctrl+';

export default function CommandPalette() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const open = useSelector(s => s.ui.commandPaletteOpen);
  const invoices = useSelector(getInvoices) || [];
  const contacts = useSelector(getContacts) || [];
  const currentTheme =
    useSelector(s => s.settings.saved?.general?.theme) ?? 'system';
  const currentSettings = useSelector(getCurrentSettings);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    const onKeyDown = event => {
      const key = event.key.toLowerCase();
      const mod =
        window.manta.platform === 'darwin' ? event.metaKey : event.ctrlKey;
      if (key === 'k' && mod && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        dispatch(UIActions.setCommandPalette(true));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

  const navCommands = useMemo(
    () => [
      {
        id: 'nav-dashboard',
        label: t('app:nav:dashboard'),
        keywords: ['dashboard', 'home'],
      },
      {
        id: 'nav-invoices',
        label: t('app:nav:invoices'),
        keywords: ['invoices'],
      },
      {
        id: 'nav-contacts',
        label: t('app:nav:clients'),
        keywords: ['contacts', 'customers', 'clients'],
      },
      {
        id: 'nav-items',
        label: t('app:nav:items'),
        keywords: ['products', 'services', 'catalog', 'items'],
      },
      {
        id: 'nav-settings',
        label: t('app:nav:settings'),
        keywords: ['settings', 'preferences'],
      },
    ],
    [t]
  );

  const actionCommands = useMemo(
    () => [
      {
        id: 'action-new-invoice',
        label: t('app:nav:newInvoice'),
        keywords: ['new', 'invoice'],
        shortcut: `${modKey}N`,
      },
      {
        id: 'action-theme',
        label: `${t('app:palette:toggleTheme')} (${t(`app:theme:${currentTheme}`)})`,
        keywords: ['theme', 'dark', 'light'],
      },
      {
        id: 'action-shortcuts',
        label: t('app:nav:shortcuts'),
        keywords: ['shortcuts', 'keyboard'],
        shortcut: `${modKey}/`,
      },
      {
        id: 'action-updates',
        label: t('app:update:check'),
        keywords: ['update'],
        shortcut: `${modKey}U`,
      },
    ],
    [t, currentTheme]
  );

  const filteredNav = filterCommands(navCommands, query);
  const filteredActions = filterCommands(actionCommands, query);
  const records = searchRecords({ query, invoices, contacts });

  const close = () => dispatch(UIActions.setCommandPalette(false));

  const run = fn => {
    close();
    fn();
  };

  const invoiceLabel = inv =>
    inv.invoiceID || (inv._id ? String(inv._id).slice(0, 8) : 'Invoice');

  return (
    <CommandDialog
      open={open}
      onOpenChange={v => dispatch(UIActions.setCommandPalette(v))}
      title={t('app:palette:title')}
      description={t('app:palette:description')}
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={t('app:palette:placeholder')}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{t('app:palette:empty')}</CommandEmpty>
          {filteredNav.length > 0 && (
            <CommandGroup heading={t('app:palette:goTo')}>
              {filteredNav.map(cmd => (
                <CommandItem
                  key={cmd.id}
                  value={cmd.id}
                  onSelect={() => {
                    if (cmd.id === 'nav-dashboard')
                      run(() =>
                        dispatch(UIActions.changeActiveTab('dashboard'))
                      );
                    else if (cmd.id === 'nav-invoices')
                      run(() =>
                        dispatch(UIActions.changeActiveTab('invoices'))
                      );
                    else if (cmd.id === 'nav-contacts')
                      run(() =>
                        dispatch(UIActions.changeActiveTab('contacts'))
                      );
                    else if (cmd.id === 'nav-items')
                      run(() => dispatch(UIActions.changeActiveTab('items')));
                    else if (cmd.id === 'nav-settings')
                      run(() =>
                        dispatch(UIActions.changeActiveTab('settings'))
                      );
                  }}
                >
                  {cmd.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {filteredActions.length > 0 && (
            <CommandGroup heading={t('app:palette:actions')}>
              {filteredActions.map(cmd => (
                <CommandItem
                  key={cmd.id}
                  value={cmd.id}
                  onSelect={() => {
                    if (cmd.id === 'action-new-invoice') {
                      run(() => dispatch(UIActions.newInvoice()));
                    } else if (cmd.id === 'action-theme') {
                      run(() => {
                        const next = nextTheme(currentTheme);
                        const general = currentSettings?.general ?? {};
                        dispatch(
                          SettingsActions.updateSettings('general', {
                            ...general,
                            theme: next,
                          })
                        );
                        toast.add({
                          title: t('app:palette:themeChanged', {
                            theme: t(`app:theme:${next}`),
                          }),
                        });
                      });
                    } else if (cmd.id === 'action-shortcuts') {
                      run(() => dispatch(UIActions.setShortcutsDialog(true)));
                    } else if (cmd.id === 'action-updates') {
                      run(() => ipc.send('check-for-updates'));
                    }
                  }}
                >
                  {cmd.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {records.invoices.length > 0 && (
            <CommandGroup heading={t('app:palette:invoices')}>
              {records.invoices.map(inv => (
                <CommandItem
                  key={inv._id}
                  value={`invoice-${inv._id}`}
                  onSelect={() => run(() => ipc.send('preview-invoice', inv))}
                >
                  {invoiceLabel(inv)}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {records.contacts.length > 0 && (
            <CommandGroup heading={t('app:palette:clients')}>
              {records.contacts.map(c => (
                <CommandItem
                  key={c._id}
                  value={`contact-${c._id}`}
                  onSelect={() =>
                    run(() => dispatch(UIActions.changeActiveTab('contacts')))
                  }
                >
                  {c.fullname || c.company || c.email || c._id}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
