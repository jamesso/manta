// React Libraries
import React from 'react';
import PropTypes from 'prop-types';
import { truncate } from 'lodash';
import moment from 'moment';

// Helper
import { calTermDate } from '../../../../helpers/date';
import { getIssuedAt } from '../../../../app/helpers/invoice';
import {
  getDocTitleKey,
  isEstimate,
  isCreditNote,
} from '../../../../app/helpers/docType';
import {
  formatPostalAddress,
  hasPostalAddress,
} from '../../../../helpers/einvoice/address.js';
import { resolveProfile } from '../../../../helpers/einvoice/toEn16931.js';

// Styles
import styled from 'styled-components';
import { labelled } from '../../labelled';

const InvoiceHeader = styled.div`
  flex: 1;
  flex: none;
  display: flex;
  justify-content: space-between;
`;

const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
`;

const Company = styled.div`
  margin-bottom: 1.66667em;
`;

const Recipient = styled.div``;

const RightColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-end;
  h4 {
    font-size: 1.16667em;
    color: #dbbd8a;
    margin: 0;
    font-weight: 300;
  }
`;

const Heading = styled.h1`
  margin: 0 0 10px 0;
  font-size: 2em;
  font-weight: 400;
  color: #cbc189;
  text-transform: uppercase;
  letter-spacing: 1px;
  ${props =>
    props.customAccentColor &&
    `
    color: ${props.accentColor};
  `};
`;

// Component
function Header({ t, invoice, profile, configs }) {
  const { tax, recipient } = invoice;
  const { language, accentColor, customAccentColor } = configs;
  const sellerProfile = resolveProfile(invoice, { profile });
  const sellerLines = hasPostalAddress(sellerProfile.postalAddress)
    ? formatPostalAddress(sellerProfile.postalAddress, language)
    : sellerProfile.address
      ? [sellerProfile.address]
      : [];
  const recipientLines = hasPostalAddress(recipient.postalAddress)
    ? formatPostalAddress(recipient.postalAddress, language)
    : [];
  const bank = sellerProfile.bank ?? {};
  return (
    <InvoiceHeader>
      <LeftColumn>
        <Company>
          <h4>{sellerProfile.company}</h4>
          <p>{sellerProfile.fullname}</p>
          {sellerLines.map(line => (
            <p key={line}>{line}</p>
          ))}
          <p>{sellerProfile.email}</p>
          <p>{sellerProfile.phone}</p>
          {bank.iban ? (
            <p>
              {labelled(t, language, 'preview:einvoice:bank', bank.iban)}
              {bank.bic ? ` / ${bank.bic}` : ''}
              {bank.accountName ? ` (${bank.accountName})` : ''}
            </p>
          ) : null}
          {invoice.seller ? (
            <>
              {invoice.seller.taxId ? (
                <p>
                  {labelled(
                    t,
                    language,
                    'preview:tax:taxId',
                    invoice.seller.taxId
                  )}
                </p>
              ) : null}
              {invoice.seller.vatId ? (
                <p>
                  {labelled(
                    t,
                    language,
                    'preview:tax:vatId',
                    invoice.seller.vatId
                  )}
                </p>
              ) : null}
            </>
          ) : (
            tax && <p>{labelled(t, language, 'preview:tax:taxId', tax.tin)}</p>
          )}
        </Company>

        {configs.showRecipient && (
          <Recipient>
            <h4>{t('preview:common:billedTo', { lng: language })}</h4>
            <p>{recipient.company}</p>
            <p>{recipient.fullname}</p>
            {recipientLines.map(line => (
              <p key={line}>{line}</p>
            ))}
            <p>{recipient.email}</p>
            {configs.showBuyerReference && recipient.buyerReference ? (
              <p>
                {labelled(
                  t,
                  language,
                  'preview:einvoice:buyerReference',
                  recipient.buyerReference
                )}
              </p>
            ) : null}
            {recipient.taxId ? (
              <p>
                {labelled(
                  t,
                  language,
                  'preview:tax:recipientTaxId',
                  recipient.taxId
                )}
              </p>
            ) : null}
            <p>{recipient.phone}</p>
          </Recipient>
        )}
      </LeftColumn>
      <RightColumn>
        <Heading
          accentColor={accentColor}
          customAccentColor={customAccentColor}
        >
          {t(getDocTitleKey(invoice), { lng: language })}
        </Heading>
        <h4>
          #
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
            invoice.dueDate && [
              <p key="dueDate">
                {labelled(
                  t,
                  language,
                  'preview:common:due',
                  invoice.dueDate.useCustom
                    ? moment(invoice.dueDate.selectedDate)
                        .locale(language)
                        .format(configs.dateFormat)
                    : moment(
                        calTermDate(
                          getIssuedAt(invoice),
                          invoice.dueDate.paymentTerm
                        )
                      )
                        .locale(language)
                        .format(configs.dateFormat)
                )}
              </p>,
              <p key="dueDateNote">
                {!invoice.dueDate.useCustom &&
                  `
            (
              ${t(
                `form:fields:dueDate:paymentTerms:${
                  invoice.dueDate.paymentTerm
                }:description`,
                { lng: language }
              )}
            )
            `}
              </p>,
            ]}
      </RightColumn>
    </InvoiceHeader>
  );
}

Header.propTypes = {
  configs: PropTypes.object.isRequired,
  invoice: PropTypes.object.isRequired,
  profile: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
};

export default Header;
