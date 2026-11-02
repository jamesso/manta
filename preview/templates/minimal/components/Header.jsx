// React Libraries
import React from 'react';
import PropTypes from 'prop-types';
import { truncate } from 'lodash';
import moment from 'moment';
import { calTermDate } from '../../../../helpers/date';
import { getIssuedAt } from '../../../../app/helpers/invoice';
import {
  getDocTitleKey,
  isEstimate,
  isCreditNote,
} from '../../../../app/helpers/docType';

// Styles
import styled from 'styled-components';
const Wrapper = styled.div`
  display: flex;
  justify-content: space-between;
  text-transform: capitalize;
`;

const Heading = styled.h1`
  font-family: 'Lora', 'Songti SC', serif;
  font-size: 2.1em;
  font-weight: 400;
  margin-bottom: 1em;
  color: #2c323a;
  ${props =>
    props.customAccentColor &&
    `
    color: ${props.accentColor};
  `};
`;

const Logo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  height: auto;
  ${props =>
    props.logoSize &&
    `
    max-width: ${props.logoSize}%;
  `};
  img {
    width: 100%;
  }
`;

// Component
function Header({ t, invoice, profile, configs }) {
  const { language, logoSize, accentColor, customAccentColor } = configs;
  const { dueDate } = invoice;
  return (
    <Wrapper>
      <div>
        <Heading
          accentColor={accentColor}
          customAccentColor={customAccentColor}
        >
          {t(getDocTitleKey(invoice), { lng: language })}
        </Heading>
        <h4 className="label">
          #{' '}
          {invoice.invoiceID
            ? invoice.invoiceID
            : truncate(invoice._id, {
                length: 8,
                omission: '',
              })}
        </h4>
        <p>
          {t('preview:common:created', { lng: language })}:{' '}
          {moment(getIssuedAt(invoice))
            .lang(language)
            .format(configs.dateFormat)}
        </p>
        {isCreditNote(invoice) && invoice.creditedInvoice ? (
          <p>
            {t('preview:common:creditsInvoice', {
              lng: language,
              number: invoice.creditedInvoice.invoiceID ?? '',
              date: invoice.creditedInvoice.issuedAt
                ? moment(invoice.creditedInvoice.issuedAt)
                    .lang(language)
                    .format(configs.dateFormat)
                : '',
            })}
          </p>
        ) : null}
        {isEstimate(invoice)
          ? invoice.validUntil != null && (
              <p key="validUntil">
                {t('preview:common:validUntil', { lng: language })}:{' '}
                {moment(invoice.validUntil)
                  .lang(language)
                  .format(configs.dateFormat)}
              </p>
            )
          : !isCreditNote(invoice) &&
            dueDate && [
              <p key="dueDate">
                {t('preview:common:due', { lng: language })}:{' '}
                {dueDate.useCustom
                  ? moment(dueDate.selectedDate)
                      .lang(language)
                      .format(configs.dateFormat)
                  : moment(
                      calTermDate(getIssuedAt(invoice), dueDate.paymentTerm)
                    )
                      .lang(language)
                      .format(configs.dateFormat)}
              </p>,
              <p key="dueDateNote">
                {!dueDate.useCustom &&
                  `
            (
              ${t(
                `form:fields:dueDate:paymentTerms:${
                  dueDate.paymentTerm
                }:description`
              )}
            )
            `}
              </p>,
            ]}
      </div>
      {configs.showLogo && (
        <Logo logoSize={logoSize}>
          <img src={profile.logo} alt="Logo" />
        </Logo>
      )}
    </Wrapper>
  );
}

Header.propTypes = {
  configs: PropTypes.object.isRequired,
  invoice: PropTypes.object.isRequired,
  profile: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
};

export default Header;
