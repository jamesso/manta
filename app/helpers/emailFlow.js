import { getDefaultPreviewConfigs } from '../../preview/constants/defaultConfigs';
import { updateContact } from '../actions/contacts';
import { markInvoiceSent } from '../actions/invoices';
import { toast } from '@/components/ui/toast';
import i18n from '../../i18n/i18n';
import { buildEmailDraft, canEmail, resolveRecipient } from './emailDraft';
import { askEmail } from './emailPrompt';
import { getInvoiceNumber } from './invoice';
import { snapshotProfileForInvoice } from './snapshotProfile';

function defaultSettings() {
  return window.manta.settings;
}

export function captureAppSnapshot(invoice, settings = defaultSettings()) {
  const invoiceSettings = settings.get('invoice');
  const generalSettings = settings.get('general');
  const configs =
    invoice.configs ??
    getDefaultPreviewConfigs(invoiceSettings, generalSettings);
  const language = configs.language ?? generalSettings.language;
  return {
    profile: snapshotProfileForInvoice(invoice, settings.get('profile')),
    configs,
    language,
  };
}

function translateAt(t, language) {
  return (key, opts) => t(key, { ...opts, lng: language });
}

export async function runEmailFlow(
  { invoice, kind, source = 'app', snapshot, previewToken },
  deps = {}
) {
  const ipc = deps.ipc ?? window.manta.ipc;
  const settings = deps.settings ?? defaultSettings();
  const contacts = deps.contacts ?? [];
  const allSalesDocs = deps.allSalesDocs ?? [];
  const dispatch = deps.dispatch;
  const t = deps.t ?? i18n.t.bind(i18n);
  const now = deps.now ?? Date.now;

  if (!canEmail(invoice)) {
    toast.add({ title: t('email:toast:notSaved'), type: 'warning' });
    return 'invalid';
  }

  let { email, contact } = resolveRecipient(invoice, contacts);
  if (!email) {
    const client =
      invoice.recipient?.fullname ||
      invoice.recipient?.company ||
      t('common:client');
    const answer = await askEmail({
      client,
      email: invoice.recipient?.email ?? '',
      canSave: Boolean(contact),
    });
    if (!answer) {
      return 'canceled';
    }
    email = answer.email;
    if (answer.saveToClient && contact) {
      dispatch(updateContact({ ...contact, email: answer.email }));
    }
  }

  const flowSnapshot =
    source === 'preview' && snapshot
      ? snapshot
      : captureAppSnapshot(invoice, settings);

  const draft = buildEmailDraft(invoice, kind, {
    to: email,
    invoiceSettings: settings.get('invoice'),
    profile: flowSnapshot.profile,
    t: translateAt(t, flowSnapshot.language),
    allSalesDocs,
    dateFormat: flowSnapshot.configs?.dateFormat,
  });

  const res = await ipc.invoke('email-invoice', {
    invoiceId: invoice._id,
    kind,
    invoice,
    draft,
    fileBase: getInvoiceNumber(invoice),
    source,
    snapshot: flowSnapshot,
    previewToken,
  });

  if (res.ok) {
    const hint = t('email:toast:openedHint', { fileName: res.fileName });
    const truncatedNote = res.truncated ? ` ${t('email:toast:truncated')}` : '';
    toast.add({
      title: t('email:toast:opened'),
      description: `${hint}${truncatedNote}`,
      timeout: 0,
      actionProps: {
        children: t(
          kind === 'reminder'
            ? 'email:actions:markReminded'
            : 'email:actions:markSent'
        ),
        onClick: () => dispatch(markInvoiceSent(invoice._id, kind)),
      },
    });
    if (res.truncated && typeof res.fullMessage === 'string') {
      toast.add({
        title: t('email:actions:copyFullMessage'),
        timeout: 0,
        actionProps: {
          children: t('email:actions:copyFullMessage'),
          onClick: async () => {
            const copyRes = await ipc.invoke(
              'copy-email-message',
              res.fullMessage
            );
            if (copyRes?.ok) {
              toast.add({ title: t('email:toast:copied') });
            } else {
              toast.add({
                title: t('email:toast:failed', { reason: copyRes?.error }),
                type: 'warning',
              });
            }
          },
        },
      });
    }
    return 'ok';
  }

  if (res.error === 'no-mail-app') {
    toast.add({
      title: t('email:toast:noMailApp'),
      timeout: 0,
      actionProps: {
        children: t('settings:backup:showFile'),
        onClick: () => ipc.send('reveal-file', res.pdfPath),
      },
    });
    return 'no-mail';
  }

  toast.add({
    title: t('email:toast:failed', { reason: res.error }),
    type: 'warning',
  });
  return 'error';
}
