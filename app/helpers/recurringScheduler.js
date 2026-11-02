export function startRecurringScheduler({
  trigger,
  intervalMs = 3_600_000,
  subscribeResume,
}) {
  trigger();
  const intervalId = setInterval(trigger, intervalMs);
  const unsubscribe = subscribeResume(trigger);
  return function stop() {
    clearInterval(intervalId);
    unsubscribe();
  };
}
