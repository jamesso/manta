export function createSingleFlight(fn) {
  let inFlight = null;

  return function run(...args) {
    if (inFlight) {
      return inFlight;
    }
    inFlight = Promise.resolve(fn(...args)).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
