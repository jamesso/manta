// Libs
import React, { Component } from 'react';
import PropTypes from 'prop-types';

// Styles
import styled from 'styled-components';

const Wrapper = styled.div`
  display: flex;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
  overflow: auto;
  padding-top: 30px;
`;

const Message = styled.p`
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 12px;
  height: 100%;
  margin: 0;
`;

// Components
import { InvoiceTemplate } from '../templates';

class MainContent extends Component {
  render() {
    const { t, invoice } = this.props;
    return (
      <Wrapper>
        {invoice._id ? (
          <div className="print-area" data-invoice-id={invoice._id}>
            <div className="paper" dir="ltr">
              <InvoiceTemplate {...this.props} />
            </div>
          </div>
        ) : (
          <Message>{t('preview:common:chooseInvoiceToPreview')}</Message>
        )}
      </Wrapper>
    );
  }
}

MainContent.propTypes = {
  configs: PropTypes.object.isRequired,
  invoice: PropTypes.object.isRequired,
  profile: PropTypes.object.isRequired,
  UILang: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired,
};

export default MainContent;
