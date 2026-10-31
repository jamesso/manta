import openDialog from '../renderers/dialog';
import i18n from '../../i18n/i18n';

function processImg(filePath, callback) {
  window.manta.processLogo(filePath).then(result => {
    if (result.error) {
      handleError(new Error(result.error));
      return;
    }
    callback(result.dataUrl);
  }).catch(err => {
    handleError(err);
  });
}

function handleError(err) {
  openDialog({
    type: 'warning',
    title: i18n.t('dialog:fileTypeErr:title'),
    message: err.message,
  });
}

export { processImg };
