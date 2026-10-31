// Libs
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { HexColorInput } from 'react-colorful';
import { Section, Label } from '../shared';

const CurrentColor = styled.div`
  width: 100%;
  height: 60px;
  border-radius: 4px;
  background: ${props => props.$color};
`;

const Swatches = styled.div`
  display: flex;
  flex-direction: row;
  gap: 6px;
  margin: 8px 0;
`;

const Swatch = styled.button`
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 2px;
  background: ${props => props.$color};
`;

const HexField = styled(HexColorInput)`
  width: 100%;
  box-sizing: border-box;
`;

class AccentColor extends Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(color) {
    this.props.handleAccentColorChange(color);
  }

  render() {
    const defaultColors = [
      '#D9E3F0',
      '#F47373',
      '#697689',
      '#37D67A',
      '#2CCCE4',
      '#555555',
      '#dce775',
      '#ff8a65',
    ];
    const { t, UILang, accentColor } = this.props;
    return (
      <Section>
        <Label>{t('preview:sidebar:accentColor:name', { lng: UILang })}</Label>
        <CurrentColor $color={accentColor} />
        <Swatches>
          {defaultColors.map(color => (
            <Swatch
              key={color}
              type="button"
              $color={color}
              aria-label={color}
              onClick={() => this.handleChange(color)}
            />
          ))}
        </Swatches>
        <HexField color={accentColor} onChange={this.handleChange} prefixed />
      </Section>
    );
  }
}

AccentColor.propTypes = {
  accentColor: PropTypes.string.isRequired,
  handleAccentColorChange: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  UILang: PropTypes.string.isRequired,
};

export default AccentColor;
