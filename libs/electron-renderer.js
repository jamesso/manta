// Renderer access to Electron while nodeIntegration is on.
// electron.vite.config.mjs aliases 'electron' to this file.
// Removed in plan 009 (preload + contextBridge).
const electron = window.require('electron');
const remote = window.require('@electron/remote');

export const { ipcRenderer, shell, clipboard, webFrame, webUtils } = electron;
export { remote };
export default { ...electron, remote };
