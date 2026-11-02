import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_PROFILE,
  getChecklistState,
  isDefaultLogo,
} from '../onboarding';

const defaultLogo = 'data:image/svg+xml;base64,abc';

describe('getChecklistState', () => {
  const baseProfile = {
    ...PLACEHOLDER_PROFILE,
    logo: defaultLogo,
  };

  it('fresh defaults show zero done', () => {
    const state = getChecklistState(
      {
        profile: baseProfile,
        onboarding: { dismissed: false, exportedPdf: false },
      },
      [],
      [],
      defaultLogo
    );
    expect(state.doneCount).toBe(0);
    expect(state.total).toBe(5);
    expect(state.allDone).toBe(false);
  });

  it('changed company marks profile done', () => {
    const state = getChecklistState(
      {
        profile: { ...baseProfile, company: 'Acme Corp' },
        onboarding: {},
      },
      [],
      [],
      defaultLogo
    );
    expect(state.items.find(i => i.id === 'profile').done).toBe(true);
  });

  it('empty strings do not count as profile done', () => {
    const state = getChecklistState(
      {
        profile: { ...baseProfile, company: '   ' },
        onboarding: {},
      },
      [],
      [],
      defaultLogo
    );
    expect(state.items.find(i => i.id === 'profile').done).toBe(false);
  });

  it('detects custom logo', () => {
    const state = getChecklistState(
      {
        profile: { ...baseProfile, logo: 'data:image/png;base64,xyz' },
        onboarding: {},
      },
      [],
      [],
      defaultLogo
    );
    expect(state.items.find(i => i.id === 'logo').done).toBe(true);
    expect(isDefaultLogo(baseProfile.logo, defaultLogo)).toBe(true);
  });

  it('counts contacts and invoices', () => {
    const state = getChecklistState(
      { profile: baseProfile, onboarding: {} },
      [{ _id: '1' }],
      [{ _id: 'c' }],
      defaultLogo
    );
    expect(state.items.find(i => i.id === 'client').done).toBe(true);
    expect(state.items.find(i => i.id === 'invoice').done).toBe(true);
  });

  it('handles exportedPdf and dismissed', () => {
    const state = getChecklistState(
      {
        profile: baseProfile,
        onboarding: { exportedPdf: true, dismissed: true },
      },
      [],
      [],
      defaultLogo
    );
    expect(state.items.find(i => i.id === 'pdf').done).toBe(true);
    expect(state.dismissed).toBe(true);
  });

  it('missing onboarding does not crash', () => {
    const state = getChecklistState(
      { profile: baseProfile },
      [],
      [],
      defaultLogo
    );
    expect(state.items.find(i => i.id === 'pdf').done).toBe(false);
    expect(state.dismissed).toBe(false);
  });

  it('all five done sets allDone', () => {
    const state = getChecklistState(
      {
        profile: {
          fullname: 'Jane',
          company: 'Co',
          logo: 'custom',
        },
        onboarding: { exportedPdf: true },
      },
      [{ _id: '1' }],
      [{ _id: 'c' }],
      defaultLogo
    );
    expect(state.allDone).toBe(true);
  });
});
