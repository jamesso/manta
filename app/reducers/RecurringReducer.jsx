import { handleActions, combineActions } from 'redux-actions';
import * as Actions from '../actions/recurring';

const RecurringReducer = handleActions(
  {
    [combineActions(
      Actions.getRecurring,
      Actions.saveRecurring,
      Actions.setRecurringActive,
      Actions.deleteRecurring,
      Actions.restoreRecurring,
      Actions.updateRecurringTemplate
    )]: (state, action) => action.payload,
  },
  []
);

export default RecurringReducer;
