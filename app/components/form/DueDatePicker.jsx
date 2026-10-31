// Libraries
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

// Styles
import _withFadeInAnimation from '../shared/hoc/_withFadeInAnimation';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  margin-bottom: 20px;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  --rdp-accent-color: #469fe5;
`;

const DateButton = styled.button`
  flex: 1;
  text-align: left;
  padding: 6px 12px;
  border: 1px solid #e0e1e1;
  border-radius: 4px;
  background: #fff;
  color: #292b2c;
`;

// Component
export class DueDatePicker extends PureComponent {
  constructor(props) {
    super(props);
    this.state = { focused: false };
    this.onFocusChange = this.onFocusChange.bind(this);
    this.onDateChange = this.onDateChange.bind(this);
    this.onSelect = this.onSelect.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.clearDate = this.clearDate.bind(this);
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevState.focused && this.state.focused) {
      document.addEventListener('keydown', this.onKeyDown);
    }
    if (prevState.focused && !this.state.focused) {
      document.removeEventListener('keydown', this.onKeyDown);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onFocusChange() {
    this.setState({ focused: !this.state.focused });
  }

  onKeyDown(event) {
    if (event.key === 'Escape') this.setState({ focused: false });
  }

  onSelect(date) {
    this.onDateChange(date || null);
    this.setState({ focused: false });
  }

  onDateChange(date) {
    const selectedDate = date === null ? null : moment(date).toObject();
    this.props.updateCustomDate(selectedDate);
  }

  clearDate() {
    this.onDateChange(null);
  }

  render() {
    const { t, selectedDate } = this.props;
    const dueDate = selectedDate === null ? null : moment(selectedDate);
    return (
      <Container>
        <DateButton type="button" id="invoice-duedate" onClick={this.onFocusChange}>
          {dueDate ? dueDate.format('DD/MM/YYYY') : t('form:fields:dueDate:placeHolder')}
        </DateButton>
        {this.state.focused && (
          <Overlay onClick={this.onFocusChange}>
            <div onClick={e => e.stopPropagation()}>
              <DayPicker
                mode="single"
                weekStartsOn={1}
                selected={dueDate ? dueDate.toDate() : undefined}
                defaultMonth={dueDate ? dueDate.toDate() : undefined}
                onSelect={this.onSelect}
              />
            </div>
          </Overlay>
        )}
        {selectedDate !== null && (
          <a className="clearDateBtn active" href="#" onClick={this.clearDate}>
            <i className="ion-close-circled" />
          </a>
        )}
      </Container>
    );
  }
}

DueDatePicker.propTypes = {
  selectedDate: PropTypes.object,
  t: PropTypes.func.isRequired,
  updateCustomDate: PropTypes.func.isRequired,
};

DueDatePicker.defaultProps = {
  selectedDate: null,
};

// Export
export default _withFadeInAnimation(DueDatePicker);
