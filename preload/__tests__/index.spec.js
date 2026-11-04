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

  it('blocks the removed Previewer window channels', () => {
    for (const channel of [
      'preview-invoice',
      'update-preview-window',
      'change-preview-window-language',
      'change-preview-window-profile',
      'save-configs-to-invoice',
      'capture-preview-snapshot',
      'request-email-invoice',
      'preview-export-freeze',
      'pfd-exported',
    ]) {
      expect(() => api.ipc.send(channel)).toThrow('Blocked IPC channel');
    }
  });

  it('allows invoke for save-pdf and einvoice-export', () => {
    api.ipc.invoke('save-pdf', {});
    api.ipc.invoke('einvoice-export', {});
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('save-pdf', {});
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('einvoice-export', {});
  });

  it('passes an empty event to listeners', () => {
    const listener = vi.fn();
    api.ipc.on('menu-change-tab', listener);
    const ipcListener = ipcRenderer.on.mock.calls[0][1];
    const realEvent = { sender: { id: 1 } };
    ipcListener(realEvent, 'dashboard');
    expect(listener).toHaveBeenCalledWith({}, 'dashboard');
    expect(listener.mock.calls[0][0]).not.toBe(realEvent);
  });

  it('removes every allowed channel in an array', () => {
    api.ipc.removeAllListeners(['quit-app', 'menu-change-tab']);
    expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('quit-app');
    expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
      'menu-change-tab'
    );
  });
});
