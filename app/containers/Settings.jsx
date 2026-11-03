import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import * as Actions from '../actions/settings';
import * as UIActions from '../actions/ui';
import SettingsNav from '../components/settings/SettingsNav';
import Appearance from '../components/settings/sections/Appearance';
import BusinessProfile from '../components/settings/sections/BusinessProfile';
import ExportBackup from '../components/settings/sections/ExportBackup';
import InvoiceDefaults from '../components/settings/sections/InvoiceDefaults';
import LanguageRegion from '../components/settings/sections/LanguageRegion';
import Sounds from '../components/settings/sections/Sounds';
import Updates from '../components/settings/sections/Updates';
import { getCurrentSettings } from '../reducers/SettingsReducer';

export default function Settings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentSettings = useSelector(getCurrentSettings);
  const pendingSection = useSelector(s => s.ui.pendingSettingsSection);
  const [section, setSection] = useState('profile');
  const [errors, setErrors] = useState({});
  const [saveMessage, setSaveMessage] = useState('');
  const flushRef = useRef(async () => ({ ok: true }));

  const registerFlush = useCallback(flush => {
    flushRef.current = flush;
  }, []);

  const changeSection = useCallback(
    async id => {
      if (id === section) {
        return;
      }
      const result = await flushRef.current?.();
      if (result?.ok === false) {
        return;
      }
      setErrors({});
      setSaveMessage('');
      setSection(id);
    },
    [section]
  );

  useEffect(() => {
    if (!pendingSection) {
      return;
    }
    void changeSection(pendingSection).then(() => {
      dispatch(UIActions.clearSettingsSectionRequest());
    });
  }, [pendingSection, changeSection, dispatch]);

  const saveSection = useCallback(
    async (key, data) => {
      const result = await dispatch(Actions.updateSettings(key, data));
      if (result?.ok === false) {
        if (result.errors) {
          setErrors(result.errors);
        }
        if (result.message) {
          setSaveMessage(result.message);
        }
        return result;
      }
      setErrors({});
      setSaveMessage('');
      return result;
    },
    [dispatch]
  );

  if (!currentSettings) {
    return null;
  }

  const { profile, invoice, general } = currentSettings;

  let content = null;
  if (section === 'profile') {
    content = (
      <BusinessProfile
        value={profile}
        invoiceSettings={invoice}
        onSave={data => saveSection('profile', data)}
        errors={errors}
        saveMessage={saveMessage}
        registerFlush={registerFlush}
      />
    );
  } else if (section === 'invoice') {
    content = (
      <InvoiceDefaults
        value={invoice}
        profile={profile}
        onSave={data => saveSection('invoice', data)}
        errors={errors}
        saveMessage={saveMessage}
        registerFlush={registerFlush}
      />
    );
  } else if (section === 'appearance') {
    content = (
      <Appearance
        value={general}
        onSave={data => saveSection('general', data)}
        saveMessage={saveMessage}
        registerFlush={registerFlush}
      />
    );
  } else if (section === 'language') {
    content = (
      <LanguageRegion
        general={general}
        invoice={invoice}
        onSaveGeneral={data => saveSection('general', data)}
        onSaveInvoice={data => saveSection('invoice', data)}
        saveMessage={saveMessage}
        registerFlush={registerFlush}
      />
    );
  } else if (section === 'export') {
    content = (
      <ExportBackup
        invoice={invoice}
        general={general}
        onSaveInvoice={data => saveSection('invoice', data)}
        onSaveGeneral={data => saveSection('general', data)}
        saveMessage={saveMessage}
        registerFlush={registerFlush}
      />
    );
  } else if (section === 'updates') {
    content = <Updates />;
  } else if (section === 'sounds') {
    content = (
      <Sounds
        value={general}
        onSave={data => saveSection('general', data)}
        saveMessage={saveMessage}
        registerFlush={registerFlush}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-5 px-8 pt-7 pb-8 text-foreground">
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">
        {t('settings:header')}
      </h1>
      <div className="grid flex-1 gap-10 md:grid-cols-[13rem_1fr]">
        <SettingsNav active={section} onChange={changeSection} />
        <div className="min-w-0 max-w-3xl">{content}</div>
      </div>
    </div>
  );
}
