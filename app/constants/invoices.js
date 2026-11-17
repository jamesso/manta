export {
  CREDIT_NOTE_STATUSES,
  INVOICE_STATUSES,
} from '../../helpers/docStatuses.js';
export const DISPLAY_STATUSES = [
  'draft',
  'pending',
  'partial',
  'overdue',
  'paid',
  'refunded',
  'cancelled',
];
export const PAYMENT_METHODS = [
  'bank',
  'cash',
  'check',
  'card',
  'paypal',
  'other',
];
export const UNDO_TIMEOUT_MS = 6000;
export const CREDITABLE_STATUSES = ['pending', 'paid', 'refunded'];
