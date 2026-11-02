// Keep in sync with main/menu.js accelerators.

export const SHORTCUT_GROUPS = [
  {
    group: 'app:shortcuts:groups:general',
    items: [
      { label: 'app:shortcuts:items:palette', mac: '⌘K', other: 'Ctrl+K' },
      { label: 'app:shortcuts:items:sidebar', mac: '⌘B', other: 'Ctrl+B' },
      { label: 'app:shortcuts:items:settings', mac: '⌘,', other: 'Ctrl+,' },
      { label: 'app:shortcuts:items:shortcuts', mac: '⌘/', other: 'Ctrl+/' },
      { label: 'app:shortcuts:items:checkUpdates', mac: '⌘U', other: 'Ctrl+U' },
      { label: 'app:shortcuts:items:quit', mac: '⌘Q', other: 'Ctrl+Q' },
    ],
  },
  {
    group: 'app:shortcuts:groups:invoice',
    items: [
      { label: 'app:shortcuts:items:newInvoice', mac: '⌘N', other: 'Ctrl+N' },
      { label: 'app:shortcuts:items:save', mac: '⌘S', other: 'Ctrl+S' },
      { label: 'app:shortcuts:items:reset', mac: '⌘R', other: 'Ctrl+R' },
      { label: 'app:shortcuts:items:addItem', mac: '⌘I', other: 'Ctrl+I' },
      {
        label: 'app:shortcuts:items:toggleSettings',
        mac: '⌥S',
        other: 'Alt+S',
      },
      { label: 'app:shortcuts:items:dueDate', mac: '⌥T', other: 'Alt+T' },
      { label: 'app:shortcuts:items:currency', mac: '⌥C', other: 'Alt+C' },
      { label: 'app:shortcuts:items:vat', mac: '⌥V', other: 'Alt+V' },
      { label: 'app:shortcuts:items:discount', mac: '⌥D', other: 'Alt+D' },
      { label: 'app:shortcuts:items:note', mac: '⌥N', other: 'Alt+N' },
    ],
  },
  {
    group: 'app:shortcuts:groups:go',
    items: [
      {
        label: 'app:shortcuts:items:invoices',
        mac: '⌘⇧A',
        other: 'Ctrl+Shift+A',
      },
      {
        label: 'app:shortcuts:items:clients',
        mac: '⌘⇧D',
        other: 'Ctrl+Shift+D',
      },
    ],
  },
  {
    group: 'app:shortcuts:groups:help',
    items: [
      { label: 'app:shortcuts:items:tutorial', mac: '⌘T', other: 'Ctrl+T' },
    ],
  },
];
