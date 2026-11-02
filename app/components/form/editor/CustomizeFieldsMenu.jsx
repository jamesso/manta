import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { isEqual } from 'lodash';
import { SlidersHorizontal } from 'lucide-react';
import {
  toggleField,
  toggleFormSettings,
  updateSavedFormSettings,
} from '../../../actions/form';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
export default function CustomizeFieldsMenu() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { settings, savedSettings } = useSelector(state => state.form);
  return (
    <DropdownMenu
      open={settings.open}
      onOpenChange={open => {
        if (open !== settings.open) dispatch(toggleFormSettings());
      }}
    >
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <SlidersHorizontal />
        {t('form:customize:name')}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {['dueDate', 'currency', 'discount', 'tax', 'note'].map(name => (
          <DropdownMenuCheckboxItem
            key={name}
            checked={Boolean(settings.required_fields[name])}
            closeOnClick={false}
            onCheckedChange={() => dispatch(toggleField(name))}
          >
            {t(
              name === 'currency' || name === 'note'
                ? `form:fields:${name}`
                : `form:fields:${name}:name`
            )}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isEqual(
            settings.required_fields,
            savedSettings.required_fields
          )}
          onClick={() =>
            dispatch(
              updateSavedFormSettings(
                'required_fields',
                settings.required_fields
              )
            )
          }
        >
          {t('form:customize:saveAsDefault')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
