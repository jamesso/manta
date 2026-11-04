import { act, renderHook } from '@testing-library/react';

import { useRowSelection } from '../DataTable';

describe('useRowSelection', () => {
  it('drops selected rows that are no longer visible', () => {
    const { result, rerender } = renderHook(({ ids }) => useRowSelection(ids), {
      initialProps: { ids: ['a', 'b', 'c'] },
    });

    act(() => result.current.setRowSelection({ a: true, c: true }));
    expect(result.current.selectedIds).toEqual(['a', 'c']);

    rerender({ ids: ['a', 'b'] });
    expect(result.current.selectedIds).toEqual(['a']);

    // A hidden row stays unselected when it shows again.
    rerender({ ids: ['a', 'b', 'c'] });
    expect(result.current.selectedIds).toEqual(['a']);
    expect(result.current.rowSelection).toEqual({ a: true });
  });

  it('clears the selection', () => {
    const { result } = renderHook(() => useRowSelection(['a']));
    act(() => result.current.setRowSelection({ a: true }));
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds).toEqual([]);
  });
});
