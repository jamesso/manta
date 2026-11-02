import { buildBackup, mergeImportedSettings, planMerge } from './backup';
import { buildInvoicesCsv } from './csv';
import { bulkSaveDocs, getAllDocs } from './pouchDB';

export async function collectBackup(settingsStore = window.manta.settings) {
  return buildBackup({
    settings: {
      profile: settingsStore.get('profile'),
      invoice: settingsStore.get('invoice'),
      general: settingsStore.get('general'),
    },
    invoices: await getAllDocs('invoices'),
    contacts: await getAllDocs('contacts'),
  });
}

export async function exportBackup(ipc = window.manta.ipc) {
  return ipc.invoke('backup-export', await collectBackup());
}

export async function exportCsv(now, ipc = window.manta.ipc) {
  const invoices = await getAllDocs('invoices');
  const text = buildInvoicesCsv(invoices, now);
  const defaultName = `manta-invoices-${momentLocalDate(now)}.csv`;
  return ipc.invoke('csv-export', { text, defaultName });
}

function momentLocalDate(now) {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function previewImport(backup) {
  const contacts = await getAllDocs('contacts');
  const invoices = await getAllDocs('invoices');
  const skipContacts = planMerge(backup.contacts, contacts, 'skip').counts;
  const skipInvoices = planMerge(backup.invoices, invoices, 'skip').counts;
  const overwriteContacts = planMerge(
    backup.contacts,
    contacts,
    'overwrite'
  ).counts;
  const overwriteInvoices = planMerge(
    backup.invoices,
    invoices,
    'overwrite'
  ).counts;
  return {
    skip: {
      contacts: skipContacts,
      invoices: skipInvoices,
    },
    overwrite: {
      contacts: overwriteContacts,
      invoices: overwriteInvoices,
    },
  };
}

export async function runImport(
  backup,
  { mode, includeSettings },
  { ipc = window.manta.ipc, settingsStore = window.manta.settings } = {}
) {
  const snapshot = await ipc.invoke(
    'backup-snapshot',
    await collectBackup(settingsStore)
  );
  const snapshotPath = snapshot.filePath;

  const counts = { added: 0, overwritten: 0, skipped: 0 };
  const failed = { contacts: [], invoices: [] };
  let settingsResult = null;

  try {
    const contacts = await getAllDocs('contacts');
    const invoices = await getAllDocs('invoices');
    const contactPlan = planMerge(backup.contacts, contacts, mode);
    const invoicePlan = planMerge(backup.invoices, invoices, mode);

    if (contactPlan.toWrite.length) {
      const contactBatch = await bulkSaveDocs('contacts', contactPlan.toWrite);
      failed.contacts = contactBatch.failed;
      counts.added += contactBatch.succeeded.filter(
        id => !contacts.some(c => c._id === id)
      ).length;
      counts.overwritten += contactBatch.succeeded.filter(id =>
        contacts.some(c => c._id === id)
      ).length;
    }
    counts.skipped += contactPlan.counts.skipped;

    if (invoicePlan.toWrite.length) {
      const invoiceBatch = await bulkSaveDocs('invoices', invoicePlan.toWrite);
      failed.invoices = invoiceBatch.failed;
      counts.added += invoiceBatch.succeeded.filter(
        id => !invoices.some(c => c._id === id)
      ).length;
      counts.overwritten += invoiceBatch.succeeded.filter(id =>
        invoices.some(c => c._id === id)
      ).length;
    }
    counts.skipped += invoicePlan.counts.skipped;

    if (includeSettings && backup.settings) {
      settingsResult = mergeImportedSettings(
        {
          profile: settingsStore.get('profile'),
          invoice: settingsStore.get('invoice'),
          general: settingsStore.get('general'),
        },
        backup.settings
      );
    }
  } finally {
    await getAllDocs('contacts');
    await getAllDocs('invoices');
  }

  return {
    snapshotPath,
    counts,
    failed,
    settings: settingsResult?.settings,
    skippedSections: settingsResult?.skippedSections ?? [],
  };
}
