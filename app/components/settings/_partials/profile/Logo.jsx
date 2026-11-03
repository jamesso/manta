// Libraries
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ImageUp, Trash2 } from 'lucide-react';
import { withTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

// Helpers
import { processImg } from '../../../../helpers/image';

// Node Libs
const ipc = window.manta.ipc;

// Component
import TargetBox from './TargetBox';

class Logo extends Component {
  constructor(props) {
    super(props);
    this.selectLogo = this.selectLogo.bind(this);
    this.removeLogo = this.removeLogo.bind(this);
    this.handleFileDrop = this.handleFileDrop.bind(this);
  }

  componentDidMount() {
    ipc.on('file-selected', (event, filePath) => {
      this.handleFileUpload(filePath);
    });
  }

  componentWillUnmount() {
    ipc.removeAllListeners('file-selected');
  }

  handleFileUpload(filePath) {
    processImg(filePath, imgSrcString => {
      this.props.handleLogoChange(imgSrcString);
    });
  }

  handleFileDrop(file) {
    this.handleFileUpload(window.manta.getPathForFile(file));
  }

  selectLogo() {
    ipc.send('open-file-dialog');
  }

  removeLogo() {
    this.props.handleLogoChange(null);
  }

  render() {
    const { logo, t } = this.props;
    return (
      <div className="flex items-center gap-4">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-card p-3 shadow-xs">
          {logo ? (
            <img
              src={logo}
              alt="Logo"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <TargetBox
              onDrop={this.handleFileDrop}
              label={t('settings:logo:drop')}
            />
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={this.selectLogo}
          >
            <ImageUp />
            {logo ? t('settings:logo:replace') : t('settings:logo:choose')}
          </Button>
          {logo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={this.removeLogo}
              aria-label={t('settings:logo:remove')}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
              {t('settings:logo:remove')}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
}

Logo.propTypes = {
  handleLogoChange: PropTypes.func.isRequired,
  logo: PropTypes.string,
  t: PropTypes.func.isRequired,
};

Logo.defaultProps = {
  logo: null,
};

export default withTranslation()(Logo);
