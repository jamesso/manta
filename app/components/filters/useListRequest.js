import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as UIActions from '../../actions/ui';

// Applies a `UIActions.openList(page, request)` request once, then clears it.
export function useListRequest(page, apply) {
  const dispatch = useDispatch();
  const request = useSelector(s => s.ui.listRequest);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (request?.page !== page) return;
    applyRef.current(request);
    dispatch(UIActions.clearListRequest());
  }, [request, page, dispatch]);
}
