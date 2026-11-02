// Redux
import { createStore, applyMiddleware, compose } from 'redux';

// Root Reducer
import rootReducer from '../reducers';

// Custom Middleware
import MeasureMW from '../middlewares/MeasureMW';
import FormMW from '../middlewares/FormMW';
import ContactsMW from '../middlewares/ContactsMW';
import ItemsMW from '../middlewares/ItemsMW';
import InvoicesMW from '../middlewares/InvoicesMW';
import SettingsMW from '../middlewares/SettingsMW';
import UIMiddleware from '../middlewares/UIMiddleware';

// Default Middlewares
const middlewares = [
  FormMW,
  ContactsMW,
  ItemsMW,
  InvoicesMW,
  SettingsMW,
  UIMiddleware,
];

// Dev Mode Middlewares
const isDev = import.meta.env.DEV;
if (isDev) {
  middlewares.unshift(MeasureMW);
}

// Redux Devtool
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

export default function configureStore(initialState) {
  const store = createStore(
    rootReducer,
    initialState,
    composeEnhancers(applyMiddleware(...middlewares))
  );
  return store;
}
