// Libraries
import React from 'react';
import PropTypes from 'prop-types';
import { padStart } from 'lodash';
import { formatNumber } from '../../../../helpers/formatNumber';
import {
  getInvoiceTotals,
  getPayments,
  getAmountPaid,
  getBalanceDue,
} from '../../../../app/helpers/invoice';
import { isCreditNote } from '../../../../app/helpers/docType';
import currencies from '../../../../libs/currencies.json';

// Styles
import styled from 'styled-components';

const Table = styled.table`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: 50px;
  margin-bottom: 50px;
  width: 100%;
  ${props =>
    props.alignItems &&
    `
    justify-content: ${props.alignItems};
  `} th {
    font-weight: 500;
  }
`;

const ItemsHeader = styled.tr`
  display: flex;
  justify-content: space-between;
  font-family: Montserrat, sans-serif;
  font-weight: 500;
  font-size: 0.8em;
  color: #2c323a;
  letter-spacing: 1px;
  text-transform: uppercase;
`;

const ItemsList = styled.tbody`
  margin: 1.5em -2.5em;
  padding: 1em 2.5em;
  font-family: 'Lora', serif;
  font-size: 0.95em;
  color: #000000;
  background: #f9fafa;
`;

const Item = styled.tr`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7em 0;
  border-bottom: 2px dotted #d8d8d8;
  & :last-child {
    border-bottom: none;
  }
  td:last-child {
    color: #b4b7ba;
  }
`;

const InvoiceSummary = styled.tfoot`
  display: flex;
  flex-direction: column;
  font-family: Montserrat;
  font-size: 0.8em;
  color: #2c323a;
  letter-spacing: 1px;
  text-transform: uppercase;
  font-weight: 500;

  tr {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.65em 0;
    border-bottom: 2px solid #ecf1f1;
    &:last-child {
      border-bottom: none;
    }
  }
`;

const Subtotal = styled.tr``;
const Tax = styled.tr`
  color: #ec476e;
`;
const Discount = styled.tr`
  color: #469fe5;
`;
const Total = styled.tr`
  color: #6bbb69;
`;
const AmountPaid = styled.tr``;
const BalanceDue = styled.tr`
  font-weight: 700;
`;

function setAlignItems(configs) {
  let pos;
  switch (configs.alignItems) {
    case 'top': {
      pos = 'flex-start';
      break;
    }
    case 'bottom': {
      pos = 'flex-end';
      break;
    }
    default: {
      pos = 'center';
      break;
    }
  }
  return pos;
}

// Component
function Main({ invoice, configs, t }) {
  // Get currentLanguage
  const currentLanguage = configs.language;
  const totals = getInvoiceTotals(invoice);
  // Destructuring values
  const { tax, discount } = invoice;
  const { code, placement, fraction, separator } = invoice.currency;
  // Set placement
  const currencyBefore = placement === 'before';
  // Set Currency Sign
  const currency = configs.useSymbol ? currencies[code].symbol : code;
  const hasPayments = getPayments(invoice).length > 0;
  const moneyCell = value => (
    <>
      {currencyBefore ? currency : null}{' '}
      {formatNumber(value, fraction, separator)}{' '}
      {currencyBefore ? null : currency}
    </>
  );
  // Render Items
  const itemComponents = invoice.rows.map((row, index) => (
    <Item key={index}>
      <td>
        {padStart(index + 1, 2, 0)}
        {'. '}
        {row.description} ({row.quantity}
        {totals.mode === 'line' &&
        totals.taxBreakdown.length > 1 &&
        row.taxRate != null
          ? ` · ${row.taxRate}%`
          : ''}
        )
      </td>
      <td>
        {currencyBefore ? currency : null}{' '}
        {formatNumber(
          totals.mode === 'line' ? totals.lines[index]?.net : row.subtotal,
          fraction,
          separator
        )}{' '}
        {currencyBefore ? null : currency}
      </td>
    </Item>
  ));

  return (
    <Table alignItems={setAlignItems(configs)}>
      <thead>
        <ItemsHeader>
          <th>
            {t('preview:common:itemDescription', { lng: currentLanguage })}
          </th>
          <th>{t('preview:common:price', { lng: currentLanguage })}</th>
        </ItemsHeader>
      </thead>

      <ItemsList>{itemComponents}</ItemsList>

      <InvoiceSummary>
        <Subtotal>
          <td>{t('preview:common:subtotal', { lng: currentLanguage })}</td>
          <td>
            {currencyBefore ? currency : null}{' '}
            {formatNumber(
              totals.mode === 'line' ? totals.subtotal : invoice.subtotal,
              fraction,
              separator
            )}{' '}
            {currencyBefore ? null : currency}
          </td>
        </Subtotal>

        {totals.mode === 'invoice' && tax && (
          <Tax>
            <td>
              {t('form:fields:tax:name', { lng: currentLanguage })} {tax.amount}
              %
            </td>
            {tax.method === 'reverse' ? (
              <td>{t('form:fields:tax:reverse', { lng: currentLanguage })}</td>
            ) : (
              <td>
                {currencyBefore ? currency : null}{' '}
                {formatNumber(totals.taxTotal, fraction, separator)}{' '}
                {currencyBefore ? null : currency}
              </td>
            )}
          </Tax>
        )}

        {totals.mode === 'line'
          ? totals.taxBreakdown.map(group => (
              <Tax key={group.key}>
                <td>
                  {t(`preview:tax:category:${group.category}`, {
                    lng: currentLanguage,
                  })}{' '}
                  {group.rate}%
                  <br />
                  <small>
                    {t('preview:tax:on', {
                      lng: currentLanguage,
                      amount: formatNumber(group.base, fraction, separator),
                    })}
                  </small>
                </td>
                <td>
                  {currencyBefore ? currency : null}{' '}
                  {formatNumber(group.amount, fraction, separator)}{' '}
                  {currencyBefore ? null : currency}
                </td>
              </Tax>
            ))
          : null}

        {discount && (
          <Discount>
            <td>
              {t('form:fields:discount:name', { lng: currentLanguage })}{' '}
              {discount.type === 'percentage' && (
                <span> {discount.amount}%</span>
              )}
            </td>
            <td>
              {currencyBefore ? currency : null}{' '}
              {formatNumber(totals.discount, fraction, separator)}{' '}
              {currencyBefore ? null : currency}
            </td>
          </Discount>
        )}

        <Total>
          <td>
            {t(
              isCreditNote(invoice)
                ? 'preview:common:totalCredit'
                : 'preview:common:total',
              { lng: currentLanguage }
            )}
          </td>
          <td>
            {currencyBefore ? currency : null}{' '}
            {formatNumber(
              totals.mode === 'line' ? totals.grandTotal : invoice.grandTotal,
              fraction,
              separator
            )}{' '}
            {currencyBefore ? null : currency}
          </td>
        </Total>
        {totals.mode === 'line'
          ? totals.taxBreakdown
              .filter(g => g.exemptionReason)
              .map(g => (
                <tr key={`${g.key}-reason`}>
                  <td colSpan="2">
                    <small>
                      {t(`preview:tax:category:${g.category}`, {
                        lng: currentLanguage,
                      })}
                      : {g.exemptionReason}
                    </small>
                  </td>
                </tr>
              ))
          : null}
        {hasPayments ? (
          <>
            <AmountPaid>
              <td>
                {t('preview:common:amountPaid', { lng: currentLanguage })}
              </td>
              <td>{moneyCell(getAmountPaid(invoice))}</td>
            </AmountPaid>
            <BalanceDue>
              <td>
                {t('preview:common:balanceDue', { lng: currentLanguage })}
              </td>
              <td>{moneyCell(getBalanceDue(invoice))}</td>
            </BalanceDue>
          </>
        ) : null}
      </InvoiceSummary>
    </Table>
  );
}

Main.propTypes = {
  configs: PropTypes.object.isRequired,
  invoice: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
};

export default Main;
