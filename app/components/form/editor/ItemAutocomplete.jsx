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

const inputClassName =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40';

const popupClassName =
  'group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95';

const listClassName =
  'max-h-72 scroll-py-1 overflow-y-auto p-1 outline-none data-empty:p-0';

export function shouldApplyTextChange(reason, skipSelection) {
  return !skipSelection && reason !== 'item-press';
}

export function shouldAddRowOnEnter({ key, open, isComposing }) {
  if (isComposing || key !== 'Enter') {
    return false;
  }
  return !open;
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

  const matches = useMemo(() => searchItems(items, value), [items, value]);
  const open = userOpen && matches.length > 0 && value.trim().length >= 1;

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
      onOpenChange={setUserOpen}
    >
      <Autocomplete.Input
        id={id}
        className={cn(inputClassName, inputProps.className)}
        {...inputProps}
        onKeyDown={event => {
          inputProps.onKeyDown?.(event);
          if (event.defaultPrevented) {
            return;
          }
          if (event.nativeEvent.isComposing) {
            return;
          }
          if (
            shouldAddRowOnEnter({
              key: event.key,
              open,
              isComposing: event.nativeEvent.isComposing,
            })
          ) {
            event.preventDefault();
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
