import * as ACTION_TYPES from '../constants/actions.jsx';
import { createAction } from 'redux-actions';

export const convertEstimate = createAction(
  ACTION_TYPES.ESTIMATE_CONVERT,
  estimate => estimate
);

export const markEstimateConverted = createAction(
  ACTION_TYPES.ESTIMATE_MARK_CONVERTED,
  payload => payload
);
