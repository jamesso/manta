import ItemsReducer, { getActiveItems, getItems } from '../ItemsReducer';
import * as ACTION_TYPES from '../../constants/actions.jsx';

describe('ItemsReducer', () => {
  const docs = [{ _id: '1', name: 'A', archived: false }];

  it('handles initial state', () => {
    expect(ItemsReducer(undefined, {})).toEqual([]);
  });

  it.each([
    ACTION_TYPES.ITEM_GET_ALL,
    ACTION_TYPES.ITEM_SAVE,
    ACTION_TYPES.ITEM_UPDATE,
    ACTION_TYPES.ITEM_DELETE,
    ACTION_TYPES.ITEM_RESTORE,
  ])('replaces state for %s', type => {
    expect(ItemsReducer([], { type, payload: docs })).toEqual(docs);
  });

  it('getActiveItems excludes archived items', () => {
    const state = {
      items: [
        { _id: '1', archived: false },
        { _id: '2', archived: true },
      ],
    };
    expect(getActiveItems(state)).toEqual([{ _id: '1', archived: false }]);
    expect(getItems(state)).toBe(state.items);
  });
});
