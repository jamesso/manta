import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import ActionsMenu from '../shared/ActionsMenu';
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDetail,
  SheetDetails,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle,
  useSheetValue,
} from '@/components/ui/sheet';
import { formatNumber } from '../../../helpers/formatNumber';
import * as ItemsActions from '../../actions/items';
import { getUnitCode, isKnownUnit, withArchived } from '../../helpers/items';
import { getTaxRates } from '../../helpers/tax';

export default function ItemDetailSheet({
  item: openItem,
  open,
  onOpenChange,
  onEdit,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const invoiceSettings = useSelector(
    state => state.settings.saved?.invoice ?? {}
  );
  const item = useSheetValue(open, openItem);

  // Stay mounted while closed so the sheet slides in when it opens.
  if (!item) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const currency = invoiceSettings.currency ?? {};
  const unitCode = getUnitCode(item.unitCode);
  const unitLabel = isKnownUnit(unitCode)
    ? t(`items:units:${unitCode}`)
    : unitCode;
  const taxRate = item.taxRateId
    ? getTaxRates(invoiceSettings).find(r => r.id === item.taxRateId)
    : null;
  // Items stored by an older import can have no price.
  const price = Number.isFinite(item.unitPrice)
    ? formatNumber(
        item.unitPrice,
        currency.fraction ?? 2,
        currency.separator ?? 'commaDot'
      )
    : '—';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{item.name}</SheetTitle>
            {item.archived ? (
              <Badge variant="secondary">{t('items:views:archived')}</Badge>
            ) : null}
          </div>
        </SheetHeader>
        <SheetBody>
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="text-sm text-muted-foreground">
              {t('items:dialog:unitPrice')}
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {price}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {t('items:dialog:priceHint')}
            </div>
          </div>
          <SheetSection>
            <SheetDetails>
              <SheetDetail label={t('items:dialog:unit')}>
                {unitLabel}
              </SheetDetail>
              <SheetDetail label={t('items:dialog:taxRate')}>
                {taxRate
                  ? `${taxRate.name}${
                      taxRate.active === false
                        ? ` (${t('settings:taxRates:inactive')})`
                        : ''
                    }`
                  : t('items:dialog:defaultTaxRate')}
              </SheetDetail>
            </SheetDetails>
          </SheetSection>
          <SheetSection title={t('items:dialog:description')}>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {item.description || t('items:detail:noDescription')}
            </p>
          </SheetSection>
        </SheetBody>
        <SheetFooter>
          <ActionsMenu
            placement="footer"
            label={t('items:actions:open', { name: item.name })}
          >
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
          <SheetClose render={<Button type="button" variant="ghost" />}>
            {t('common:close')}
          </SheetClose>
          <Button type="button" onClick={() => onEdit(item)}>
            {t('items:actions:edit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
