import sounds from '../../libs/sounds';
const ipc = window.manta.ipc;

function showModalWindow(dialogOptions, returnChannel = '', ...rest) {
  ipc.send('show-modal', dialogOptions, returnChannel, ...rest);
  sounds.play('DIALOG');
}

export default showModalWindow;
