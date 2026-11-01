import { EventEmitter } from 'node:events';
import { normalizeTheme, setupTheme, WINDOW_BACKGROUND } from '../theme.js';

function setup(saved, { dark = false } = {}) {
  const nativeTheme = Object.assign(new EventEmitter(), {
    themeSource: 'system',
    shouldUseDarkColors: dark,
  });
  const ipcMain = new EventEmitter();
  const data = { 'general.theme': saved };
  const store = { get: k => data[k], set: (k, v) => (data[k] = v) };
  const win = { color: null, setBackgroundColor: c => (win.color = c) };
  const BrowserWindow = { getAllWindows: () => [win] };
  setupTheme({ nativeTheme, ipcMain, BrowserWindow, store });
  return { nativeTheme, ipcMain, data, win };
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
    ipcMain.emit('set-theme', {}, 'light');
    expect(nativeTheme.themeSource).toBe('light');
    expect(data['general.theme']).toBe('light');
  });

  it('set-theme with an invalid value saves system', () => {
    const { nativeTheme, ipcMain, data } = setup('dark');
    ipcMain.emit('set-theme', {}, 'neon');
    expect(nativeTheme.themeSource).toBe('system');
    expect(data['general.theme']).toBe('system');
  });

  it('repaints window backgrounds when the theme updates', () => {
    const { nativeTheme, win } = setup('system');
    nativeTheme.shouldUseDarkColors = true;
    nativeTheme.emit('updated');
    expect(win.color).toBe(WINDOW_BACKGROUND.dark);
  });
});
