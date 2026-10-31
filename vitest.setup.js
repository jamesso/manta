process.env.TZ = 'UTC';

import { afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

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

vi.mock('./app/renderers/dialog.js');
vi.mock('./libs/sounds.js');
