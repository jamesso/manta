import React, { PureComponent } from 'react';
import i18n from '../../../i18n/i18n';
import * as dialog from '@/lib/dialog';
import { toast } from '@/components/ui/toast';
import { Notify } from '../../../helpers/notify';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Download, RefreshCw } from 'lucide-react';

const ipc = window.manta.ipc;

class AppUpdate extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      checking: false,
      downloading: false,
      progress: null,
    };
    this.hideIndicator = this.hideIndicator.bind(this);
    this.onUpdateAvailable = this.onUpdateAvailable.bind(this);
    this.onUpdateDownloaded = this.onUpdateDownloaded.bind(this);
    this.onUpdateNotAvailable = this.onUpdateNotAvailable.bind(this);
    this.onUpdateError = this.onUpdateError.bind(this);
  }

  componentDidMount() {
    ipc.on('update-checking', () => {
      this.setState({ checking: true });
    });
    ipc.on('update-available', this.onUpdateAvailable);
    ipc.on('update-not-available', this.onUpdateNotAvailable);
    ipc.on('update-error', this.onUpdateError);
    ipc.on('update-download-progress', (_e, percentage) => {
      this.setState({ progress: percentage });
    });
    ipc.on('update-downloaded', this.onUpdateDownloaded);
  }

  componentWillUnmount() {
    ipc.removeAllListeners([
      'update-checking',
      'update-available',
      'update-not-available',
      'update-error',
      'update-download-progress',
      'update-downloaded',
    ]);
  }

  async onUpdateAvailable() {
    this.hideIndicator();
    const ok = await dialog.confirm({
      title: i18n.t('dialog:appUpdate:available:title'),
      message: i18n.t('dialog:appUpdate:available:message'),
      confirmLabel: i18n.t('common:yes'),
      cancelLabel: i18n.t('common:noThanks'),
    });
    if (ok) {
      this.setState({ downloading: true });
      ipc.send('update-download-started');
    }
  }

  onUpdateNotAvailable() {
    toast.add({
      type: 'info',
      title: i18n.t('dialog:appUpdate:noUpdate:title'),
      description: i18n.t('dialog:appUpdate:noUpdate:message'),
    });
    this.hideIndicator();
  }

  onUpdateError(_e, error) {
    dialog.alert({
      type: 'warning',
      title: i18n.t('dialog:appUpdate:error:title'),
      message: error,
    });
    this.hideIndicator();
  }

  async onUpdateDownloaded() {
    Notify({
      title: i18n.t('dialog:appUpdate:downloaded:title'),
      body: i18n.t('dialog:appUpdate:downloaded:message'),
    });
    this.hideIndicator();
    const ok = await dialog.confirm({
      title: i18n.t('dialog:appUpdate:downloaded:title'),
      message: i18n.t('dialog:appUpdate:downloaded:message'),
      confirmLabel: i18n.t('dialog:appUpdate:downloaded:quitNow'),
      cancelLabel: i18n.t('dialog:appUpdate:downloaded:later'),
    });
    if (ok) ipc.send('quit-and-install');
  }

  hideIndicator() {
    this.setState({
      checking: false,
      downloading: false,
      progress: null,
    });
  }

  render() {
    const { checking, downloading, progress } = this.state;
    const label = checking
      ? i18n.t('app:update:checking')
      : downloading
        ? i18n.t('app:update:downloading', {
            percent: Math.round(progress || 0),
          })
        : i18n.t('app:update:check');

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={label}
          disabled={checking || downloading}
          onClick={() => ipc.send('check-for-updates')}
        >
          {downloading ? (
            <Download />
          ) : (
            <RefreshCw className={checking ? 'animate-spin' : undefined} />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate">{label}</span>
            {downloading && (
              <div className="group-data-[collapsible=icon]:hidden h-1 rounded bg-sidebar-accent">
                <div
                  className="h-1 rounded bg-primary"
                  style={{ width: `${progress || 0}%` }}
                />
              </div>
            )}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
}

export default AppUpdate;
