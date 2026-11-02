// The setting `general.theme` drives nativeTheme.themeSource. Every renderer
// follows it through the prefers-color-scheme media query.
export const THEMES = ['system', 'light', 'dark'];

// Same values as --background in ui/styles/globals.css.
export const WINDOW_BACKGROUND = { light: '#ffffff', dark: '#0a0a0a' };

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
  ipcMain.on('set-theme', (_event, value) => {
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

export const TITLEBAR_HEIGHT = 40;
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
      trafficLightPosition: { x: 14, y: 13 },
    };
  }
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: titleBarOverlayFor(nativeTheme),
  };
}
