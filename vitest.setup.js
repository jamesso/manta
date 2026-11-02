import { afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const mantaHost =
  typeof globalThis.window !== 'undefined' ? globalThis.window : globalThis;
mantaHost.manta = {
  ipc: {
    send: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    invoke: vi.fn(),
  },
  settings: {
    get: vi.fn(() => 'someSettings'),
    set: vi.fn(),
    has: vi.fn(() => true),
  },
  processLogo: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,' })),
  getPathForFile: vi.fn(() => '/tmp/file.png'),
  platform: 'darwin',
  getActivePreviewRequestId: vi.fn(() => null),
};

// The old setTimeout(0) shim runs after jsdom teardown.
const rafTimers = new Set();
global.requestAnimationFrame = callback => {
  const id = setTimeout(() => {
    rafTimers.delete(id);
    if (typeof window !== 'undefined') callback(0);
  }, 0);
  rafTimers.add(id);
  return id;
};
global.cancelAnimationFrame = id => {
  clearTimeout(id);
  rafTimers.delete(id);
};

afterEach(() => {
  for (const id of rafTimers) clearTimeout(id);
  rafTimers.clear();
});

beforeEach(() => {
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('id-string');
});

vi.mock('./libs/sounds.js');
