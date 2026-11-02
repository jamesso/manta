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
  const form = useSelector(state => state.form);
  const allDocs = useSelector(state => state.invoices);
  const { settings, errors, savePending, docType, sourceEstimateId } = form;
  const isEstimate = docType === 'estimate';
  const editActive = settings.editMode.active;
  let heading = t(isEstimate ? 'form:header:newEstimate' : 'form:header:new');
  if (editActive) {
    heading = t(isEstimate ? 'form:header:editEstimate' : 'form:header:edit');
  }
  const sourceEstimate =
    !isEstimate && sourceEstimateId
      ? allDocs.find(d => d._id === sourceEstimateId)
      : null;
  return (
    <div className="@container flex h-full min-h-0 flex-col text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h1 className="text-xl font-semibold">{heading}</h1>
          {sourceEstimate ? (
            <p className="text-sm text-muted-foreground">
              {t('form:convertedFrom', {
                number:
                  sourceEstimate.invoiceID ||
                  String(sourceEstimate._id).slice(0, 8),
              })}
            </p>
          ) : null}
        </div>
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
