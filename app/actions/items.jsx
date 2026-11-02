import * as ACTION_TYPES from '../constants/actions.jsx';
import { createAction } from 'redux-actions';

export const getAllItems = createAction(ACTION_TYPES.ITEM_GET_ALL);

export const saveItem = createAction(ACTION_TYPES.ITEM_SAVE, doc => doc);

export const updateItem = createAction(
  ACTION_TYPES.ITEM_UPDATE,
  doc => doc,
  (_doc, messageKey = 'messages:item:updated') => ({ messageKey })
);

export const deleteItem = createAction(
  ACTION_TYPES.ITEM_DELETE,
  idOrIds => idOrIds
);

export const restoreItems = createAction(
  ACTION_TYPES.ITEM_RESTORE,
  docs => docs
);
