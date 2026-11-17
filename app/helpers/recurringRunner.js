import { getAllDocs, getSingleDoc, saveDoc, updateDoc } from './pouchDB';
import { getDuePeriods } from './recurringSchedule';
import { buildInvoiceFromProfile, isRecurringPeriodTaken } from './recurring';

const CHECKPOINT_RETRIES = 3;

function periodKeySet(invoices) {
  const existing = new Set();
  for (const inv of invoices) {
    if (inv.recurringId && inv.periodKey) {
      existing.add(`${inv.recurringId}|${inv.periodKey}`);
    }
  }
  return existing;
}

function profileScheduleKey(profile) {
  return [
    profile.interval,
    profile.every,
    profile.startDate,
    profile.anchorDay,
    profile.endDate ?? '',
    profile.active ? '1' : '0',
    JSON.stringify(profile.template ?? {}),
  ].join('|');
}

async function loadFreshProfile(db, profileId) {
  try {
    return await db.getSingleDoc('recurring', profileId);
  } catch {
    return null;
  }
}

function shouldStopProfile(fresh, snapshotKey) {
  if (!fresh) {
    return true;
  }
  if (!fresh.active) {
    return true;
  }
  return profileScheduleKey(fresh) !== snapshotKey;
}

async function confirm409BelongsToPeriod(db, profileId, periodKey) {
  try {
    const doc = await db.getSingleDoc(
      'invoices',
      `rec-${profileId}-${periodKey}`
    );
    return isRecurringPeriodTaken(doc, profileId, periodKey);
  } catch (err) {
    if (err.status === 404) {
      return false;
    }
    throw err;
  }
}

async function saveInvoiceDraft(db, profile, periodKey, now, makeId) {
  const invoice = buildInvoiceFromProfile(profile, periodKey, now, makeId);
  try {
    // The mutation result needs no list reload; this run tracks taken periods.
    await db.saveDoc('invoices', invoice);
    return { ok: true, skipped: false };
  } catch (err) {
    if (err.status === 409) {
      const belongs = await confirm409BelongsToPeriod(
        db,
        profile._id,
        periodKey
      );
      if (belongs) {
        return { ok: true, skipped: true };
      }
      return { ok: false, error: err, periodKey };
    }
    return { ok: false, error: err, periodKey };
  }
}

async function updateProfileCheckpoint(
  db,
  profileId,
  nextDate,
  lastRunAt,
  profileNextDate
) {
  for (let attempt = 0; attempt < CHECKPOINT_RETRIES; attempt += 1) {
    let fresh;
    try {
      fresh = await db.getSingleDoc('recurring', profileId);
    } catch {
      return { ok: true, skipped: true };
    }
    const keepNext =
      fresh.nextDate !== profileNextDate ? fresh.nextDate : nextDate;
    try {
      await db.updateDoc('recurring', {
        ...fresh,
        nextDate: keepNext,
        lastRunAt,
      });
      return { ok: true };
    } catch (err) {
      if (err.status === 409 && attempt < CHECKPOINT_RETRIES - 1) {
        continue;
      }
      return { ok: false, error: err };
    }
  }
  return { ok: false, error: new Error('checkpoint retries exceeded') };
}

export async function runRecurringOnce({
  now = Date.now(),
  db = { getAllDocs, saveDoc, getSingleDoc, updateDoc },
  makeId = () => crypto.randomUUID(),
} = {}) {
  let created = 0;
  let skipped = 0;
  const capped = [];
  const errors = [];

  const profiles = await db.getAllDocs('recurring');
  const invoices = await db.getAllDocs('invoices');
  const existing = periodKeySet(invoices);

  for (const profile of profiles) {
    const snapshotKey = profileScheduleKey(profile);
    let { periods, nextDate, capped: isCapped } = getDuePeriods(profile, now);
    if (periods.length === 0 && nextDate === profile.nextDate) {
      continue;
    }
    if (isCapped) {
      capped.push(profile.name || profile._id);
    }

    let checkpointNext = nextDate;
    const profileNextAtStart = profile.nextDate;
    let stopProfile = false;

    for (const periodKey of periods) {
      const fresh = await loadFreshProfile(db, profile._id);
      if (shouldStopProfile(fresh, snapshotKey)) {
        checkpointNext = fresh?.nextDate ?? profile.nextDate;
        stopProfile = true;
        break;
      }

      if (existing.has(`${profile._id}|${periodKey}`)) {
        skipped += 1;
        continue;
      }

      const result = await saveInvoiceDraft(db, fresh, periodKey, now, makeId);
      if (result.skipped) {
        skipped += 1;
        existing.add(`${profile._id}|${periodKey}`);
        continue;
      }
      if (!result.ok) {
        errors.push({
          profileId: profile._id,
          error: result.error?.message ?? String(result.error),
        });
        checkpointNext = periodKey;
        break;
      }
      created += 1;
      existing.add(`${profile._id}|${periodKey}`);
    }

    if (!stopProfile && periods.length > 0) {
      const checkpoint = await updateProfileCheckpoint(
        db,
        profile._id,
        checkpointNext,
        now,
        profileNextAtStart
      );
      if (!checkpoint.ok && !checkpoint.skipped) {
        errors.push({
          profileId: profile._id,
          error: checkpoint.error?.message ?? 'checkpoint failed',
        });
      }
    }
  }

  return { created, skipped, capped, errors };
}
