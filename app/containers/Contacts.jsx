import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import ClientDetailSheet from '../components/contacts/ClientDetailSheet';
import ClientEditorDialog from '../components/contacts/ClientEditorDialog';
import ClientsTable from '../components/contacts/ClientsTable';
import InvoiceDetailSheet from '../components/invoices/InvoiceDetailSheet';
import { useNow } from '../components/invoices/useNow';
import { matchesClientQuery, summarizeClients } from '../helpers/clients';
import { getContacts } from '../reducers/ContactsReducer';
import { getInvoices } from '../reducers/InvoicesReducer';
import { getDateFormat } from '../reducers/SettingsReducer';

export default function Contacts() {
  const { t } = useTranslation();
  const contacts = useSelector(getContacts);
  const invoices = useSelector(getInvoices);
  const dateFormat = useSelector(getDateFormat);
  const now = useNow();

  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [detailId, setDetailId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContact, setEditorContact] = useState(null);
  const [invoiceDetailId, setInvoiceDetailId] = useState(null);

  const summaryMap = useMemo(
    () => summarizeClients(contacts, invoices, now),
    [contacts, invoices, now]
  );

  const tableRows = useMemo(() => {
    return contacts
      .filter(c => matchesClientQuery(c, query))
      .map(c => ({
        ...c,
        summary: summaryMap.get(c._id) ?? {
          invoiceCount: 0,
          outstanding: {},
          invoices: [],
        },
      }));
  }, [contacts, query, summaryMap]);

  const detailContact = detailId
    ? contacts.find(c => c._id === detailId) || null
    : null;
  const detailSummary = detailId ? summaryMap.get(detailId) : null;

  const openEditor = useCallback(contact => {
    setEditorContact(contact ?? null);
    setEditorOpen(true);
  }, []);

  useEffect(() => {
    if (detailId && !contacts.some(c => c._id === detailId)) {
      setDetailId(null);
    }
  }, [contacts, detailId]);

  useEffect(() => {
    if (invoiceDetailId && !invoices.some(i => i._id === invoiceDetailId)) {
      setInvoiceDetailId(null);
    }
  }, [invoices, invoiceDetailId]);

  const invoiceDetail = invoiceDetailId
    ? invoices.find(i => i._id === invoiceDetailId) || null
    : null;

  const showEmptyNone = contacts.length === 0;
  const showEmptySearch = !showEmptyNone && tableRows.length === 0;

  return (
    <div className="flex h-full flex-col gap-4 p-4 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('contacts:header')}</h1>
        {!showEmptyNone ? (
          <Button type="button" onClick={() => openEditor(null)}>
            <UserPlus className="size-4" />
            {t('contacts:newClient')}
          </Button>
        ) : null}
      </div>

      {showEmptyNone ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('contacts:empty:title')}</EmptyTitle>
            <EmptyDescription>
              {t('contacts:empty:description')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => openEditor(null)}>
              <UserPlus className="size-4" />
              {t('contacts:newClient')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : showEmptySearch ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t('contacts:empty:noResults', { query })}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuery('')}
            >
              {t('contacts:empty:clearSearch')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              value={query}
              placeholder={t('contacts:searchPlaceholder')}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <ClientsTable
            contacts={tableRows}
            sorting={sorting}
            onSortingChange={setSorting}
            onRowOpen={row => setDetailId(row._id)}
            onEdit={contact => {
              const latest =
                contacts.find(c => c._id === contact._id) || contact;
              openEditor(latest);
            }}
          />
        </>
      )}

      <ClientEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contact={editorContact}
      />

      {detailContact && detailSummary ? (
        <ClientDetailSheet
          contact={detailContact}
          summary={detailSummary}
          open={Boolean(detailId)}
          onOpenChange={open => {
            if (!open) {
              setDetailId(null);
            }
          }}
          dateFormat={dateFormat}
          onEdit={contact => {
            const latest = contacts.find(c => c._id === contact._id) || contact;
            openEditor(latest);
          }}
          onOpenInvoice={id => setInvoiceDetailId(id)}
        />
      ) : null}

      <InvoiceDetailSheet
        invoice={invoiceDetail}
        open={Boolean(invoiceDetail)}
        onOpenChange={open => {
          if (!open) {
            setInvoiceDetailId(null);
          }
        }}
        dateFormat={dateFormat}
        t={t}
        now={now}
      />
    </div>
  );
}
