let lockCount = 0;

export function isImportWriteLocked() {
  return lockCount > 0;
}

export function importWriteLockReason() {
  return 'settings:errors:importInProgress';
}

export async function withImportWriteLock(fn) {
  lockCount += 1;
  try {
    return await fn();
  } finally {
    lockCount -= 1;
  }
}
