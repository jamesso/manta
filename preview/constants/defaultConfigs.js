export function getDefaultPreviewConfigs(invoiceSettings, generalSettings) {
  return {
    dateFormat: invoiceSettings.dateFormat,
    language: generalSettings.language,
    template: invoiceSettings.template,
    accentColor: '#2CCCE4',
    logoSize: '20',
    fontSize: '200',
    alignItems: 'middle',
    showLogo: true,
    useSymbol: true,
    customAccentColor: true,
    showRecipient: true,
  };
}
