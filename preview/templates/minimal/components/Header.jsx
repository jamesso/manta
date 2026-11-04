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
import { labelled } from '../../labelled';

// Styles
import styled from 'styled-components';
const Wrapper = styled.div`
  display: flex;
  justify-content: space-between;
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
          {labelled(
            t,
            language,
            'preview:common:created',
            moment(getIssuedAt(invoice))
              .locale(language)
              .format(configs.dateFormat)
          )}
        </p>
        {isCreditNote(invoice) && invoice.creditedInvoice ? (
          <p>
            {t('preview:common:creditsInvoice', {
              lng: language,
              number: invoice.creditedInvoice.invoiceID ?? '',
              date: invoice.creditedInvoice.issuedAt
                ? moment(invoice.creditedInvoice.issuedAt)
                    .locale(language)
                    .format(configs.dateFormat)
                : '',
            })}
          </p>
        ) : null}
        {isEstimate(invoice)
          ? invoice.validUntil != null && (
              <p key="validUntil">
                {labelled(
                  t,
                  language,
                  'preview:common:validUntil',
                  moment(invoice.validUntil)
                    .locale(language)
                    .format(configs.dateFormat)
                )}
              </p>
            )
          : !isCreditNote(invoice) &&
            dueDate && [
              <p key="dueDate">
                {labelled(
                  t,
                  language,
                  'preview:common:due',
                  dueDate.useCustom
                    ? moment(dueDate.selectedDate)
                        .locale(language)
                        .format(configs.dateFormat)
                    : moment(
                        calTermDate(getIssuedAt(invoice), dueDate.paymentTerm)
                      )
                        .locale(language)
                        .format(configs.dateFormat)
                )}
              </p>,
              <p key="dueDateNote">
                {!dueDate.useCustom &&
                  `
            (
              ${t(
                `form:fields:dueDate:paymentTerms:${
                  dueDate.paymentTerm
                }:description`,
                { lng: language }
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
