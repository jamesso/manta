export function nextTheme(current) {
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  if (current === 'dark') return 'system';
  return 'light';
}
