import '../static/css/preview/font.css';
import '../ui/styles/globals.css';

import './renderers/startup.js';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import configureStore from './store';
import App from './App';
import ErrorBoundary from './components/shared/ErrorBoundary';
import DialogHost from './components/layout/DialogHost';
import { UpdateProvider } from './components/layout/UpdateProvider';
import { Toaster } from '@/components/ui/toast';

document.documentElement.dataset.platform = window.manta.platform;

const store = configureStore();

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <UpdateProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </UpdateProvider>
    <DialogHost />
    <Toaster />
  </Provider>
);
