// Restores styled-components v5 behavior: only valid HTML attributes
// reach DOM elements. See https://styled-components.com/docs/faqs#what-do-i-need-to-do-to-migrate-to-v6
import React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import { StyleSheetManager } from 'styled-components';

function shouldForwardProp(propName, target) {
  if (typeof target === 'string') return isPropValid(propName);
  return true;
}

export default function StyledRoot({ children }) {
  return (
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      {children}
    </StyleSheetManager>
  );
}
