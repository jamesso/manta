/** Keep in sync with the defaults in `app.js` `setInitialValues()`. */
export const PLACEHOLDER_PROFILE = {
  fullname: 'Manta Ray',
  company: 'Oceanic Preservation Society',
};

/**
 * Profiles installed before commit `9ae5798` may store an older default logo, so
 * "Add logo" can show as done for them. Existing users never had `exportedPdf`;
 * that item stays open until their next export.
 */
export function isDefaultLogo(logo, defaultLogoDataUrl) {
  return logo === defaultLogoDataUrl;
}

function profileDone(profile) {
  const fields = ['fullname', 'company'];
  return fields.some(key => {
    const value = profile?.[key];
    if (typeof value !== 'string') {
      return false;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    return trimmed !== PLACEHOLDER_PROFILE[key];
  });
}

export function getChecklistState(
  { profile, onboarding },
  invoices,
  contacts,
  defaultLogoDataUrl
) {
  const dismissed = onboarding?.dismissed === true;
  const items = [
    { id: 'profile', done: profileDone(profile) },
    {
      id: 'logo',
      done:
        typeof profile?.logo === 'string' &&
        profile.logo.trim() !== '' &&
        !isDefaultLogo(profile.logo, defaultLogoDataUrl),
    },
    { id: 'client', done: contacts.length > 0 },
    { id: 'invoice', done: invoices.length > 0 },
    { id: 'pdf', done: onboarding?.exportedPdf === true },
  ];
  const doneCount = items.filter(i => i.done).length;
  return {
    items,
    doneCount,
    total: items.length,
    allDone: doneCount === items.length,
    dismissed,
  };
}
