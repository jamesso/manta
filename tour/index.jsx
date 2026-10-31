import '../static/css/bootstrap.min.css';
import '../static/css/ionicons.min.css';
import '../static/css/general.css';

import '../libs/dragNdrop.js';

// Libraries
import React from 'react';
import { render } from 'react-dom';
import i18n from '../i18n/i18n';

// Root Component
import Tour from './Tour';

render(<Tour />, document.getElementById('root'));
