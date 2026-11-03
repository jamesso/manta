import React, { Component } from 'react';
import PropTypes from 'prop-types';

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
        data-over={this.state.isOver || undefined}
        className="-m-3 flex size-[calc(100%+1.5rem)] items-center justify-center rounded-2xl border-2 border-dashed border-border p-3 text-center text-xs text-muted-foreground transition-colors data-over:border-brand data-over:bg-brand/10 data-over:text-foreground"
        onDragOver={this.onDragOver}
        onDragLeave={this.onDragLeave}
        onDrop={this.onDrop}
      >
        {this.props.label}
      </div>
    );
  }
}

TargetBox.propTypes = { onDrop: PropTypes.func, label: PropTypes.string };

export default TargetBox;
