// React Libraries
import React from 'react';
import PropTypes from 'prop-types';

import styled from 'styled-components';
import {
  formatPostalAddress,
  hasPostalAddress,
} from '../../../../helpers/einvoice/address.js';
import { resolveProfile } from '../../../../helpers/einvoice/toEn16931.js';
const Wrapper = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  ${props =>
    props.left &&
    `
    align-items: flex-start;
  `} ${props =>
    props.right &&
    `
    align-items: flex-end;
  `};
`;

// Component
function Footer({ t, invoice, profile, configs }) {
  const currentLanguage = configs.language;
  const { tax, recipient } = invoice;
  const sellerProfile = resolveProfile(invoice, { profile });
  const sellerLines = hasPostalAddress(sellerProfile.postalAddress)
    ? formatPostalAddress(sellerProfile.postalAddress, currentLanguage)
    : sellerProfile.address
      ? [sellerProfile.address]
      : [];
  const recipientLines = hasPostalAddress(recipient.postalAddress)
    ? formatPostalAddress(recipient.postalAddress, currentLanguage)
    : [];
  const bank = sellerProfile.bank ?? {};
  return (
    <Wrapper>
      <Column left>
        <h4 className="label">{sellerProfile.company}</h4>
        <p>{sellerProfile.fullname}</p>
        {sellerLines.map(line => (
          <p key={line}>{line}</p>
        ))}
        <p>{sellerProfile.email}</p>
        <p>{sellerProfile.phone}</p>
        {bank.iban ? (
          <p>
            {t('preview:einvoice:bank', { lng: currentLanguage })}: {bank.iban}
            {bank.bic ? ` / ${bank.bic}` : ''}
            {bank.accountName ? ` (${bank.accountName})` : ''}
          </p>
        ) : null}
        {invoice.seller ? (
          <>
            {invoice.seller.taxId ? (
              <p>
                {t('preview:tax:taxId', { lng: currentLanguage })}:{' '}
                {invoice.seller.taxId}
              </p>
            ) : null}
            {invoice.seller.vatId ? (
              <p>
                {t('preview:tax:vatId', { lng: currentLanguage })}:{' '}
                {invoice.seller.vatId}
              </p>
            ) : null}
          </>
        ) : (
          tax && <p>Tax ID: {tax.tin}</p>
        )}
      </Column>
      {configs.showRecipient && (
        <Column right>
          <h4 className="label">
            {t('preview:common:billedTo', { lng: currentLanguage })}
          </h4>
          <p>{recipient.company}</p>
          <p>{recipient.fullname}</p>
          {recipientLines.map(line => (
            <p key={line}>{line}</p>
          ))}
          <p>{recipient.email}</p>
          {recipient.buyerReference ? (
            <p>
              {t('preview:einvoice:buyerReference', { lng: currentLanguage })}:{' '}
              {recipient.buyerReference}
            </p>
          ) : null}
          {recipient.taxId ? (
            <p>
              {t('preview:tax:recipientTaxId', { lng: currentLanguage })}:{' '}
              {recipient.taxId}
            </p>
          ) : null}
          <p>{recipient.phone}</p>
        </Column>
      )}
    </Wrapper>
  );
}

Footer.propTypes = {
  configs: PropTypes.object.isRequired,
  invoice: PropTypes.object.isRequired,
  profile: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
};

export default Footer;
