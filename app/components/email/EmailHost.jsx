import React, { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import EmailAddressDialog from './EmailAddressDialog';
import { getAllSalesDocs } from '../../reducers/InvoicesReducer';
import { getContacts } from '../../reducers/ContactsReducer';
import { runEmailFlow } from '../../helpers/emailFlow';

const ipc = window.manta.ipc;

export function useEmailInvoice() {
  const dispatch = useDispatch();
  const contacts = useSelector(getContacts);
  const allSalesDocs = useSelector(getAllSalesDocs);

  return useCallback(
    (invoice, kind = 'invoice') =>
      runEmailFlow({ invoice, kind }, { dispatch, contacts, allSalesDocs }),
    [dispatch, contacts, allSalesDocs]
  );
}

export default function EmailHost() {
  const dispatch = useDispatch();
  const contacts = useSelector(getContacts);
  const allSalesDocs = useSelector(getAllSalesDocs);

  useEffect(() => {
    const onRequest = (_event, payload) => {
      if (!payload?.invoice) {
        return;
      }
      runEmailFlow(
        {
          invoice: payload.invoice,
          kind: 'invoice',
          source: payload.source ?? 'preview',
          snapshot: payload.snapshot,
          previewToken: payload.previewToken,
        },
        { dispatch, contacts, allSalesDocs }
      );
    };
    ipc.on('request-email-invoice', onRequest);
    return () => {
      ipc.removeAllListeners(['request-email-invoice']);
    };
  }, [dispatch, contacts, allSalesDocs]);

  return <EmailAddressDialog />;
}
