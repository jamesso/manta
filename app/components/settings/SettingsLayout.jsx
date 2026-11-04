import { cn } from 'cn';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field';

// Shared layout for every Settings page:
//   SettingsPage   page title, description and save error
//   SettingsGroup  a titled card; its children are stacked with dividers
//   SettingsBlock  a padded part of a card for stacked fields or grids
//   SettingsRow    a padded part of a card: label left, control right

export function SettingsPage({ title, description, error, children }) {
  return (
    <div className="flex flex-col gap-10 pb-10">
      <header className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        {error ? (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
}

export function SettingsGroup({
  title,
  description,
  action,
  className,
  children,
}) {
  return (
    <section className="flex flex-col gap-3">
      {title || description || action ? (
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            {title ? (
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div
        className={cn(
          'flex flex-col divide-y divide-border rounded-xl border bg-card text-card-foreground shadow-xs',
          className
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function SettingsBlock({ className, ...props }) {
  return (
    <div className={cn('flex flex-col gap-5 p-5', className)} {...props} />
  );
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  className,
  children,
}) {
  return (
    <Field
      orientation="horizontal"
      className={cn(
        'items-center justify-between gap-6 p-5 has-[>[data-slot=field-content]]:items-center',
        className
      )}
    >
      <FieldContent className="min-w-0">
        <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </FieldContent>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </Field>
  );
}
