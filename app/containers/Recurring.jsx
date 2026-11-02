import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as UIActions from '../actions/ui';
import * as ACTION_TYPES from '../constants/actions.jsx';
import RecurringEmpty from '../components/recurring/RecurringEmpty';
import RecurringTable from '../components/recurring/RecurringTable';
import RecurringSheet from '../components/recurring/RecurringSheet';

export default function Recurring() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const profiles = useSelector(s => s.recurring) || [];
  const contacts = useSelector(s => s.contacts) || [];

  const openNewTemplate = () => {
    dispatch({
      type: ACTION_TYPES.FORM_LOAD_TEMPLATE,
      payload: { template: {}, profileId: null, contacts },
    });
    dispatch(UIActions.changeActiveTab('form'));
  };

  const sorted = [...profiles].sort((a, b) =>
    (a.nextDate || '').localeCompare(b.nextDate || '')
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('recurring:header:name')}</h1>
        {sorted.length > 0 ? (
          <Button type="button" onClick={openNewTemplate}>
            <Plus className="size-4" />
            {t('recurring:header:new')}
          </Button>
        ) : null}
      </div>
      {sorted.length === 0 ? (
        <RecurringEmpty onNew={openNewTemplate} />
      ) : (
        <RecurringTable profiles={sorted} contacts={contacts} />
      )}
      <RecurringSheet />
    </div>
  );
}
