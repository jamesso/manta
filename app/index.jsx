import '../static/css/bootstrap.min.css';
import '../static/css/ionicons.min.css';
import '../static/css/general.css';
import '../static/css/layout.css';
import '../static/css/form.css';
import '../static/css/contact.css';
import '../static/css/items.css';
import '../static/css/date-picker.css';

import './renderers/startup.js';

// Libraries
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import configureStore from './store';
import i18n from '../i18n/i18n';

// Root Component
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';
import StyledRoot from './components/shared/StyledRoot';

// Store
const store = configureStore();

// Render
createRoot(document.getElementById('root')).render(
  <StyledRoot>
    <Provider store={store}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Provider>
  </StyledRoot>
);
