import { act, renderHook } from '@testing-library/react';

import { usePagination } from '../DataTable';

describe('usePagination', () => {
  it('goes back to page 1 only when a reset value changes', () => {
    const { result, rerender } = renderHook(({ deps }) => usePagination(deps), {
      initialProps: { deps: ['', []] },
    });

    act(() => result.current[1](prev => ({ ...prev, pageIndex: 2 })));
    expect(result.current[0].pageIndex).toBe(2);

    // Same values in a new array (a normal re-render): keep the page.
    rerender({ deps: ['', []] });
    expect(result.current[0].pageIndex).toBe(2);

    // The search changed: back to page 1, keep the page size.
    rerender({ deps: ['acme', []] });
    expect(result.current[0]).toEqual({ pageIndex: 0, pageSize: 50 });
  });
});
