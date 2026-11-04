import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const stop = event => event.stopPropagation();

// The "…" more menu of table rows (placement "row") and drawer footers
// (placement "footer"). Rules for its items:
// - Every item has an icon (radio items in a submenu use their check mark).
// - Labels use Title Case and start with a verb ("Mark as Sent").
// - Order: open/edit actions, other actions, then destructive actions,
//   with a separator between groups.
// The menu is as wide as its longest label, so labels never wrap.
// Clicks do not bubble up to the row (React events cross the portal).
export default function ActionsMenu({ label, placement = 'row', children }) {
  const footer = placement === 'footer';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant={footer ? 'outline' : 'ghost'}
            size={footer ? 'icon' : 'icon-sm'}
            className={footer ? 'me-auto' : undefined}
            aria-label={label}
            onClick={stop}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={footer ? 'start' : 'end'}
        side={footer ? 'top' : 'bottom'}
        className="w-max min-w-44"
        onClick={stop}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
