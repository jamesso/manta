import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ipcRenderer } from 'electron';

// Component
import { Invoices } from '../Invoices';

ipcRenderer.removeAllListeners = vi.fn();

// Mocks
const dispatch = vi.fn();
const t = vi.fn();
const invoices = [
  {
    _id: 'first-invoice',
    status: 'pending',
  },
  {
    _id: 'second-invoice',
    status: 'refunded',
  },
  {
    _id: 'third-invoice',
    status: 'paid',
  },
  {
    _id: 'fourth-invoice',
    status: 'cancelled',
  },
];
vi.mock('../../components/invoices/Invoice', () => ({
  default: ({ invoice }) => <div className="invoice">{invoice.status}</div>,
}));

vi.mock('../../components/shared/Message', () => ({
  default: () => <div className="message" />,
}));

function renderInvoices(list = invoices) {
  return render(<Invoices t={t} invoices={list} dispatch={dispatch} />);
}

beforeEach(() => {
  dispatch.mockClear();
});

describe('render component correctly', () => {
  it('render correct number of invoices', () => {
    const { container } = renderInvoices();
    expect(container.querySelectorAll('.invoice')).toHaveLength(invoices.length);
  });

  it('render empty message when there is no invoice in the DB', () => {
    const view = renderInvoices();
    expect(view.container.querySelector('.message')).not.toBeInTheDocument();
    view.rerender(<Invoices t={t} invoices={[]} dispatch={dispatch} />);
    expect(view.container.querySelector('.message')).toBeInTheDocument();
  });
});

describe('handle actions correcrtly', () => {
  let spySetFilter;

  beforeEach(() => {
    spySetFilter = vi.spyOn(Invoices.prototype, 'setFilter');
  });

  afterEach(() => {
    spySetFilter.mockRestore();
  });

  it('set correct filter', () => {
    const { container } = renderInvoices();
    fireEvent.click(container.querySelector('button[data-filter="paid"]'));
    expect(spySetFilter).toHaveBeenCalled();
    expect(container.querySelectorAll('.invoice')).toHaveLength(1);
    expect(container.querySelector('.invoice')).toHaveTextContent('paid');
    expect(container.querySelector('.invoice')).not.toHaveTextContent('pending');
  });

  it('display only invoices with matched status', () => {
    const { container } = renderInvoices();
    fireEvent.click(container.querySelector('button[data-filter="paid"]'));
    const filteredInvoices = invoices.filter(invoice => invoice.status === 'paid');
    expect(container.querySelectorAll('.invoice')).toHaveLength(filteredInvoices.length);
  });
});
