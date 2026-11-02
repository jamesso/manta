console.time('init');

// Node Libs
const fs = require('fs');
const os = require('os');
const path = require('path');
const omit = require('lodash').omit;

// Electron Libs
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const { autoUpdater } = require('electron-updater');
const {
  SECURE_WEB_PREFERENCES,
  loadPage,
  showWhenReady,
} = require('./helpers/windows');
// Only the dev server (`npm run dev`) opens DevTools by default. Built
// runs (`npm start`, e2e) behave like the packaged app.
const isDev = !app.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL);

// Never let dev/test runs touch the real user profile.
if (process.env.MANTA_USER_DATA) {
  app.setPath('userData', process.env.MANTA_USER_DATA);
} else if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Manta-dev'));
}

// Place a BrowserWindow in center of primary display

// commmandline arguments
const forceDevtools = process.argv.includes('--force-devtools');
if (process.argv.includes('--disable-hardware-acceleration')) {
  app.disableHardwareAcceleration();
}

// 3rd Party Libs
const appConfig = require('./main/settings');
require('./main/settings-ipc');
const {
  setupTheme,
  getBackgroundColor,
  titleBarOptions,
  titleBarOverlayFor,
} = require('./main/theme');

let mainWindow = null;
let previewWindow = null;

function createMainWindow() {
  // Get window state
  const mainWindownStateKeeper = windowStateKeeper('main');
  // Creating a new window
  mainWindow = new BrowserWindow({
    x: mainWindownStateKeeper.x,
    y: mainWindownStateKeeper.y,
    width: mainWindownStateKeeper.width,
    height: mainWindownStateKeeper.height,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: getBackgroundColor(nativeTheme),
    show: false,
    title: 'Main Window',
    ...titleBarOptions(process.platform, nativeTheme),
    webPreferences: SECURE_WEB_PREFERENCES,
  });
  // Register WindowID
  appConfig.set('mainWindowID', parseInt(mainWindow.id));
  // Track window state
  mainWindownStateKeeper.track(mainWindow);
  // Load Content
  loadPage(mainWindow, 'app');
  if (process.platform !== 'darwin') {
    nativeTheme.on('updated', () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.setTitleBarOverlay(titleBarOverlayFor(nativeTheme));
      }
    });
  }
  // Add Event Listeners
  mainWindow.on('show', event => {
    if (isDev || forceDevtools)
      mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
  mainWindow.on('close', event => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      if (isDev || forceDevtools) mainWindow.webContents.closeDevTools();
      mainWindow.hide();
    } else {
      app.quit();
    }
  });
}

function createPreviewWindow() {
  // Get window state
  const previewWindownStateKeeper = windowStateKeeper('preview');
  // Create New Window
  previewWindow = new BrowserWindow({
    x: previewWindownStateKeeper.x,
    y: previewWindownStateKeeper.y,
    width: previewWindownStateKeeper.width,
    height: previewWindownStateKeeper.height,
    minWidth: 1024,
    minHeight: 800,
    backgroundColor: getBackgroundColor(nativeTheme),
    show: false,
    title: 'Preview Window',
    ...titleBarOptions(process.platform, nativeTheme),
    webPreferences: SECURE_WEB_PREFERENCES,
  });
  // Register WindowID
  appConfig.set('previewWindowID', parseInt(previewWindow.id));
  // Track window state
  previewWindownStateKeeper.track(previewWindow);
  // Load Content
  loadPage(previewWindow, 'preview');
  if (process.platform !== 'darwin') {
    nativeTheme.on('updated', () => {
      if (!previewWindow.isDestroyed()) {
        previewWindow.setTitleBarOverlay(titleBarOverlayFor(nativeTheme));
      }
    });
  }
  // Add Event Listener
  previewWindow.on('show', event => {
    if (isDev || forceDevtools)
      previewWindow.webContents.openDevTools({ mode: 'detach' });
  });
  previewWindow.on('close', event => {
    event.preventDefault();
    if (isDev || forceDevtools) previewWindow.webContents.closeDevTools();
    previewWindow.hide();
  });
}

// `electron .` sets the app path to the package root. Launching
// out/main/index.js directly sets it to out/main, which has no static/.
function bundledFile(...segments) {
  const candidates = [
    path.join(app.getAppPath(), ...segments),
    path.join(__dirname, '..', '..', ...segments),
  ];
  return (
    candidates.find(candidate => fs.existsSync(candidate)) || candidates[0]
  );
}

function setInitialValues() {
  // Default Logo
  const logoPath = bundledFile('static', 'imgs', 'default_logo.svg');
  const logoData = fs.readFileSync(logoPath);
  const logoBase64String =
    'data:image/svg+xml;base64,' + logoData.toString('base64');
  // Default Options
  const defaultOptions = {
    onboarding: {
      dismissed: false,
      exportedPdf: false,
    },
    ui: {
      sidebarCollapsed: false,
    },
    profile: {
      logo: logoBase64String,
      fullname: 'Manta Ray',
      company: 'Oceanic Preservation Society',
      address: '336 Bon Air Center #384 Greenbrae, CA 94904',
      email: 'info@opsociety.org',
      phone: '+01 (0) 1-2345-6789',
      website: 'http://www.opsociety.org/',
      legalName: '',
      postalAddress: {
        street: '',
        additional: '',
        postcode: '',
        city: '',
        region: '',
        countryCode: '',
      },
      bank: { accountName: '', iban: '', bic: '' },
    },
    general: {
      language: 'en',
      sound: 'default',
      muted: false,
      previewPDF: true,
      theme: 'system',
      checkUpdate: 'daily',
      lastCheck: Date.now(),
    },
    invoice: {
      exportDir: os.homedir(),
      template: 'default',
      dateFormat: 'MM/DD/YYYY',
      tax: {
        tin: '123-456-789',
        method: 'default',
        amount: 0,
      },
      currency: {
        code: 'USD',
        placement: 'before',
        separator: 'commaDot',
        fraction: 2,
      },
      required_fields: {
        invoiceID: false,
        dueDate: false,
        currency: false,
        discount: false,
        tax: false,
        note: false,
      },
      numbering: { prefix: 'INV-', next: 1, padding: 4 },
      estimateNumbering: { prefix: 'EST-', next: 1, padding: 4 },
      creditNoteNumbering: { prefix: 'CN-', next: 1, padding: 4 },
      estimateValidDays: 30,
      eInvoice: { enabled: false, format: 'xrechnung-ubl' },
      emailTemplate: { subject: '', body: '' },
      reminderTemplate: { subject: '', body: '' },
    },
  };

  // Set initial values conditionally work for 2 level depth key only,
  // Changing anything deeper would need to be done with migration
  for (const key in defaultOptions) {
    // Add level 1 key if not exist
    if (Object.prototype.hasOwnProperty.call(defaultOptions, key)) {
      if (!appConfig.has(`${key}`)) {
        appConfig.set(`${key}`, defaultOptions[key]);
      }
      // Add level 2 key if not exist
      for (const childKey in defaultOptions[key]) {
        if (
          Object.prototype.hasOwnProperty.call(defaultOptions[key], childKey)
        ) {
          if (!appConfig.has(`${key}.${childKey}`)) {
            appConfig.set(`${key}.${childKey}`, defaultOptions[key][childKey]);
          }
        }
      }
    }
  }
}

function migrateData() {
  // Migration scheme
  const migrations = {
    1: configs => {
      // Get the current configs
      const { info, appSettings } = configs;
      // Return current configs if this is the first time install
      if (info === undefined || appSettings === undefined) {
        return configs;
      }
      // Update current configs
      const migratedConfigs = Object.assign({}, configs, {
        profile: info,
        general: {
          language: appSettings.language,
          sound: appSettings.sound,
          muted: appSettings.muted,
        },
        invoice: {
          exportDir: appSettings.exportDir,
          template: appSettings.template,
          currency: appSettings.currency,
          dateFormat: 'MM/DD/YYYY',
          tax: {
            tin: '123-456-789',
            method: 'default',
            amount: 0,
          },
          required_fields: {
            dueDate: false,
            currency: false,
            discount: false,
            tax: false,
            note: false,
          },
        },
      });
      // Omit old keys
      return omit(migratedConfigs, [
        'info',
        'appSettings',
        'printOptions',
        'test',
      ]);
    },

    2: configs => {
      // Return current configs if this is the first time install
      if (configs.invoice.currency.placement !== undefined) {
        return configs;
      }
      // Update current configs
      return Object.assign({}, configs, {
        invoice: Object.assign({}, configs.invoice, {
          currency: {
            code: configs.invoice.currency,
            placement: 'before',
            separator: 'commaDot',
            fraction: 2,
          },
        }),
      });
    },

    3: configs => {
      // Return current configs if checkUpdate and lastCheck do not exist
      const { checkUpdate, lastCheck } = configs.general;
      if (checkUpdate === undefined || lastCheck === undefined) {
        return configs;
      }
      // Remove checkUpdate and lastCheck
      return Object.assign({}, configs, {
        general: omit(configs.general, ['checkUpdate', 'lastCheck']),
      });
    },
  };
  // Get the current Config
  const configs = appConfig.store;
  // Get the current configs
  const version = appConfig.get('version') || 0;
  // Handle migration
  const newMigrations = Object.keys(migrations)
    .filter(k => k > version)
    .sort();
  // Exit if there's no migration to run
  if (!newMigrations.length) return;
  // If there's migration to run run the current
  // config through each migration
  const migratedConfigs = newMigrations.reduce(
    (prev, key) => migrations[key](prev),
    configs
  );
  // Save the final config to DB
  appConfig.clear();
  appConfig.store = migratedConfigs;
  // Update the latest config version
  appConfig.set('version', newMigrations[newMigrations.length - 1]);
}

function removeObsoleteKeys() {
  ['tour', 'tourWindowID', 'winsLastVisibleState'].forEach(k =>
    appConfig.delete(k)
  );
}

function addEventListeners() {
  ipcMain.on('quit-app', () => {
    app.quit();
  });
  // Quit and install
  // https://github.com/electron-userland/electron-builder/issues/1604#issuecomment-306709572
  ipcMain.on('quit-and-install', () => {
    setImmediate(() => {
      // Remove this listener
      app.removeAllListeners('window-all-closed');
      // Force close all windows
      mainWindow.destroy();
      previewWindow.destroy();
      // Start the quit and update sequence
      autoUpdater.quitAndInstall(false);
    });
  });
}

function loadMainProcessFiles() {
  require('./main/preview-window');
  require('./main/save-pdf');
  require('./main/email-invoice');
  const {
    registerPreviewCoordinatorIpc,
  } = require('./main/preview-pdf-coordinator');
  registerPreviewCoordinatorIpc();
  require('./main/einvoice');
  require('./main/select-export-directory');
  require('./main/select-logo-file');
  require('./main/logo');
  require('./main/backup');
  require('./main/updater');
  require('./main/power-events');
}

function windowStateKeeper(windowName) {
  let window, windowState;

  function setBounds() {
    // Restore from appConfig
    if (appConfig.has(`windowState.${windowName}`)) {
      windowState = appConfig.get(`windowState.${windowName}`);
      return;
    }
    // Default
    windowState = {
      x: undefined,
      y: undefined,
      width: 1000,
      height: 800,
    };
  }

  function saveState() {
    if (!windowState.isMaximized) {
      windowState = window.getBounds();
    }
    windowState.isMaximized = window.isMaximized();
    appConfig.set(`windowState.${windowName}`, windowState);
  }

  function track(win) {
    window = win;
    ['resize', 'move'].forEach(event => {
      win.on(event, saveState);
    });
  }

  setBounds();

  return {
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    isMaximized: windowState.isMaximized,
    track,
  };
}

function initialize() {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event, url) => {
      if (url.split('#')[0] !== contents.getURL().split('#')[0])
        event.preventDefault();
    });
  });
  app.on('ready', () => {
    setupTheme({ nativeTheme, ipcMain, BrowserWindow, store: appConfig });
    createMainWindow();
    createPreviewWindow();
    showWhenReady(mainWindow);
    setInitialValues();
    migrateData();
    removeObsoleteKeys();
    addEventListeners();
    loadMainProcessFiles();
    require('./main/menu').buildMenu();
  });
  // Reactivate the app
  app.on('activate', () => {
    if (
      mainWindow &&
      !mainWindow.isDestroyed() &&
      previewWindow &&
      !previewWindow.isDestroyed() &&
      !mainWindow.isVisible() &&
      !previewWindow.isVisible()
    ) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  // Close all windows before quit the app
  app.on('before-quit', () => {
    // Use condition in case quit sequence is initiated by autoUpdater
    // which will destroy all there windows already before emitting this event
    if (mainWindow !== null) mainWindow.destroy();
    if (previewWindow !== null) previewWindow.destroy();
  });
  console.timeEnd('init');
}

initialize();
