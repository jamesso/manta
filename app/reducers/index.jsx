import { combineReducers } from 'redux';
import UIReducer from './UIReducer';
import FormReducer from './FormReducer';
import InvoicesReducer from './InvoicesReducer';
import ContactsReducer from './ContactsReducer';
import ItemsReducer from './ItemsReducer';
import SettingsReducer from './SettingsReducer';
import BootstrapReducer from './BootstrapReducer';

export default combineReducers({
  ui: UIReducer,
  form: FormReducer,
  invoices: InvoicesReducer,
  contacts: ContactsReducer,
  items: ItemsReducer,
  settings: SettingsReducer,
  startup: BootstrapReducer,
});
