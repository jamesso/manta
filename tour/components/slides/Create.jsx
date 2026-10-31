import React from 'react';
import createImg from '../../imgs/Create.svg';
import Slide from '../Slide';

function Create({ t }) {
  return (
    <Slide
      fromColor="#85E5A9"
      toColor="#26BB86"
      heading={t('tour:slides:create:heading')}
      description={t('tour:slides:create:description')}
      imgSrc={createImg}
      imgSize="350px"
    />
  );
}

export default Create;
