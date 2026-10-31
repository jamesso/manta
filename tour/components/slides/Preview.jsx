import React from 'react';
import previewImg from '../../imgs/Preview.svg';
import Slide from '../Slide';

const description = `
`;

function Preview({t}) {
  return (
    <Slide
      inverted
      fromColor="#5691c8"
      toColor="#457fca"
      heading={t('tour:slides:preview:heading')}
      description={t('tour:slides:preview:description')}
      imgSrc={previewImg}
      imgSize="520px"
    />
  );
}

export default Preview;
