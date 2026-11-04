// "Label: value" with the colon style of the PDF language
// (for example "Date d’émission : …" in French, "创建日期：…" in Chinese).
export function labelled(t, lng, key, value) {
  return t('preview:common:labelled', { lng, label: t(key, { lng }), value });
}
