import { applyItemToRow } from '../../../../helpers/items';
import {
  shouldAddRowOnEnter,
  shouldApplyTextChange,
} from '../ItemAutocomplete';

describe('ItemAutocomplete behavior', () => {
  it('skips text updates after item selection', () => {
    expect(shouldApplyTextChange('item-press', false)).toBe(false);
    expect(shouldApplyTextChange('input-change', false)).toBe(true);
    expect(shouldApplyTextChange('input-change', true)).toBe(false);
  });

  it('adds a row on Enter only when popup is closed', () => {
    expect(
      shouldAddRowOnEnter({ key: 'Enter', open: false, isComposing: false })
    ).toBe(true);
    expect(
      shouldAddRowOnEnter({ key: 'Enter', open: true, isComposing: false })
    ).toBe(false);
    expect(
      shouldAddRowOnEnter({ key: 'Enter', open: false, isComposing: true })
    ).toBe(false);
  });

  it('pick applies price and unit without mutating the source row', () => {
    const row = Object.freeze({
      id: 'r1',
      description: 'de',
      price: 5,
      quantity: 2,
      unitCode: 'C62',
      subtotal: 10,
    });
    const next = applyItemToRow(row, {
      name: 'Design',
      description: '',
      unitPrice: 80,
      unitCode: 'HUR',
    });
    expect(next.price).toBe(80);
    expect(next.unitCode).toBe('HUR');
    expect(next.quantity).toBe(2);
    expect(row.price).toBe(5);
  });
});
