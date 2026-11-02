import { snapshotProfileForInvoice } from '../snapshotProfile';

describe('snapshotProfileForInvoice', () => {
  it('prefers stored seller fields over settings profile', () => {
    const profile = snapshotProfileForInvoice(
      {
        seller: { company: 'Seller Co', fullname: 'Seller Name' },
      },
      { company: 'Settings Co', fullname: 'Settings Name', logo: 'logo-data' }
    );
    expect(profile.company).toBe('Seller Co');
    expect(profile.fullname).toBe('Seller Name');
    expect(profile.logo).toBe('logo-data');
  });
});
