import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete } from '@base-ui/react';
import { cn } from 'cn';

import { formatAmount } from './formatAmount';
import {
  itemToRowDescription,
  searchItems,
  isKnownUnit,
  getUnitCode,
} from '../../../helpers/items';

export const inputClassName =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40';

export const popupClassName =
  'group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95';

export const listClassName =
  'max-h-72 scroll-py-1 overflow-y-auto p-1 outline-none data-empty:p-0';

export function shouldApplyTextChange(reason, skipSelection) {
  return !skipSelection && reason !== 'item-press';
}

// A click opens the full list only on an empty line. A click on a filled
// line (to edit its text) must not show suggestions.
export function shouldIgnoreOpenChange(nextOpen, reason, hasQuery) {
  return nextOpen && reason === 'input-press' && hasQuery;
}

// Enter adds a new row unless the user highlighted an item to pick.
export function shouldAddRowOnEnter({ key, open, highlighted, isComposing }) {
  if (isComposing || key !== 'Enter') {
    return false;
  }
  return !open || !highlighted;
}

export function shouldBlockAutocompleteEnter(event, open, composing) {
  return (
    event.key === 'Enter' &&
    open &&
    (composing || event.nativeEvent?.isComposing)
  );
}

export function blockBaseUIKeyHandler(event) {
  if (typeof event.preventBaseUIHandler === 'function') {
    event.preventBaseUIHandler();
  }
  event.preventDefault();
  event.stopPropagation();
}

export default function ItemAutocomplete({
  id,
  value,
  items,
  currency,
  onTextChange,
  onPick,
  onEnterWithoutPick,
  inputProps = {},
}) {
  const { t } = useTranslation();
  const [userOpen, setUserOpen] = useState(false);
  const skipTextChangeRef = useRef(false);
  const composingRef = useRef(false);
  const highlightedRef = useRef(false);

  const hasQuery = value.trim().length > 0;
  // An empty field lists every saved item, so the user can browse them.
  const matches = useMemo(
    () => (hasQuery ? searchItems(items, value) : items),
    [hasQuery, items, value]
  );
  const open = userOpen && matches.length > 0;

  const handlePick = item => {
    skipTextChangeRef.current = true;
    onPick(item);
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
      itemToStringValue={itemToRowDescription}
      open={open}
      openOnInputClick
      onItemHighlighted={item => {
        highlightedRef.current = item != null;
      }}
      onOpenChange={(nextOpen, details) => {
        if (shouldIgnoreOpenChange(nextOpen, details.reason, hasQuery)) {
          return;
        }
        setUserOpen(nextOpen);
      }}
    >
      <Autocomplete.Input
        id={id}
        className={cn(inputClassName, inputProps.className)}
        placeholder={
          items.length > 0 ? t('form:fields:items:pickPlaceholder') : undefined
        }
        {...inputProps}
        onCompositionStart={event => {
          composingRef.current = true;
          inputProps.onCompositionStart?.(event);
        }}
        onCompositionEnd={event => {
          composingRef.current = false;
          inputProps.onCompositionEnd?.(event);
        }}
        onKeyDown={event => {
          inputProps.onKeyDown?.(event);
          if (event.defaultPrevented) {
            return;
          }
          const composing =
            composingRef.current || Boolean(event.nativeEvent?.isComposing);
          if (shouldBlockAutocompleteEnter(event, open, composing)) {
            blockBaseUIKeyHandler(event);
            return;
          }
          if (
            shouldAddRowOnEnter({
              key: event.key,
              open,
              highlighted: highlightedRef.current,
              isComposing: composing,
            })
          ) {
            event.preventDefault();
            setUserOpen(false);
            onEnterWithoutPick();
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
              {matches.map(item => (
                <Autocomplete.Item
                  key={item._id}
                  value={item}
                  className="relative flex cursor-default select-none flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  onClick={() => handlePick(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{item.name}</div>
                      {item.description ? (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-end text-xs text-muted-foreground">
                      <div>
                        {isKnownUnit(item.unitCode)
                          ? t(`items:units:${getUnitCode(item.unitCode)}`)
                          : getUnitCode(item.unitCode)}
                      </div>
                      <div className="tabular-nums">
                        {formatAmount(item.unitPrice, currency)}
                      </div>
                    </div>
                  </div>
                </Autocomplete.Item>
              ))}
            </Autocomplete.List>
            {matches.length === 0 ? (
              <Autocomplete.Empty className="px-2 py-3 text-sm text-muted-foreground">
                {t('form:fields:items:noMatch')}
              </Autocomplete.Empty>
            ) : null}
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
