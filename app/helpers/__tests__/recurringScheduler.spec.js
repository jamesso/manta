import { describe, it, expect, vi, afterEach } from 'vitest';
import { startRecurringScheduler } from '../recurringScheduler';

describe('startRecurringScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires on start, interval, and resume', async () => {
    vi.useFakeTimers();
    const trigger = vi.fn();
    const unsubscribe = vi.fn();
    const stop = startRecurringScheduler({
      trigger,
      subscribeResume: cb => {
        cb();
        return unsubscribe;
      },
    });
    expect(trigger).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(trigger).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(trigger).toHaveBeenCalledTimes(3);
    expect(unsubscribe).toHaveBeenCalled();
  });
});
