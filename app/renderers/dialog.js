import { ipcRenderer } from 'electron';
import sounds from '../../libs/sounds';

function showModalWindow(dialogOptions, returnChannel = '', ...rest) {
  ipcRenderer.send('show-modal', dialogOptions, returnChannel, ...rest);
  sounds.play('DIALOG');
}

export default showModalWindow;
