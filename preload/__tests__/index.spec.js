import Module from 'node:module';

const ipcRenderer = {
  send: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  sendSync: vi.fn(),
  invoke: vi.fn(),
};
const contextBridge = {
  exposeInMainWorld: vi.fn(),
};
const webUtils = {
  getPathForFile: vi.fn(),
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'electron') return { contextBridge, ipcRenderer, webUtils };
  return originalRequire.apply(this, arguments);
};

const wasIsolated = process.contextIsolated;
process.contextIsolated = true;

describe('preload IPC allow-list', () => {
  let api;

  beforeAll(async () => {
    await import('../index.js');
    api = contextBridge.exposeInMainWorld.mock.calls[0][1];
  });

  afterAll(() => {
    Module.prototype.require = originalRequire;
    process.contextIsolated = wasIsolated;
  });

  beforeEach(() => {
    ipcRenderer.send.mockClear();
    ipcRenderer.on.mockClear();
    ipcRenderer.removeAllListeners.mockClear();
  });

  it('sends on an allowed channel', () => {
    api.ipc.send('quit-app');
    expect(ipcRenderer.send).toHaveBeenCalledWith('quit-app');
  });

  it('throws for a channel that is not allowed', () => {
    expect(() => api.ipc.send('evil-channel')).toThrow(
      'Blocked IPC channel: evil-channel'
    );
    expect(ipcRenderer.send).not.toHaveBeenCalled();
  });

  it('passes an empty event to listeners', () => {
    const listener = vi.fn();
    api.ipc.on('end-tour', listener);
    const ipcListener = ipcRenderer.on.mock.calls[0][1];
    const realEvent = { sender: { id: 1 } };
    ipcListener(realEvent, 'done');
    expect(listener).toHaveBeenCalledWith({}, 'done');
    expect(listener.mock.calls[0][0]).not.toBe(realEvent);
  });

  it('removes every allowed channel in an array', () => {
    api.ipc.removeAllListeners(['quit-app', 'end-tour']);
    expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('quit-app');
    expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('end-tour');
  });
});
