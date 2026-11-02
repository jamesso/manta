import * as ACTION_TYPES from '../constants/actions.jsx';
import { createAction } from 'redux-actions';

export const getRecurring = createAction(ACTION_TYPES.RECURRING_GET_ALL);
export const saveRecurring = createAction(ACTION_TYPES.RECURRING_SAVE);
export const setRecurringActive = createAction(
  ACTION_TYPES.RECURRING_SET_ACTIVE
);
export const deleteRecurring = createAction(ACTION_TYPES.RECURRING_DELETE);
export const restoreRecurring = createAction(ACTION_TYPES.RECURRING_RESTORE);
export const updateRecurringTemplate = createAction(
  ACTION_TYPES.RECURRING_TEMPLATE_UPDATE
);
export const runRecurring = createAction(ACTION_TYPES.RECURRING_RUN);
