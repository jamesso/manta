// @vitest-environment node

import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../backup.js', import.meta.url));

describe('backup IPC sender checks', () => {
  let handlers;
  let dialog;
  let mainWindow;
  let event;
  let senderWindow;

  beforeEach(() => {
    handlers = {};
    dialog = {
      showSaveDialog: vi.fn(async () => ({ canceled: true })),
      showOpenDialog: vi.fn(async () => ({ canceled: true })),
    };
    mainWindow = { id: 1, isDestroyed: () => false };
    senderWindow = mainWindow;
    const frame = {};
    event = { sender: { mainFrame: frame }, senderFrame: frame };
    const electron = {
      app: { getPath: () => '/tmp/manta-backup-test', getVersion: () => '1' },
      dialog,
      BrowserWindow: {
        fromId: () => mainWindow,
        fromWebContents: () => senderWindow,
      },
      ipcMain: { handle: (channel, handler) => (handlers[channel] = handler) },
    };
    vm.runInNewContext(
      fs.readFileSync(new URL('../backup.js', import.meta.url), 'utf8'),
      {
        require: name => {
          if (name === 'electron') return electron;
          if (name === './settings') return { get: () => 1 };
          return require(name);
        },
      }
    );
  });

  for (const [channel, dialogMethod] of [
    ['backup-export', 'showSaveDialog'],
    ['backup-import', 'showOpenDialog'],
  ]) {
    it(`${channel} opens a parented dialog for the main frame`, async () => {
      await expect(handlers[channel](event, {})).resolves.toEqual({
        canceled: true,
      });
      expect(dialog[dialogMethod]).toHaveBeenCalledWith(
        mainWindow,
        expect.any(Object)
      );
    });

    it(`${channel} rejects the preview window`, async () => {
      senderWindow = { id: 2, isDestroyed: () => false };
      await expect(handlers[channel](event, {})).rejects.toThrow(
        'invalid request'
      );
      expect(dialog[dialogMethod]).not.toHaveBeenCalled();
    });
  }

  for (const channel of [
    'backup-export',
    'backup-import',
    'backup-snapshot',
    'csv-export',
  ]) {
    it(`${channel} rejects a sub-frame`, async () => {
      event.senderFrame = {};
      await expect(handlers[channel](event, { text: 'csv' })).rejects.toThrow(
        'invalid request'
      );
      expect(dialog.showSaveDialog).not.toHaveBeenCalled();
      expect(dialog.showOpenDialog).not.toHaveBeenCalled();
    });
  }
});
