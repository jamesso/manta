// Libs
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Component
import Invoice from '../Invoice';

// Mocks
const invoice = {
  _id: '37b2804e-bfc1-4289-b1d7-226c5652ac91',
  status: 'pending',
  currency: {
    code: 'USD',
    decimal_digits: 2,
    name: 'US Dollar',
    name_plural: 'US dollars',
    rounding: 0,
    symbol: '$',
    symbol_native: '$',
  },
  subtotal: 3843,
  grandTotal: 3843,
  recipient: {
    _id: '3bd85cb9-7675-4d59-b9c3-305481cb77c9',
    company: 'Lindgren Group',
    email: 'Hattie42@gmail.com',
    fullname: 'Penelope Hettinger',
    phone: '854-306-7837',
  },
};

const editInvoice = vi.fn();
const deleteInvoice = vi.fn();
const duplicateInvoice = vi.fn();
const setInvoiceStatus = vi.fn();
const dateFormat = 'MM/DD/YY';
const currencyPlacement = 'before';
Date.now = vi.fn().mockReturnValue(0);

const t = vi.fn(status => {
  switch (status) {
    case 'invoices:status:cancelled': {
      return 'Cancelled';
    }
    case 'invoices:status:refunded': {
      return 'Refunded';
    }
    case 'invoices:status:paid': {
      return 'Paid';
    }
    default: {
      return 'Pending';
    }
  }
});

function renderInvoice(current = invoice) {
  return render(
    <Invoice
      t={t}
      invoice={current}
      editInvoice={editInvoice}
      deleteInvoice={deleteInvoice}
      duplicateInvoice={duplicateInvoice}
      setInvoiceStatus={setInvoiceStatus}
      dateFormat={dateFormat}
      currencyPlacement={currencyPlacement}
    />
  );
}

function statusNode(container, iconClass) {
  return container.querySelector(`.${iconClass}`).parentElement;
}

beforeEach(() => {
  editInvoice.mockClear();
  deleteInvoice.mockClear();
  duplicateInvoice.mockClear();
  setInvoiceStatus.mockClear();
});

describe('Renders correctly to the DOM', () => {
  it('render invoice status correctly', () => {
    const pending = renderInvoice();
    expect(statusNode(pending.container, 'ion-loop')).toHaveTextContent('Pending');
    pending.unmount();

    const paid = renderInvoice(Object.assign({}, invoice, { status: 'paid' }));
    expect(statusNode(paid.container, 'ion-checkmark')).toHaveTextContent('Paid');
    paid.unmount();

    const cancelled = renderInvoice(
      Object.assign({}, invoice, { status: 'cancelled' })
    );
    expect(statusNode(cancelled.container, 'ion-backspace')).toHaveTextContent(
      'Cancelled'
    );
    cancelled.unmount();

    const refunded = renderInvoice(
      Object.assign({}, invoice, { status: 'refunded' })
    );
    expect(
      statusNode(refunded.container, 'ion-arrow-return-left')
    ).toHaveTextContent('Refunded');
  });
});

describe('handle clicks correctly', () => {
  let spyViewAction;
  let spyEditAction;
  let spyDuplicateAction;

  beforeEach(() => {
    spyViewAction = vi.spyOn(Invoice.prototype, 'viewInvoice');
    spyEditAction = vi.spyOn(Invoice.prototype, 'editInvoice');
    spyDuplicateAction = vi.spyOn(Invoice.prototype, 'duplicateInvoice');
  });

  afterEach(() => {
    spyViewAction.mockRestore();
    spyEditAction.mockRestore();
    spyDuplicateAction.mockRestore();
  });

  it('handle edit action correctly', () => {
    renderInvoice();
    fireEvent.click(screen.getAllByRole('button', { name: 'Pending' })[0]);
    expect(editInvoice).toHaveBeenCalled();
    expect(editInvoice).toHaveBeenCalledWith(invoice);
  });

  it('handle delete action correctly', () => {
    const { container } = renderInvoice();
    fireEvent.click(container.querySelector('.ion-trash-a').closest('button'));
    expect(deleteInvoice).toHaveBeenCalled();
    expect(deleteInvoice).toHaveBeenCalledWith(invoice._id);
  });

  it('handle duplicate action correctly', () => {
    const { container } = renderInvoice();
    fireEvent.click(container.querySelector('.ion-ios-copy').closest('button'));
    expect(duplicateInvoice).toHaveBeenCalled();
    expect(duplicateInvoice).toHaveBeenCalledWith(invoice);
  });

  it('handle view action correctly', () => {
    renderInvoice();
    const pendingButtons = screen.getAllByRole('button', { name: 'Pending' });
    fireEvent.click(pendingButtons[pendingButtons.length - 1]);
    expect(spyViewAction).toHaveBeenCalled();
  });

  it('handle edit action correctly', () => {
    renderInvoice();
    fireEvent.click(screen.getAllByRole('button', { name: 'Pending' })[0]);
    expect(spyEditAction).toHaveBeenCalled();
  });
});
