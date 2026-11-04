'use client';

import * as React from 'react';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { cn } from 'cn';

import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

function Sheet({ ...props }) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

// Returns `value` while the sheet is open and the value from the last open
// render while it closes, so the content stays visible as the sheet slides
// out after the caller clears it.
function useSheetValue(open, value) {
  const last = React.useRef(value);
  if (open) {
    last.current = value;
  }
  return last.current;
}

function SheetTrigger({ ...props }) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs',
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          // Float like the app body: 0.5rem from the window edges, below the
          // h-12 title bar, with the same rounded-2xl corners.
          'fixed z-50 flex flex-col rounded-2xl bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0',
          'data-[side=bottom]:inset-x-2 data-[side=bottom]:bottom-2 data-[side=bottom]:h-auto data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem]',
          'data-[side=top]:inset-x-2 data-[side=top]:top-12 data-[side=top]:h-auto data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]',
          'data-[side=left]:top-12 data-[side=left]:bottom-2 data-[side=left]:start-2 data-[side=left]:w-3/4 data-[side=left]:data-ending-style:translate-x-[-2.5rem] rtl:data-[side=left]:data-ending-style:-translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] rtl:data-[side=left]:data-starting-style:-translate-x-[-2.5rem] data-[side=left]:sm:max-w-sm',
          'data-[side=right]:top-12 data-[side=right]:end-2 data-[side=right]:bottom-2 data-[side=right]:w-3/4 data-[side=right]:data-ending-style:translate-x-[2.5rem] rtl:data-[side=right]:data-ending-style:-translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] rtl:data-[side=right]:data-starting-style:-translate-x-[2.5rem] data-[side=right]:sm:max-w-md',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 end-3"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

// Standard drawer layout: a fixed SheetHeader, one scrolling SheetBody and a
// fixed SheetFooter. Group body content in SheetSection blocks.
function SheetHeader({ className, ...props }) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1 border-b p-4 pe-12', className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }) {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4',
        className
      )}
      {...props}
    />
  );
}

function SheetSection({ title, action, className, children, ...props }) {
  return (
    <section
      data-slot="sheet-section"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    >
      {title || action ? (
        <div className="flex min-h-7 items-center justify-between gap-2">
          {title ? (
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
          ) : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

// Label/value pairs in two aligned columns.
function SheetDetails({ className, ...props }) {
  return (
    <dl
      data-slot="sheet-details"
      className={cn(
        'grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-6 gap-y-2.5 text-sm',
        className
      )}
      {...props}
    />
  );
}

function SheetDetail({ label, className, children }) {
  return (
    <div className={cn('contents', className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

function SheetFooter({ className, ...props }) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        'flex flex-row flex-wrap items-center justify-end gap-2 border-t p-4',
        className
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-base font-medium text-foreground', className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetSection,
  SheetDetails,
  SheetDetail,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  useSheetValue,
};
