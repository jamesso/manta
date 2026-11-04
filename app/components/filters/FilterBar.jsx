import { useTranslation } from 'react-i18next';
import { ListFilter, Search, X } from 'lucide-react';
import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toggleValue } from '../../helpers/listFilters';

export function FilterBar({ className, children }) {
  return (
    <div
      role="toolbar"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {children}
    </div>
  );
}

export function FilterSearch({ value, onChange, label, placeholder }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape' && value) {
            onChange('');
            e.preventDefault();
          }
        }}
        className="rounded-full ps-9 pe-3.5"
        aria-label={label}
        placeholder={placeholder}
      />
    </div>
  );
}

// Multi-select filter in a popover. options: [{ value, label, count }].
// An empty selection means "all".
export function FacetFilter({
  title,
  options,
  selected,
  onChange,
  searchable = false,
}) {
  const { t } = useTranslation();
  const selectedLabels = options
    .filter(o => selected.includes(o.value))
    .map(o => o.label);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              'max-w-full',
              selected.length === 0 && 'border-dashed text-muted-foreground'
            )}
          />
        }
      >
        <ListFilter />
        {title}
        {selected.length > 0 ? (
          <>
            <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
            {selected.length > 2 ? (
              <Badge variant="secondary">
                {t('common:filters:selected', { count: selected.length })}
              </Badge>
            ) : (
              selectedLabels.map(label => (
                <Badge
                  key={label}
                  variant="secondary"
                  className="max-w-32 truncate"
                >
                  {label}
                </Badge>
              ))
            )}
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 gap-0 p-0">
        <Command>
          {searchable ? <CommandInput placeholder={title} /> : null}
          <CommandList>
            <CommandEmpty>{t('common:filters:noOptions')}</CommandEmpty>
            <CommandGroup>
              {options.map(option => {
                const checked = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    data-checked={checked}
                    onSelect={() =>
                      onChange(toggleValue(selected, option.value))
                    }
                    className={cn(
                      option.count === 0 && !checked && 'text-muted-foreground'
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{option.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {option.count}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => onChange([])}
                    className="justify-center"
                  >
                    {t('common:filters:clear')}
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ResetFilters({ onClick }) {
  const { t } = useTranslation();
  return (
    <Button type="button" variant="ghost" onClick={onClick}>
      {t('common:filters:reset')}
      <X />
    </Button>
  );
}

// Shown when filters hide every row.
export function NoResults({ title, onClear }) {
  const { t } = useTranslation();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          {t('common:filters:noResultsDescription')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" onClick={onClear}>
          {t('common:filters:clearAll')}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
