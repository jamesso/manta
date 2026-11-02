import { firstOrNull, setBaseFontSize, toConfigValue } from '../index';

it('stores slider font size as a string', () => {
  expect(toConfigValue('fontSize', [300])).toBe('300');
});

it('stores slider logo size as a string', () => {
  expect(toConfigValue('logoSize', 22.5)).toBe('22.5');
});

it('keeps a slider font size on the size scale', () => {
  expect(setBaseFontSize(toConfigValue('fontSize', [300]))).toBe('1.025em');
});

it('leaves other config values unchanged', () => {
  expect(toConfigValue('language', 'de')).toBe('de');
});

it('ignores an empty toggle group', () => {
  expect(firstOrNull([])).toBe(null);
});

it('reads the pressed toggle value', () => {
  expect(firstOrNull(['business'])).toBe('business');
});
