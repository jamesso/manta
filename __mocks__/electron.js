import { vi } from 'vitest';

export const app = vi.fn();
export const ipcRenderer = {
  send: vi.fn(),
  on: vi.fn(),
};
export const remote = {
  require: vi.fn(),
  getGlobal: vi.fn(name => {
    if (name === 'mantaSettings') {
      return {
        set: vi.fn(),
        get: vi.fn(() => 'someSettings'),
        has: vi.fn(() => false),
      };
    }
  }),
};
export default { app, ipcRenderer, remote };
