import '../static/css/bootstrap.min.css';
import '../static/css/ionicons.min.css';
import '../static/css/general.css';

import '../libs/dragNdrop.js';

// Libraries
import React from 'react';
import { createRoot } from 'react-dom/client';
import Dialog from './Dialog';
import StyledRoot from '../app/components/shared/StyledRoot';

createRoot(document.getElementById('root')).render(
  <StyledRoot>
    <Dialog />
  </StyledRoot>
);
