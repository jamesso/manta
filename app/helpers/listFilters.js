// Shared logic for the filter bar on list pages.

export function toggleValue(values, value) {
  return values.includes(value)
    ? values.filter(v => v !== value)
    : [...values, value];
}

// An empty selection means "no filter".
export function matchesAny(selected, test) {
  return selected.length === 0 || selected.some(test);
}

// Distinct non-empty values with counts, most common first.
// Selected values stay in the list (count 0) so the user can clear them.
export function facetOptions(rows, getValue, selected = []) {
  const counts = new Map(selected.map(value => [value, 0]));
  for (const row of rows) {
    const value = getValue(row);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );
}
