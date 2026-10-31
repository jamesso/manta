import { getPrintOptions } from '../print-options.js';

describe('getPrintOptions', () => {
  it('defaults when saved is undefined', () => {
    const options = getPrintOptions(undefined);
    expect(options.margins.marginType).toBe('default');
    expect(options.preferCSSPageSize).toBe(true);
    expect(options.printBackground).toBe(true);
    expect(options.landscape).toBe(false);
  });

  it('maps marginsType 1 to none', () => {
    expect(getPrintOptions({ marginsType: 1 }).margins.marginType).toBe('none');
  });

  it('maps marginsType 2 to printableArea', () => {
    expect(getPrintOptions({ marginsType: 2 }).margins.marginType).toBe(
      'printableArea'
    );
  });

  it('keeps margins.marginType custom', () => {
    expect(
      getPrintOptions({ margins: { marginType: 'custom' } }).margins.marginType
    ).toBe('custom');
  });
});
