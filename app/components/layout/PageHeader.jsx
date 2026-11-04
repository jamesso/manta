import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Shared layout for list pages: Invoices, Estimates, Recurring, Clients, Items.
export function ListPage({ children }) {
  return (
    <div className="flex min-h-full flex-col gap-5 px-8 pt-7 pb-8 text-foreground">
      {children}
    </div>
  );
}

// Title with a count line under it; view toggle and primary button on the right.
export function PageHeader({ title, count, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">
          {title}
        </h1>
        {count ? (
          <p className="text-sm text-muted-foreground">{count}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// Switches between record sets that need different tables.
// options: [{ value, label, count }]
export function ViewTabs({ value, onChange, options }) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList>
        {options.map(option => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
            <span className="text-muted-foreground">{option.count}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
