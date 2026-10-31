import React from 'react';
import welcomeImg from '../../imgs/Welcome.svg';
import Slide from '../Slide';

function Welcome({t}) {
  return (
    <Slide
      inverted
      fromColor="#CAD2E8"
      toColor="#6979A4"
      heading={t('tour:slides:welcome:heading')}
      description={t('tour:slides:welcome:description')}
      imgSrc={welcomeImg}
      imgSize="475px"
    />
  );
}

export default Welcome;
