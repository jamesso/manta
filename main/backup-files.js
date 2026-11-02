const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

function backupFileName(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `manta-backup-${y}-${m}-${d}.json`;
}

function autoBackupFileName(date) {
  return `manta-auto-${date.toISOString().replace(/[-:.]/g, '')}.json`;
}

function autoBackupsToPrune(names, keep = 10) {
  const re = /^manta-auto-\d{8}T\d{9}Z\.json$/;
  const auto = names.filter(n => re.test(n)).sort();
  if (auto.length <= keep) {
    return [];
  }
  return auto.slice(0, auto.length - keep);
}

function serializeBackup(payload, appVersion, date) {
  if (payload.app !== 'Manta') {
    throw new Error('bad payload');
  }
  if (!Array.isArray(payload.invoices) || !Array.isArray(payload.contacts)) {
    throw new Error('bad payload');
  }
  if (!Array.isArray(payload.items)) {
    throw new Error('bad payload');
  }
  return JSON.stringify(
    {
      app: 'Manta',
      version: payload.version,
      appVersion,
      exportedAt: date.toISOString(),
      settings: payload.settings,
      invoices: payload.invoices,
      contacts: payload.contacts,
      items: payload.items,
    },
    null,
    2
  );
}

async function writeFileAtomic(filePath, text, fsPromises = fs.promises) {
  const dir = path.dirname(filePath);
  await fsPromises.mkdir(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`
  );
  const handle = await fsPromises.open(tmp, 'wx', 0o600);
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    await fsPromises.rename(tmp, filePath);
  } catch (err) {
    await handle.close().catch(() => {});
    await fsPromises.unlink(tmp).catch(() => {});
    throw err;
  }
}

module.exports = {
  MAX_IMPORT_BYTES,
  backupFileName,
  autoBackupFileName,
  autoBackupsToPrune,
  serializeBackup,
  writeFileAtomic,
};
