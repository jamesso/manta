import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { I18nextProvider } from 'react-i18next';

import rootReducer from '../../../reducers';
import i18n from '../../../../i18n/i18n';
import ItemsTable from '../ItemsTable';

const item = {
  _id: 'item-1',
  name: 'Web design',
  description: 'Per hour',
  unitPrice: 80,
  unitCode: 'HUR',
  archived: false,
};

function renderTable() {
  const store = createStore(rootReducer, {
    settings: {
      saved: {
        invoice: {
          currency: {
            code: 'USD',
            fraction: 2,
            separator: 'commaDot',
            placement: 'before',
          },
        },
      },
    },
  });

  return render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <ItemsTable
          items={[item]}
          sorting={[{ id: 'name', desc: false }]}
          onSortingChange={() => {}}
          onRowOpen={() => {}}
          onEdit={() => {}}
        />
      </I18nextProvider>
    </Provider>
  );
}

describe('ItemsTable', () => {
  it('renders item rows using TanStack row cells', () => {
    renderTable();
    expect(screen.getByText('Web design')).toBeInTheDocument();
    expect(screen.getByText('Per hour')).toBeInTheDocument();
  });
});
