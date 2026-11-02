import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { clearForm } from '../../../actions/form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import ClientField from './ClientField';
import DetailsCard from './DetailsCard';
import LineItems from './LineItems';
import AdjustmentsCard from './AdjustmentsCard';
import NotesCard from './NotesCard';
import CustomizeFieldsMenu from './CustomizeFieldsMenu';
import TotalsFooter from './TotalsFooter';
import LivePreview from './LivePreview';
export default function EditorLayout() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { settings, errors, savePending } = useSelector(state => state.form);
  return (
    <div className="@container flex h-full min-h-0 flex-col text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h1 className="text-xl font-semibold">
          {t(settings.editMode.active ? 'form:header:edit' : 'form:header:new')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <CustomizeFieldsMenu />
          <Button
            variant="ghost"
            disabled={savePending}
            onClick={() => dispatch(clearForm())}
          >
            {t('form:header:btns:clear')}
          </Button>
          <Sheet>
            <SheetTrigger
              render={<Button variant="outline" className="@5xl:hidden" />}
            >
              <Eye />
              {t('form:preview:toggle')}
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full overflow-y-auto bg-background text-foreground sm:max-w-xl"
            >
              <SheetHeader>
                <SheetTitle>{t('form:preview:toggle')}</SheetTitle>
              </SheetHeader>
              <LivePreview />
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 @5xl:grid-cols-[minmax(28rem,1fr)_minmax(24rem,1fr)]">
        <div className="space-y-4 overflow-y-auto p-4">
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              {t(errors.draftEmpty || 'form:errors:summary')}
            </p>
          )}
          <ClientField />
          <DetailsCard />
          <LineItems />
          {(settings.required_fields.discount ||
            settings.required_fields.tax) && <AdjustmentsCard />}
          {settings.required_fields.note && <NotesCard />}
        </div>
        <div className="hidden overflow-y-auto bg-muted @5xl:block">
          <LivePreview />
        </div>
      </div>
      <TotalsFooter />
    </div>
  );
}
