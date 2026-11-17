vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
}));
vi.mock('../settings', () => ({ default: { get: () => 1 } }));

import { BrowserWindow as ElectronBrowserWindow } from 'electron';

const frame = {};
const trustedEvent = { sender: { mainFrame: frame }, senderFrame: frame };

beforeEach(() => {
  ElectronBrowserWindow.fromWebContents.mockReturnValue({
    id: 1,
    isDestroyed: () => false,
  });
});

import { EventEmitter } from 'node:events';
import {
  normalizeTheme,
  setupTheme,
  WINDOW_BACKGROUND,
  titleBarOptions,
  titleBarOverlayFor,
} from '../theme.js';

function setup(saved, { dark = false } = {}) {
  const nativeTheme = Object.assign(new EventEmitter(), {
    themeSource: 'system',
    shouldUseDarkColors: dark,
  });
  const ipcMain = new EventEmitter();
  const data = { 'general.theme': saved };
  const store = { get: k => data[k], set: vi.fn((k, v) => (data[k] = v)) };
  const win = { color: null, setBackgroundColor: c => (win.color = c) };
  const BrowserWindow = { getAllWindows: () => [win] };
  setupTheme({ nativeTheme, ipcMain, BrowserWindow, store });
  return { nativeTheme, ipcMain, data, win, store };
}

describe('theme', () => {
  it('keeps valid values and maps others to system', () => {
    expect(['system', 'light', 'dark'].map(normalizeTheme)).toEqual([
      'system',
      'light',
      'dark',
    ]);
    for (const bad of [undefined, null, '', 'blue', 1, {}])
      expect(normalizeTheme(bad)).toBe('system');
  });

  it('applies the saved setting at startup', () => {
    expect(setup('dark').nativeTheme.themeSource).toBe('dark');
  });

  it('uses system when the saved value is missing or invalid', () => {
    expect(setup(undefined).nativeTheme.themeSource).toBe('system');
    expect(setup('purple').nativeTheme.themeSource).toBe('system');
  });

  it('set-theme applies and saves the theme', () => {
    const { nativeTheme, ipcMain, data } = setup('system');
    ipcMain.emit('set-theme', trustedEvent, 'dark');
    expect(nativeTheme.themeSource).toBe('dark');
    expect(data['general.theme']).toBe('dark');
  });

  it('set-theme with an invalid value saves system', () => {
    const { nativeTheme, ipcMain, data } = setup('dark');
    ipcMain.emit('set-theme', trustedEvent, 'neon');
    expect(nativeTheme.themeSource).toBe('system');
    expect(data['general.theme']).toBe('system');
  });

  it('ignores an untrusted set-theme without writing the store', () => {
    const { nativeTheme, ipcMain, data, store } = setup('light');
    ipcMain.emit('set-theme', { ...trustedEvent, senderFrame: {} }, 'dark');
    ElectronBrowserWindow.fromWebContents.mockReturnValue({
      id: 2,
      isDestroyed: () => false,
    });
    ipcMain.emit('set-theme', trustedEvent, 'dark');
    expect(store.set).not.toHaveBeenCalled();
    expect(data['general.theme']).toBe('light');
    expect(nativeTheme.themeSource).toBe('light');
  });

  it('repaints window backgrounds when the theme updates', () => {
    const { nativeTheme, win } = setup('system');
    nativeTheme.shouldUseDarkColors = true;
    nativeTheme.emit('updated');
    expect(win.color).toBe(WINDOW_BACKGROUND.dark);
  });

  it('titleBarOptions on darwin uses hiddenInset without overlay', () => {
    const opts = titleBarOptions('darwin', { shouldUseDarkColors: false });
    expect(opts.titleBarStyle).toBe('hiddenInset');
    expect(opts.titleBarOverlay).toBeUndefined();
  });

  it('titleBarOptions on win32 uses overlay colors', () => {
    const dark = titleBarOptions('win32', { shouldUseDarkColors: true });
    expect(dark.titleBarOverlay.color).toBe(WINDOW_BACKGROUND.dark);
    expect(dark.titleBarOverlay.height).toBe(48);
    const light = titleBarOverlayFor({ shouldUseDarkColors: false });
    expect(light.color).toBe(WINDOW_BACKGROUND.light);
  });
});
