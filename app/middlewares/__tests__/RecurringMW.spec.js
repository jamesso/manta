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
  getAllDocs,
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
    getAllDocs.mockClear();
    getAllDocs.mockImplementation(async db => [...mockData[`${db}Records`]]);
    removeDocs.mockResolvedValue({ removed: [], succeeded: [], failed: [] });
    restoreDocs.mockResolvedValue({ succeeded: [], failed: [] });
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

  it('dispatches getInvoices and openList when drafts are created', async () => {
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
    expect(dispatch).toHaveBeenCalledWith(
      UIActions.openList('invoices', { status: 'draft' })
    );
  });

  it.each([
    ['save', false],
    ['save', true],
    ['pause', false],
    ['pause', true],
  ])(
    'reloads profiles once after %s and its runner (runner failure: %s)',
    async (kind, failRun) => {
      const profile = {
        _id: 'rp1',
        _rev: '1-profile',
        name: 'Plan',
        active: true,
        interval: 'monthly',
        every: 1,
        startDate: '2026-01-01',
        nextDate: '2026-01-01',
        anchorDay: 1,
        template: {
          recipient: { fullname: 'Client' },
          rows: [{ price: '1', quantity: '1' }],
        },
      };
      mockData.recurringRecords = [profile];
      runRecurringOnceMock.mockImplementationOnce(async () => {
        if (failRun) throw new Error('runner load failed');
        mockData.recurringRecords[0] = {
          ...mockData.recurringRecords[0],
          nextDate: '2027-01-01',
          _rev: '3-checkpoint',
        };
        return { created: 0, skipped: 0, capped: [], errors: [] };
      });
      dispatch.mockImplementation(action => middleware(action));
      const action =
        kind === 'save'
          ? Actions.saveRecurring({ ...profile, name: 'Updated' })
          : Actions.setRecurringActive({ id: profile._id, active: false });
      expect(await middleware(action)).toBe(true);
      await vi.waitFor(() =>
        expect(
          next.mock.calls.some(
            ([action]) => action.type === ACTION_TYPES.RECURRING_GET_ALL
          )
        ).toBe(true)
      );
      const refreshed = next.mock.calls.find(
        ([action]) => action.type === ACTION_TYPES.RECURRING_GET_ALL
      )[0].payload;
      expect(refreshed).toEqual(mockData.recurringRecords);
      expect(refreshed[0]).toMatchObject(
        kind === 'save' ? { name: 'Updated' } : { active: false }
      );
      expect(refreshed[0]._rev).toBe(failRun ? '2-mock' : '3-checkpoint');
      expect(getAllDocs.mock.calls).toEqual([['recurring']]);
    }
  );

  it('restores removed profiles from the delete undo action', async () => {
    const removed = [{ _id: 'rp1', name: 'Plan' }];
    removeDocs.mockResolvedValueOnce({
      removed,
      failed: [],
      succeeded: [],
    });
    restoreDocs.mockResolvedValueOnce({ succeeded: [], failed: [] });
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
