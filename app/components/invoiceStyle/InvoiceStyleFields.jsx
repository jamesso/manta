import React from 'react';
import Template from './Template';
import Language from './Language';
import DateFormat from './DateFormat';
import Alignment from './Alignment';
import FontSize from './FontSize';
import LogoSize from './LogoSize';
import Toggler from './Toggler';
import AccentColor from './AccentColor';

// Style controls for the printed document. Settings shows only the style
// part; the preview drawer also shows template, language and date format.
export default function InvoiceStyleFields({
  t,
  UILang,
  configs,
  update,
  documentFields = false,
}) {
  const props = { t, UILang, update };
  return (
    <div className="flex flex-col gap-6">
      {documentFields ? (
        <>
          <Template {...props} template={configs.template} />
          <Language {...props} language={configs.language} />
          <DateFormat
            {...props}
            language={configs.language}
            dateFormat={configs.dateFormat}
          />
        </>
      ) : null}
      <Alignment {...props} alignItems={configs.alignItems} />
      <FontSize {...props} fontSize={configs.fontSize} />
      {configs.showLogo ? (
        <LogoSize {...props} logoSize={configs.logoSize} />
      ) : null}
      <Toggler {...props} configs={configs} />
      {configs.customAccentColor ? (
        <AccentColor {...props} accentColor={configs.accentColor} />
      ) : null}
    </div>
  );
}
