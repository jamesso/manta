import '../static/css/bootstrap.min.css';
import '../static/css/ionicons.min.css';
import '../static/css/general.css';
import '../static/css/preview/font.css';
import '../static/css/preview/print.css';

import '../libs/dragNdrop.js';

// Libraries
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import i18n from '../i18n/i18n';
import ErrorBoundary from '../app/components/shared/ErrorBoundary';
import StyledRoot from '../app/components/shared/StyledRoot';

// Root Reducer
import combineReducers from './reducers';

// Root Component
import Viewer from './Viewer';

// Middleware
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

// Create Store
const store = createStore(
  combineReducers,
  composeEnhancers(applyMiddleware())
);

createRoot(document.getElementById('root')).render(
  <StyledRoot>
    <Provider store={store}>
      <ErrorBoundary>
        <Viewer />
      </ErrorBoundary>
    </Provider>
  </StyledRoot>
);
