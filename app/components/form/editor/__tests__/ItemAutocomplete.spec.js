import { applyItemToRow } from '../../../../helpers/items';
import {
  shouldAddRowOnEnter,
  shouldApplyTextChange,
  shouldBlockAutocompleteEnter,
} from '../ItemAutocomplete';

describe('ItemAutocomplete behavior', () => {
  it('skips text updates after item selection', () => {
    expect(shouldApplyTextChange('item-press', false)).toBe(false);
    expect(shouldApplyTextChange('input-change', false)).toBe(true);
    expect(shouldApplyTextChange('input-change', true)).toBe(false);
  });

  it('blocks IME Enter while the popup is open', () => {
    const event = { key: 'Enter', nativeEvent: { isComposing: true } };
    expect(shouldBlockAutocompleteEnter(event, true, true)).toBe(true);
    expect(shouldBlockAutocompleteEnter(event, false, true)).toBe(false);
  });

  it('adds a row on Enter unless an open popup has a highlighted item', () => {
    expect(
      shouldAddRowOnEnter({ key: 'Enter', open: false, isComposing: false })
    ).toBe(true);
    expect(
      shouldAddRowOnEnter({
        key: 'Enter',
        open: true,
        highlighted: true,
        isComposing: false,
      })
    ).toBe(false);
    expect(
      shouldAddRowOnEnter({
        key: 'Enter',
        open: true,
        highlighted: false,
        isComposing: false,
      })
    ).toBe(true);
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
