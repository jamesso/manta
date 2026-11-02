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

export function askEmail({ client, email, canSave }) {
  return new Promise(resolve => {
    enqueue({
      id: String(++idCounter),
      client,
      email,
      canSave,
      resolve,
    });
  });
}

export function getCurrent() {
  return queue[0] ?? null;
}

export function resolveCurrent(value, expectedId) {
  const current = queue[0];
  if (!current) {
    return;
  }
  if (expectedId !== undefined && current.id !== expectedId) {
    return;
  }
  queue.shift();
  current.resolve(value);
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
