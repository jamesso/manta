import React, { useState } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../../i18n/i18n';
import ItemAutocomplete, { blockBaseUIKeyHandler } from '../ItemAutocomplete';

const catalog = [
  {
    _id: 'i1',
    name: 'Design',
    description: 'Work',
    unitPrice: 80,
    unitCode: 'HUR',
    archived: false,
  },
  {
    _id: 'i2',
    name: 'Hosting',
    description: '',
    unitPrice: 20,
    unitCode: 'MON',
    archived: false,
  },
];

function renderHarness({ onPick, onEnterWithoutPick, initialValue = '' }) {
  function Harness() {
    const [value, setValue] = useState(initialValue);
    return (
      <ItemAutocomplete
        id="desc"
        value={value}
        items={catalog}
        currency={{ fraction: 2, separator: 'commaDot' }}
        onTextChange={setValue}
        onPick={onPick}
        onEnterWithoutPick={onEnterWithoutPick}
      />
    );
  }

  const utils = render(
    <I18nextProvider i18n={i18n}>
      <Harness />
    </I18nextProvider>
  );
  return {
    ...utils,
    input: utils.container.querySelector('#desc'),
  };
}

async function openPopup(input, user) {
  await user.click(input);
  await user.type(input, 'de');
  await waitFor(() => {
    expect(document.body.textContent).toContain('Design');
  });
}

describe('ItemAutocomplete mounted behavior', () => {
  it('does not pick or add a row on IME Enter with an open popup', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onEnterWithoutPick = vi.fn();
    const { input } = renderHarness({ onPick, onEnterWithoutPick });

    await openPopup(input, user);
    fireEvent.compositionStart(input);

    const nativeEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      which: 13,
      bubbles: true,
    });
    Object.defineProperty(nativeEvent, 'isComposing', { value: true });
    fireEvent.keyDown(input, {
      key: 'Enter',
      code: 'Enter',
      which: 13,
      nativeEvent,
    });

    expect(onPick).not.toHaveBeenCalled();
    expect(onEnterWithoutPick).not.toHaveBeenCalled();
  });

  it('adds a row on Enter when the popup is closed', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onEnterWithoutPick = vi.fn();
    const { input } = renderHarness({ onPick, onEnterWithoutPick });

    await user.type(input, 'solo text');
    fireEvent.keyDown(input, { key: 'Escape' });
    await user.keyboard('{Enter}');

    expect(onPick).not.toHaveBeenCalled();
    expect(onEnterWithoutPick).toHaveBeenCalledTimes(1);
  });

  it('picks a highlighted item on keyboard Enter when not composing', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onEnterWithoutPick = vi.fn();
    const { input } = renderHarness({ onPick, onEnterWithoutPick });

    await openPopup(input, user);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onEnterWithoutPick).not.toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'i1', unitPrice: 80 })
    );
  });

  it('lists all saved items when the user clicks an empty field', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const { input } = renderHarness({ onPick, onEnterWithoutPick: vi.fn() });

    await user.click(input);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Hosting');
    });
    expect(document.body.textContent).toContain('Design');

    await user.click(
      [...document.querySelectorAll('[role="option"]')].find(o =>
        o.textContent.includes('Hosting')
      )
    );
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'i2', unitPrice: 20 })
    );
  });

  it('does not open suggestions on a click in a filled field', async () => {
    const user = userEvent.setup();
    const { input } = renderHarness({
      onPick: vi.fn(),
      onEnterWithoutPick: vi.fn(),
      initialValue: 'Design work',
    });

    await user.click(input);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(document.querySelector('[role="option"]')).toBeNull();
  });

  it('adds a row on Enter in an open empty list with no highlight', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onEnterWithoutPick = vi.fn();
    const { input } = renderHarness({ onPick, onEnterWithoutPick });

    await user.click(input);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Hosting');
    });
    await user.keyboard('{Enter}');

    expect(onPick).not.toHaveBeenCalled();
    expect(onEnterWithoutPick).toHaveBeenCalledTimes(1);
  });

  it('blockBaseUIKeyHandler sets baseUIHandlerPrevented', () => {
    const event = {
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      preventBaseUIHandler: vi.fn(),
    };
    blockBaseUIKeyHandler(event);
    expect(event.preventBaseUIHandler).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
