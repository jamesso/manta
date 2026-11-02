const queues = new Map();

/**
 * Serialize read/check/write for one original invoice (payments and credit notes).
 */
export function runInvoiceMutationQueued(invoiceId, fn) {
  const prev = queues.get(invoiceId) || Promise.resolve();
  const next = prev.then(fn, fn).finally(() => {
    if (queues.get(invoiceId) === next) {
      queues.delete(invoiceId);
    }
  });
  queues.set(invoiceId, next);
  return next;
}

export function clearInvoiceMutationQueuesForTests() {
  queues.clear();
}
