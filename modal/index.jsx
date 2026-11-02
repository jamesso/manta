import '../ui/styles/globals.css';
import '../static/css/ionicons.min.css';

import '../libs/dragNdrop.js';

// Libraries
import React from 'react';
import { createRoot } from 'react-dom/client';
import Dialog from './Dialog';
import StyledRoot from '../preview/templates/StyledRoot.jsx';

createRoot(document.getElementById('root')).render(
  <StyledRoot>
    <Dialog />
  </StyledRoot>
);
