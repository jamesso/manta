import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as ItemsActions from '../../actions/items';
import { withArchived } from '../../helpers/items';

export default function ItemRowActions({ item, onEdit }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('items:actions:open', { name: item.name })}
            onClick={event => event.stopPropagation()}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={event => {
            event.stopPropagation();
            onEdit(item);
          }}
        >
          <Pencil className="size-4" />
          {t('items:actions:edit')}
        </DropdownMenuItem>
        {item.archived ? (
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              dispatch(
                ItemsActions.updateItem(
                  withArchived(item, false),
                  'messages:item:unarchived'
                )
              );
            }}
          >
            <ArchiveRestore className="size-4" />
            {t('items:actions:unarchive')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={event => {
              event.stopPropagation();
              dispatch(
                ItemsActions.updateItem(
                  withArchived(item, true),
                  'messages:item:archived'
                )
              );
            }}
          >
            <Archive className="size-4" />
            {t('items:actions:archive')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={event => {
            event.stopPropagation();
            dispatch(ItemsActions.deleteItem(item._id));
          }}
        >
          <Trash2 className="size-4" />
          {t('items:actions:delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
