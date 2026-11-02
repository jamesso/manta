import { buildBackup, mergeImportedSettings, planMerge } from './backup';
import { buildInvoicesCsv } from './csv';
import { withImportWriteLock } from './importWriteLock';
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

function countSucceeded(succeeded, beforeIds) {
  const before = new Set(beforeIds);
  let added = 0;
  let overwritten = 0;
  for (const id of succeeded) {
    if (before.has(id)) {
      overwritten += 1;
    } else {
      added += 1;
    }
  }
  return { added, overwritten };
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
  return withImportWriteLock(async () => {
    const snapshot = await ipc.invoke(
      'backup-snapshot',
      await collectBackup(settingsStore)
    );
    const snapshotPath = snapshot.filePath;
    const snapshotWarning = snapshot.snapshotWarning ?? null;

    const counts = { added: 0, overwritten: 0, skipped: 0 };
    const failed = { contacts: [], invoices: [] };
    let batchError = null;
    let settingsResult = null;
    let contacts = [];
    let invoices = [];

    try {
      const existingContacts = await getAllDocs('contacts');
      const existingInvoices = await getAllDocs('invoices');
      const contactPlan = planMerge(backup.contacts, existingContacts, mode);
      const invoicePlan = planMerge(backup.invoices, existingInvoices, mode);

      if (contactPlan.toWrite.length) {
        try {
          const contactBatch = await bulkSaveDocs(
            'contacts',
            contactPlan.toWrite
          );
          failed.contacts = contactBatch.failed;
          const tallies = countSucceeded(
            contactBatch.succeeded,
            existingContacts.map(doc => doc._id)
          );
          counts.added += tallies.added;
          counts.overwritten += tallies.overwritten;
        } catch (err) {
          batchError = { batch: 'contacts', message: err.message };
        }
      }
      counts.skipped += contactPlan.counts.skipped;

      if (!batchError && invoicePlan.toWrite.length) {
        try {
          const invoiceBatch = await bulkSaveDocs(
            'invoices',
            invoicePlan.toWrite
          );
          failed.invoices = invoiceBatch.failed;
          const tallies = countSucceeded(
            invoiceBatch.succeeded,
            existingInvoices.map(doc => doc._id)
          );
          counts.added += tallies.added;
          counts.overwritten += tallies.overwritten;
        } catch (err) {
          batchError = { batch: 'invoices', message: err.message };
        }
      }
      if (!batchError) {
        counts.skipped += invoicePlan.counts.skipped;
      }

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
      contacts = await getAllDocs('contacts');
      invoices = await getAllDocs('invoices');
    }

    return {
      snapshotPath,
      snapshotWarning,
      counts,
      failed,
      batchError,
      contacts,
      invoices,
      settings: settingsResult?.settings,
      skippedSections: settingsResult?.skippedSections ?? [],
    };
  });
}
