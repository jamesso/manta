import openDialog from '../renderers/dialog';
import i18n from '../../i18n/i18n';

const nodeRequire = name => window.require(name);

function detectSVG(filePath) {
  const data = nodeRequire('fs').readFileSync(filePath);
  return nodeRequire('is-svg')(data);
}

function svg2Base64(filePath) {
  const data = nodeRequire('fs').readFileSync(filePath);
  const base64String = 'data:image/svg+xml;base64,' + data.toString('base64');
  return base64String;
}

function processImg(filePath, callback) {
  // Handle SVG File
  if (detectSVG(filePath)) {
    const base64String = svg2Base64(filePath);
    callback(base64String);
    return;
  }

  // Normal Image File such as PNG or JPEG
  const Jimp = nodeRequire('jimp');
  Jimp.read(filePath, (err, image) => {
    if (err) handleError(err);
    try {
      image
        .resize(500, Jimp.AUTO)
        .quality(100)
        .getBase64(Jimp.MIME_PNG, (err, result) => {
          if (err) handleError(err);
          callback(result);
        });
    } catch (err) {
      if (err) handleError(err);
    }
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
