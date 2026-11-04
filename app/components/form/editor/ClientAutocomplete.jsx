import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete } from '@base-ui/react';
import { cn } from 'cn';

import { matchesClientQuery } from '../../../helpers/clients';
import {
  inputClassName,
  popupClassName,
  listClassName,
  shouldApplyTextChange,
  shouldIgnoreOpenChange,
  shouldBlockAutocompleteEnter,
  blockBaseUIKeyHandler,
} from './ItemAutocomplete';

export const contactLabel = contact =>
  contact?.fullname || contact?.company || '';

// Same pattern as ItemAutocomplete: free text plus saved suggestions.
export default function ClientAutocomplete({
  id,
  value,
  contacts,
  onTextChange,
  onPick,
  inputProps = {},
}) {
  const { t } = useTranslation();
  const [userOpen, setUserOpen] = useState(false);
  const skipTextChangeRef = useRef(false);
  const composingRef = useRef(false);

  const hasQuery = value.trim().length > 0;
  // An empty field lists every saved client, so the user can browse them.
  const matches = useMemo(
    () =>
      hasQuery ? contacts.filter(c => matchesClientQuery(c, value)) : contacts,
    [hasQuery, contacts, value]
  );
  const open = userOpen && matches.length > 0;

  const handlePick = contact => {
    skipTextChangeRef.current = true;
    onPick(contact);
    setUserOpen(false);
    queueMicrotask(() => {
      skipTextChangeRef.current = false;
    });
  };

  return (
    <Autocomplete.Root
      items={matches}
      value={value}
      onValueChange={(text, details) => {
        if (!shouldApplyTextChange(details.reason, skipTextChangeRef.current)) {
          return;
        }
        onTextChange(text);
      }}
      filter={null}
      itemToStringValue={contactLabel}
      open={open}
      openOnInputClick
      onOpenChange={(nextOpen, details) => {
        if (shouldIgnoreOpenChange(nextOpen, details.reason, hasQuery)) {
          return;
        }
        setUserOpen(nextOpen);
      }}
    >
      <Autocomplete.Input
        id={id}
        autoComplete="off"
        placeholder={
          contacts.length > 0
            ? t('form:fields:recipient:pickPlaceholder')
            : undefined
        }
        {...inputProps}
        className={cn(inputClassName, inputProps.className)}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        onKeyDown={event => {
          const composing =
            composingRef.current || Boolean(event.nativeEvent?.isComposing);
          if (shouldBlockAutocompleteEnter(event, open, composing)) {
            blockBaseUIKeyHandler(event);
          }
        }}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner
          sideOffset={4}
          align="start"
          className="isolate z-50"
        >
          <Autocomplete.Popup className={popupClassName}>
            <Autocomplete.List className={listClassName}>
              {matches.map(contact => (
                <Autocomplete.Item
                  key={contact._id}
                  value={contact}
                  className="relative flex cursor-default select-none flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  onClick={() => handlePick(contact)}
                >
                  <div className="font-medium">{contactLabel(contact)}</div>
                  {contact.fullname && contact.company ? (
                    <div className="line-clamp-1 text-xs text-muted-foreground">
                      {contact.company}
                    </div>
                  ) : null}
                  {contact.email ? (
                    <div className="line-clamp-1 text-xs text-muted-foreground">
                      {contact.email}
                    </div>
                  ) : null}
                </Autocomplete.Item>
              ))}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
