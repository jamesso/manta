import React from 'react';
import successImg from '../../imgs/Success.svg';
import Slide from '../Slide';

function Success({ t }) {
  return (
    <Slide
      fromColor="#FFFFFF"
      toColor="#ECE9E6"
      heading={t('tour:slides:success:heading')}
      description={t('tour:slides:success:description')}
      imgSrc={successImg}
      imgSize="425px"
    />
  );
}

export default Success;
