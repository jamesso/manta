import { isMainWindowMainFrame } from './main-window-sender';

// The setting `general.theme` drives nativeTheme.themeSource. Every renderer
// follows it through the prefers-color-scheme media query.
export const THEMES = ['system', 'light', 'dark'];

// Same values as --sidebar (window chrome) in ui/styles/globals.css.
export const WINDOW_BACKGROUND = { light: '#f2f1f0', dark: '#0c0c0d' };

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : 'system';
}

export function getBackgroundColor(nativeTheme) {
  return nativeTheme.shouldUseDarkColors
    ? WINDOW_BACKGROUND.dark
    : WINDOW_BACKGROUND.light;
}

export function setupTheme({ nativeTheme, ipcMain, BrowserWindow, store }) {
  nativeTheme.themeSource = normalizeTheme(store.get('general.theme'));
  ipcMain.on('set-theme', (event, value) => {
    if (!isMainWindowMainFrame(event)) return;
    const theme = normalizeTheme(value);
    store.set('general.theme', theme);
    nativeTheme.themeSource = theme;
  });
  nativeTheme.on('updated', () => {
    const color = getBackgroundColor(nativeTheme);
    for (const win of BrowserWindow.getAllWindows()) {
      win.setBackgroundColor(color);
    }
  });
}

export const TITLEBAR_HEIGHT = 48;
const TITLEBAR_SYMBOL = { light: '#0a0a0a', dark: '#fafafa' };

export function titleBarOverlayFor(nativeTheme) {
  const mode = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  return {
    color: WINDOW_BACKGROUND[mode],
    symbolColor: TITLEBAR_SYMBOL[mode],
    height: TITLEBAR_HEIGHT,
  };
}

export function titleBarOptions(platform, nativeTheme) {
  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 17 },
    };
  }
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: titleBarOverlayFor(nativeTheme),
  };
}
