import { handleActions, combineActions } from 'redux-actions';
import { createSelector } from 'reselect';
import * as Actions from '../actions/items';

const ItemsReducer = handleActions(
  {
    [combineActions(
      Actions.getAllItems,
      Actions.saveItem,
      Actions.updateItem,
      Actions.deleteItem,
      Actions.restoreItems
    )]: (state, action) => action.payload,
  },
  []
);

export default ItemsReducer;

export const getItems = state => state.items;

export const getActiveItems = createSelector([getItems], items =>
  items.filter(item => !item.archived)
);
