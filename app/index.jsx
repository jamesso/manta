import '../ui/styles/globals.css';
import '../static/css/ionicons.min.css';
import '../static/css/layout.css';
import '../static/css/form.css';
import '../static/css/contact.css';
import '../static/css/items.css';
import '../static/css/date-picker.css';

import './renderers/startup.js';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import configureStore from './store';
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';
import StyledRoot from './components/shared/StyledRoot';
import DialogHost from './components/layout/DialogHost';
import { UpdateProvider } from './components/layout/UpdateProvider';
import { Toaster } from '@/components/ui/toast';

document.documentElement.dataset.platform = window.manta.platform;

const store = configureStore();

createRoot(document.getElementById('root')).render(
  <StyledRoot>
    <Provider store={store}>
      <UpdateProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </UpdateProvider>
      <DialogHost />
      <Toaster />
    </Provider>
  </StyledRoot>
);
