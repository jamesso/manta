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

function applyRendererColorScheme(win, nativeTheme) {
  const scheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  const wc = win.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    if (!wc.debugger.isAttached()) wc.debugger.attach('1.3');
    wc.debugger.sendCommand('Emulation.setEmulatedMedia', {
      media: '',
      features: [{ name: 'prefers-color-scheme', value: scheme }],
    });
  } catch {
    // Best-effort: nativeTheme alone is enough when the runtime propagates it.
  }
}

function syncPrefersColorScheme(BrowserWindow, nativeTheme) {
  for (const win of BrowserWindow.getAllWindows()) {
    applyRendererColorScheme(win, nativeTheme);
  }
}

export { applyRendererColorScheme };

export function setupTheme({ nativeTheme, ipcMain, BrowserWindow, store }) {
  nativeTheme.themeSource = normalizeTheme(store.get('general.theme'));
  syncPrefersColorScheme(BrowserWindow, nativeTheme);
  ipcMain.on('set-theme', (_event, value) => {
    const theme = normalizeTheme(value);
    store.set('general.theme', theme);
    nativeTheme.themeSource = theme;
    syncPrefersColorScheme(BrowserWindow, nativeTheme);
  });
  nativeTheme.on('updated', () => {
    syncPrefersColorScheme(BrowserWindow, nativeTheme);
    const color = getBackgroundColor(nativeTheme);
    for (const win of BrowserWindow.getAllWindows()) {
      win.setBackgroundColor(color);
    }
  });
}
