import { ESTIMATE_STATUSES } from './docStatuses.js';

export function getEstimateStoredStatus(e) {
  const status = e?.status;
  if (ESTIMATE_STATUSES.includes(status)) {
    return status;
  }
  return 'draft';
}
