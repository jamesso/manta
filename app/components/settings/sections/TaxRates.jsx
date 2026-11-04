import { createColumnHelper, useTable } from '@tanstack/react-table';
import { Pencil, Plus, Power, PowerOff, Star, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getActiveTaxRates, getTaxRates } from '../../../helpers/tax';
import { getItems } from '../../../reducers/ItemsReducer';
import ActionsMenu from '../../shared/ActionsMenu';
import TaxRateDialog from './TaxRateDialog';
import { SettingsBlock, SettingsGroup } from '../SettingsLayout';

const columnHelper = createColumnHelper();

export default function TaxRates({ value, onChange }) {
  const { t } = useTranslation();
  const items = useSelector(getItems);
  const rates = getTaxRates({ taxRates: value, tax: {} });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRate, setEditRate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [usedCount, setUsedCount] = useState(0);

  const activeCount = getActiveTaxRates(rates).length;

  const upsertList = useCallback(
    nextRate => {
      let list = rates.map(r => ({ ...r }));
      const idx = list.findIndex(r => r.id === nextRate.id);
      if (idx === -1) {
        list = [...list, nextRate];
      } else {
        list[idx] = nextRate;
      }
      if (nextRate.isDefault) {
        list = list.map(r => ({
          ...r,
          isDefault: r.id === nextRate.id,
        }));
      }
      onChange(list);
    },
    [rates, onChange]
  );

  const setDefault = useCallback(
    id => {
      onChange(
        rates.map(r => ({
          ...r,
          isDefault: r.id === id,
        }))
      );
    },
    [rates, onChange]
  );

  const toggleInactive = useCallback(
    id => {
      onChange(
        rates.map(r =>
          r.id === id ? { ...r, active: r.active === false ? true : false } : r
        )
      );
    },
    [rates, onChange]
  );

  const removeRate = useCallback(
    id => {
      onChange(rates.filter(r => r.id !== id));
    },
    [rates, onChange]
  );

  const tryDelete = useCallback(
    rate => {
      const count = items.filter(it => it.taxRateId === rate.id).length;
      if (count > 0) {
        setUsedCount(count);
        setDeleteTarget(rate);
        return;
      }
      removeRate(rate.id);
    },
    [items, removeRate]
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: t('settings:taxRates:name'),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <span>{row.original.name}</span>
            {row.original.isDefault ? (
              <Badge variant="secondary">
                {t('settings:taxRates:default')}
              </Badge>
            ) : null}
            {row.original.active === false ? (
              <Badge variant="outline">{t('settings:taxRates:inactive')}</Badge>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor('rate', {
        header: t('settings:taxRates:rate'),
        cell: ({ row }) =>
          row.original.category === 'S' ? `${row.original.rate}%` : '0%',
      }),
      columnHelper.accessor('category', {
        header: t('settings:taxRates:category'),
        cell: ({ getValue }) => getValue(),
      }),
      columnHelper.display({
        id: 'actions',
        cell: ({ row }) => {
          const rate = row.original;
          const isOnlyActive = rate.active !== false && activeCount <= 1;
          const disableDelete =
            rate.isDefault || (rate.active !== false && activeCount <= 1);
          return (
            <ActionsMenu
              label={t('settings:taxRates:actionsFor', { name: rate.name })}
            >
              <DropdownMenuItem
                onClick={() => {
                  setEditRate(rate);
                  setDialogOpen(true);
                }}
              >
                <Pencil />
                {t('common:edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={rate.isDefault}
                onClick={() => setDefault(rate.id)}
              >
                <Star />
                {t('settings:taxRates:setDefault')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isOnlyActive || rate.isDefault}
                onClick={() => toggleInactive(rate.id)}
              >
                {rate.active === false ? <Power /> : <PowerOff />}
                {rate.active === false
                  ? t('settings:taxRates:reactivate')
                  : t('settings:taxRates:markInactive')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={disableDelete}
                onClick={() => tryDelete(rate)}
              >
                <Trash2 />
                {t('settings:taxRates:delete')}
              </DropdownMenuItem>
            </ActionsMenu>
          );
        },
      }),
    ],
    [t, activeCount, setDefault, toggleInactive, tryDelete]
  );

  const table = useTable({ data: rates, columns });

  return (
    <>
      <SettingsGroup
        title={t('settings:taxRates:title')}
        description={t('settings:taxRates:hintSnapshot')}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditRate(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            {t('settings:taxRates:add')}
          </Button>
        }
      >
        <div className="px-2 pt-1">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id}>
                  {hg.headers.map(header => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : typeof header.column.columnDef.header === 'function'
                          ? header.column.columnDef.header(header.getContext())
                          : header.column.columnDef.header}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getAllCells().map(cell => (
                    <TableCell key={cell.id}>
                      {typeof cell.column.columnDef.cell === 'function'
                        ? cell.column.columnDef.cell(cell.getContext())
                        : cell.getValue()}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <SettingsBlock>
          <p className="text-sm text-muted-foreground">
            {t('settings:taxRates:hintAdvisor')}
          </p>
        </SettingsBlock>
      </SettingsGroup>
      <TaxRateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rate={editRate}
        onSave={upsertList}
      />
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings:taxRates:delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings:taxRates:usedBy', { count: usedCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  toggleInactive(deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
            >
              {t('settings:taxRates:markInactive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
