import startup from './startup.wav';
import dialog from './dialog.wav';
import success from './success.wav';
import warning from './warning.wav';
import add from './add.wav';
import remove from './remove.wav';
import reload from './reload.wav';
import tap from './tap.wav';

const VOLUME = 0.25;

export default {
  STARTUP: {
    url: startup,
    volume: VOLUME * 2,
  },

  DIALOG: {
    url: dialog,
    volume: VOLUME,
  },

  SUCCESS: {
    url: success,
    volume: VOLUME,
  },

  WARNING: {
    url: warning,
    volume: VOLUME,
  },

  ADD: {
    url: add,
    volume: VOLUME,
  },

  REMOVE: {
    url: remove,
    volume: VOLUME,
  },

  RELOAD: {
    url: reload,
    volume: VOLUME,
  },

  TAP: {
    url: tap,
    volume: VOLUME,
  },
};
