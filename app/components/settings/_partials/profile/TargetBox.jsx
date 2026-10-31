import React, { Component } from 'react';
import PropTypes from 'prop-types';

const style = {
  flex: '1',
  background: '#F9FAFA',
  border: '2px dashed #469FE5',
  borderRadius: '4px',
  marginBottom: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '-20px',
};

class TargetBox extends Component {
  constructor(props) {
    super(props);
    this.state = { isOver: false };
    this.onDragOver = this.onDragOver.bind(this);
    this.onDragLeave = this.onDragLeave.bind(this);
    this.onDrop = this.onDrop.bind(this);
  }

  onDragOver(event) {
    event.preventDefault();
    if (!this.state.isOver) this.setState({ isOver: true });
  }

  onDragLeave() {
    this.setState({ isOver: false });
  }

  onDrop(event) {
    event.preventDefault();
    this.setState({ isOver: false });
    const file = event.dataTransfer.files[0];
    if (file && this.props.onDrop) this.props.onDrop(file);
  }

  render() {
    return (
      <div
        style={style}
        onDragOver={this.onDragOver}
        onDragLeave={this.onDragLeave}
        onDrop={this.onDrop}
      >
        {this.state.isOver ? 'Release to drop' : 'Drag file here'}
      </div>
    );
  }
}

TargetBox.propTypes = { onDrop: PropTypes.func };

export default TargetBox;
