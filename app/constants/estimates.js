export { ESTIMATE_STATUSES } from '../../helpers/docStatuses.js';
export const ESTIMATE_SETTABLE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
];
export const ESTIMATE_TABS = [
  'all',
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
  'converted',
];
export const ESTIMATE_SORT_RANK = {
  expired: 0,
  sent: 1,
  draft: 2,
  accepted: 3,
  declined: 4,
  converted: 5,
};
export const DEFAULT_ESTIMATE_VALID_DAYS = 30;
