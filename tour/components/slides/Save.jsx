import React from 'react';
import saveImg from '../../imgs/Save.svg';
import Slide from '../Slide';

function Save({ t }) {
  return (
    <Slide
      fromColor="#FFD200"
      toColor="#F7971E"
      heading={t('tour:slides:save:heading')}
      description={t('tour:slides:save:description')}
      imgSrc={saveImg}
      imgSize="460px"
    />
  );
}

export default Save;
