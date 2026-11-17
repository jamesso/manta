vi.mock('electron', () => ({
  ipcMain: { on: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() },
}));

vi.mock('../settings', () => {
  const api = { get: vi.fn(), set: vi.fn(), has: vi.fn() };
  return { ...api, default: api };
});

import { BrowserWindow, ipcMain } from 'electron';
import appConfig from '../settings';

describe('settings ipc', () => {
  const handlers = {};
  const mainFrame = { id: 'main-frame' };
  const previewFrame = { id: 'preview-frame' };
  const childFrame = { id: 'child-frame' };
  const mainSender = { mainFrame };
  const previewSender = { mainFrame: previewFrame };
  const subSender = { mainFrame };
  const mainWin = { id: 1, isDestroyed: () => false };
  const previewWin = { id: 2, isDestroyed: () => false };
  const profile = { company: 'Acme' };
  let store;

  const mainEvent = () => ({
    sender: mainSender,
    senderFrame: mainFrame,
    returnValue: 'unset',
  });
  const previewEvent = () => ({
    sender: previewSender,
    senderFrame: previewFrame,
    returnValue: 'unset',
  });
  const subFrameEvent = () => ({
    sender: subSender,
    senderFrame: childFrame,
    returnValue: 'unset',
  });

  beforeAll(async () => {
    ipcMain.on.mockImplementation((channel, fn) => {
      handlers[channel] = fn;
    });
    await import('../settings-ipc.js');
  });

  beforeEach(() => {
    store = {
      mainWindowID: 1,
      previewWindowID: 2,
      profile,
      invoice: { currency: 'USD' },
    };
    appConfig.get.mockImplementation(key => store[key]);
    appConfig.set.mockImplementation((key, value) => {
      store[key] = value;
    });
    appConfig.has.mockImplementation(key =>
      Object.prototype.hasOwnProperty.call(store, key)
    );
    appConfig.get.mockClear();
    appConfig.set.mockClear();
    appConfig.has.mockClear();
    BrowserWindow.fromWebContents.mockImplementation(sender => {
      if (sender === previewSender) {
        return previewWin;
      }
      return mainWin;
    });
  });

  it('main settings:set of general.theme calls store.set and sets returnValue true', () => {
    const event = mainEvent();
    handlers['settings:set'](event, 'general.theme', 'dark');
    expect(appConfig.set).toHaveBeenCalledWith('general.theme', 'dark');
    expect(event.returnValue).toBe(true);
  });

  it('preview settings:set of general.theme does not call store.set and sets returnValue false', () => {
    const event = previewEvent();
    handlers['settings:set'](event, 'general.theme', 'dark');
    expect(appConfig.set).not.toHaveBeenCalled();
    expect(event.returnValue).toBe(false);
  });

  it('main settings:set of mainWindowID and previewWindowID does not call store.set and sets returnValue false', () => {
    for (const key of ['mainWindowID', 'previewWindowID']) {
      appConfig.set.mockClear();
      const event = mainEvent();
      handlers['settings:set'](event, key, 99);
      expect(appConfig.set).not.toHaveBeenCalled();
      expect(event.returnValue).toBe(false);
    }
  });

  it('main settings:set of an object key does not call store.set and sets returnValue false', () => {
    const event = mainEvent();
    handlers['settings:set'](event, { mainWindowID: 2, previewWindowID: 1 });
    expect(appConfig.set).not.toHaveBeenCalled();
    expect(event.returnValue).toBe(false);
  });

  it('sub-frame settings:set does not call store.set', () => {
    const event = subFrameEvent();
    handlers['settings:set'](event, 'general.theme', 'dark');
    expect(appConfig.set).not.toHaveBeenCalled();
    expect(event.returnValue).toBe(false);
  });

  it('preview settings:get of profile returns the store value', () => {
    const event = previewEvent();
    handlers['settings:get'](event, 'profile');
    expect(event.returnValue).toBe(profile);
  });

  it('sub-frame settings:get sets returnValue to undefined and does not call store.get', () => {
    const event = subFrameEvent();
    handlers['settings:get'](event, 'profile');
    expect(event.returnValue).toBeUndefined();
    expect(appConfig.get).not.toHaveBeenCalled();
  });

  it('preview settings:has of invoice returns the store result and sub-frame settings:has sets returnValue to false', () => {
    const preview = previewEvent();
    handlers['settings:has'](preview, 'invoice');
    expect(preview.returnValue).toBe(true);
    expect(appConfig.has).toHaveBeenCalledWith('invoice');

    appConfig.has.mockClear();
    const sub = subFrameEvent();
    handlers['settings:has'](sub, 'invoice');
    expect(sub.returnValue).toBe(false);
    expect(appConfig.has).not.toHaveBeenCalled();
  });
});
