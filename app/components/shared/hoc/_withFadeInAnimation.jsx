import React from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const FadeIn = styled.div`
  height: 100%;
  animation: ${fadeIn} 400ms ease-out;
`;

const _withFadeInTransition = ComposedComponent => props => (
  <FadeIn>
    <ComposedComponent {...props} />
  </FadeIn>
);

export default _withFadeInTransition;
