import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ActionsMenu from '../shared/ActionsMenu';
import * as ItemsActions from '../../actions/items';
import { withArchived } from '../../helpers/items';

export default function ItemRowActions({ item, onEdit }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  return (
    <ActionsMenu label={t('items:actions:open', { name: item.name })}>
      <DropdownMenuItem onClick={() => onEdit(item)}>
        <Pencil />
        {t('items:actions:edit')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() =>
          dispatch(
            ItemsActions.updateItem(
              withArchived(item, !item.archived),
              item.archived
                ? 'messages:item:unarchived'
                : 'messages:item:archived'
            )
          )
        }
      >
        {item.archived ? <ArchiveRestore /> : <Archive />}
        {item.archived
          ? t('items:actions:unarchive')
          : t('items:actions:archive')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => dispatch(ItemsActions.deleteItem(item._id))}
      >
        <Trash2 />
        {t('items:actions:delete')}
      </DropdownMenuItem>
    </ActionsMenu>
  );
}
