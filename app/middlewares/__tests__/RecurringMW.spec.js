import * as ACTION_TYPES from '../../constants/actions.jsx';
import * as Actions from '../../actions/recurring';
import * as InvoicesActions from '../../actions/invoices';
import * as UIActions from '../../actions/ui';

const { runRecurringOnceMock } = vi.hoisted(() => ({
  runRecurringOnceMock: vi.fn(() =>
    Promise.resolve({ created: 0, skipped: 0, capped: [], errors: [] })
  ),
}));

vi.mock('../../helpers/pouchDB');
vi.mock('@/components/ui/toast', () => ({
  toast: { add: vi.fn(() => 'toast-1'), close: vi.fn() },
}));

vi.mock('../../helpers/recurringRunner', () => ({
  runRecurringOnce: (...args) => runRecurringOnceMock(...args),
}));

import RecurringMW from '../RecurringMW';
import {
  removeDocs,
  restoreDocs,
  mockData,
  resetMockPouchData,
} from '../../helpers/pouchDB';
import { toast } from '@/components/ui/toast';

describe('RecurringMW', () => {
  let next;
  let dispatch;
  let middleware;

  beforeEach(() => {
    resetMockPouchData();
    removeDocs.mockResolvedValue({ removed: [], failed: [], docs: [] });
    restoreDocs.mockResolvedValue([]);
    runRecurringOnceMock.mockClear();
    runRecurringOnceMock.mockResolvedValue({
      created: 0,
      skipped: 0,
      capped: [],
      errors: [],
    });
    next = vi.fn();
    dispatch = vi.fn();
    middleware = RecurringMW({
      dispatch,
      getState: () => ({ recurring: mockData.recurringRecords ?? [] }),
    })(next);
    toast.add.mockClear();
    toast.close.mockClear();
  });

  it('runs the runner once for concurrent RECURRING_RUN actions', async () => {
    let resolveRun;
    const runPromise = new Promise(resolve => {
      resolveRun = resolve;
    });
    runRecurringOnceMock.mockImplementation(() =>
      runPromise.then(() => ({
        created: 0,
        skipped: 0,
        capped: [],
        errors: [],
      }))
    );
    const first = middleware(Actions.runRecurring());
    const second = middleware(Actions.runRecurring());
    await Promise.resolve();
    resolveRun();
    await Promise.all([first, second]);
    expect(runRecurringOnceMock).toHaveBeenCalledTimes(1);
  });

  it('dispatches getInvoices and openInvoicesTab when drafts are created', async () => {
    runRecurringOnceMock.mockResolvedValueOnce({
      created: 2,
      skipped: 0,
      capped: [],
      errors: [],
    });
    await middleware(Actions.runRecurring());
    expect(dispatch).toHaveBeenCalledWith(InvoicesActions.getInvoices());
    const toastCall = toast.add.mock.calls.find(c => c[0]?.actionProps);
    expect(toastCall).toBeDefined();
    toastCall[0].actionProps.onClick();
    expect(dispatch).toHaveBeenCalledWith(UIActions.openInvoicesTab('draft'));
  });

  it('restores removed profiles from the delete undo action', async () => {
    const removed = [{ _id: 'rp1', name: 'Plan' }];
    removeDocs.mockResolvedValueOnce({
      removed,
      failed: [],
      docs: [],
    });
    restoreDocs.mockResolvedValueOnce([]);
    await middleware(Actions.deleteRecurring(['rp1']));
    expect(toast.add).toHaveBeenCalled();
    dispatch.mockClear();
    restoreDocs.mockClear();
    toast.add.mock.calls[0][0].actionProps.onClick();
    expect(dispatch).toHaveBeenCalledWith(Actions.restoreRecurring(removed));
    await middleware(Actions.restoreRecurring(removed));
    expect(restoreDocs).toHaveBeenCalledWith('recurring', removed);
  });
});
