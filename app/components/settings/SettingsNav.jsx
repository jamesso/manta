import {
  Building2,
  FileText,
  Globe,
  HardDriveDownload,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  Volume2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from 'cn';

const ITEMS = [
  { id: 'profile', icon: Building2, labelKey: 'settings:nav:profile' },
  { id: 'invoice', icon: FileText, labelKey: 'settings:nav:invoice' },
  { id: 'appearance', icon: Palette, labelKey: 'settings:nav:appearance' },
  { id: 'language', icon: Globe, labelKey: 'settings:nav:language' },
  { id: 'export', icon: HardDriveDownload, labelKey: 'settings:nav:export' },
  { id: 'updates', icon: RefreshCw, labelKey: 'settings:nav:updates' },
  { id: 'sounds', icon: Volume2, labelKey: 'settings:nav:sounds' },
];

export default function SettingsNav({ active, onChange }) {
  const { t } = useTranslation();

  return (
    <>
      <nav className="hidden flex-col gap-1 md:flex">
        {ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-start text-sm',
                isActive
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
              onClick={() => onChange(item.id)}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>
      <div className="md:hidden">
        <Select value={active} onValueChange={onChange}>
          <SelectTrigger className="w-full bg-background text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ITEMS.map(item => (
              <SelectItem key={item.id} value={item.id}>
                {t(item.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

export { Monitor, Sun, Moon };
