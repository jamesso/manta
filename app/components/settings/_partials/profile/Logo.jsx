// Libraries
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

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

  shouldComponentUpdate(nextProps) {
    return this.props.logo !== nextProps.logo;
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
    return (
      <div className="relative flex size-[200px] items-center justify-center rounded border border-black/10 p-5">
        {this.props.logo ? (
          <div className="flex max-h-40 max-w-40">
            <img
              src={this.props.logo}
              alt="Logo"
              className="h-auto w-full max-w-[180px]"
            />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col">
            <TargetBox onDrop={this.handleFileDrop} />
          </div>
        )}
        {this.props.logo ? (
          <button
            type="button"
            onClick={this.removeLogo}
            aria-label="Remove logo"
            className="absolute -top-4 -end-4 cursor-pointer text-[#ec476e]"
          >
            <X aria-hidden="true" className="size-8" />
          </button>
        ) : (
          <button
            type="button"
            onClick={this.selectLogo}
            className="absolute bottom-5 w-4/5 cursor-pointer rounded bg-[#469fe5] px-2 py-1 text-center text-xs tracking-wide text-white uppercase"
          >
            Or Select Photo
          </button>
        )}
      </div>
    );
  }
}

Logo.propTypes = {
  handleLogoChange: PropTypes.func.isRequired,
  logo: PropTypes.string,
};

Logo.defaultProps = {
  logo: null,
};

export default Logo;
