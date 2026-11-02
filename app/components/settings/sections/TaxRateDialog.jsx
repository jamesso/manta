import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_EXEMPTION_REASONS,
  EXEMPTION_REQUIRED,
  TAX_CATEGORIES,
  getTaxRateErrors,
} from '../../../helpers/tax';

export default function TaxRateDialog({ open, onOpenChange, rate, onSave }) {
  const { t } = useTranslation();
  const formId = useId();
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) {
      return;
    }
    setErrors({});
    if (rate) {
      setDraft({ ...rate });
    } else {
      setDraft({
        id: crypto.randomUUID(),
        name: '',
        rate: 19,
        category: 'S',
        isDefault: false,
        exemptionReason: '',
        active: true,
      });
    }
  }, [open, rate]);

  if (!draft) {
    return null;
  }

  const setCategory = category => {
    setDraft(prev => {
      const next = {
        ...prev,
        category,
        rate: category === 'S' ? prev.rate || 19 : 0,
      };
      if (
        EXEMPTION_REQUIRED.includes(category) &&
        !String(next.exemptionReason).trim()
      ) {
        next.exemptionReason = DEFAULT_EXEMPTION_REASONS[category] ?? '';
      }
      return next;
    });
  };

  const onSubmit = event => {
    event.preventDefault();
    const nextErrors = getTaxRateErrors(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }
    onSave({
      ...draft,
      name: String(draft.name).trim(),
      exemptionReason: String(draft.exemptionReason ?? '').trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {rate ? t('settings:taxRates:edit') : t('settings:taxRates:add')}
          </DialogTitle>
        </DialogHeader>
        <form id={formId} className="space-y-4" onSubmit={onSubmit}>
          <Field>
            <FieldLabel>{t('settings:taxRates:name')}</FieldLabel>
            <Input
              value={draft.name}
              aria-invalid={Boolean(errors.name)}
              onChange={e =>
                setDraft(prev => ({ ...prev, name: e.target.value }))
              }
            />
            {errors.name ? <FieldError>{t(errors.name)}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel>{t('settings:taxRates:category')}</FieldLabel>
            <Select value={draft.category} onValueChange={setCategory}>
              <SelectTrigger className="bg-background text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground">
                {TAX_CATEGORIES.map(code => (
                  <SelectItem key={code} value={code}>
                    {code} — {t(`settings:taxRates:categories:${code}:label`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {t(`settings:taxRates:categories:${draft.category}:help`)}
            </p>
          </Field>
          <Field>
            <FieldLabel>{t('settings:taxRates:rate')}</FieldLabel>
            <Input
              type="number"
              step="0.01"
              disabled={draft.category !== 'S'}
              value={draft.category === 'S' ? draft.rate : 0}
              aria-invalid={Boolean(errors.rate)}
              onChange={e =>
                setDraft(prev => ({
                  ...prev,
                  rate: Number(e.target.value),
                }))
              }
            />
            {errors.rate ? <FieldError>{t(errors.rate)}</FieldError> : null}
          </Field>
          {EXEMPTION_REQUIRED.includes(draft.category) ? (
            <Field>
              <FieldLabel>{t('settings:taxRates:reason')}</FieldLabel>
              <Textarea
                value={draft.exemptionReason ?? ''}
                aria-invalid={Boolean(errors.exemptionReason)}
                onChange={e =>
                  setDraft(prev => ({
                    ...prev,
                    exemptionReason: e.target.value,
                  }))
                }
              />
              {errors.exemptionReason ? (
                <FieldError>{t(errors.exemptionReason)}</FieldError>
              ) : null}
            </Field>
          ) : null}
          <Field className="flex flex-row items-center justify-between gap-4">
            <FieldLabel htmlFor="tax-rate-default">
              {t('settings:taxRates:default')}
            </FieldLabel>
            <Switch
              id="tax-rate-default"
              checked={Boolean(draft.isDefault)}
              onCheckedChange={checked =>
                setDraft(prev => ({ ...prev, isDefault: checked }))
              }
            />
          </Field>
        </form>
        <DialogFooter>
          <Button type="submit" form={formId}>
            {t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
