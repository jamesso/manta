import moment from 'moment';

export const INTERVALS = ['weekly', 'monthly', 'quarterly', 'yearly'];
export const MAX_PERIODS_PER_RUN = 12;
export const DATE_KEY = 'YYYY-MM-DD';

export function toDateKey(ms) {
  return moment(ms).format(DATE_KEY);
}

export function dateKeyToMs(key) {
  return moment(key, DATE_KEY, true).startOf('day').valueOf();
}

export function isDateKey(value) {
  return typeof value === 'string' && moment(value, DATE_KEY, true).isValid();
}

function validEvery(every) {
  return Number.isInteger(every) && every >= 1;
}

export function nextDateAfter(dateKey, interval, every, anchorDay) {
  const m = moment(dateKey, DATE_KEY, true);
  if (interval === 'weekly') {
    return m.add(every * 7, 'days').format(DATE_KEY);
  }
  let months = 1;
  if (interval === 'monthly') {
    months = every;
  } else if (interval === 'quarterly') {
    months = every * 3;
  } else if (interval === 'yearly') {
    months = every * 12;
  } else {
    throw new Error(`Unknown interval: ${interval}`);
  }
  const next = m.add(months, 'months');
  const dim = next.daysInMonth();
  next.date(Math.min(anchorDay, dim));
  return next.format(DATE_KEY);
}

export function firstPeriodOnOrAfter(profile, dateKey) {
  const { startDate, interval, every, anchorDay } = profile;
  if (
    !isDateKey(startDate) ||
    !INTERVALS.includes(interval) ||
    !validEvery(every)
  ) {
    throw new Error('Invalid profile schedule');
  }
  if (startDate >= dateKey) {
    return startDate;
  }
  let d = startDate;
  for (let i = 0; i < 10000; i += 1) {
    d = nextDateAfter(d, interval, every, anchorDay);
    if (d >= dateKey) {
      return d;
    }
  }
  throw new Error('Schedule loop guard exceeded');
}

export function getDuePeriods(profile, now, maxPerRun = MAX_PERIODS_PER_RUN) {
  const today = toDateKey(now);
  const { interval, every, endDate } = profile;

  if (
    !profile.active ||
    !isDateKey(profile.nextDate) ||
    !INTERVALS.includes(interval) ||
    !validEvery(every)
  ) {
    return { periods: [], nextDate: profile.nextDate, capped: false };
  }

  if (endDate != null && isDateKey(endDate) && profile.nextDate > endDate) {
    return { periods: [], nextDate: profile.nextDate, capped: false };
  }

  const periods = [];
  let d = profile.nextDate;
  let capped = false;

  while (d <= today) {
    if (endDate != null && isDateKey(endDate) && d > endDate) {
      break;
    }
    if (periods.length === maxPerRun) {
      capped = true;
      break;
    }
    periods.push(d);
    d = nextDateAfter(d, interval, every, profile.anchorDay);
  }

  return { periods, nextDate: d, capped };
}
