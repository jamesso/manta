import './renderers/startup.js';
import './renderers/menu.js';

// Libraries
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import configureStore from './store';
import i18n from '../i18n/i18n';

// Root Component
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';

// Store
const store = configureStore();

// Render
ReactDOM.render(
  <Provider store={store}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </Provider>,
  document.getElementById('root')
);
