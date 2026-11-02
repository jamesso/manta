let lockCount = 0;
let activeWrites = 0;
const drainWaiters = [];

function notifyDrainWaiters() {
  if (activeWrites > 0) {
    return;
  }
  const waiters = drainWaiters.splice(0);
  for (const resolve of waiters) {
    resolve();
  }
}

function waitForActiveWrites() {
  if (activeWrites === 0) {
    return Promise.resolve();
  }
  return new Promise(resolve => drainWaiters.push(resolve));
}

export function isImportWriteLocked() {
  return lockCount > 0;
}

export function importWriteLockReason() {
  return 'settings:errors:importInProgress';
}

export function trackImportWriteStart() {
  if (lockCount > 0) {
    return null;
  }
  activeWrites += 1;
  return () => {
    activeWrites -= 1;
    notifyDrainWaiters();
  };
}

export async function withImportWriteLock(fn) {
  await waitForActiveWrites();
  lockCount += 1;
  try {
    return await fn();
  } finally {
    lockCount -= 1;
  }
}
