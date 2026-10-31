// Single settings store for the app. Reads/writes the legacy plain JSON file
// at <userData>/Settings (no extension).
const electronStore = require('electron-store');

const Store = electronStore.default || electronStore; // ESM-only package

const settings = new Store({ name: 'Settings', fileExtension: '' });

module.exports = settings;
