import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateItem } from '../../../actions/form';
import { applyTaxRate, getActiveTaxRates, getTaxRates } from '../../../helpers/tax';

export default function TaxRateSelect({ row, index }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const invoiceSettings = useSelector(
    state => state.settings.saved?.invoice ?? state.form.savedSettings
  );
  const rates = getTaxRates(invoiceSettings);
  const active = getActiveTaxRates(rates);
  const options = [...active];
  if (
    row.taxRateId &&
    !options.some(r => r.id === row.taxRateId)
  ) {
    options.push({
      id: row.taxRateId,
      name: `${row.taxRate ?? 0}%`,
      rate: row.taxRate ?? 0,
      category: row.taxCategory ?? 'S',
      active: false,
    });
  }

  const value = row.taxRateId ?? '';

  return (
    <Select
      value={value}
      onValueChange={id => {
        const rate = rates.find(r => r.id === id) ?? active.find(r => r.id === id);
        dispatch(updateItem(applyTaxRate(row, rate ?? null)));
      }}
    >
      <SelectTrigger
        className="w-full bg-background text-foreground"
        aria-label={t('form:fields:tax:rateRow', { number: index + 1 })}
      >
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent className="bg-popover text-popover-foreground">
        {options.map(rate => (
          <SelectItem key={rate.id} value={rate.id}>
            {rate.name}
            {rate.active === false ? ` (${t('settings:taxRates:inactive')})` : ''}
            {rate.category === 'S' ? ` · ${rate.rate}%` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
