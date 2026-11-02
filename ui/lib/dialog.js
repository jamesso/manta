let queue = [];
const listeners = new Set();
let idCounter = 0;

function notify() {
  listeners.forEach(listener => listener());
}

function enqueue(request) {
  queue.push(request);
  notify();
}

export function confirm({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
}) {
  return new Promise(resolve => {
    enqueue({
      id: String(++idCounter),
      kind: 'confirm',
      title,
      message,
      confirmLabel,
      cancelLabel,
      destructive,
      resolve,
    });
  });
}

export function alert({ title, message, type = 'info' }) {
  return new Promise(resolve => {
    enqueue({
      id: String(++idCounter),
      kind: 'alert',
      title,
      message,
      type,
      resolve,
    });
  });
}

export function getCurrent() {
  return queue[0] ?? null;
}

export function resolveCurrent(value, expectedId) {
  const current = queue[0];
  if (!current) return;
  if (expectedId !== undefined && current.id !== expectedId) return;
  queue.shift();
  if (current.kind === 'confirm') {
    current.resolve(value === true);
  } else {
    current.resolve(undefined);
  }
  notify();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function _reset() {
  queue = [];
  listeners.clear();
}
