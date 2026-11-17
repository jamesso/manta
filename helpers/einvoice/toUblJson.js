import moment from 'moment';

import { fmt2, fmtQty } from './money.js';

function formatIssueDate(value) {
  if (value == null || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return moment(value).format('YYYY-MM-DD');
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  const m = moment(s);
  return m.isValid() ? m.format('YYYY-MM-DD') : undefined;
}

function amt(value, currency) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return {
    '#text': fmt2(value),
    '@currencyID': currency,
  };
}

function qty(value, unit) {
  return {
    '#text': fmtQty(value),
    '@unitCode': unit,
  };
}

function partyTaxSchemes(modelSeller) {
  const schemes = [];
  if (modelSeller.vatId) {
    schemes.push({
      'cbc:CompanyID': modelSeller.vatId,
      'cac:TaxScheme': { 'cbc:ID': 'VAT' },
    });
  }
  if (modelSeller.taxNumber) {
    schemes.push({
      'cbc:CompanyID': modelSeller.taxNumber,
      'cac:TaxScheme': { 'cbc:ID': 'FC' },
    });
  }
  return schemes.length ? schemes : undefined;
}

function postalAddress(addr) {
  if (!addr || typeof addr !== 'object') {
    return undefined;
  }
  const block = {};
  const street = String(addr.street ?? '').trim();
  const additional = String(addr.additional ?? '').trim();
  const city = String(addr.city ?? '').trim();
  const postcode = String(addr.postcode ?? '').trim();
  const region = String(addr.region ?? '').trim();
  const country = String(addr.countryCode ?? '').trim();
  if (street) block['cbc:StreetName'] = street;
  if (additional) block['cbc:AdditionalStreetName'] = additional;
  if (city) block['cbc:CityName'] = city;
  if (postcode) block['cbc:PostalZone'] = postcode;
  if (region) block['cbc:CountrySubentity'] = region;
  if (country) {
    block['cac:Country'] = { 'cbc:IdentificationCode': country };
  }
  return Object.keys(block).length ? block : undefined;
}

function supplierParty(model, currency) {
  const party = {};
  if (model.seller.electronicAddress) {
    party['cbc:EndpointID'] = model.seller.electronicAddress;
    party['cbc:EndpointID@schemeID'] = 'EM';
  }
  if (model.seller.taxNumber) {
    party['cac:PartyIdentification'] = [{ 'cbc:ID': model.seller.taxNumber }];
  }
  if (model.seller.tradingName) {
    party['cac:PartyName'] = [{ 'cbc:Name': model.seller.tradingName }];
  }
  const addr = postalAddress(model.seller.address);
  if (addr) {
    party['cac:PostalAddress'] = addr;
  }
  const tax = partyTaxSchemes(model.seller);
  if (tax) {
    party['cac:PartyTaxScheme'] = tax;
  }
  party['cac:PartyLegalEntity'] = {
    'cbc:RegistrationName': model.seller.name,
  };
  const contact = model.seller.contact ?? {};
  if (contact.name || contact.phone || contact.email) {
    party['cac:Contact'] = {
      ...(contact.name ? { 'cbc:Name': contact.name } : {}),
      ...(contact.phone ? { 'cbc:Telephone': contact.phone } : {}),
      ...(contact.email ? { 'cbc:ElectronicMail': contact.email } : {}),
    };
  }
  return { 'cac:Party': party };
}

function customerParty(model) {
  const party = {};
  if (model.buyer.electronicAddress) {
    party['cbc:EndpointID'] = model.buyer.electronicAddress;
    party['cbc:EndpointID@schemeID'] = 'EM';
  }
  const addr = postalAddress(model.buyer.address);
  if (addr) {
    party['cac:PostalAddress'] = addr;
  }
  if (model.buyer.vatId) {
    party['cac:PartyTaxScheme'] = {
      'cbc:CompanyID': model.buyer.vatId,
      'cac:TaxScheme': { 'cbc:ID': 'VAT' },
    };
  }
  party['cac:PartyLegalEntity'] = {
    'cbc:RegistrationName': model.buyer.name,
  };
  if (model.buyer.contactName) {
    party['cac:Contact'] = { 'cbc:Name': model.buyer.contactName };
  }
  return { 'cac:Party': party };
}

export function toUblJson(model) {
  const currency = model.currency;
  const rootKey = 'ubl:Invoice';
  const typeKey = 'cbc:InvoiceTypeCode';
  const lineKey = 'cac:InvoiceLine';
  const qtyKey = 'cbc:InvoicedQuantity';

  const invoice = {
    'cbc:ID': model.number,
    'cbc:IssueDate': model.issueDate,
    [typeKey]: model.typeCode,
    'cbc:DocumentCurrencyCode': currency,
  };

  if (model.dueDate) {
    invoice['cbc:DueDate'] = model.dueDate;
  }
  if (model.note) {
    invoice['cbc:Note'] = [model.note];
  }
  if (model.buyerReference) {
    invoice['cbc:BuyerReference'] = model.buyerReference;
  }
  if (model.preceding?.number) {
    invoice['cac:BillingReference'] = [
      {
        'cac:InvoiceDocumentReference': {
          'cbc:ID': model.preceding.number,
          ...(formatIssueDate(model.preceding.issuedAt)
            ? {
                'cbc:IssueDate': formatIssueDate(model.preceding.issuedAt),
              }
            : {}),
        },
      },
    ];
  }

  invoice['cac:AccountingSupplierParty'] = supplierParty(model, currency);
  invoice['cac:AccountingCustomerParty'] = customerParty(model);

  if (model.payment?.iban) {
    invoice['cac:PaymentMeans'] = [
      {
        'cbc:PaymentMeansCode': model.payment.meansCode,
        'cac:PayeeFinancialAccount': {
          'cbc:ID': model.payment.iban,
          ...(model.payment.accountName
            ? { 'cbc:Name': model.payment.accountName }
            : {}),
          ...(model.payment.bic
            ? {
                'cac:FinancialInstitutionBranch': {
                  'cbc:ID': model.payment.bic,
                },
              }
            : {}),
        },
      },
    ];
  }

  if (model.allowances?.length) {
    invoice['cac:AllowanceCharge'] = model.allowances.map(a => ({
      'cbc:ChargeIndicator': 'false',
      'cbc:AllowanceChargeReason': a.reason,
      'cbc:Amount': fmt2(a.amount),
      'cbc:Amount@currencyID': currency,
      'cac:TaxCategory': {
        'cbc:ID': a.category,
        'cbc:Percent': String(a.rate),
        'cac:TaxScheme': { 'cbc:ID': 'VAT' },
      },
    }));
  }

  const taxSubtotal = (model.vatBreakdown ?? []).map(g => {
    const cat = {
      'cbc:ID': g.category,
      'cbc:Percent': String(g.rate),
      'cac:TaxScheme': { 'cbc:ID': 'VAT' },
    };
    if (g.vatexCode) {
      cat['cbc:TaxExemptionReasonCode'] = g.vatexCode;
    }
    if (g.exemptionReason) {
      cat['cbc:TaxExemptionReason'] = g.exemptionReason;
    }
    return {
      'cbc:TaxableAmount': fmt2(g.base),
      'cbc:TaxableAmount@currencyID': currency,
      'cbc:TaxAmount': fmt2(g.amount),
      'cbc:TaxAmount@currencyID': currency,
      'cac:TaxCategory': cat,
    };
  });

  invoice['cac:TaxTotal'] = [
    {
      'cbc:TaxAmount': fmt2(model.totals.taxTotal),
      'cbc:TaxAmount@currencyID': currency,
      'cac:TaxSubtotal': taxSubtotal,
    },
  ];

  const monetary = {
    'cbc:LineExtensionAmount': fmt2(model.totals.subtotal),
    'cbc:LineExtensionAmount@currencyID': currency,
    'cbc:TaxExclusiveAmount': fmt2(model.totals.taxExclusive),
    'cbc:TaxExclusiveAmount@currencyID': currency,
    'cbc:TaxInclusiveAmount': fmt2(model.totals.grandTotal),
    'cbc:TaxInclusiveAmount@currencyID': currency,
    'cbc:PayableAmount': fmt2(model.totals.payable),
    'cbc:PayableAmount@currencyID': currency,
  };
  if (model.totals.discount > 0) {
    monetary['cbc:AllowanceTotalAmount'] = fmt2(model.totals.discount);
    monetary['cbc:AllowanceTotalAmount@currencyID'] = currency;
  }
  if (model.totals.prepaid > 0) {
    monetary['cbc:PrepaidAmount'] = fmt2(model.totals.prepaid);
    monetary['cbc:PrepaidAmount@currencyID'] = currency;
  }
  invoice['cac:LegalMonetaryTotal'] = monetary;

  invoice[lineKey] = (model.lines ?? []).map(line => ({
    'cbc:ID': line.id,
    [qtyKey]: fmtQty(line.quantity),
    [`${qtyKey}@unitCode`]: line.unitCode,
    'cbc:LineExtensionAmount': fmt2(line.net),
    'cbc:LineExtensionAmount@currencyID': currency,
    'cac:Item': {
      'cbc:Name': line.description,
      'cac:ClassifiedTaxCategory': {
        'cbc:ID': line.taxCategory,
        'cbc:Percent': String(line.taxRate),
        'cac:TaxScheme': { 'cbc:ID': 'VAT' },
      },
    },
    'cac:Price': {
      'cbc:PriceAmount': fmtQty(line.price),
      'cbc:PriceAmount@currencyID': currency,
    },
  }));

  return { [rootKey]: invoice };
}
