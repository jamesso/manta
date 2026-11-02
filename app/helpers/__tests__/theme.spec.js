import { nextTheme } from '../theme.js';

describe('nextTheme', () => {
  it('cycles system → light → dark → system', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });

  it('falls back unknown values to light', () => {
    expect(nextTheme(undefined)).toBe('light');
    expect(nextTheme('invalid')).toBe('light');
  });
});
