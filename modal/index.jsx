import '../static/css/bootstrap.min.css';
import '../static/css/ionicons.min.css';
import '../static/css/general.css';

import '../libs/dragNdrop.js';

// Libraries
import React from 'react';
import { createRoot } from 'react-dom/client';
import Dialog from './Dialog';

createRoot(document.getElementById('root')).render(
  <Dialog />
);
