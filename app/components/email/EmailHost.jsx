import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import EmailAddressDialog from './EmailAddressDialog';
import { getAllSalesDocs } from '../../reducers/InvoicesReducer';
import { getContacts } from '../../reducers/ContactsReducer';
import { runEmailFlow } from '../../helpers/emailFlow';

export function useEmailInvoice() {
  const dispatch = useDispatch();
  const contacts = useSelector(getContacts);
  const allSalesDocs = useSelector(getAllSalesDocs);

  return useCallback(
    (invoice, kind = 'invoice', configs) =>
      runEmailFlow(
        { invoice, kind, configs },
        { dispatch, contacts, allSalesDocs }
      ),
    [dispatch, contacts, allSalesDocs]
  );
}

export default function EmailHost() {
  return <EmailAddressDialog />;
}
