// Libs
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Component
import { ItemRow } from '../ItemRow.jsx';

// Mocks
const actions = true;
const addItem = vi.fn();
const hasHandler = true;
const item = {
  id: '638fd7e3-217b-4a29-87f7-5ec539f73af9',
  description: 'iPhone X',
  price: 999,
  quantity: 1,
  subtotal: 999,
};
const removeRow = vi.fn();
const updateRow = vi.fn();
const t = vi.fn();

function renderRow() {
  return render(
    <ItemRow
      t={t}
      actions={actions}
      addItem={addItem}
      hasHandler={hasHandler}
      item={item}
      removeRow={removeRow}
      updateRow={updateRow}
    />
  );
}

beforeEach(() => {
  addItem.mockClear();
  removeRow.mockClear();
  updateRow.mockClear();
});

describe('Renders correctly to the DOM', () => {
  it('set local state as item prop value', () => {
    const { container } = renderRow();
    expect(container.querySelector('input[name="description"]')).toHaveValue(
      item.description
    );
    expect(container.querySelector('input[name="price"]')).toHaveValue(item.price);
    expect(container.querySelector('input[name="quantity"]')).toHaveValue(
      item.quantity
    );
  });

  it('handle text input change correctly', () => {
    const spy = vi.spyOn(ItemRow.prototype, 'handleTextInputChange');
    const { container } = renderRow();
    fireEvent.change(container.querySelector('input[name="description"]'), {
      target: { value: 'iPhoneX' },
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('handle number input change correctly', () => {
    const spy = vi.spyOn(ItemRow.prototype, 'handleNumberInputChange');
    const { container } = renderRow();
    fireEvent.change(container.querySelector('input[name="price"]'), {
      target: { value: '1000' },
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('add new row when press enter', () => {
    const spy = vi.spyOn(ItemRow.prototype, 'handleKeyDown');
    const { container } = renderRow();
    fireEvent.keyDown(container.querySelector('input[name="description"]'), {
      which: 13,
      keyCode: 13,
      key: 'Enter',
    });
    expect(spy).toHaveBeenCalled();
    expect(addItem).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('updateSubtotal when price and quantity change', () => {
    const spy = vi.spyOn(ItemRow.prototype, 'updateSubtotal');
    const { container } = renderRow();
    fireEvent.change(container.querySelector('input[name="price"]'), {
      target: { value: '799' },
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('uses an empty price when the item has none', () => {
    const { container } = render(
      <ItemRow
        t={t}
        actions={actions}
        addItem={addItem}
        hasHandler={hasHandler}
        item={{ id: 'row-1', description: 'Service', quantity: 1, subtotal: 0 }}
        removeRow={removeRow}
        updateRow={updateRow}
      />
    );
    expect(container.querySelector('input[name="price"]').value).toBe('');
  });

  it('handle removeRow correctly', () => {
    const { container } = renderRow();
    fireEvent.click(container.querySelector('a'));
    expect(removeRow).toHaveBeenCalled();
  });
});
